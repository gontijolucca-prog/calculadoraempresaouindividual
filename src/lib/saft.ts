import type { ClientProfile, ContabilidadeData } from '../ClientProfile';
import type { PreviSaState } from '../previSaState';
import { repairMojibake } from './mojibake';

export interface SAFTDetail {
  label: string;
  value: string;
  group: string;
}

export interface SAFTParseResult {
  profile: Partial<ClientProfile>;
  previsa: Partial<PreviSaState>;
  /** Dados do Balanço/contabilidade extraídos das contas (classes 1–5/8), para
   *  preencher os documentos. Vazio quando o SAF-T não traz saldos do plano. */
  contabilidade?: Partial<ContabilidadeData>;
  /** Saldos de ABERTURA das mesmas rubricas (= posição de fecho do ano anterior),
   *  para preencher a coluna do ano anterior do Balanço e a posição inicial da
   *  Demonstração das Alterações no Capital Próprio. */
  contabilidadeAbertura?: Partial<ContabilidadeData>;
  warnings: string[];
  filled: string[];
  empty: string[];
  details: SAFTDetail[];
}

// ════════════════════════════════════════════════════════════════════════════
// Helpers — namespace-agnostic (matches by localName, ignoring xmlns prefix)
// ════════════════════════════════════════════════════════════════════════════

function localChildren(parent: Element, name: string): Element[] {
  const out: Element[] = [];
  const kids = parent.children;
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    if (k.localName === name) out.push(k);
  }
  return out;
}

function localChild(parent: Element, name: string): Element | null {
  const kids = parent.children;
  for (let i = 0; i < kids.length; i++) {
    if (kids[i].localName === name) return kids[i];
  }
  return null;
}

function localDescendants(root: Element | Document, name: string): Element[] {
  const out: Element[] = [];
  const walk = (n: Element) => {
    if (n.localName === name) out.push(n);
    const c = n.children;
    for (let i = 0; i < c.length; i++) walk(c[i]);
  };
  const rootEl = (root as Document).documentElement ?? (root as Element);
  if (rootEl) walk(rootEl);
  return out;
}

function text(parent: Element | null, name: string): string {
  if (!parent) return '';
  const c = localChild(parent, name);
  // Repara mojibake (ex.: SAF-T gravado em UTF-8 mas com texto duplamente
  // codificado → "AtlÃ¢ntico"). Idempotente: texto correcto fica intacto.
  return repairMojibake(c?.textContent?.trim() ?? '');
}

function num(parent: Element | null, name: string): number {
  const t = text(parent, name);
  if (!t) return 0;
  const v = parseFloat(t.replace(',', '.'));
  return Number.isFinite(v) ? v : 0;
}

// Parse de um montante SAF-T já extraído como string. SAF-T PT é dot-decimal por
// norma, mas alguns exportadores escrevem vírgula — espelha o num() acima para os
// totais que vêm como string (antes usavam parseFloat cru e truncavam decimais).
const numStr = (s: string | null | undefined): number => {
  const v = parseFloat(String(s ?? '').replace(',', '.'));
  return Number.isFinite(v) ? v : 0;
};

function fmtEur(n: number): string {
  return n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function fmtNum(n: number): string {
  return n.toLocaleString('pt-PT', { maximumFractionDigits: 0 });
}

// ════════════════════════════════════════════════════════════════════════════
// Account aggregation — collapse leaves into class-level totals
// ════════════════════════════════════════════════════════════════════════════

interface GLAccount {
  id: string;
  desc: string;
  openDebit: number;
  openCredit: number;
  closeDebit: number;
  closeCredit: number;
  totalDebit: number;   // period movement (from GeneralLedgerEntries) — optional
  totalCredit: number;
}

/** Returns the net balance as a signed number; positive = credit side. */
function netCredit(a: GLAccount): number {
  return (a.closeCredit - a.closeDebit);
}

/** Returns absolute period turnover from movement, falling back to closing-opening. */
function periodTurnover(a: GLAccount, side: 'debit' | 'credit'): number {
  if (a.totalDebit > 0 || a.totalCredit > 0) {
    return side === 'debit' ? a.totalDebit : a.totalCredit;
  }
  // Fallback: closing - opening
  if (side === 'debit') return Math.max(0, a.closeDebit - a.openDebit);
  return Math.max(0, a.closeCredit - a.openCredit);
}

function valueOnSide(a: GLAccount, side: 'debit' | 'credit'): number {
  const net = Math.abs(netCredit(a));
  if (net > 0) {
    // Use net balance — its sign tells us the natural side
    if (side === 'credit' && netCredit(a) >= 0) return net;
    if (side === 'debit'  && netCredit(a) <  0) return net;
    // If asking for the "wrong" side, prefer raw closing balance on that side
  }
  return side === 'debit' ? a.closeDebit : a.closeCredit;
}

/**
 * Sum the closing balance of accounts under a given prefix. In SNC the parent account
 * already aggregates its children's balances, so we prefer the most-aggregate match.
 * Strategy:
 *  1. If an exact prefix match exists, use it (it's the canonical aggregate).
 *  2. Else sum the shortest-depth descendants (siblings at the same level).
 */
function sumLeaves(accounts: GLAccount[], prefix: string, side: 'debit' | 'credit'): number {
  const matching = accounts.filter(a => a.id.startsWith(prefix));
  if (matching.length === 0) return 0;

  // Exact-match parent — trust it as the aggregate
  const exact = matching.find(a => a.id === prefix);
  if (exact) return valueOnSide(exact, side);

  // No parent — sum the shortest-depth descendants only (avoid double-counting deeper levels)
  let minLen = Infinity;
  for (const a of matching) if (a.id.length < minLen) minLen = a.id.length;
  return matching
    .filter(a => a.id.length === minLen)
    .reduce((sum, a) => sum + valueOnSide(a, side), 0);
}

/** Recolhe o movimento (débito/crédito) por conta a partir dos diários da
 *  GeneralLedgerEntries. SAF-T-PT usa <DebitLine>/<CreditLine> dentro de <Lines>;
 *  variantes antigas usam <Line> com DebitAmount/CreditAmount. Usado quando o
 *  ficheiro só traz o plano de contas + lançamentos (sem saldos) — ex. SAF-T de
 *  contabilidade — para conseguir mesmo assim apurar rendimentos/gastos. */
function collectGLMovement(glEntriesEl: Element | null): Map<string, { d: number; c: number }> {
  const mov = new Map<string, { d: number; c: number }>();
  if (!glEntriesEl) return mov;
  const add = (accId: string, d: number, c: number) => {
    if (!accId) return;
    const m = mov.get(accId) ?? { d: 0, c: 0 };
    m.d += d; m.c += c; mov.set(accId, m);
  };
  for (const j of localDescendants(glEntriesEl, 'Journal'))
    for (const t of localDescendants(j, 'Transaction')) {
      for (const dl of localDescendants(t, 'DebitLine'))  add(text(dl, 'AccountID'), num(dl, 'DebitAmount'), 0);
      for (const cl of localDescendants(t, 'CreditLine')) add(text(cl, 'AccountID'), 0, num(cl, 'CreditAmount'));
      for (const ln of localDescendants(t, 'Line'))       add(text(ln, 'AccountID'), num(ln, 'DebitAmount'), num(ln, 'CreditAmount'));
    }
  return mov;
}

/** Soma o movimento BRUTO das contas cujo id começa por `prefix`, no lado pedido
 *  (créditos para rendimentos/classe 7, débitos para gastos/classe 6). Usa-se o
 *  lado natural — e não o líquido — de propósito: os lançamentos de apuramento de
 *  fim de exercício (que fecham as contas de resultados, classe 6/7 → 81) postam
 *  no lado oposto e zerariam o líquido. O lado natural dá o total do período. */
function sumMovByPrefix(mov: Map<string, { d: number; c: number }>, prefix: string, side: 'debit' | 'credit'): number {
  let s = 0;
  for (const [id, m] of mov) if (id.startsWith(prefix)) s += side === 'credit' ? m.c : m.d;
  return Math.round(s * 100) / 100;
}

/** Fluxos de caixa pelo MÉTODO DIRECTO, derivados dos diários: cada transação
 *  que mexe na caixa (contas 11/12/13) é classificada pela contrapartida
 *  dominante (a conta não-caixa com maior montante no lançamento). Cobre os
 *  formatos com DebitLine/CreditLine e com Line. Transferências caixa↔caixa
 *  anulam-se (delta ≈ 0) e são ignoradas. Devolve undefined sem movimentos. */
function extractFluxosDirectos(glEntriesEl: Element | null): (Partial<ContabilidadeData> & { movimentos: number }) | undefined {
  if (!glEntriesEl) return undefined;
  const isCaixa = (id: string) => /^1[123]/.test(id);
  const f = {
    recebClientes: 0, pagFornecedores: 0, pagPessoal: 0, imposto: 0, outrosOp: 0,
    pagInvest: 0, recebInvest: 0, finObtidos: 0, pagFin: 0, realizCapital: 0,
  };
  let movimentos = 0;
  for (const j of localDescendants(glEntriesEl, 'Journal')) {
    for (const t of localDescendants(j, 'Transaction')) {
      const lines: { acc: string; d: number; c: number }[] = [];
      for (const dl of localDescendants(t, 'DebitLine'))  lines.push({ acc: text(dl, 'AccountID'), d: num(dl, 'DebitAmount'), c: 0 });
      for (const cl of localDescendants(t, 'CreditLine')) lines.push({ acc: text(cl, 'AccountID'), d: 0, c: num(cl, 'CreditAmount') });
      for (const ln of localDescendants(t, 'Line'))       lines.push({ acc: text(ln, 'AccountID'), d: num(ln, 'DebitAmount'), c: num(ln, 'CreditAmount') });
      let delta = 0;
      const contras: { acc: string; amt: number }[] = [];
      for (const l of lines) {
        if (!l.acc) continue;
        if (isCaixa(l.acc)) delta += l.d - l.c;
        else contras.push({ acc: l.acc, amt: l.d + l.c });
      }
      if (Math.abs(delta) < 0.005 || contras.length === 0) continue;
      // Contrapartida dominante decide a rubrica do fluxo.
      contras.sort((a, b) => b.amt - a.amt);
      const acc = contras[0].acc;
      const entrada = delta > 0;
      const amt = Math.abs(delta);
      movimentos++;
      if (entrada) {
        if (acc.startsWith('21') || (acc.startsWith('7') && !acc.startsWith('79'))) f.recebClientes += amt;
        else if (acc.startsWith('79'))                              f.recebInvest += amt;   // juros obtidos
        else if (acc.startsWith('241'))                             f.imposto -= amt;        // reembolso IRC
        else if (acc.startsWith('24'))                              f.outrosOp += amt;       // IVA/SS a recuperar
        else if (acc.startsWith('25'))                              f.finObtidos += amt;
        else if (acc.startsWith('26') || acc.startsWith('51') || acc.startsWith('53') || acc.startsWith('54')) f.realizCapital += amt;
        else if (/^4[1-6]/.test(acc))                               f.recebInvest += amt;
        else                                                        f.outrosOp += amt;
      } else {
        if (acc.startsWith('23') || acc.startsWith('63'))           f.pagPessoal += amt;
        // Fornecedores: só 22/compras/FSE. As contas 65 (imparidades) e 68
        // (outros gastos — multas, impostos indiretos) NÃO são pagamentos a
        // fornecedores → caem em "outros operacionais" (default).
        else if (acc.startsWith('22') || /^3[123]/.test(acc) || acc.startsWith('61') || acc.startsWith('62')) f.pagFornecedores += amt;
        else if (acc.startsWith('241'))                             f.imposto += amt;        // IRC pago
        else if (acc.startsWith('24'))                              f.outrosOp -= amt;       // IVA/SS pagos
        else if (acc.startsWith('25') || acc.startsWith('26') || acc.startsWith('69')) f.pagFin += amt;
        else if (/^4[1-6]/.test(acc))                               f.pagInvest += amt;
        else                                                        f.outrosOp -= amt;
      }
    }
  }
  if (movimentos === 0) return undefined;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const all = [f.recebClientes, f.pagFornecedores, f.pagPessoal, f.imposto, f.outrosOp, f.pagInvest, f.recebInvest, f.finObtidos, f.pagFin, f.realizCapital];
  if (all.every(v => Math.abs(v) < 0.005)) return undefined;
  return {
    movimentos,
    fcRecebimentosClientes:    r2(f.recebClientes),
    fcPagamentosFornecedores:  r2(f.pagFornecedores),
    fcPagamentosPessoal:       r2(f.pagPessoal),
    fcImpostoRendimento:       r2(f.imposto),
    fcOutrosOperacionais:      r2(f.outrosOp),
    fcPagamentosInvestimento:  r2(f.pagInvest),
    fcRecebimentosInvestimento: r2(f.recebInvest),
    fcFinanciamentosObtidos:   r2(f.finObtidos),
    fcPagamentosFinanciamento: r2(f.pagFin),
    fcRealizacoesCapital:      r2(f.realizCapital),
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Descodificação (encoding) dos bytes do ficheiro
// ════════════════════════════════════════════════════════════════════════════

function countReplacement(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 0xfffd) n++;
  return n;
}

/**
 * Descodifica os bytes de um ficheiro SAF-T respeitando o encoding declarado no
 * prólogo XML, em vez de assumir um charset fixo.
 *
 * Porquê: os SAF-T-PT antigos (exportações da AT) vinham em Windows-1252; os
 * recentes vêm em UTF-8. Ler UTF-8 como Windows-1252 — ou o contrário — corrompe
 * os acentos (ex.: "Atlântico" vira "AtlÃ¢ntico"). Aqui detectamos o encoding,
 * descodificamos com o `TextDecoder` certo, e removemos o BOM se existir. Quando
 * não há declaração fiável, tentamos UTF-8 e caímos para Windows-1252 se a
 * descodificação UTF-8 produzir caracteres de substituição (sinal de mismatch).
 */
export function decodeSaftText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  // BOM UTF-8 → é seguramente UTF-8; salta os 3 bytes do BOM.
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }

  // Lê só o prólogo em latin1 (não corrompe ASCII) para encontrar a declaração:
  // <?xml version="1.0" encoding="..."?>
  const prologue = new TextDecoder('latin1').decode(bytes.subarray(0, 256));
  const declared = (prologue.match(/encoding\s*=\s*["']([^"']+)["']/i)?.[1] || '')
    .toLowerCase()
    .replace(/[\s_]/g, '-');
  const isLatin = ['windows-1252', 'cp1252', 'iso-8859-1', 'iso8859-1', 'latin1', 'latin-1'].includes(declared);
  const label = isLatin ? 'windows-1252' : 'utf-8';

  const primary = new TextDecoder(label).decode(bytes);
  // Se descodificámos como UTF-8 e apareceram caracteres de substituição, o
  // ficheiro é provavelmente Windows-1252 mal declarado — tenta esse decode.
  if (label === 'utf-8' && countReplacement(primary) > 0) {
    const fallback = new TextDecoder('windows-1252').decode(bytes);
    if (countReplacement(fallback) < countReplacement(primary)) return fallback;
  }
  return primary;
}

