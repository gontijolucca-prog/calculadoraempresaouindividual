import type { ClientProfile } from '../ClientProfile';
import type { PreviSaState, Territorio } from '../previSaState';

export interface SAFTDetail {
  label: string;
  value: string;
  group: string;
}

export interface SAFTParseResult {
  profile: Partial<ClientProfile>;
  previsa: Partial<PreviSaState>;
  warnings: string[];
  filled: string[];
  empty: string[];
  details: SAFTDetail[];
}

function el(parent: Element | Document, tag: string): string {
  return parent.getElementsByTagName(tag)[0]?.textContent?.trim() ?? '';
}

function fmtEur(n: number): string {
  return n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function parseSAFT(xmlText: string): SAFTParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error('Ficheiro XML inválido ou corrompido');

  const warnings: string[] = [];
  const filled: string[] = [];
  const details: SAFTDetail[] = [];
  const profile: Partial<ClientProfile> = {};
  const previsa: Partial<PreviSaState> = {};

  const headerEl = doc.getElementsByTagName('Header')[0];
  if (!headerEl) throw new Error('Elemento <Header> não encontrado — não é um ficheiro SAF-T PT válido');

  // ═════════════════════════════════════════════════════════════════
  // CABEÇALHO — todos os campos
  // ═════════════════════════════════════════════════════════════════
  const auditVersion    = el(headerEl, 'AuditFileVersion');
  const companyID       = el(headerEl, 'CompanyID');
  const taxRegNrRaw     = el(headerEl, 'TaxRegistrationNumber');
  const taxBasis        = el(headerEl, 'TaxAccountingBasis');
  const companyName     = el(headerEl, 'CompanyName');
  const businessName    = el(headerEl, 'BusinessName');
  const fiscalYear      = el(headerEl, 'FiscalYear');
  const startDate       = el(headerEl, 'StartDate');
  const endDate         = el(headerEl, 'EndDate');
  const currencyCode    = el(headerEl, 'CurrencyCode');
  const dateCreated     = el(headerEl, 'DateCreated');
  const taxEntity       = el(headerEl, 'TaxEntity');
  const productCoTaxID  = el(headerEl, 'ProductCompanyTaxID');
  const softwareCertNr  = el(headerEl, 'SoftwareCertificateNumber');
  const productID       = el(headerEl, 'ProductID');
  const productVersion  = el(headerEl, 'ProductVersion');

  if (auditVersion)   details.push({ group: 'Cabeçalho', label: 'Versão SAF-T',            value: auditVersion });
  if (companyID)      details.push({ group: 'Cabeçalho', label: 'ID da Empresa',            value: companyID });
  if (taxEntity)      details.push({ group: 'Cabeçalho', label: 'Entidade Fiscal',          value: taxEntity });
  if (dateCreated)    details.push({ group: 'Cabeçalho', label: 'Data de Criação do Ficheiro', value: dateCreated });
  if (currencyCode)   details.push({ group: 'Cabeçalho', label: 'Moeda',                   value: currencyCode });
  if (productID)      details.push({ group: 'Cabeçalho', label: 'Software',                value: productID + (productVersion ? ` v${productVersion}` : '') });
  if (productCoTaxID) details.push({ group: 'Cabeçalho', label: 'NIF do Software',         value: productCoTaxID });
  if (softwareCertNr) details.push({ group: 'Cabeçalho', label: 'Certificado Software',    value: softwareCertNr });

  const taxBasisMap: Record<string, string> = {
    C: 'C — Contabilidade Organizada',
    L: 'L — Contabilidade Organizada (livre)',
    S: 'S — Regime Simplificado',
    F: 'F — Faturação',
    P: 'P — Contabilidade Pública',
    R: 'R — Recibos',
    T: 'T — Autofaturação',
    I: 'I — Dados Integrados',
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
  const addrEl = headerEl.getElementsByTagName('CompanyAddress')[0];
  if (addrEl) {
    const buildingNumber  = el(addrEl, 'BuildingNumber');
    const streetName      = el(addrEl, 'StreetName');
    const addressDetail   = el(addrEl, 'AddressDetail');
    const city            = el(addrEl, 'City');
    const postalCode      = el(addrEl, 'PostalCode');
    const region          = el(addrEl, 'Region');
    const country         = el(addrEl, 'Country');

    const line1 = [streetName, buildingNumber].filter(Boolean).join(' ') || addressDetail;
    if (line1)                                                 details.push({ group: 'Empresa', label: 'Morada',         value: line1 });
    if (postalCode && postalCode !== '0000-000')               details.push({ group: 'Empresa', label: 'Código Postal',  value: postalCode });
    if (city && city.toLowerCase() !== 'desconhecido')         details.push({ group: 'Empresa', label: 'Localidade',     value: city });
    if (region)                                                details.push({ group: 'Empresa', label: 'Região',         value: region });
    if (country)                                               details.push({ group: 'Empresa', label: 'País',           value: country });

    // Territory from postal code
    const cp = parseInt((postalCode || '').replace('-', '').replace(/\D/g, '').slice(0, 4), 10) || 0;
    if (cp >= 9000 && cp <= 9399) previsa.territorio = 'madeira';
    else if (cp >= 9400 && cp <= 9999) previsa.territorio = 'acores';
    else if (cp > 0) previsa.territorio = 'continental';
    if (region) {
      const r = region.toLowerCase();
      if (r.includes('madeira')) previsa.territorio = 'madeira';
      else if (r.includes('açores') || r.includes('acores') || r.includes('açor')) previsa.territorio = 'acores';
    }
  }

  // Contacts
  const contactEl = headerEl.getElementsByTagName('CompanyContact')[0];
  if (contactEl) {
    const telephone = el(contactEl, 'Telephone');
    const fax       = el(contactEl, 'Fax');
    const email     = el(contactEl, 'Email');
    const website   = el(contactEl, 'Website');
    if (telephone) details.push({ group: 'Empresa', label: 'Telefone', value: telephone });
    if (fax)       details.push({ group: 'Empresa', label: 'Fax',      value: fax });
    if (email && email.includes('@')) details.push({ group: 'Empresa', label: 'Email', value: email });
    if (website)   details.push({ group: 'Empresa', label: 'Website',  value: website });
  }

  // ═════════════════════════════════════════════════════════════════
  // MASTER FILES — Plano de Contas (GeneralLedger)
  // ═════════════════════════════════════════════════════════════════
  const glEls = doc.getElementsByTagName('GeneralLedger');
  let resultadoEstimado = 0;
  let glCount = 0;

  if (glEls.length > 0) {
    const glByClass: Record<string, { debit: number; credit: number; accounts: number }> = {};

    for (let i = 0; i < glEls.length; i++) {
      const accountID   = el(glEls[i], 'AccountID');
      const desc        = el(glEls[i], 'AccountDescription');
      const openDebit   = parseFloat(el(glEls[i], 'OpeningDebitBalance'))  || 0;
      const openCredit  = parseFloat(el(glEls[i], 'OpeningCreditBalance')) || 0;
      const closeDebit  = parseFloat(el(glEls[i], 'ClosingDebitBalance'))  || 0;
      const closeCredit = parseFloat(el(glEls[i], 'ClosingCreditBalance')) || 0;

      if (!accountID) continue;
      glCount++;

      const cls = accountID.charAt(0);
      if (!glByClass[cls]) glByClass[cls] = { debit: 0, credit: 0, accounts: 0 };
      glByClass[cls].accounts++;
      glByClass[cls].debit  += closeDebit;
      glByClass[cls].credit += closeCredit;

      // Account 81x → RAI estimate
      if (accountID.startsWith('81')) {
        resultadoEstimado += closeCredit - closeDebit;
      }

      // Show each account line
      const balance = closeCredit - closeDebit;
      const openBal = openCredit - openDebit;
      const label   = `${accountID} — ${desc}`;
      const valStr  = `Saldo: ${fmtEur(Math.abs(balance))} ${balance >= 0 ? 'Crédito' : 'Débito'}` +
                      (openBal !== 0 ? ` (abertura: ${fmtEur(Math.abs(openBal))} ${openBal >= 0 ? 'Cr' : 'Db'})` : '');
      details.push({ group: 'Plano de Contas', label, value: valStr });
    }

    // Summary by class
    const classNames: Record<string, string> = {
      '1': 'Classe 1 — Meios Financeiros', '2': 'Classe 2 — Contas a Receber/Pagar',
      '3': 'Classe 3 — Inventários', '4': 'Classe 4 — Investimentos',
      '5': 'Classe 5 — Capital Próprio', '6': 'Classe 6 — Gastos',
      '7': 'Classe 7 — Rendimentos', '8': 'Classe 8 — Resultados',
      '9': 'Classe 9 — Contab. Analítica',
    };
    for (const [cls, totals] of Object.entries(glByClass)) {
      const net = totals.credit - totals.debit;
      details.push({
        group: 'Resumo por Classe',
        label: classNames[cls] ?? `Classe ${cls}`,
        value: `${totals.accounts} conta(s) · Saldo líquido: ${fmtEur(Math.abs(net))} ${net >= 0 ? 'Crédito' : 'Débito'}`,
      });
    }
  }

  // ─── Customers ───────────────────────────────────────────────────
  const customerEls = doc.getElementsByTagName('Customer');
  if (customerEls.length > 0) {
    details.push({ group: 'Clientes', label: 'Total de Clientes', value: String(customerEls.length) });
    for (let i = 0; i < Math.min(customerEls.length, 50); i++) {
      const cName  = el(customerEls[i], 'CompanyName') || el(customerEls[i], 'Name');
      const cNif   = el(customerEls[i], 'CustomerTaxID');
      const cAcct  = el(customerEls[i], 'AccountID');
      if (cName) {
        details.push({
          group: 'Clientes',
          label: `Cliente ${i + 1}${cNif ? ` (NIF: ${cNif})` : ''}`,
          value: cName + (cAcct ? ` · Conta: ${cAcct}` : ''),
        });
      }
    }
    if (customerEls.length > 50) {
      details.push({ group: 'Clientes', label: '…', value: `+ ${customerEls.length - 50} clientes adicionais` });
    }
  }

  // ─── Suppliers ───────────────────────────────────────────────────
  const supplierEls = doc.getElementsByTagName('Supplier');
  if (supplierEls.length > 0) {
    details.push({ group: 'Fornecedores', label: 'Total de Fornecedores', value: String(supplierEls.length) });
    for (let i = 0; i < Math.min(supplierEls.length, 30); i++) {
      const sName = el(supplierEls[i], 'CompanyName') || el(supplierEls[i], 'Name');
      const sNif  = el(supplierEls[i], 'SupplierTaxID');
      if (sName) {
        details.push({
          group: 'Fornecedores',
          label: `Fornecedor ${i + 1}${sNif ? ` (NIF: ${sNif})` : ''}`,
          value: sName,
        });
      }
    }
    if (supplierEls.length > 30) {
      details.push({ group: 'Fornecedores', label: '…', value: `+ ${supplierEls.length - 30} fornecedores adicionais` });
    }
  }

  // ─── Products ────────────────────────────────────────────────────
  const productEls = doc.getElementsByTagName('Product');
  if (productEls.length > 0) {
    details.push({ group: 'Produtos / Serviços', label: 'Total de Artigos', value: String(productEls.length) });
    for (let i = 0; i < Math.min(productEls.length, 50); i++) {
      const pCode = el(productEls[i], 'ProductCode');
      const pDesc = el(productEls[i], 'ProductDescription');
      const pType = el(productEls[i], 'ProductType');
      if (pDesc) {
        details.push({
          group: 'Produtos / Serviços',
          label: `${pCode || `Art. ${i + 1}`}${pType ? ` (${pType})` : ''}`,
          value: pDesc,
        });
      }
    }
    if (productEls.length > 50) {
      details.push({ group: 'Produtos / Serviços', label: '…', value: `+ ${productEls.length - 50} artigos adicionais` });
    }
  }

  // ─── Tax Table ────────────────────────────────────────────────────
  const taxTableEls = doc.getElementsByTagName('TaxTableEntry');
  for (let i = 0; i < taxTableEls.length; i++) {
    const taxType        = el(taxTableEls[i], 'TaxType');
    const taxCountryReg  = el(taxTableEls[i], 'TaxCountryRegion');
    const taxCode        = el(taxTableEls[i], 'TaxCode');
    const desc           = el(taxTableEls[i], 'Description');
    const taxPct         = el(taxTableEls[i], 'TaxPercentage');
    if (taxType) {
      details.push({
        group: 'Tabela de Impostos',
        label: `${taxType} ${taxCode} (${taxCountryReg})`,
        value: desc + (taxPct ? ` — ${taxPct}%` : ''),
      });
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // SOURCE DOCUMENTS — SalesInvoices
  // ═════════════════════════════════════════════════════════════════
  const salesEl = doc.getElementsByTagName('SalesInvoices')[0];
  let totalCredit = 0;
  if (salesEl) {
    const nEntries   = el(salesEl, 'NumberOfEntries');
    const totalDebit = el(salesEl, 'TotalDebit');
    const totalCrStr = el(salesEl, 'TotalCredit');
    totalCredit      = parseFloat(totalCrStr) || 0;

    if (nEntries)   details.push({ group: 'Documentos de Venda', label: 'Nº de Documentos',    value: nEntries });
    if (totalDebit) details.push({ group: 'Documentos de Venda', label: 'Total Débito',         value: fmtEur(parseFloat(totalDebit) || 0) });
    if (totalCrStr) details.push({ group: 'Documentos de Venda', label: 'Total Crédito (VN)',   value: fmtEur(totalCredit) });

    // Invoice breakdown by type
    const invoiceEls = salesEl.getElementsByTagName('Invoice');
    const byType: Record<string, { count: number; total: number }> = {};
    let hasNormal = false;
    let hasISE    = false;
    let eacCode   = '';

    for (let i = 0; i < invoiceEls.length; i++) {
      const invType  = el(invoiceEls[i], 'InvoiceType');
      const grossVal = parseFloat(el(invoiceEls[i], 'GrossTotal')) || 0;
      if (invType) {
        if (!byType[invType]) byType[invType] = { count: 0, total: 0 };
        byType[invType].count++;
        byType[invType].total += grossVal;
      }
      const lines = invoiceEls[i].getElementsByTagName('Line');
      for (let j = 0; j < lines.length; j++) {
        const taxCode = lines[j].getElementsByTagName('TaxCode')[0]?.textContent?.trim() ?? '';
        if (taxCode === 'NOR' || taxCode === 'INT' || taxCode === 'RED') hasNormal = true;
        if (taxCode === 'ISE') hasISE = true;
        const eac = invoiceEls[i].getElementsByTagName('EACCode')[0]?.textContent?.trim() ?? '';
        if (eac && /^\d{5}$/.test(eac) && !eacCode) eacCode = eac;
      }
    }

    for (const [invType, stats] of Object.entries(byType)) {
      details.push({
        group: 'Documentos de Venda',
        label: `Tipo ${invType}`,
        value: `${stats.count} documento(s) · ${fmtEur(stats.total)}`,
      });
    }

    if (hasISE && !hasNormal) {
      profile.regimeIva = 'isento';
      filled.push('Regime de IVA (isento)');
      details.push({ group: 'Dados Fiscais', label: 'Regime de IVA', value: 'Isento (art.º 9.º CIVA)' });
    } else if (hasNormal) {
      profile.regimeIva = 'normal_mensal';
      filled.push('Regime de IVA (normal)');
      details.push({ group: 'Dados Fiscais', label: 'Regime de IVA', value: 'Regime Normal Mensal' });
    }

    if (eacCode) {
      profile.cae = eacCode;
      filled.push('CAE');
      details.push({ group: 'Dados Fiscais', label: 'CAE (código atividade)', value: eacCode });
    }
  }

  // ─── Purchases ───────────────────────────────────────────────────
  const purchasesEl = doc.getElementsByTagName('Purchases')[0]
    ?? doc.getElementsByTagName('PurchasesInvoices')[0];
  if (purchasesEl) {
    const nEntries   = el(purchasesEl, 'NumberOfEntries');
    const totalDebit = el(purchasesEl, 'TotalDebit');
    const totalCr    = el(purchasesEl, 'TotalCredit');
    if (nEntries)   details.push({ group: 'Documentos de Compra', label: 'Nº de Documentos', value: nEntries });
    if (totalDebit) details.push({ group: 'Documentos de Compra', label: 'Total Débito',      value: fmtEur(parseFloat(totalDebit) || 0) });
    if (totalCr)    details.push({ group: 'Documentos de Compra', label: 'Total Crédito',     value: fmtEur(parseFloat(totalCr)   || 0) });
  }

  // ─── MovementOfGoods ─────────────────────────────────────────────
  const movGoodsEl = doc.getElementsByTagName('MovementOfGoods')[0];
  if (movGoodsEl) {
    const nEntries = el(movGoodsEl, 'NumberOfMovementLines');
    const total    = el(movGoodsEl, 'TotalQuantityIssued');
    if (nEntries) details.push({ group: 'Movimentos de Stock', label: 'Nº de Linhas', value: nEntries });
    if (total)    details.push({ group: 'Movimentos de Stock', label: 'Qtd. Total Emitida', value: total });
  }

  // ─── WorkingDocuments ────────────────────────────────────────────
  const workDocsEl = doc.getElementsByTagName('WorkingDocuments')[0];
  if (workDocsEl) {
    const nEntries = el(workDocsEl, 'NumberOfEntries');
    const totalDr  = el(workDocsEl, 'TotalDebit');
    const totalCr  = el(workDocsEl, 'TotalCredit');
    if (nEntries) details.push({ group: 'Documentos de Trabalho', label: 'Nº de Documentos', value: nEntries });
    if (totalDr)  details.push({ group: 'Documentos de Trabalho', label: 'Total Débito',      value: fmtEur(parseFloat(totalDr) || 0) });
    if (totalCr)  details.push({ group: 'Documentos de Trabalho', label: 'Total Crédito',     value: fmtEur(parseFloat(totalCr) || 0) });
  }

  // ─── Payments ────────────────────────────────────────────────────
  const paymentsEl = doc.getElementsByTagName('Payments')[0];
  let workerNifsCount = 0;
  if (paymentsEl) {
    const nEntries = el(paymentsEl, 'NumberOfEntries');
    const totalDr  = el(paymentsEl, 'TotalDebit');
    const totalCr  = el(paymentsEl, 'TotalCredit');
    if (nEntries) details.push({ group: 'Pagamentos / Recibos', label: 'Nº de Documentos', value: nEntries });
    if (totalDr)  details.push({ group: 'Pagamentos / Recibos', label: 'Total Débito',      value: fmtEur(parseFloat(totalDr) || 0) });
    if (totalCr)  details.push({ group: 'Pagamentos / Recibos', label: 'Total Crédito',     value: fmtEur(parseFloat(totalCr) || 0) });

    // Salary payments → estimate employees
    const paymentDocEls = paymentsEl.getElementsByTagName('Payment');
    const workerNifs = new Set<string>();
    for (let i = 0; i < paymentDocEls.length; i++) {
      const type = el(paymentDocEls[i], 'PaymentType');
      if (type === 'RG' || type === 'RV') {
        const lineEls = paymentDocEls[i].getElementsByTagName('Line');
        for (let j = 0; j < lineEls.length; j++) {
          const wNif = el(lineEls[j], 'EmployeeID');
          if (wNif) workerNifs.add(wNif);
        }
      }
    }
    workerNifsCount = workerNifs.size;
  }

  // ─── GeneralLedgerEntries (for type C) ───────────────────────────
  const glEntriesEl = doc.getElementsByTagName('GeneralLedgerEntries')[0];
  if (glEntriesEl) {
    const nJournals = el(glEntriesEl, 'NumberOfJournals');
    const nTrans    = el(glEntriesEl, 'NumberOfTransactions');
    const nEntries  = el(glEntriesEl, 'NumberOfEntries');
    const totalDr   = el(glEntriesEl, 'TotalDebit');
    const totalCr   = el(glEntriesEl, 'TotalCredit');
    if (nJournals) details.push({ group: 'Diário Contabilístico', label: 'Nº de Diários',     value: nJournals });
    if (nTrans)    details.push({ group: 'Diário Contabilístico', label: 'Nº de Transações',   value: nTrans });
    if (nEntries)  details.push({ group: 'Diário Contabilístico', label: 'Nº de Lançamentos',  value: nEntries });
    if (totalDr)   details.push({ group: 'Diário Contabilístico', label: 'Total Débito',       value: fmtEur(parseFloat(totalDr) || 0) });
    if (totalCr)   details.push({ group: 'Diário Contabilístico', label: 'Total Crédito',      value: fmtEur(parseFloat(totalCr) || 0) });
  }

  // ═════════════════════════════════════════════════════════════════
  // PROFILE population (same as before)
  // ═════════════════════════════════════════════════════════════════
  if (companyName) {
    profile.nomeCliente = companyName;
    filled.push('Nome');
  }
  if (taxRegNr) {
    profile.nif = taxRegNr;
    filled.push('NIF');
  }

  if (contactEl) {
    const telephone = el(contactEl, 'Telephone');
    const email     = el(contactEl, 'Email');
    if (telephone) { profile.telefone = telephone; filled.push('Telefone'); }
    if (email && email.includes('@')) { profile.email = email; filled.push('Email'); }
  }

  if (addrEl) {
    const buildingNumber = el(addrEl, 'BuildingNumber');
    const streetName     = el(addrEl, 'StreetName');
    const addressDetail  = el(addrEl, 'AddressDetail');
    const city           = el(addrEl, 'City');
    const postalCode     = el(addrEl, 'PostalCode');

    const line1 = [streetName, buildingNumber].filter(Boolean).join(' ') || addressDetail;
    if (line1) { profile.morada = line1; filled.push('Morada'); }
    if (postalCode && postalCode !== '0000-000') { profile.codigoPostal = postalCode; filled.push('Código Postal'); }
    if (city && city.toLowerCase() !== 'desconhecido') { profile.localidade = city; filled.push('Localidade'); }
  }

  if (taxBasis === 'C' || taxBasis === 'L') {
    profile.tipoEntidade = 'lda';
    profile.regimeContabilidade = 'organizada';
    warnings.push(`TaxAccountingBasis "${taxBasis}" sugere contabilidade organizada — confirme o tipo de entidade`);
    filled.push('Tipo de entidade', 'Regime de contabilidade');
  } else if (taxBasis === 'S') {
    profile.tipoEntidade = 'eni';
    profile.regimeContabilidade = 'simplificado';
    filled.push('Tipo de entidade', 'Regime de contabilidade');
  } else if (taxBasis === 'F') {
    profile.tipoEntidade = 'eni';
    profile.regimeContabilidade = 'simplificado';
    filled.push('Tipo de entidade', 'Regime de contabilidade');
  }

  if (period > 2000) {
    profile.inicioAtividade = period;
    filled.push('Ano de atividade');
  }

  // Activity type from invoice lines
  let serviceCount = 0;
  let goodsCount   = 0;
  const eacCodeFromSales = details.find(d => d.group === 'Dados Fiscais' && d.label.startsWith('CAE'))?.value ?? '';
  const allLines = doc.getElementsByTagName('Line');
  for (let i = 0; i < Math.min(allLines.length, 200); i++) {
    const desc = allLines[i].getElementsByTagName('Description')[0]?.textContent?.trim().toLowerCase() ?? '';
    const isService = /(consultoria|servi[cç]o|presta[cç][aã]o|assessoria|forma[cç][aã]o|repara[cç][aã]o|manuten[cç][aã]o|transporte|aluguer|software|design|marketing|contabilidade|auditoria|jur[ií]dico|m[eé]dico|arquitetura|engenharia|inform[aá]tica)/.test(desc);
    const isGoods   = /(venda|produto|mercadoria|artigo|material|equipamento|stock|armaz[eé]m|compra|fornecedor)/.test(desc);
    if (isService) serviceCount++;
    else if (isGoods) goodsCount++;
    else {
      const cp = parseInt(eacCodeFromSales.slice(0, 2), 10) || 0;
      if (cp >= 45 && cp <= 47) goodsCount++;
      else if (cp >= 49 && cp <= 99) serviceCount++;
    }
  }
  if (serviceCount > 0 || goodsCount > 0) {
    profile.atividadePrincipal = serviceCount >= goodsCount ? 'servicos' : 'bens';
    filled.push('Tipo de atividade');
  } else {
    profile.atividadePrincipal = 'servicos';
  }

  // Revenue / VN
  if (totalCredit > 0 && startDate && endDate) {
    const start  = new Date(startDate);
    const end    = new Date(endDate);
    const days   = (end.getTime() - start.getTime()) / 86400000 + 1;
    const months = days / 30.44;

    let fatAnual: number;
    if (months < 11.5) {
      fatAnual = Math.round((totalCredit / months) * 12);
      warnings.push(`Faturação anualizada: ${totalCredit.toFixed(2)} € em ${months.toFixed(1)} mês(es) → estimativa anual ${fatAnual.toLocaleString('pt-PT')} €`);
    } else {
      fatAnual = Math.round(totalCredit);
    }
    if (fatAnual > 0) {
      profile.faturaçaoAnualPrevista = fatAnual;
      filled.push('Faturação anual estimada');
      details.push({
        group: 'Dados Fiscais',
        label: 'Faturação do Período',
        value: `${fmtEur(totalCredit)}${months < 11.5 ? ` (anualizado → ${fatAnual.toLocaleString('pt-PT')} €)` : ''}`,
      });
    }
  }

  if ((profile.tipoEntidade === 'eni' || profile.tipoEntidade === 'unipessoal') && profile.faturaçaoAnualPrevista) {
    profile.rendimentoMensalEni = Math.round(profile.faturaçaoAnualPrevista / 12);
    filled.push('Rendimento mensal ENI (estimado)');
  }
  if (profile.tipoEntidade === 'eni' || profile.tipoEntidade === 'unipessoal') {
    profile.regimeSs  = profile.regimeContabilidade === 'simplificado' ? 'simplified' : 'general';
    profile.tipoRendimentoSs = profile.atividadePrincipal === 'bens' ? 'bens' : 'servicos';
    filled.push('Regime SS (estimado)');
  }

  if (workerNifsCount > 0) {
    profile.nrFuncionarios = workerNifsCount;
    filled.push('Nº de funcionários (estimado)');
    details.push({ group: 'Dados Fiscais', label: 'Nº de Funcionários', value: `${workerNifsCount} (via recibos de vencimento)` });
  }

  // Fixed assets / vehicles
  const fixedAssetEls = doc.getElementsByTagName('Asset');
  const vehicles: { desc: string; value: number }[] = [];
  for (let i = 0; i < fixedAssetEls.length; i++) {
    const desc     = el(fixedAssetEls[i], 'Description').toLowerCase();
    const isVehicle = /(viatura|ve[ií]culo|carro|autom[oó]vel|carrinha|cami[aã]o|motociclo|moto)/.test(desc);
    if (isVehicle) {
      const val = parseFloat(el(fixedAssetEls[i], 'AcquisitionAndProductionCosts')) || 0;
      if (val > 0) vehicles.push({ desc: el(fixedAssetEls[i], 'Description'), value: val });
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
  // PREVISA population
  // ═════════════════════════════════════════════════════════════════
  if (taxRegNr)     previsa.nif        = taxRegNr;
  if (companyName)  previsa.designacao  = companyName;
  if (period > 2000) previsa.periodo   = period;

  // Volume de negócios para PEC/PC
  if (profile.faturaçaoAnualPrevista && profile.faturaçaoAnualPrevista > 0) {
    previsa.volumeNegocios = profile.faturaçaoAnualPrevista;
  } else if (totalCredit > 0) {
    previsa.volumeNegocios = Math.round(totalCredit);
  }

  // RAI estimado a partir das contas de classe 8 (apenas SAF-T tipo C)
  if (glCount > 0 && resultadoEstimado !== 0) {
    previsa.c701_rai = Math.round(resultadoEstimado * 100) / 100;
    warnings.push(`RAI estimado das contas 81x: ${fmtEur(Math.abs(resultadoEstimado))} ${resultadoEstimado >= 0 ? '(lucro)' : '(prejuízo)'}. Confirme com a contabilidade.`);
    details.push({
      group: 'Dados Fiscais',
      label: 'RAI estimado (conta 81x)',
      value: `${fmtEur(Math.abs(resultadoEstimado))} ${resultadoEstimado >= 0 ? 'Lucro' : 'Prejuízo'}`,
    });
  }

  // PME / Regime
  if (profile.tipoEntidade === 'lda' || taxBasis === 'C' || taxBasis === 'L') {
    previsa.isPME = true;
    previsa.regime = previsa.territorio === 'madeira' ? 'madeira'
                   : previsa.territorio === 'acores'  ? 'acores'
                   : 'geral';
  }

  // ═════════════════════════════════════════════════════════════════
  // Empty fields
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

  return { profile, previsa, warnings, filled, empty, details };
}
