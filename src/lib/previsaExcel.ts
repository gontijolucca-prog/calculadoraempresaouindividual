/**
 * Descarregar o Previsa preenchido — IGUAL ao modelo original PrevisaV25_01.xls.
 *
 * O template é o PRÓPRIO ficheiro original convertido uma única vez para .xlsx
 * (public/previsa-template.xlsx, via LibreOffice — preserva as 13 folhas,
 * fórmulas, estilos, cores, merges e larguras). Aqui NÃO se reconstrói o
 * workbook: abre-se o .xlsx como zip (fflate) e editam-se APENAS as células de
 * input directamente no XML das folhas — tudo o resto fica byte-a-byte igual.
 * (A abordagem anterior, SheetJS Community, perdia toda a formatação: a edição
 * Community não escreve estilos — o ficheiro saía "despido".)
 *
 * Ao abrir, o Excel/LibreOffice/Sheets recalcula todo o Modelo 22 a partir dos
 * inputs: o workbook leva <calcPr fullCalcOnLoad="1"> e os valores em cache das
 * células com fórmula são removidos (dupla garantia).
 *
 * Mapa de células (descoberto por análise do modelo):
 *   ' Res Q10'  C6=711 C8=712 C10=72 C12=74 C13=75 C14=76 C15=77 C16=78 C17=79
 *               C44=compras→CMV  C50=compras→CMC
 *               C54=62 C55=63 C56=64 C57=65 C58=66 C59=67 C60=68 C61=69  C64=8122
 *   'Folha1'    C2=regime fiscal   C16=dimensão PME
 *   'Identificação' L4=designação  L6=ano
 */
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import type { PreviSaState } from '../previSaState';

const REGIME_TO_C2: Record<string, number> = {
  geral: 1, madeira: 2, acores: 3, interioridade: 5, startup: 1,
};

const escXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Coluna "C"/"L"/"AA" → número (para inserir células por ordem). */
function colNum(ref: string): number {
  const letters = ref.replace(/\d+$/, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/**
 * Substitui (ou insere) UMA célula no XML de uma folha, preservando o atributo
 * de estilo `s="…"` da célula original — é ele que mantém a formatação.
 * Números ficam sem atributo de tipo; strings vão como inlineStr (não mexe na
 * sharedStrings).
 */
function setCellXml(xml: string, ref: string, value: number | string): string {
  const isStr = typeof value === 'string';
  const body = isStr
    ? ` t="inlineStr"><is><t xml:space="preserve">${escXml(value)}</t></is></c>`
    : `><v>${value}</v></c>`;
  const cellRe = new RegExp(`<c r="${ref}"((?:\\s[^>]*?)?)(?:/>|>[\\s\\S]*?</c>)`);
  const m = cellRe.exec(xml);
  if (m) {
    // mantém todos os atributos excepto o tipo (t), que depende do valor novo
    const attrs = (m[1] ?? '').replace(/\s+t="[^"]*"/, '');
    return xml.slice(0, m.index) + `<c r="${ref}"${attrs}${body}` + xml.slice(m.index + m[0].length);
  }
  // Fallback (não deve acontecer — as células de input existem no modelo):
  // insere a célula na linha respectiva, por ordem de coluna.
  const rowNum = ref.replace(/^[A-Z]+/, '');
  const rowRe = new RegExp(`<row r="${rowNum}"[^>]*>`);
  const rm = rowRe.exec(xml);
  if (!rm) throw new Error(`Modelo Previsa: linha ${rowNum} não existe para a célula ${ref}`);
  const cellTag = `<c r="${ref}"${body}`;
  if (rm[0].endsWith('/>')) {
    // linha vazia auto-fechada → abre-a e mete a célula lá dentro
    const opened = rm[0].slice(0, -2) + '>';
    return xml.slice(0, rm.index) + opened + cellTag + '</row>' + xml.slice(rm.index + rm[0].length);
  }
  // procura a primeira célula da linha com coluna maior e insere antes dela
  const rowEnd = xml.indexOf('</row>', rm.index);
  const rowBody = xml.slice(rm.index + rm[0].length, rowEnd);
  let insertOffset = rowBody.length; // por defeito, no fim da linha
  for (const cm of rowBody.matchAll(/<c r="([A-Z]+\d+)"/g)) {
    if (colNum(cm[1]) > colNum(ref)) { insertOffset = cm.index!; break; }
  }
  const at = rm.index + rm[0].length + insertOffset;
  return xml.slice(0, at) + cellTag + xml.slice(at);
}

/** Remove o valor em cache das células com fórmula (obriga a recalcular). */
function stripCachedFormulaValues(xml: string): string {
  return xml
    .replace(/(<f(?:\s[^>]*)?>[\s\S]*?<\/f>)<v(?:\s[^>]*)?>[\s\S]*?<\/v>/g, '$1')
    .replace(/(<f(?:\s[^>]*)?\/>)<v(?:\s[^>]*)?>[\s\S]*?<\/v>/g, '$1');
}

/**
 * Núcleo puro (testável fora do browser): template .xlsx em bytes + estado do
 * Previsa → bytes do .xlsx preenchido.
 */
export function buildPrevisaXlsx(template: Uint8Array, state: PreviSaState): Uint8Array {
  const files = unzipSync(template);
  const read = (path: string) => {
    const f = files[path];
    if (!f) throw new Error(`Modelo Previsa: falta ${path} no .xlsx`);
    return strFromU8(f);
  };

  // ── mapa nome da folha → ficheiro xl/worksheets/sheetN.xml ────────────────
  const wbXml = read('xl/workbook.xml');
  const relsXml = read('xl/_rels/workbook.xml.rels');
  const relTarget = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
    const target = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
    if (id && target) relTarget.set(id, target);
  }
  const sheetFile = new Map<string, string>();
  for (const m of wbXml.matchAll(/<sheet\b[^>]*>/g)) {
    const name = /\bname="([^"]*)"/.exec(m[0])?.[1];
    const rid = /\br:id="([^"]+)"/.exec(m[0])?.[1];
    const target = rid ? relTarget.get(rid) : undefined;
    if (name != null && target) {
      // nomes vêm escapados no XML (&amp; etc) — desfaz para comparar
      const plain = name.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      sheetFile.set(plain, target.startsWith('/') ? target.slice(1) : `xl/${target}`);
    }
  }

  // ── células de input ──────────────────────────────────────────────────────
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const RQ = ' Res Q10'; // nome da folha tem espaço inicial — propositado
  const edits: [string, string, number | string][] = [
    [RQ, 'C6', n(state.rai_711)],
    [RQ, 'C8', n(state.rai_712)],
    [RQ, 'C10', n(state.rai_72)],
    [RQ, 'C12', n(state.rai_74)],
    [RQ, 'C13', n(state.rai_75)],
    [RQ, 'C14', n(state.rai_76)],
    [RQ, 'C15', n(state.rai_77)],
    [RQ, 'C16', n(state.rai_78)],
    [RQ, 'C17', n(state.rai_79)],
    [RQ, 'C44', n(state.rai_cmv)], // compras de mercadorias → CMV (C41 = C42+C44+C45-C46)
    [RQ, 'C50', n(state.rai_cmc)], // compras de matérias  → CMC (C47 = C48+C50+C51-C52)
    [RQ, 'C54', n(state.rai_62)],
    [RQ, 'C55', n(state.rai_63)],
    [RQ, 'C56', n(state.rai_64)],
    [RQ, 'C57', n(state.rai_65)],
    [RQ, 'C58', n(state.rai_66)],
    [RQ, 'C59', n(state.rai_67)],
    [RQ, 'C60', n(state.rai_68)],
    [RQ, 'C61', n(state.rai_69)],
    [RQ, 'C64', n(state.rai_8122_db) - n(state.rai_8122_cr)],
    ['Folha1', 'C2', REGIME_TO_C2[state.regime] ?? 1],
    ['Folha1', 'C16', state.isPME ? 2 : 4],
    ['Identificação', 'L4', state.designacao || 'Empresa'],
    ['Identificação', 'L6', state.periodo || new Date().getFullYear() - 1],
    // Startup (Lei 21/2023) — pergunta SIM/NÃO na folha de identificação.
    ['Identificação', 'S14', state.isStartup ? 'SIM' : 'NÃO'],
  ];

  const sv = state as unknown as Record<string, unknown>;
  const nf = (k: string) => n(sv[k]);
  const anoFiscal = state.periodo || new Date().getFullYear() - 1;

  // ── Quadro 07 (folha "Q7 e Q9"): campos a acrescer (D4-D72) e a deduzir
  // (D74-D105), alinhados pelo código oficial do Modelo 22 na coluna C.
  // Mapa célula→campo verificado contra o template (células de input apenas).
  const Q7Q9 = 'Q7 e Q9';
  const q7Map: [string, string][] = [
    ['D4', 'c702'], ['D5', 'c703'], ['D6', 'c805'], ['D7', 'c704'], ['D8', 'c705'],
    ['D9', 'c806'], ['D10', 'c706'], ['D11', 'c707'], ['D13', 'c709'], ['D15', 'c711'],
    ['D16', 'c782'], ['D17', 'c712'], ['D18', 'c713'], ['D19', 'c714'], ['D24', 'c725'],
    ['D26', 'c731'], ['D27', 'c726'], ['D28', 'c783'], ['D29', 'c728'], ['D30', 'c727'],
    ['D31', 'c729'], ['D32', 'c730'], ['D33', 'c732'], ['D35', 'c784'], ['D36', 'c734'],
    ['D38', 'c780'], ['D39', 'c785'], ['D40', 'c802'], ['D41', 'c746'], ['D42', 'c737'],
    ['D43', 'c786'], ['D44', 'c718'], ['D46', 'c720'], ['D47', 'c722'], ['D48', 'c723'],
    ['D49', 'c736'], ['D50', 'c738'], ['D51', 'c739'], ['D53', 'c741'], ['D54', 'c742'],
    ['D55', 'c743'], ['D56', 'c787'], ['D57', 'c744'], ['D58', 'c745'], ['D59', 'c747'],
    ['D60', 'c748'], ['D61', 'c749'], ['D62', 'c788'], ['D63', 'c750'], ['D64', 'c789'],
    ['D65', 'c790'], ['D66', 'c751'], ['D67', 'c803'], ['D68', 'c779'], ['D69', 'c797'],
    ['D70', 'c799'], ['D71', 'c804'], ['D72', 'c752'],
    ['D74', 'c754'], ['D75', 'c755'], ['D76', 'c756'], ['D77', 'c757'], ['D78', 'c791'],
    ['D79', 'c758'], ['D80', 'c759'], ['D81', 'c760'], ['D82', 'c761'], ['D83', 'c762'],
    ['D85', 'c781'], ['D86', 'c764'], ['D87', 'c765'], ['D88', 'c766'], ['D89', 'c792'],
    ['D90', 'c767'], ['D91', 'c768'], ['D92', 'c769'], ['D93', 'c770'], ['D94', 'c793'],
    ['D95', 'c771'], ['D98', 'c795'], ['D99', 'c773'], ['D100', 'c796'], ['D101', 'c774'],
    ['D102', 'c800'], ['D103', 'c801'], ['D104', 'c798'], ['D105', 'c775'],
    ['D126', 'c397'],
  ];
  for (const [cell, field] of q7Map) {
    const v = nf(field);
    if (v !== 0) edits.push([Q7Q9, cell, v]);
  }
  // Despesas não documentadas (campo 716 → D25): se o Q07 não foi preenchido
  // mas o SAF-T trouxe os montantes da TA, usa-os — o Excel deriva daqui tanto
  // o acréscimo ao Q07 como a tributação autónoma (C107 = D25 − C117).
  const despNaoDoc = nf('c716') > 0 ? nf('c716') : nf('ta_despNaoDocPrincipal') + nf('ta_despNaoDocNaoPrincipal');
  if (despNaoDoc !== 0) edits.push([Q7Q9, 'D25', despNaoDoc]);

  // ── Quadro 09 (prejuízos fiscais): as linhas do template são RELATIVAS ao
  // período (D121 = Ano-1 … D115 = Ano-7; D114 = anos até 2017) — alinhar os
  // campos por ano do estado com o período exportado.
  let prejAntigos = nf('prej_ate2017');
  for (let back = 1; back <= 7; back++) {
    const y = anoFiscal - back;
    const v = y >= 2018 && y <= 2024 ? nf(`prej_${y}`) : 0;
    if (v !== 0) edits.push([Q7Q9, `D${122 - back}`, v]);
  }
  for (let y = 2018; y <= 2024; y++) {
    if (y < anoFiscal - 7) prejAntigos += nf(`prej_${y}`);
  }
  if (prejAntigos !== 0) edits.push([Q7Q9, 'D114', prejAntigos]);

  // ── ' Res Q10': deduções à coleta, TA (outras), pagamentos e derrama ──────
  const rq10Map: [string, string][] = [
    ['C81', 'c375'],            // dupla tributação económica internacional
    ['C82', 'c355_bf'],         // benefícios fiscais (exceto CFEI II e IFR)
    ['C84', 'c355_cfei'],       // CFEI II
    ['C85', 'c355_ifr'],        // IFR
    ['C87', 'c470'],            // adicional ao IMI
    ['C93', 'retencoesFonte'],
    ['C94', 'pcPagamentos'],
    ['C95', 'pacPagamentos'],
    ['C98', 'c363'],            // IRC de períodos anteriores
    ['C99', 'c372'],            // reposição de benefícios fiscais
    ['C108', 'ta_representacao'],
    ['C109', 'ta_ajadasCusto'],
    ['C113', 'ta_lucrosDistribuidos'],
    ['C114', 'ta_offshores'],
    ['C115', 'ta_indemCessacao'],
    ['C116', 'ta_bonus'],
    ['C117', 'ta_despNaoDocNaoPrincipal'],
    ['C120', 'ta_retFonteArt88n12'],
    ['C121', 'c369'],
    ['C122', 'c366'],
  ];
  for (const [cell, field] of rq10Map) {
    const v = nf(field);
    if (v !== 0) edits.push([RQ, cell, v]);
  }
  // Taxa de derrama municipal (fração, ex. 0.015) — escreve sempre o valor do
  // estado para a estimativa do Excel bater com a do simulador.
  edits.push([RQ, 'C101', n(state.taxaDerramaMunicipal)]);

  const edited = new Map<string, string>();
  for (const [sheet, ref, value] of edits) {
    const path = sheetFile.get(sheet);
    if (!path) throw new Error(`Modelo Previsa: folha "${sheet}" não encontrada`);
    const xml = edited.get(path) ?? read(path);
    edited.set(path, setCellXml(xml, ref, value));
  }

  // ── recálculo garantido ao abrir ─────────────────────────────────────────
  // 1) limpa caches de fórmulas em TODAS as folhas
  for (const path of new Set(sheetFile.values())) {
    const xml = edited.get(path) ?? read(path);
    edited.set(path, stripCachedFormulaValues(xml));
  }
  // 2) <calcPr fullCalcOnLoad="1"> no workbook
  let newWb = wbXml;
  if (/<calcPr\b[^>]*\/>/.test(newWb)) {
    newWb = newWb.replace(/<calcPr\b([^>]*?)\s*\/>/, (_mm, attrs: string) =>
      `<calcPr${attrs.replace(/\s*fullCalcOnLoad="[^"]*"/, '')} fullCalcOnLoad="1"/>`);
  } else {
    newWb = newWb.replace('</sheets>', '</sheets><calcPr fullCalcOnLoad="1"/>');
  }
  edited.set('xl/workbook.xml', newWb);

  for (const [path, xml] of edited) files[path] = strToU8(xml);
  return zipSync(files, { level: 6 });
}

export async function downloadPrevisaExcel(state: PreviSaState, fileLabel?: string): Promise<void> {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  const url = `${base}previsa-template.xlsx`.replace(/([^:])\/\//g, '$1/');
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Modelo Previsa não encontrado (${resp.status})`);
  const out = buildPrevisaXlsx(new Uint8Array(await resp.arrayBuffer()), state);

  const slug = (fileLabel || state.designacao || 'empresa')
    .normalize('NFD').replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '') || 'empresa';
  const blob = new Blob([out as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Previsa_${slug}_${state.periodo || ''}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