/**
 * Normaliza a declaração de encoding do prólogo XML para UTF-8. Usa-se ao
 * guardar o SAF-T descodificado: como o texto passa a ser Unicode e será
 * re-exportado como bytes UTF-8 (Blob), a declaração tem de dizer UTF-8 —
 * senão um ficheiro de origem Windows-1252 seria mal lido ao ser reimportado.
 */
export function normalizeXmlEncodingToUtf8(text: string): string {
  const head = text.slice(0, 256);
  if (/<\?xml[^>]*encoding\s*=\s*["'][^"']+["']/i.test(head)) {
    return text.replace(/(<\?xml[^>]*encoding\s*=\s*["'])[^"']+(["'])/i, `$1UTF-8$2`);
  }
  return text;
}

// ════════════════════════════════════════════════════════════════════════════
// Main parser
// ════════════════════════════════════════════════════════════════════════════

export function parseSAFT(xmlText: string): SAFTParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error('Ficheiro XML inválido ou corrompido');

  const root = doc.documentElement;
  if (!root) throw new Error('Documento XML vazio');

  const warnings: string[] = [];
  const filled: string[] = [];
  const details: SAFTDetail[] = [];
  const profile: Partial<ClientProfile> = {};
  const previsa: Partial<PreviSaState> = {};
  let contabilidade: Partial<ContabilidadeData> | undefined;
  let contabilidadeAbertura: Partial<ContabilidadeData> | undefined;
  // Agregações das faturas (preenchidas no bloco SalesInvoices, emitidas depois
  // do parse dos clientes para podermos mostrar nomes) + mapa id/NIF → nome.
  let salesAgg: { porCliente: Map<string, number>; porMes: number[]; ivaPorTaxa: Map<string, { base: number; iva: number }>; ivaLiquidado: number } | null = null;
  const customerNames = new Map<string, string>();

  const headerEl = localChild(root, 'Header');
  if (!headerEl) throw new Error('Elemento <Header> não encontrado — não é um ficheiro SAF-T PT válido');

  // ═════════════════════════════════════════════════════════════════
  // CABEÇALHO
  // ═════════════════════════════════════════════════════════════════
  const auditVersion    = text(headerEl, 'AuditFileVersion');
  const companyID       = text(headerEl, 'CompanyID');
  const taxRegNrRaw     = text(headerEl, 'TaxRegistrationNumber');
  const taxBasis        = text(headerEl, 'TaxAccountingBasis');
  const companyName     = text(headerEl, 'CompanyName');
  const businessName    = text(headerEl, 'BusinessName');
  const fiscalYear      = text(headerEl, 'FiscalYear');
  const startDate       = text(headerEl, 'StartDate');
  const endDate         = text(headerEl, 'EndDate');
  const currencyCode    = text(headerEl, 'CurrencyCode');
  const dateCreated     = text(headerEl, 'DateCreated');
  const taxEntity       = text(headerEl, 'TaxEntity');
  const productCoTaxID  = text(headerEl, 'ProductCompanyTaxID');
  const softwareCertNr  = text(headerEl, 'SoftwareCertificateNumber');
  const productID       = text(headerEl, 'ProductID');
  const productVersion  = text(headerEl, 'ProductVersion');
  const taxonomyRef     = text(headerEl, 'TaxonomyReference');
  const headerComment   = text(headerEl, 'HeaderComment');
  const telephoneHdr    = text(headerEl, 'Telephone');
  const faxHdr          = text(headerEl, 'Fax');
  const emailHdr        = text(headerEl, 'Email');
  const websiteHdr      = text(headerEl, 'Website');

  if (auditVersion)   details.push({ group: 'Cabeçalho', label: 'Versão SAF-T',                value: auditVersion });
  if (companyID)      details.push({ group: 'Cabeçalho', label: 'ID da Empresa',                value: companyID });
  if (taxEntity)      details.push({ group: 'Cabeçalho', label: 'Entidade Fiscal',              value: taxEntity });
  if (dateCreated)    details.push({ group: 'Cabeçalho', label: 'Data de Criação do Ficheiro',  value: dateCreated });
  if (currencyCode)   details.push({ group: 'Cabeçalho', label: 'Moeda',                        value: currencyCode });
  if (productID)      details.push({ group: 'Cabeçalho', label: 'Software',                     value: productID + (productVersion ? ` v${productVersion}` : '') });
  if (productCoTaxID) details.push({ group: 'Cabeçalho', label: 'NIF do Software',              value: productCoTaxID });
  if (softwareCertNr) details.push({ group: 'Cabeçalho', label: 'Certificado Software',         value: softwareCertNr });
  if (taxonomyRef) {
    const taxMap: Record<string, string> = {
      'S': 'SNC — Contabilidade',
      'M': 'Micro-entidades',
      'N': 'Não normalizada',
      'O': 'Outras',
    };
    details.push({ group: 'Cabeçalho', label: 'Referencial Contabilístico', value: taxMap[taxonomyRef] ?? taxonomyRef });
  }
  if (headerComment) details.push({ group: 'Cabeçalho', label: 'Comentário', value: headerComment });

  const taxBasisMap: Record<string, string> = {
    C: 'C — Contabilidade Organizada',
    L: 'L — Contabilidade Organizada (livre)',
    S: 'S — Regime Simplificado',
    F: 'F — Faturação',
    P: 'P — Contabilidade Pública',
    R: 'R — Recibos',
    T: 'T — Autofaturação',
    I: 'I — Dados Integrados',
    E: 'E — Faturação emitida por terceiros',
  };
  if (taxBasis) details.push({ group: 'Cabeçalho', label: 'Tipo de Contabilidade', value: taxBasisMap[taxBasis] ?? taxBasis });

  // ─── Empresa ─────────────────────────────────────────────────────
  const taxRegNr = taxRegNrRaw.replace(/\D/g, '').slice(0, 9);
  if (taxRegNr)    details.push({ group: 'Empresa', label: 'NIF',              value: taxRegNr });
  if (companyName) details.push({ group: 'Empresa', label: 'Nome / Firma',     value: companyName });
  if (businessName && businessName !== companyName)
                   details.push({ group: 'Empresa', label: 'Nome Comercial',   value: businessName });

  const period = fiscalYear ? parseInt(fiscalYear, 10)
    : startDate ? new Date(startDate).getFullYear() : 0;
  if (startDate)   details.push({ group: 'Empresa', label: 'Período Início',   value: startDate });
  if (endDate)     details.push({ group: 'Empresa', label: 'Período Fim',      value: endDate });
  if (fiscalYear)  details.push({ group: 'Empresa', label: 'Ano Fiscal',       value: fiscalYear });

  // Address
  const addrEl = localChild(headerEl, 'CompanyAddress');
  let cpNumeric = 0;
  let regionTxt = '';
  if (addrEl) {
    const buildingNumber  = text(addrEl, 'BuildingNumber');
    const streetName      = text(addrEl, 'StreetName');
    const addressDetail   = text(addrEl, 'AddressDetail');
    const city            = text(addrEl, 'City');
    const postalCode      = text(addrEl, 'PostalCode');
    regionTxt             = text(addrEl, 'Region');
    const country         = text(addrEl, 'Country');

    // Prefer streetName + buildingNumber, fall back to addressDetail; combine when both
    // forms carry info (e.g., streetName empty but addressDetail has the full street).
    const streetPart = [streetName, buildingNumber].filter(Boolean).join(' ');
    // AddressDetail often already contains the street + number (it's the "free-form" line).
    // Avoid duplication: prefer the longer of the two if one contains the other.
    let line1: string;
    if (streetPart && addressDetail) {
      const s = streetPart.toLowerCase();
      const a = addressDetail.toLowerCase();
      if (a.includes(s) || a === s) line1 = addressDetail;
      else if (s.includes(a)) line1 = streetPart;
      else line1 = `${addressDetail}, ${streetPart}`;
    } else {
      line1 = streetPart || addressDetail;
    }
    if (line1)                                                 details.push({ group: 'Empresa', label: 'Morada',         value: line1 });
    if (postalCode && postalCode !== '0000-000')               details.push({ group: 'Empresa', label: 'Código Postal',  value: postalCode });
    if (city && city.toLowerCase() !== 'desconhecido')         details.push({ group: 'Empresa', label: 'Localidade',     value: city });
    if (regionTxt)                                             details.push({ group: 'Empresa', label: 'Região',         value: regionTxt });
    if (country)                                               details.push({ group: 'Empresa', label: 'País',           value: country });

    cpNumeric = parseInt((postalCode || '').replace('-', '').replace(/\D/g, '').slice(0, 4), 10) || 0;
  }

  // Territory from postal code + region
  if (cpNumeric >= 9000 && cpNumeric <= 9399) previsa.territorio = 'madeira';
  else if (cpNumeric >= 9400 && cpNumeric <= 9999) previsa.territorio = 'acores';
  else if (cpNumeric > 0) previsa.territorio = 'continental';
  if (regionTxt) {
    const r = regionTxt.toLowerCase();
    if (r.includes('madeira')) previsa.territorio = 'madeira';
    else if (r.includes('açores') || r.includes('acores') || r.includes('açor')) previsa.territorio = 'acores';
  }

  // Contacts (Header or CompanyAddress)
  const contactEl = localChild(headerEl, 'CompanyContact');
  const telephone = telephoneHdr || text(contactEl, 'Telephone');
  const fax       = faxHdr       || text(contactEl, 'Fax');
  const email     = emailHdr     || text(contactEl, 'Email');
  const website   = websiteHdr   || text(contactEl, 'Website');
  if (telephone) details.push({ group: 'Empresa', label: 'Telefone', value: telephone });
  if (fax)       details.push({ group: 'Empresa', label: 'Fax',      value: fax });
  if (email && email.includes('@')) details.push({ group: 'Empresa', label: 'Email', value: email });
  if (website)   details.push({ group: 'Empresa', label: 'Website',  value: website });

  // ═════════════════════════════════════════════════════════════════
  // MASTER FILES — GeneralLedger (Plano de Contas)
  // ═════════════════════════════════════════════════════════════════
  // Some files put accounts under <GeneralLedgerAccounts><Account>; older or
  // simplified files use <GeneralLedger> at the top level. Cover both.
  const glAccountEls = [
    ...localDescendants(root, 'Account'),
    ...localDescendants(root, 'GeneralLedger'),
  ];

  const accounts: GLAccount[] = [];
  for (const el of glAccountEls) {
    const accountID = text(el, 'AccountID');
    if (!accountID) continue;
    // Skip Customer/Supplier <AccountID> wrappers — they don't carry balances
    if (!text(el, 'OpeningDebitBalance') && !text(el, 'OpeningCreditBalance') &&
        !text(el, 'ClosingDebitBalance') && !text(el, 'ClosingCreditBalance') &&
        !text(el, 'AccountDescription')) continue;

    accounts.push({
      id: accountID,
      desc: text(el, 'AccountDescription'),
      openDebit:   num(el, 'OpeningDebitBalance'),
      openCredit:  num(el, 'OpeningCreditBalance'),
      closeDebit:  num(el, 'ClosingDebitBalance'),
      closeCredit: num(el, 'ClosingCreditBalance'),
      totalDebit:  num(el, 'TotalDebit'),
      totalCredit: num(el, 'TotalCredit'),
    });
  }

  // Optionally augment account turnover by iterating GeneralLedgerEntries lines
  const glEntriesEl = localChild(root, 'GeneralLedgerEntries')
    ?? localDescendants(root, 'GeneralLedgerEntries')[0]
    ?? null;
  if (glEntriesEl && accounts.length > 0) {
    const byId = new Map(accounts.map(a => [a.id, a]));
    const journalEls = localDescendants(glEntriesEl, 'Journal');
    for (const j of journalEls) {
      const transactionEls = localDescendants(j, 'Transaction');
      for (const t of transactionEls) {
        const lineEls = localDescendants(t, 'Line');
        for (const line of lineEls) {
          const accId = text(line, 'AccountID');
          if (!accId) continue;
          const debit  = num(line, 'DebitAmount');
          const credit = num(line, 'CreditAmount');
          const a = byId.get(accId);
          if (a) {
            // Add to turnover ONLY if the file didn't already provide TotalDebit/TotalCredit
            if (!a.totalDebit && !a.totalCredit) {
              a.totalDebit  = (a.totalDebit  ?? 0) + debit;
              a.totalCredit = (a.totalCredit ?? 0) + credit;
            }
          }
        }
      }
    }
  }

  // Summary by class
  const classNames: Record<string, string> = {
    '1': 'Classe 1 — Meios Financeiros',
    '2': 'Classe 2 — Contas a Receber/Pagar',
    '3': 'Classe 3 — Inventários',
    '4': 'Classe 4 — Investimentos',
    '5': 'Classe 5 — Capital Próprio',
    '6': 'Classe 6 — Gastos',
    '7': 'Classe 7 — Rendimentos',
    '8': 'Classe 8 — Resultados',
    '9': 'Classe 9 — Contab. Analítica',
  };
  if (accounts.length > 0) {
    const byClass: Record<string, { debit: number; credit: number; count: number }> = {};
    for (const a of accounts) {
      const cls = a.id.charAt(0);
      if (!byClass[cls]) byClass[cls] = { debit: 0, credit: 0, count: 0 };
      byClass[cls].count++;
      byClass[cls].debit  += a.closeDebit;
      byClass[cls].credit += a.closeCredit;
    }
    for (const [cls, totals] of Object.entries(byClass).sort(([a], [b]) => a.localeCompare(b))) {
      const net = totals.credit - totals.debit;
      details.push({
        group: 'Resumo por Classe',
        label: classNames[cls] ?? `Classe ${cls}`,
        value: `${totals.count} conta(s) · Saldo líquido: ${fmtEur(Math.abs(net))} ${net >= 0 ? 'Crédito' : 'Débito'}`,
      });
    }

    // Top accounts in classes 6 & 7 — show user where the money is
    const interesting = accounts
      .filter(a => /^[678]/.test(a.id))
      .map(a => ({ a, abs: Math.abs(netCredit(a)) }))
      .filter(x => x.abs >= 1)
      .sort((x, y) => y.abs - x.abs)
      .slice(0, 30);
    for (const { a, abs } of interesting) {
      details.push({
        group: 'Contas 6/7/8 (maiores valores)',
        label: `${a.id} — ${a.desc}`,
        value: `${fmtEur(abs)} ${netCredit(a) >= 0 ? 'Crédito' : 'Débito'}`,
      });
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // PREVISA — Rendimentos (Class 7) e Gastos (Class 6) a partir do GL
  // ═════════════════════════════════════════════════════════════════
  const useRaiCalc = (taxBasis === 'C' || taxBasis === 'L' || taxBasis === 'I') && accounts.length > 0;
  if (useRaiCalc) {
    previsa.useRaiCalc = true;
    // Fonte dos valores por conta: se o ficheiro traz saldos no plano de contas
    // (caso comum), usa-os via sumLeaves; se só traz o plano + lançamentos (SAF-T
    // de contabilidade, sem saldos — ex. alguns ficheiros), apura o movimento
    // líquido directamente dos diários. Assim apuramos rendimentos/gastos em
    // ambos os formatos.
    const glMov = collectGLMovement(
      localChild(root, 'GeneralLedgerEntries') ?? localDescendants(root, 'GeneralLedgerEntries')[0] ?? null
    );
    // Por prefixo: usa o saldo do plano de contas quando existe (não-zero); senão
    // (típico das contas de resultados, classe 6/7, que fecham a 0 no fim do ano)
    // cai para o movimento bruto dos diários. Cobre os dois formatos de SAF-T.
    const sumBy = (prefix: string, side: 'debit' | 'credit'): number => {
      const byBalance = sumLeaves(accounts, prefix, side);
      if (byBalance > 0) return byBalance;
      return sumMovByPrefix(glMov, prefix, side);
    };
    // Class 7
    const r711 = sumBy('711', 'credit');
    const r712 = sumBy('712', 'credit');
    const r72  = sumBy('72',  'credit');
    const r74  = sumBy('74',  'credit');
    const r75  = sumBy('75',  'credit');
    const r76  = sumBy('76',  'credit');
    const r77  = sumBy('77',  'credit');
    const r78  = sumBy('78',  'credit');
    const r79  = sumBy('79',  'credit');
    if (r711) { previsa.rai_711 = Math.round(r711 * 100) / 100; filled.push('Vendas de mercadorias (711)'); }
    if (r712) { previsa.rai_712 = Math.round(r712 * 100) / 100; filled.push('Vendas de produtos (712)'); }
    if (r72)  { previsa.rai_72  = Math.round(r72 * 100) / 100;  filled.push('Prestações de serviços (72)'); }
    if (r74)  { previsa.rai_74  = Math.round(r74 * 100) / 100;  filled.push('Trabalhos própria entidade (74)'); }
    if (r75)  { previsa.rai_75  = Math.round(r75 * 100) / 100;  filled.push('Subsídios à exploração (75)'); }
    if (r76)  { previsa.rai_76  = Math.round(r76 * 100) / 100;  filled.push('Reversões (76)'); }
    if (r77)  { previsa.rai_77  = Math.round(r77 * 100) / 100;  filled.push('Ganhos JV (77)'); }
    if (r78)  { previsa.rai_78  = Math.round(r78 * 100) / 100;  filled.push('Outros rendimentos (78)'); }
    if (r79)  { previsa.rai_79  = Math.round(r79 * 100) / 100;  filled.push('Juros e dividendos (79)'); }

    // Class 6 — CMV vs CMC (61), FSE (62), Pessoal (63), Amort. (64), etc.
    const cmv  = sumBy('611', 'debit')
               + sumBy('612', 'debit')
               + sumBy('613', 'debit')
               + sumBy('614', 'debit')
               + sumBy('615', 'debit')
               + sumBy('616', 'debit')
               + sumBy('617', 'debit');
    const cmc  = sumBy('618', 'debit')
               + sumBy('619', 'debit');
    // If neither sub split, fall back to total 61
    const c61Total = sumBy('61', 'debit');
    const cmvFinal = cmv > 0 ? cmv : c61Total;
    const cmcFinal = cmc > 0 ? cmc : 0;

    const c62 = sumBy('62', 'debit');
    const c63 = sumBy('63', 'debit');
    const c64 = sumBy('64', 'debit');
    const c65 = sumBy('65', 'debit');
    const c66 = sumBy('66', 'debit');
    const c67 = sumBy('67', 'debit');
    const c68 = sumBy('68', 'debit');
    const c69 = sumBy('69', 'debit');

    if (cmvFinal) { previsa.rai_cmv = Math.round(cmvFinal * 100) / 100; filled.push('CMV (61)'); }
    if (cmcFinal) { previsa.rai_cmc = Math.round(cmcFinal * 100) / 100; filled.push('CMC (618/619)'); }
    if (c62) { previsa.rai_62 = Math.round(c62 * 100) / 100; filled.push('FSE (62)'); }
    if (c63) { previsa.rai_63 = Math.round(c63 * 100) / 100; filled.push('Gastos com pessoal (63)'); }
    if (c64) { previsa.rai_64 = Math.round(c64 * 100) / 100; filled.push('Amortizações (64)'); }
    if (c65) { previsa.rai_65 = Math.round(c65 * 100) / 100; filled.push('Imparidades (65)'); }
    if (c66) { previsa.rai_66 = Math.round(c66 * 100) / 100; filled.push('Reduções de JV (66)'); }
    if (c67) { previsa.rai_67 = Math.round(c67 * 100) / 100; filled.push('Provisões (67)'); }
    if (c68) { previsa.rai_68 = Math.round(c68 * 100) / 100; filled.push('Outros gastos (68)'); }
    if (c69) { previsa.rai_69 = Math.round(c69 * 100) / 100; filled.push('Gastos financiamento (69)'); }

    // Tributações Autónomas — heurísticas a partir de contas SNC
    const taRepresentacao = sumBy('6266', 'debit')
                          + sumBy('6262', 'debit');
    const taAjudasCusto   = sumBy('6325', 'debit');
    const taDespNaoDoc    = sumBy('6888', 'debit')
                          + sumBy('6886', 'debit');
    if (taRepresentacao) { previsa.ta_representacao = Math.round(taRepresentacao * 100) / 100; filled.push('TA — Representação (6266/6262)'); }
    if (taAjudasCusto)   { previsa.ta_ajadasCusto   = Math.round(taAjudasCusto * 100) / 100;   filled.push('TA — Ajudas de Custo (6325)'); }
    if (taDespNaoDoc) {
      previsa.ta_despNaoDocPrincipal = Math.round(taDespNaoDoc * 100) / 100;
      filled.push('TA — Despesas não documentadas (688x)');
    }

    // Imposto diferido (8122) — extração directa (não é resultado).
    const r8122db = sumBy('8122', 'debit');
    const r8122cr = sumBy('8122', 'credit');
    if (r8122db) { previsa.rai_8122_db = Math.round(r8122db * 100) / 100; filled.push('Imposto diferido — Débito (8122)'); }
    if (r8122cr) { previsa.rai_8122_cr = Math.round(r8122cr * 100) / 100; filled.push('Imposto diferido — Crédito (8122)'); }

    // RAI = total rendimentos (7) − total gastos (6). É O cálculo correcto:
    // a conta 811 é de apuramento (débito = crédito → saldo de movimento 0), por
    // isso somar o seu movimento bruto dava um valor sem sentido (ex.: Mykola
    // 59.807 em vez do prejuízo real −14.404). Quando o ficheiro traz saldos de
    // fecho (ex.: Atlântico), 811 fica = rendimentos−gastos = 112.800, igual a este.
    const totalRendimentos = r711 + r712 + r72 + r74 + r75 + r76 + r77 + r78 + r79;
    const totalGastos      = cmvFinal + cmcFinal + c62 + c63 + c64 + c65 + c66 + c67 + c68 + c69;
    if (totalRendimentos) details.push({ group: 'Resultados Apurados', label: 'Total Rendimentos (7)', value: fmtEur(totalRendimentos) });
    if (totalGastos)      details.push({ group: 'Resultados Apurados', label: 'Total Gastos (6)',      value: fmtEur(totalGastos) });
    if (totalRendimentos || totalGastos) {
      const raiCalc = Math.round((totalRendimentos - totalGastos) * 100) / 100;
      // Saldo de fecho da 811 (quando existe) como verificação — só informativo.
      const r811Closing = sumLeaves(accounts, '811', 'credit') - sumLeaves(accounts, '811', 'debit');
      previsa.c701_rai = r811Closing !== 0 ? Math.round(r811Closing * 100) / 100 : raiCalc;
      filled.push('RAI (resultado antes de impostos)');
      details.push({
        group: 'Resultados Apurados',
        label: 'Resultado antes de impostos (7 − 6)',
        value: `${fmtEur(Math.abs(raiCalc))} ${raiCalc >= 0 ? 'Lucro' : 'Prejuízo'}`,
      });
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // CONTABILIDADE — Balanço / tesouraria / imposto (classes 1–5/8)
  // a partir dos SALDOS de fecho (e abertura para a caixa) do plano de contas.
  // Só quando o ficheiro traz saldos (SAF-T de contabilidade); senão fica para
  // preenchimento manual no perfil.
  // ═════════════════════════════════════════════════════════════════
  const temSaldos = accounts.some(a => a.closeDebit || a.closeCredit || a.openDebit || a.openCredit);
  if (temSaldos) {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const close = (prefix: string, side: 'debit' | 'credit') => round2(sumLeaves(accounts, prefix, side));
    // Saldo de ABERTURA no lado pedido (para a caixa no início do período).
    const open = (prefix: string, side: 'debit' | 'credit'): number => {
      const matching = accounts.filter(a => a.id.startsWith(prefix));
      if (!matching.length) return 0;
      const pick = (a: GLAccount) => side === 'debit'
        ? Math.max(0, a.openDebit - a.openCredit)
        : Math.max(0, a.openCredit - a.openDebit);
      const exact = matching.find(a => a.id === prefix);
      if (exact) return round2(pick(exact));
      let minLen = Infinity;
      for (const a of matching) if (a.id.length < minLen) minLen = a.id.length;
      return round2(matching.filter(a => a.id.length === minLen).reduce((s, a) => s + pick(a), 0));
    };
    const caixaFim    = close('11', 'debit') + close('12', 'debit') + close('13', 'debit');
    const caixaInicio = open('11', 'debit') + open('12', 'debit') + open('13', 'debit');
    const rl818 = close('818', 'credit') - close('818', 'debit');
    contabilidade = {
      ativoFixoTangivel:        close('43', 'debit'),
      ativoIntangivel:          close('44', 'debit'),
      investimentosFinanceiros: close('41', 'debit') + close('42', 'debit'),
      inventarios:              close('3', 'debit'),
      clientes:                 close('21', 'debit'),
      estadoOutrosAtivo:        close('24', 'debit'),
      outrosAtivosCorrentes:    close('27', 'debit') + close('28', 'debit'),
      caixaDepositos:           round2(caixaFim),
      capitalRealizado:             close('51', 'credit'),
      reservasResultadosTransitados: close('55', 'credit') + close('56', 'credit'),
      resultadoLiquido:         round2(rl818),
      outrasVariacoesCapital:   close('54', 'credit') + close('58', 'credit'),
      financiamentosObtidos:    close('25', 'credit'),
      fornecedores:             close('22', 'credit'),
      estadoOutrosPassivo:      close('24', 'credit'),
      outrosPassivos:           close('27', 'credit') + close('28', 'credit'),
      impostoRendimento:        close('812', 'debit'),
      caixaInicio:              round2(caixaInicio),
      saftImportado: true,
    };
    const nz = Object.entries(contabilidade).filter(([, v]) => typeof v === 'number' && v !== 0).length;
    if (nz > 0) {
      filled.push(`Balanço / contabilidade (${nz} rubricas)`);
      const ativoTotal = (contabilidade.ativoFixoTangivel ?? 0) + (contabilidade.ativoIntangivel ?? 0)
        + (contabilidade.investimentosFinanceiros ?? 0) + (contabilidade.inventarios ?? 0)
        + (contabilidade.clientes ?? 0) + (contabilidade.estadoOutrosAtivo ?? 0)
        + (contabilidade.outrosAtivosCorrentes ?? 0) + (contabilidade.caixaDepositos ?? 0);
      if (ativoTotal) details.push({ group: 'Balanço', label: 'Total do ativo (estimado)', value: fmtEur(round2(ativoTotal)) });
      if (contabilidade.caixaDepositos) details.push({ group: 'Balanço', label: 'Caixa e depósitos (fim)', value: fmtEur(contabilidade.caixaDepositos) });
      if (contabilidade.capitalRealizado) details.push({ group: 'Balanço', label: 'Capital realizado', value: fmtEur(contabilidade.capitalRealizado) });
    } else {
      contabilidade = undefined; // tudo a zero → não vale a pena
    }

    // Saldos de ABERTURA (= fecho do ano anterior) — coluna do ano anterior do
    // Balanço e posição inicial das Alterações no Capital Próprio.
    const ab: Partial<ContabilidadeData> = {
      ativoFixoTangivel:        open('43', 'debit'),
      ativoIntangivel:          open('44', 'debit'),
      investimentosFinanceiros: open('41', 'debit') + open('42', 'debit'),
      inventarios:              open('3', 'debit'),
      clientes:                 open('21', 'debit'),
      estadoOutrosAtivo:        open('24', 'debit'),
      outrosAtivosCorrentes:    open('27', 'debit') + open('28', 'debit'),
      caixaDepositos:           round2(caixaInicio),
      capitalRealizado:             open('51', 'credit'),
      reservasResultadosTransitados: open('55', 'credit') + open('56', 'credit'),
      resultadoLiquido:         round2(open('818', 'credit') - open('818', 'debit')),
      outrasVariacoesCapital:   open('54', 'credit') + open('58', 'credit'),
      financiamentosObtidos:    open('25', 'credit'),
      fornecedores:             open('22', 'credit'),
      estadoOutrosPassivo:      open('24', 'credit'),
      outrosPassivos:           open('27', 'credit') + open('28', 'credit'),
    };
    const nzAb = Object.values(ab).filter(v => typeof v === 'number' && v !== 0).length;
    if (nzAb > 0) {
      contabilidadeAbertura = ab;
      filled.push(`Balanço do ano anterior (${nzAb} rubricas, saldos de abertura)`);
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // FLUXOS DE CAIXA — método directo a partir dos diários (independente
  // de o ficheiro trazer saldos: basta haver lançamentos).
  // ═════════════════════════════════════════════════════════════════
  {
    const glEl = localChild(root, 'GeneralLedgerEntries') ?? localDescendants(root, 'GeneralLedgerEntries')[0] ?? null;
    const fluxos = extractFluxosDirectos(glEl);
    if (fluxos) {
      const { movimentos, ...fc } = fluxos;
      contabilidade = { ...(contabilidade ?? {}), ...fc };
      filled.push(`Fluxos de caixa (método directo, ${movimentos} movimentos de caixa)`);
      const fcPairs: [string, number | undefined][] = [
        ['Recebimentos de clientes', fc.fcRecebimentosClientes],
        ['Pagamentos a fornecedores', fc.fcPagamentosFornecedores],
        ['Pagamentos ao pessoal', fc.fcPagamentosPessoal],
        ['Imposto s/ rendimento (líq. pago)', fc.fcImpostoRendimento],
        ['Financiamentos obtidos', fc.fcFinanciamentosObtidos],
      ];
      for (const [label, v] of fcPairs) {
        if (v) details.push({ group: 'Fluxos de Caixa', label, value: fmtEur(Math.abs(v)) });
      }
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // CUSTOMERS / SUPPLIERS / PRODUCTS / TAX TABLE
  // ═════════════════════════════════════════════════════════════════
  const customerEls = localDescendants(root, 'Customer');
  if (customerEls.length > 0) {
    details.push({ group: 'Clientes', label: 'Total de Clientes', value: String(customerEls.length) });
    // Mapa CustomerID/NIF → nome (TODOS os clientes), para a faturação por
    // cliente das SalesInvoices sair com nomes legíveis.
    for (let i = 0; i < customerEls.length; i++) {
      const nm = text(customerEls[i], 'CompanyName') || text(customerEls[i], 'Name');
      if (!nm) continue;
      const cid = text(customerEls[i], 'CustomerID');
      const nif = text(customerEls[i], 'CustomerTaxID');
      if (cid) customerNames.set(cid, nm);
      if (nif) customerNames.set(nif, nm);
    }
    const limit = Math.min(customerEls.length, 50);
    for (let i = 0; i < limit; i++) {
      const cName  = text(customerEls[i], 'CompanyName') || text(customerEls[i], 'Name');
      const cNif   = text(customerEls[i], 'CustomerTaxID');
      const cAcct  = text(customerEls[i], 'AccountID');
      if (cName) {
        details.push({
          group: 'Clientes',
          label: `Cliente ${i + 1}${cNif ? ` (NIF: ${cNif})` : ''}`,
          value: cName + (cAcct && cAcct !== 'Desconhecido' ? ` · Conta: ${cAcct}` : ''),
        });
      }
    }
    if (customerEls.length > limit) {
      details.push({ group: 'Clientes', label: '…', value: `+ ${customerEls.length - limit} clientes adicionais` });
    }
  }

  const supplierEls = localDescendants(root, 'Supplier');
  if (supplierEls.length > 0) {
    details.push({ group: 'Fornecedores', label: 'Total de Fornecedores', value: String(supplierEls.length) });
    const limit = Math.min(supplierEls.length, 30);
    for (let i = 0; i < limit; i++) {
      const sName = text(supplierEls[i], 'CompanyName') || text(supplierEls[i], 'Name');
      const sNif  = text(supplierEls[i], 'SupplierTaxID');
      if (sName) {
        details.push({
          group: 'Fornecedores',
          label: `Fornecedor ${i + 1}${sNif ? ` (NIF: ${sNif})` : ''}`,
          value: sName,
        });
      }
    }
    if (supplierEls.length > limit) {
      details.push({ group: 'Fornecedores', label: '…', value: `+ ${supplierEls.length - limit} fornecedores adicionais` });
    }
  }

  // Products — count by type, lets us deduce serviços vs bens
  const productEls = localDescendants(root, 'Product');
  const productTypeCount: Record<string, number> = { P: 0, S: 0, O: 0, E: 0, I: 0 };
  if (productEls.length > 0) {
    details.push({ group: 'Produtos / Serviços', label: 'Total de Artigos', value: String(productEls.length) });
    for (let i = 0; i < productEls.length; i++) {
      const pType = text(productEls[i], 'ProductType');
      if (pType && pType in productTypeCount) productTypeCount[pType]++;
    }
    const ptypeLabels: Record<string, string> = {
      P: 'Bens (P)',
      S: 'Serviços (S)',
      O: 'Outros (O)',
      E: 'Impostos especiais (E)',
      I: 'Impostos / taxas (I)',
    };
    for (const [k, n] of Object.entries(productTypeCount)) {
      if (n > 0) details.push({ group: 'Produtos / Serviços', label: ptypeLabels[k], value: `${n} artigo(s)` });
    }

    const limit = Math.min(productEls.length, 50);
    for (let i = 0; i < limit; i++) {
      const pCode = text(productEls[i], 'ProductCode');
      const pDesc = text(productEls[i], 'ProductDescription');
      const pType = text(productEls[i], 'ProductType');
      if (pDesc) {
        details.push({
          group: 'Produtos / Serviços',
          label: `${pCode || `Art. ${i + 1}`}${pType ? ` (${pType})` : ''}`,
          value: pDesc,
        });
      }
    }
    if (productEls.length > limit) {
      details.push({ group: 'Produtos / Serviços', label: '…', value: `+ ${productEls.length - limit} artigos adicionais` });
    }
  }

  // Tax table
  const taxTableEls = localDescendants(root, 'TaxTableEntry');
  for (let i = 0; i < taxTableEls.length; i++) {
    const taxType        = text(taxTableEls[i], 'TaxType');
    const taxCountryReg  = text(taxTableEls[i], 'TaxCountryRegion');
    const taxCode        = text(taxTableEls[i], 'TaxCode');
    const desc           = text(taxTableEls[i], 'Description');
    const taxPct         = text(taxTableEls[i], 'TaxPercentage');
    const taxAmt         = text(taxTableEls[i], 'TaxAmount');
    if (taxType) {
      details.push({
        group: 'Tabela de Impostos',
        label: `${taxType} ${taxCode} (${taxCountryReg})`,
        value: desc + (taxPct ? ` — ${taxPct}%` : '') + (taxAmt ? ` — ${fmtEur(numStr(taxAmt))}` : ''),
      });
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // SOURCE DOCUMENTS — SalesInvoices
  // ═════════════════════════════════════════════════════════════════
  const salesEl = localDescendants(root, 'SalesInvoices')[0] ?? null;
  let salesNetTotal = 0;       // soma líquida (NC subtraído)
  let totalCredit = 0;          // TotalCredit do bloco
  let hasNormalIVA = false;
  let hasISE = false;
  let cashVATCount = 0;
  let eacCodeDetected = '';
  let invoiceCountWithEAC = 0;
  let salesNetIVA = { continental: 0, madeira: 0, acores: 0 };

  // Para detectar funcionários nos pagamentos
  let workerNifsCount = 0;
  const workerNifs = new Set<string>();

  if (salesEl) {
    const nEntries   = text(salesEl, 'NumberOfEntries');
    const totalDebit = text(salesEl, 'TotalDebit');
    const totalCrStr = text(salesEl, 'TotalCredit');
    totalCredit = numStr(totalCrStr);

    if (nEntries)   details.push({ group: 'Documentos de Venda', label: 'Nº de Documentos',  value: nEntries });
    if (totalDebit) details.push({ group: 'Documentos de Venda', label: 'Total Débito (NC)',  value: fmtEur(numStr(totalDebit)) });
    if (totalCrStr) details.push({ group: 'Documentos de Venda', label: 'Total Crédito (FT)', value: fmtEur(totalCredit) });

    const invoiceEls = localChildren(salesEl, 'Invoice');
    const byType: Record<string, { count: number; gross: number; net: number }> = {};
    // Agregações de negócio derivadas das faturas (concentração de clientes,
    // IVA liquidado por taxa, sazonalidade mensal) — NC subtrai, anuladas fora.
    const porCliente = new Map<string, number>();           // CustomerID → net
    const porMes = new Array<number>(12).fill(0);            // mês 0-11 → net
    const ivaPorTaxa = new Map<string, { base: number; iva: number }>(); // "23%" → {base, iva}
    let ivaLiquidado = 0;

    for (let i = 0; i < invoiceEls.length; i++) {
      const inv = invoiceEls[i];
      const invType  = text(inv, 'InvoiceType');
      const totals   = localChild(inv, 'DocumentTotals');
      const gross    = num(totals, 'GrossTotal');
      const net      = num(totals, 'NetTotal');
      const docStatus = localChild(inv, 'DocumentStatus');
      const isCancelled = text(docStatus, 'InvoiceStatus') === 'A'; // Anulada
      const isCashVAT = text(inv, 'CashVATSchemeIndicator') === '1';
      if (isCashVAT) cashVATCount++;

      if (!invType) continue;
      if (!byType[invType]) byType[invType] = { count: 0, gross: 0, net: 0 };
      byType[invType].count++;

      // NC (Nota Crédito) subtracts; the rest add. Cancelled invoices ignored.
      let sign = 1;
      if (invType === 'NC' || invType === 'ND') sign = invType === 'NC' ? -1 : 1;
      const effective = isCancelled ? 0 : net * sign;
      byType[invType].gross += gross;
      byType[invType].net   += effective;
      if (!isCancelled) salesNetTotal += effective;

      if (!isCancelled) {
        // Faturação por cliente (CustomerID, com fallback ao NIF se presente)
        const custId = text(inv, 'CustomerID') || text(inv, 'CustomerTaxID');
        if (custId) porCliente.set(custId, (porCliente.get(custId) ?? 0) + effective);
        // Sazonalidade mensal
        const invDate = text(inv, 'InvoiceDate');
        const mes = invDate ? new Date(invDate).getMonth() : NaN;
        if (Number.isInteger(mes) && mes >= 0 && mes <= 11) porMes[mes] += effective;
        // IVA liquidado (total da fatura)
        ivaLiquidado += num(totals, 'TaxPayable') * sign;
      }

      // EAC code
      const eac = text(inv, 'EACCode');
      if (eac && /^\d{5}$/.test(eac)) {
        if (!eacCodeDetected) eacCodeDetected = eac;
        invoiceCountWithEAC++;
      }

      // Taxes per line — classify IVA regime and region
      const lineEls = localChildren(inv, 'Line');
      for (let j = 0; j < lineEls.length; j++) {
        const taxEl = localChild(lineEls[j], 'Tax');
        const taxCode = text(taxEl, 'TaxCode');
        const taxCountry = text(taxEl, 'TaxCountryRegion');
        if (taxCode === 'NOR' || taxCode === 'INT' || taxCode === 'RED') hasNormalIVA = true;
        if (taxCode === 'ISE') hasISE = true;
        if (taxCountry === 'PT-MA') salesNetIVA.madeira += num(lineEls[j], 'CreditAmount');
        else if (taxCountry === 'PT-AC') salesNetIVA.acores += num(lineEls[j], 'CreditAmount');
        else if (taxCountry === 'PT') salesNetIVA.continental += num(lineEls[j], 'CreditAmount');
        // IVA por taxa: base líquida da linha (crédito − débito p/ NC) × taxa
        if (!isCancelled) {
          const taxa = num(taxEl, 'TaxPercentage');
          const base = num(lineEls[j], 'CreditAmount') - num(lineEls[j], 'DebitAmount');
          if (base !== 0) {
            const k = `${taxa}%`;
            const cur = ivaPorTaxa.get(k) ?? { base: 0, iva: 0 };
            cur.base += base;
            cur.iva += base * taxa / 100;
            ivaPorTaxa.set(k, cur);
          }
        }
      }
    }

    // Guarda agregações para emitir depois do parse dos clientes (nomes) e
    // para preencher o Diagnóstico (faturação do maior cliente).
    salesAgg = { porCliente, porMes, ivaPorTaxa, ivaLiquidado };

    const typeLabels: Record<string, string> = {
      FT: 'Fatura',
      FS: 'Fatura Simplificada',
      FR: 'Fatura/Recibo',
      ND: 'Nota Débito',
      NC: 'Nota Crédito',
      VD: 'Venda a dinheiro',
      TV: 'Talão de venda',
      TD: 'Talão de devolução',
      AA: 'Alienação ativos',
      DA: 'Devolução ativos',
      RP: 'Prémio/recibo prémio',
      RE: 'Estorno prémio',
      CS: 'Imputação a coseguradoras',
      LD: 'Imputação a coseguradora líder',
      RA: 'Resseguro aceite',
    };
    for (const [invType, stats] of Object.entries(byType)) {
      const lbl = typeLabels[invType] ?? invType;
      details.push({
        group: 'Documentos de Venda',
        label: `${invType} — ${lbl}`,
        value: `${stats.count} doc · ${fmtEur(stats.gross)} bruto · ${fmtEur(Math.abs(stats.net))} líq ${stats.net < 0 ? '(NC)' : ''}`,
      });
    }
    details.push({
      group: 'Documentos de Venda',
      label: 'Volume de Negócios (líq., NC subtraído)',
      value: fmtEur(salesNetTotal),
    });
    if (cashVATCount > 0) {
      details.push({ group: 'Documentos de Venda', label: 'Faturas em Regime de IVA de Caixa', value: `${cashVATCount} documento(s)` });
    }

    if (hasISE && !hasNormalIVA) {
      profile.regimeIva = 'isento';
      filled.push('Regime de IVA (isento)');
      details.push({ group: 'Dados Fiscais', label: 'Regime de IVA', value: 'Isento (art.º 9.º CIVA)' });
    } else if (hasNormalIVA) {
      profile.regimeIva = 'normal_mensal';
      filled.push('Regime de IVA (normal)');
      details.push({ group: 'Dados Fiscais', label: 'Regime de IVA', value: 'Regime Normal' });
    }

    if (eacCodeDetected) {
      profile.cae = eacCodeDetected;
      filled.push('CAE');
      details.push({
        group: 'Dados Fiscais',
        label: 'CAE (código atividade)',
        value: `${eacCodeDetected}${invoiceCountWithEAC > 1 ? ` (em ${invoiceCountWithEAC} documentos)` : ''}`,
      });
    }
  }

  // ─── Purchases ───────────────────────────────────────────────────
  const purchasesEl = localDescendants(root, 'Purchases')[0]
    ?? localDescendants(root, 'PurchasesInvoices')[0]
    ?? null;
  if (purchasesEl) {
    const nEntries   = text(purchasesEl, 'NumberOfEntries');
    const totalDebit = text(purchasesEl, 'TotalDebit');
    const totalCr    = text(purchasesEl, 'TotalCredit');
    if (nEntries)   details.push({ group: 'Documentos de Compra', label: 'Nº de Documentos', value: nEntries });
    if (totalDebit) details.push({ group: 'Documentos de Compra', label: 'Total Débito',      value: fmtEur(numStr(totalDebit)) });
    if (totalCr)    details.push({ group: 'Documentos de Compra', label: 'Total Crédito',     value: fmtEur(numStr(totalCr)) });
  }

  // ─── Agregações das faturas: clientes, IVA por taxa, sazonalidade ──
  if (salesAgg) {
    const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const r2 = (n: number) => Math.round(n * 100) / 100;
    // Top clientes por faturação líquida + concentração do maior
    const top = [...salesAgg.porCliente.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const totalVendas = top.reduce((s, [, v]) => s + v, 0);
    if (top.length > 0 && totalVendas > 0) {
      const [topId, topVal] = top[0];
      contabilidade = { ...(contabilidade ?? {}), vendasMaiorCliente: r2(topVal) };
      filled.push('Faturação do maior cliente');
      const pct = (v: number) => `${(v / totalVendas * 100).toFixed(1)}%`;
      details.push({
        group: 'Vendas por Cliente',
        label: 'Concentração no maior cliente',
        value: `${customerNames.get(topId) ?? topId} — ${fmtEur(topVal)} (${pct(topVal)})`,
      });
      for (const [cid, v] of top.slice(0, 10)) {
        details.push({ group: 'Vendas por Cliente', label: customerNames.get(cid) ?? cid, value: `${fmtEur(v)} · ${pct(v)}` });
      }
    }
    // IVA liquidado (total + por taxa)
    if (salesAgg.ivaLiquidado > 0) {
      details.push({ group: 'IVA Liquidado', label: 'Total IVA liquidado (faturas)', value: fmtEur(r2(salesAgg.ivaLiquidado)) });
    }
    for (const [taxa, { base, iva }] of [...salesAgg.ivaPorTaxa.entries()].sort()) {
      if (base !== 0) details.push({ group: 'IVA Liquidado', label: `Taxa ${taxa}`, value: `base ${fmtEur(r2(base))} → IVA ${fmtEur(r2(iva))}` });
    }
    // Sazonalidade mensal (só meses com vendas)
    const mesesAtivos = salesAgg.porMes.map((v, i) => [i, v] as const).filter(([, v]) => v !== 0);
    if (mesesAtivos.length > 1) {
      for (const [i, v] of mesesAtivos) {
        details.push({ group: 'Vendas por Mês', label: MESES[i], value: fmtEur(r2(v)) });
      }
    }
  }

  // ─── MovementOfGoods ─────────────────────────────────────────────
  const movGoodsEl = localDescendants(root, 'MovementOfGoods')[0] ?? null;
  if (movGoodsEl) {
    const nEntries = text(movGoodsEl, 'NumberOfMovementLines');
    const totalQty = text(movGoodsEl, 'TotalQuantityIssued');
    if (nEntries) details.push({ group: 'Movimentos de Stock', label: 'Nº de Linhas', value: nEntries });
    if (totalQty) details.push({ group: 'Movimentos de Stock', label: 'Qtd. Total Emitida', value: totalQty });
  }

  // ─── WorkingDocuments ────────────────────────────────────────────
  const workDocsEl = localDescendants(root, 'WorkingDocuments')[0] ?? null;
  if (workDocsEl) {
    const nEntries = text(workDocsEl, 'NumberOfEntries');
    const totalDr  = text(workDocsEl, 'TotalDebit');
    const totalCr  = text(workDocsEl, 'TotalCredit');
    if (nEntries) details.push({ group: 'Documentos de Trabalho', label: 'Nº de Documentos', value: nEntries });
    if (totalDr)  details.push({ group: 'Documentos de Trabalho', label: 'Total Débito',      value: fmtEur(numStr(totalDr)) });
    if (totalCr)  details.push({ group: 'Documentos de Trabalho', label: 'Total Crédito',     value: fmtEur(numStr(totalCr)) });
  }

  // ─── Payments ────────────────────────────────────────────────────
  const paymentsEl = localDescendants(root, 'Payments')[0] ?? null;
  if (paymentsEl) {
    const nEntries = text(paymentsEl, 'NumberOfEntries');
    const totalDr  = text(paymentsEl, 'TotalDebit');
    const totalCr  = text(paymentsEl, 'TotalCredit');
    if (nEntries) details.push({ group: 'Pagamentos / Recibos', label: 'Nº de Documentos', value: nEntries });
    if (totalDr)  details.push({ group: 'Pagamentos / Recibos', label: 'Total Débito',      value: fmtEur(numStr(totalDr)) });
    if (totalCr)  details.push({ group: 'Pagamentos / Recibos', label: 'Total Crédito',     value: fmtEur(numStr(totalCr)) });

    // Detect employees from RG/RV payments
    const paymentDocEls = localChildren(paymentsEl, 'Payment');
    const byMethod: Record<string, { count: number; amount: number }> = {};
    for (let i = 0; i < paymentDocEls.length; i++) {
      const type = text(paymentDocEls[i], 'PaymentType');
      // Lines may include CustomerID / SupplierID
      const lineEls = localChildren(paymentDocEls[i], 'Line');
      if (type === 'RG' || type === 'RV') {
        for (let j = 0; j < lineEls.length; j++) {
          const wNif = text(lineEls[j], 'EmployeeID');
          if (wNif) workerNifs.add(wNif);
        }
      }
      const methodEls = localDescendants(paymentDocEls[i], 'PaymentMethod');
      for (const m of methodEls) {
        const mech = text(m, 'PaymentMechanism');
        const amt  = num(m, 'PaymentAmount');
        if (mech) {
          if (!byMethod[mech]) byMethod[mech] = { count: 0, amount: 0 };
          byMethod[mech].count++;
          byMethod[mech].amount += amt;
        }
      }
    }
    workerNifsCount = workerNifs.size;

    const mechLabels: Record<string, string> = {
      CC: 'Cartão de Crédito',
      CD: 'Cartão de Débito',
      CH: 'Cheque',
      CI: 'Crédito documentário',
      CO: 'Cheque ou ordem (vale postal)',
      CS: 'Compensação de saldos em conta corrente',
      DE: 'Dinheiro electrónico',
      LC: 'Letra Comercial',
      MB: 'Multibanco (Referência)',
      NU: 'Numerário',
      OU: 'Outros',
      PR: 'Permuta de bens',
      TB: 'Transferência Bancária',
      TR: 'Vale (refeição/cultura)',
    };
    for (const [mech, stats] of Object.entries(byMethod)) {
      details.push({
        group: 'Métodos de Pagamento',
        label: `${mech} — ${mechLabels[mech] ?? mech}`,
        value: `${stats.count} ocorrência(s) · ${fmtEur(stats.amount)}`,
      });
    }
  }

  // ─── GeneralLedgerEntries summary ────────────────────────────────
  if (glEntriesEl) {
    const nJournals = text(glEntriesEl, 'NumberOfJournals');
    const nEntries  = text(glEntriesEl, 'NumberOfEntries');
    const totalDr   = text(glEntriesEl, 'TotalDebit');
    const totalCr   = text(glEntriesEl, 'TotalCredit');
    if (nJournals) details.push({ group: 'Diário Contabilístico', label: 'Nº de Diários',     value: nJournals });
    if (nEntries)  details.push({ group: 'Diário Contabilístico', label: 'Nº de Lançamentos', value: nEntries });
    if (totalDr)   details.push({ group: 'Diário Contabilístico', label: 'Total Débito',      value: fmtEur(numStr(totalDr)) });
    if (totalCr)   details.push({ group: 'Diário Contabilístico', label: 'Total Crédito',     value: fmtEur(numStr(totalCr)) });
  }

  // ═════════════════════════════════════════════════════════════════
  // PROFILE population
  // ═════════════════════════════════════════════════════════════════
  if (companyName) { profile.nomeCliente = companyName; filled.push('Nome'); }
  if (taxRegNr)    { profile.nif         = taxRegNr;    filled.push('NIF'); }
  if (telephone)   { profile.telefone    = telephone;   filled.push('Telefone'); }
  if (email && email.includes('@')) { profile.email = email; filled.push('Email'); }

  if (addrEl) {
    const buildingNumber = text(addrEl, 'BuildingNumber');
    const streetName     = text(addrEl, 'StreetName');
    const addressDetail  = text(addrEl, 'AddressDetail');
    const city           = text(addrEl, 'City');
    const postalCode     = text(addrEl, 'PostalCode');

    const streetPart = [streetName, buildingNumber].filter(Boolean).join(' ');
    // AddressDetail often already contains the street + number (it's the "free-form" line).
    // Avoid duplication: prefer the longer of the two if one contains the other.
    let line1: string;
    if (streetPart && addressDetail) {
      const s = streetPart.toLowerCase();
      const a = addressDetail.toLowerCase();
      if (a.includes(s) || a === s) line1 = addressDetail;
      else if (s.includes(a)) line1 = streetPart;
      else line1 = `${addressDetail}, ${streetPart}`;
    } else {
      line1 = streetPart || addressDetail;
    }
    if (line1) { profile.morada = line1; filled.push('Morada'); }
    if (postalCode && postalCode !== '0000-000') { profile.codigoPostal = postalCode; filled.push('Código Postal'); }
    if (city && city.toLowerCase() !== 'desconhecido') { profile.localidade = city; filled.push('Localidade'); }
  }

  if (taxBasis === 'C' || taxBasis === 'L' || taxBasis === 'I') {
    profile.tipoEntidade = 'lda';
    profile.regimeContabilidade = 'organizada';
    if (taxBasis !== 'I') warnings.push(`TaxAccountingBasis "${taxBasis}" sugere contabilidade organizada — confirme o tipo de entidade`);
    filled.push('Tipo de entidade', 'Regime de contabilidade');
  } else if (taxBasis === 'S') {
    profile.tipoEntidade = 'eni';
    profile.regimeContabilidade = 'simplificado';
    filled.push('Tipo de entidade', 'Regime de contabilidade');
  } else if (taxBasis === 'F' || taxBasis === 'R' || taxBasis === 'T' || taxBasis === 'E') {
    // Simplified billing — sem GL: provavelmente ENI
    profile.tipoEntidade = 'eni';
    profile.regimeContabilidade = 'simplificado';
    filled.push('Tipo de entidade', 'Regime de contabilidade');
  }

  if (period > 2000) {
    profile.inicioAtividade = period;
    filled.push('Ano de atividade');
  }

  // Activity type — primary signal: Product types; fallback: invoice line descriptions; final: EAC code
  let activityType: 'servicos' | 'bens' = 'servicos';
  if (productTypeCount.S + productTypeCount.P > 0) {
    activityType = productTypeCount.S >= productTypeCount.P ? 'servicos' : 'bens';
  } else {
    let serviceCount = 0;
    let goodsCount   = 0;
    const allLines = localDescendants(root, 'Line');
    const cap = Math.min(allLines.length, 300);
    for (let i = 0; i < cap; i++) {
      const desc = (localChild(allLines[i], 'Description')?.textContent ?? '').trim().toLowerCase();
      const isService = /(consultoria|servi[cç]o|presta[cç][aã]o|assessoria|forma[cç][aã]o|repara[cç][aã]o|manuten[cç][aã]o|transporte|aluguer|software|design|marketing|contabilidade|auditoria|jur[ií]dico|m[eé]dico|arquitetura|engenharia|inform[aá]tica|mensalidade|aula|explica[cç][aã]o|pacote)/.test(desc);
      const isGoods   = /(venda|produto|mercadoria|artigo|material|equipamento|stock|armaz[eé]m|compra|fornecedor)/.test(desc);
      if (isService) serviceCount++;
      else if (isGoods) goodsCount++;
    }
    if (serviceCount + goodsCount > 0) {
      activityType = serviceCount >= goodsCount ? 'servicos' : 'bens';
    } else if (eacCodeDetected) {
      const cae2 = parseInt(eacCodeDetected.slice(0, 2), 10) || 0;
      activityType = (cae2 >= 45 && cae2 <= 47) ? 'bens' : 'servicos';
    }
  }
  profile.atividadePrincipal = activityType;
  filled.push('Tipo de atividade');

  // Revenue / VN: prefer SalesInvoices netTotal (NC subtracted), fall back to gross credit
  let revenue = salesNetTotal > 0 ? salesNetTotal : totalCredit;
  // For organizada, prefer class 7 total
  if (useRaiCalc) {
    const cls7 = (previsa.rai_711 ?? 0) + (previsa.rai_712 ?? 0) + (previsa.rai_72 ?? 0)
               + (previsa.rai_74 ?? 0) + (previsa.rai_75 ?? 0) + (previsa.rai_76 ?? 0)
               + (previsa.rai_77 ?? 0) + (previsa.rai_78 ?? 0) + (previsa.rai_79 ?? 0);
    if (cls7 > 0) revenue = cls7;
  }

  if (revenue > 0 && startDate && endDate) {
    const start  = new Date(startDate);
    const end    = new Date(endDate);
    const days   = (end.getTime() - start.getTime()) / 86400000 + 1;
    const months = days / 30.44;

    let fatAnual: number;
    if (months < 11.5) {
      fatAnual = Math.round((revenue / months) * 12);
      warnings.push(`Faturação anualizada: ${fmtEur(revenue)} em ${months.toFixed(1)} mês(es) → estimativa anual ${fmtNum(fatAnual)} €`);
    } else {
      fatAnual = Math.round(revenue);
    }
    if (fatAnual > 0) {
      profile.faturaçaoAnualPrevista = fatAnual;
      filled.push('Faturação anual estimada');
      details.push({
        group: 'Dados Fiscais',
        label: 'Faturação do Período',
        value: `${fmtEur(revenue)}${months < 11.5 ? ` (anualizado → ${fmtNum(fatAnual)} €)` : ''}`,
      });
    }
  } else if (revenue > 0) {
    profile.faturaçaoAnualPrevista = Math.round(revenue);
    filled.push('Faturação anual estimada');
  }

  if ((profile.tipoEntidade === 'eni' || profile.tipoEntidade === 'unipessoal') && profile.faturaçaoAnualPrevista) {
    profile.rendimentoMensalEni = Math.round(profile.faturaçaoAnualPrevista / 12);
    filled.push('Rendimento mensal ENI (estimado)');
  }
  if (profile.tipoEntidade === 'eni' || profile.tipoEntidade === 'unipessoal') {
    profile.regimeSs = profile.regimeContabilidade === 'simplificado' ? 'simplified' : 'general';
    profile.tipoRendimentoSs = activityType === 'bens' ? 'bens' : 'servicos';
    filled.push('Regime SS (estimado)');
  }

  // Employees — combine recibos + class 63 ratio (rough)
  if (workerNifsCount > 0) {
    profile.nrFuncionarios = workerNifsCount;
    filled.push('Nº de funcionários');
    details.push({ group: 'Dados Fiscais', label: 'Nº de Funcionários', value: `${workerNifsCount} (via recibos de vencimento)` });
  } else if (useRaiCalc && (previsa.rai_63 ?? 0) > 0) {
    // Rough estimate: average gross + SS employer ≈ 25k/yr per employee
    const est = Math.round((previsa.rai_63 ?? 0) / 25000);
    if (est > 0) {
      profile.nrFuncionarios = est;
      filled.push('Nº de funcionários (estimado de 63)');
      details.push({ group: 'Dados Fiscais', label: 'Nº de Funcionários (estimado)', value: `~${est} (a partir de classe 63)` });
    }
  }

  // Fixed assets / vehicles
  const fixedAssetEls = localDescendants(root, 'Asset');
  const vehicles: { desc: string; value: number }[] = [];
  for (let i = 0; i < fixedAssetEls.length; i++) {
    const desc      = (text(fixedAssetEls[i], 'Description') || text(fixedAssetEls[i], 'AssetDescription')).toLowerCase();
    const isVehicle = /(viatura|ve[ií]culo|carro|autom[oó]vel|carrinha|cami[aã]o|motociclo|moto)/.test(desc);
    if (isVehicle) {
      const val = num(fixedAssetEls[i], 'AcquisitionAndProductionCosts')
              || num(fixedAssetEls[i], 'AcquisitionCost');
      if (val > 0) vehicles.push({ desc: text(fixedAssetEls[i], 'Description') || text(fixedAssetEls[i], 'AssetDescription'), value: val });
    }
  }
  if (vehicles.length > 0) {
    profile.veiculos = vehicles;
    filled.push(`Veículos (${vehicles.length} encontrado(s))`);
    vehicles.forEach((v, i) => {
      details.push({ group: 'Ativos Fixos Tangíveis', label: `Viatura ${i + 1}`, value: `${v.desc} — ${fmtEur(v.value)}` });
    });
  }

  // ═════════════════════════════════════════════════════════════════
  // PREVISA population (resto)
  // ═════════════════════════════════════════════════════════════════
  if (taxRegNr)     previsa.nif        = taxRegNr;
  if (companyName)  previsa.designacao  = companyName;
  if (period > 2000) previsa.periodo   = period;

  // Volume de negócios para PEC/PC
  if (profile.faturaçaoAnualPrevista && profile.faturaçaoAnualPrevista > 0) {
    previsa.volumeNegocios = profile.faturaçaoAnualPrevista;
  } else if (revenue > 0) {
    previsa.volumeNegocios = Math.round(revenue * 100) / 100;
  }

  // PME / Regime
  if (profile.tipoEntidade === 'lda' || taxBasis === 'C' || taxBasis === 'L') {
    previsa.isPME = true;
    previsa.regime = previsa.territorio === 'madeira' ? 'madeira'
                   : previsa.territorio === 'acores'  ? 'acores'
                   : 'geral';
  }

  // ═════════════════════════════════════════════════════════════════
  // Empty fields list
  // ═════════════════════════════════════════════════════════════════
  const allProfileFields: (keyof ClientProfile)[] = [
    'nomeCliente', 'nif', 'email', 'telefone', 'morada', 'codigoPostal', 'localidade',
    'regimeIva', 'regimeContabilidade', 'cae', 'inicioAtividade', 'atividadePrincipal',
    'isSazonal', 'idade', 'estadoCivil', 'cônjugeRendimentos', 'nrDependentes',
    'beneficioJovem', 'tipoEntidade', 'faturaçaoAnualPrevista', 'nrFuncionarios',
    'veiculos', 'tipoVale', 'valorTicket', 'limiteDeducao', 'setorTicket',
    'rendimentoMensalEni', 'regimeSs', 'tipoRendimentoSs',
  ];
  const empty = allProfileFields.filter(f =>
    !(f in profile) ||
    (profile as Record<string, unknown>)[f] === '' ||
    (profile as Record<string, unknown>)[f] === 0 ||
    ((profile as Record<string, unknown>)[f] as unknown[])?.length === 0
  );

  return { profile, previsa, contabilidade, contabilidadeAbertura, warnings, filled, empty, details };
}
