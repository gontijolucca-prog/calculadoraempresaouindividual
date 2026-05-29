/**
 * Descarregar o Previsa preenchido — IGUAL ao modelo original PrevisaV25_01.xls.
 *
 * Em vez de reconstruir o documento, usamos o PRÓPRIO ficheiro original como
 * template (public/previsa-template.xls): lê-se com SheetJS (preserva as 13
 * folhas e 100% das fórmulas), escrevem-se APENAS as células de input com os
 * dados da empresa e exporta-se .xlsx. Ao abrir, o Excel/LibreOffice/Sheets
 * recalcula todo o Modelo 22 a partir desses inputs.
 *
 * Mapa de células (descoberto por análise do modelo):
 *   ' Res Q10'  C6=711 C8=712 C10=72 C12=74 C13=75 C14=76 C15=77 C16=78 C17=79
 *               C44=compras→CMV  C50=compras→CMC
 *               C54=62 C55=63 C56=64 C57=65 C58=66 C59=67 C60=68 C61=69  C64=8122
 *   'Folha1'    C2=regime fiscal   C16=dimensão PME
 *   'Identificação' L4=designação  L6=ano
 */
import type { PreviSaState } from '../previSaState';

const REGIME_TO_C2: Record<string, number> = {
  geral: 1, madeira: 2, acores: 3, interioridade: 5, startup: 1,
};

export async function downloadPrevisaExcel(state: PreviSaState, fileLabel?: string): Promise<void> {
  const XLSX = await import('xlsx');
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  const url = `${base}previsa-template.xls`.replace(/([^:])\/\//g, '$1/');
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Modelo Previsa não encontrado (${resp.status})`);
  const buf = await resp.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellFormula: true, cellNF: true });

  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const setNum = (sheet: string, addr: string, val: number) => {
    const ws = wb.Sheets[sheet];
    if (ws) ws[addr] = { t: 'n', v: n(val) };
  };
  const setStr = (sheet: string, addr: string, val: string) => {
    const ws = wb.Sheets[sheet];
    if (ws) ws[addr] = { t: 's', v: val ?? '' };
  };

  const RQ = ' Res Q10'; // nome da folha tem espaço inicial — propositado
  setNum(RQ, 'C6', state.rai_711);
  setNum(RQ, 'C8', state.rai_712);
  setNum(RQ, 'C10', state.rai_72);
  setNum(RQ, 'C12', state.rai_74);
  setNum(RQ, 'C13', state.rai_75);
  setNum(RQ, 'C14', state.rai_76);
  setNum(RQ, 'C15', state.rai_77);
  setNum(RQ, 'C16', state.rai_78);
  setNum(RQ, 'C17', state.rai_79);
  setNum(RQ, 'C44', state.rai_cmv); // compras de mercadorias → CMV (C41 = C42+C44+C45-C46)
  setNum(RQ, 'C50', state.rai_cmc); // compras de matérias  → CMC (C47 = C48+C50+C51-C52)
  setNum(RQ, 'C54', state.rai_62);
  setNum(RQ, 'C55', state.rai_63);
  setNum(RQ, 'C56', state.rai_64);
  setNum(RQ, 'C57', state.rai_65);
  setNum(RQ, 'C58', state.rai_66);
  setNum(RQ, 'C59', state.rai_67);
  setNum(RQ, 'C60', state.rai_68);
  setNum(RQ, 'C61', state.rai_69);
  setNum(RQ, 'C64', n(state.rai_8122_db) - n(state.rai_8122_cr));

  setNum('Folha1', 'C2', REGIME_TO_C2[state.regime] ?? 1);
  setNum('Folha1', 'C16', state.isPME ? 2 : 4);

  setStr('Identificação', 'L4', state.designacao || 'Empresa');
  setNum('Identificação', 'L6', state.periodo || new Date().getFullYear() - 1);

  // Força recálculo ao abrir. As fórmulas do template trazem resultados em cache
  // (todos 0, porque foi guardado vazio) e o SheetJS Community não escreve o
  // elemento <calcPr fullCalcOnLoad>. A forma fiável e universal de obrigar o
  // Excel/LibreOffice/Sheets a recalcular é remover o valor em cache das células
  // com fórmula: sem <v>, o programa é obrigado a computar o resultado ao abrir.
  type Cell = { f?: string; v?: unknown; w?: string };
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName] as Record<string, Cell>;
    for (const addr in ws) {
      if (addr[0] === '!') continue;
      const cell = ws[addr];
      if (cell && cell.f) { delete cell.v; delete cell.w; }
    }
  }

  const slug = (fileLabel || state.designacao || 'empresa')
    .normalize('NFD').replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '') || 'empresa';
  XLSX.writeFile(wb, `Previsa_${slug}_${state.periodo || ''}.xlsx`, { bookType: 'xlsx', cellStyles: true });
}
