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
  ];

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
