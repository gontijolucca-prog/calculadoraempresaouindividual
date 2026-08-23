/**
 * Exportar a tabela de honorários do escritório para Excel (.xlsx).
 *
 * Gera um workbook mínimo mas válido com fflate (sem dependências pesadas):
 * folha "Tabela de Honorários" com a configuração (base por entidade,
 * funcionários, escalões, serviços extra, IVA) — espelho do que está nas
 * Definições do Escritório — e uma folha "Exemplos" com o cálculo mensal/
 * anual para cada tipo de entidade (para apresentar ao cliente).
 */
import { zipSync, strToU8 } from 'fflate';
import { defaultHonorariosConfig, type HonorariosConfig, calcularProposta, type PropostaItem } from './honorarios';
import type { ClientProfile } from '../ClientProfile';

const escXml = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function colName(n: number): string {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

interface Cell {
  v: string | number;
  bold?: boolean;
  fill?: string; // "ff0677FF"
  numFmt?: string; // "0.00" | "€" → usamos formatId da styles
}

function buildSheetXml(titleRows: (string | number)[][], data: (string | number)[][], opts?: { highlightCol?: number }): string {
  const rows: Cell[][] = [];

  const addRow = (cells: (string | number)[], bold = false, fill?: string) => {
    rows.push(cells.map(v => ({ v, bold, fill })));
  };

  titleRows.forEach(r => addRow(r, true, '0677FF'));
  data.forEach(r => addRow(r));

  const headerCount = titleRows.length;

  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"/></sheetViews>
<sheetFormatPr defaultRowHeight="16"/>
<cols>`;
  const maxCols = Math.max(0, ...rows.map(r => r.length));
  for (let c = 1; c <= maxCols; c++) {
    xml += `<col min="${c}" max="${c}" width="${c === 1 ? 42 : 16}" customWidth="1"/>`;
  }
  xml += `</cols><sheetData>`;

  rows.forEach((row, ri) => {
    const rn = ri + 1;
    let cells = '';
    row.forEach((cell, ci) => {
      const ref = `${colName(ci + 1)}${rn}`;
      const isNum = typeof cell.v === 'number';
      // styles: 1=bold-white-blue-fill, 2=bold, 3=number-currency
      let styleId = 0;
      if (cell.bold) styleId = cell.fill ? 1 : 2;
      else if (isNum) styleId = 3;
      const attrs = styleId ? ` s="${styleId}"` : '';
      cells += isNum
        ? `<c r="${ref}"${attrs}><v>${cell.v}</v></c>`
        : `<c r="${ref}"${attrs} t="inlineStr"><is><t xml:space="preserve">${escXml(String(cell.v))}</t></is></c>`;
    });
    // altura extra na linha de cabeçalho
    xml += `<row r="${rn}"${ri < headerCount ? ' ht="20" customHeight="1"' : ''}>${cells}</row>`;
  });

  xml += `</sheetData></worksheet>`;
  return xml;
}

function buildWorkbook(sheets: { name: string; xml: string }[]): Uint8Array {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
${sheets.map((s, i) => `<sheet name="${escXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('\n')}
</sheets>
<calcPr fullCalcOnLoad="1"/>
</workbook>`;

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3"><font><sz val="12"/><name val="Calibri"/></font>
<font><b/><color rgb="FFFFFFFF"/><sz val="12"/><name val="Calibri"/></font>
<font><b/><sz val="12"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF0677FF"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf/></cellStyleXfs>
<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" applyFont="1"/>
<xf numFmtId="4" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rels),
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(wbRels),
    'xl/styles.xml': strToU8(styles),
  };
  sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(s.xml);
  });

  return zipSync(files, { level: 6 });
}

const TIPO_LABELS: Record<string, string> = {
  eni: 'ENI / Recibos Verdes',
  unipessoal: 'Unipessoal Lda',
  socio_unico: 'Unipessoal (Sócio Único)',
  lda: 'Sociedade por Quotas',
  sa: 'Sociedade Anónima',
};

const FAKE_PROFILE: Record<string, ClientProfile> = {
  eni: { tipoEntidade: 'eni', nrFuncionarios: 0, faturaçaoAnualPrevista: 60000 } as ClientProfile,
  unipessoal: { tipoEntidade: 'unipessoal', nrFuncionarios: 1, faturaçaoAnualPrevista: 120000 } as ClientProfile,
  socio_unico: { tipoEntidade: 'socio_unico', nrFuncionarios: 2, faturaçaoAnualPrevista: 180000 } as ClientProfile,
  lda: { tipoEntidade: 'lda', nrFuncionarios: 3, faturaçaoAnualPrevista: 250000 } as ClientProfile,
  sa: { tipoEntidade: 'sa', nrFuncionarios: 10, faturaçaoAnualPrevista: 600000 } as ClientProfile,
};

function propostaItems(c: HonorariosConfig, tipo: string): PropostaItem[] {
  return calcularProposta(FAKE_PROFILE[tipo] ?? FAKE_PROFILE.lda, c).itens;
}

/**
 * Gera os bytes do .xlsx. `config` opcional — usa default quando não houver
 * configuração guardada (ou num contexto sem storage).
 */
export function buildHonorariosXlsx(config: HonorariosConfig = defaultHonorariosConfig): Uint8Array {
  const eur = (n: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n);

  // ── Folha 1 — Tabela de honorários ──
  const sheet1: (string | number)[][] = [];
  sheet1.push(['TABELA DE HONORÁRIOS — Estudo 360']);
  sheet1.push(['Configuração atual do escritório']);
  sheet1.push([]);
  sheet1.push(['Tipo de entidade', 'Mensalidade base (€/mês)']);
  (Object.keys(config.baseMensal) as (keyof typeof config.baseMensal)[]).forEach(k => {
    sheet1.push([TIPO_LABELS[k] ?? k, config.baseMensal[k]]);
  });
  sheet1.push([]);
  sheet1.push(['Funcionários incluídos no valor base', config.funcionariosIncluidos]);
  sheet1.push(['Acréscimo por funcionário adicional (€/mês)', config.acrescimoPorFuncionario]);
  sheet1.push(['Mensalidade mínima (€/mês)', config.minimoMensal]);
  sheet1.push([]);
  sheet1.push(['ESCALÕES DE FATURAÇÃO ANUAL']);
  sheet1.push(['A partir de (€)', 'Acréscimo mensal (€)', 'Descrição']);
  [...config.escaloesFaturacao]
    .sort((a, b) => a.minFaturacao - b.minFaturacao)
    .forEach(e => sheet1.push([e.minFaturacao, e.acrescimoMensal, e.descricao]));
  sheet1.push([]);
  sheet1.push(['SERVIÇOS EXTRA']);
  sheet1.push(['Serviço', 'Preço mensal (€)', 'Ativo por defeito', 'Descrição']);
  config.servicosExtra.forEach(s => sheet1.push([s.nome, s.precoMensal, s.ativoPorDefeito ? 'Sim' : 'Não', s.descricao]));
  sheet1.push([]);
  sheet1.push(['IVA aplicado', `${(config.taxaIVA * 100).toFixed(0)}%`]);

  // ── Folha 2 — Exemplos por tipo de entidade ──
  const sheet2: (string | number)[][] = [];
  sheet2.push(['EXEMPLOS DE PROPOSTA — Estudo 360']);
  sheet2.push(['Cálculo mensal sem IVA por tipo de entidade (perfil de exemplo)']);
  sheet2.push([]);
  const tipos = ['eni', 'unipessoal', 'socio_unico', 'lda', 'sa'] as const;
  for (const tipo of tipos) {
    const itens = propostaItems(config, tipo);
    sheet2.push([`${TIPO_LABELS[tipo]} — exemplo (ex.: ${FAKE_PROFILE[tipo].faturaçaoAnualPrevista} €/ano, ${FAKE_PROFILE[tipo].nrFuncionarios} func.)`]);
    itens.forEach(i => sheet2.push(['  ' + i.descricao, i.valorMensal]));
    const total = itens.reduce((s, i) => s + i.valorMensal, 0);
    sheet2.push(['Total mensal (sem IVA)', Math.round(total * 100) / 100]);
    sheet2.push(['Total mensal (com IVA)', Math.round(total * (1 + config.taxaIVA) * 100) / 100]);
    sheet2.push(['Total anual (sem IVA)', Math.round(total * 12 * 100) / 100]);
    sheet2.push([]);
  }

  return buildWorkbook([
    { name: 'Tabela de Honorários', xml: buildSheetXml([], sheet1) },
    { name: 'Exemplos', xml: buildSheetXml([], sheet2) },
  ]);
}

/** Descarrega o ficheiro no browser. */
export function downloadHonorariosExcel(config: HonorariosConfig = defaultHonorariosConfig): void {
  const bytes = buildHonorariosXlsx(config);
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tabela-honorarios-estudo360.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}