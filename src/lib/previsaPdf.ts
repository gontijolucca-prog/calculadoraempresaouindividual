import jsPDF from 'jspdf';
import type { PreviSaState } from '../previSaState';
import { calculate, reavaliar3PPC } from './previsaCalc';
import { sanitizePdf, slugFicheiro } from './reportPdf';
import { paletaRgb } from './pdfTheme';

export interface PrevisãoEscritorio {
  nome?: string;
  logoDataUrl?: string;
  corPrimaria?: string;
  nif?: string;
  cedulaProfissional?: string;
  numeroInscricaoOCC?: string;
  email?: string;
  telefone?: string;
  morada?: string;
  codigoPostal?: string;
  localidade?: string;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n || 0);
}

/**
 * PDF do Previsão — UMA única folha A4, com todos os resultados e valores
 * finais (apuramento + liquidação), marca do escritório e notas de leitura.
 * Sem Excel: o documento é este PDF.
 */
export function criarPrevisãoPdf(state: PreviSaState, nome: string, escritorio: PrevisãoEscritorio = {}): jsPDF {
  const r = calculate(state) as any;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const P = paletaRgb(escritorio.corPrimaria);

  // Cabeçalho de documento (não de site): filete de accent, logo do escritório,
  // identificação e título em serifa — o mesmo modelo dos restantes PDFs.
  doc.setFillColor(...P.blue);
  doc.rect(0, 0, W, 1.6, 'F');

  const logo = String(escritorio.logoDataUrl || '');
  let xTexto = 10;
  if (logo.startsWith('data:image')) {
    const formato = logo.includes('image/png') ? 'PNG' : 'JPEG';
    try { doc.addImage(logo, formato, 10, 5, 18, 18); xTexto = 32; } catch { /* formato exótico */ }
  }
  if (xTexto === 10) {
    doc.setFillColor(...P.blue);
    doc.roundedRect(10, 8, 12, 12, 2.5, 2.5, 'F');
    doc.setTextColor(...P.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('360', 16, 15.6, { align: 'center' });
    xTexto = 26;
  }

  const occ = [escritorio.cedulaProfissional ? `Cédula ${escritorio.cedulaProfissional}` : '', escritorio.numeroInscricaoOCC ? `OCC ${escritorio.numeroInscricaoOCC}` : ''].filter(Boolean).join(' · ');
  const contacto = [escritorio.email, escritorio.telefone].filter(Boolean).join(' · ');
  const morada = [escritorio.morada, escritorio.codigoPostal, escritorio.localidade].filter(Boolean).join(', ');

  doc.setTextColor(...P.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(sanitizePdf(escritorio.nome || 'Estudo 360'), xTexto, 12.6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.setTextColor(...P.medium);
  doc.text(sanitizePdf([escritorio.nif ? `NIF ${escritorio.nif}` : '', occ, contacto].filter(Boolean).join(' · ')), xTexto, 16.6, { maxWidth: 130 });
  if (morada) doc.text(sanitizePdf(morada), xTexto, 20.2, { maxWidth: 130 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(...P.medium);
  doc.text('DOCUMENTO CONFIDENCIAL', 200, 11, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString('pt-PT'), 200, 15, { align: 'right' });

  doc.setFont('times', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(...P.dark);
  doc.text('Previsão — Modelo 22', 10, 33);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.4);
  doc.setTextColor(...P.medium);
  doc.text(sanitizePdf(`${nome || 'Empresa'} · Período ${state.periodo || '—'}`), 10, 38.4);
  doc.setDrawColor(...P.line);
  doc.setLineWidth(0.3);
  doc.line(10, 41.4, 200, 41.4);

  const colW = 92;
  const xL = 10;
  const xR = 108;
  let yL = 50;
  let yR = 50;

  const titulo = (txt: string, x: number, y: number) => {
    doc.setTextColor(...P.dark);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(txt, x, y);
    doc.setDrawColor(...P.line);
    doc.line(x, y + 1.5, x + colW, y + 1.5);
    return y + 8;
  };
  const linha = (label: string, val: number | string, x: number, y: number, forte = false) => {
    doc.setFont('helvetica', forte ? 'bold' : 'normal');
    doc.setFontSize(8.4);
    const tom = forte ? P.dark : P.medium;
    doc.setTextColor(...tom);
    doc.text(sanitizePdf(String(label).slice(0, 48)), x, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...P.dark);
    doc.text(typeof val === 'number' ? fmt(val) : sanitizePdf(String(val)), x + colW, y, { align: 'right' });
    return y + 7;
  };

  yL = titulo('Apuramento (Q07)', xL, yL);
  yL = linha('Total de rendimentos', r.totalRendimentos, xL, yL);
  yL = linha('Total de gastos', -Math.abs(r.totalGastos || 0), xL, yL);
  yL = linha('Resultado antes de impostos', r.effectiveRai, xL, yL, true);
  yL = linha('Correções (+)', r.acrescer || 0, xL, yL);
  yL = linha('Lucro tributável', r.lucroTributavel || 0, xL, yL);
  yL = linha('Prejuízos utilizados', -(r.prejuziosEfetivos || 0), xL, yL);
  yL = linha('Matéria coletável (Q09)', r.materiaColetavel || 0, xL, yL, true);

  yR = titulo('Liquidação (Q10)', xR, yR);
  yR = linha('IRC (coleta)', r.ircColeta || 0, xR, yR);
  yR = linha('Derrama estadual', r.derramaEstadual || 0, xR, yR);
  yR = linha('Derrama municipal', r.derrMunicipal || 0, xR, yR);
  yR = linha('Deduções à coleta', -(r.deducoesColeta || 0), xR, yR);
  yR = linha('IRC a pagar (Q10)', r.c358 || 0, xR, yR, true);
  yR = linha('Tributações autónomas', r.taTotal || 0, xR, yR);
  yR = linha('Pagamentos por conta', -(r.totalPagamentos || 0), xR, yR);
  yR = linha('Total a pagar / a recuperar', r.c367 || 0, xR, yR, true);

  // Faixa do resultado
  const yF = Math.max(yL, yR) + 2;
  doc.setFillColor(...P.light);
  doc.setDrawColor(...P.line);
  doc.rect(10, yF, 190, 16, 'F');
  doc.setFillColor(...P.blue);
  doc.rect(10, yF, 3, 16, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...P.dark);
  doc.text('Resultado do período', 14, yF + 6.5);
  doc.setFontSize(14);
  doc.setTextColor(...P.blue);
  doc.text(fmt(r.c367 || 0), 196, yF + 10.5, { align: 'right' });

  // 3.º PPC do ANO simulado (art. 107.º) — primeiro a decisão do ano corrente,
  // depois a estimativa para o ano seguinte (que não entra no total).
  let yPpc = yF + 21;
  const ppcAno = Number(state.ppcPrestacaoAno || 0);
  if (ppcAno > 0) {
    const rec = reavaliar3PPC(state, ppcAno);
    const acao = rec.tipo === 'suspender'
      ? 'não pagar — suspender'
      : rec.tipo === 'limitar'
        ? `pagar ${fmt(rec.valor)} (limitado)`
        : `pagar ${fmt(rec.valor)}`;
    const razao = rec.tipo === 'suspender'
      ? 'PPC já pagos ≥ IRC estimado'
      : rec.tipo === 'limitar'
        ? '3.º PPC normal acima da diferença em falta'
        : 'diferença ≥ 3.º PPC normal';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(...P.dark);
    doc.text(sanitizePdf(`3.º PPC ${state.periodo || ''} — ${acao}`), 10, yPpc);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...P.medium);
    const pagoAno = (state.ppcPago1 ? ppcAno : 0) + (state.ppcPago2 ? ppcAno : 0);
    doc.text(sanitizePdf(`Prestação ${fmt(ppcAno)} · já pago ${fmt(pagoAno)} · ${razao} · art. 107.º CIRC`), 10, yPpc + 3.6, { maxWidth: 190 });
    yPpc += 9;
  }

  const ppc = Number(r.ppcProximoAno || 0);
  if (ppc) {
    const prestacao = Math.ceil(ppc / 3);
    const anoPpc = (Number(state.periodo) || new Date().getFullYear()) + 1;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(...P.medium);
    doc.text(
      sanitizePdf(`PPC ${anoPpc} (estimativa, fora deste total): 3 × ${fmt(prestacao)} = ${fmt(ppc)} — jul · set · 15 dez`),
      10,
      yPpc,
      { maxWidth: 190 },
    );
    yPpc += 4;
  }

  // Rendimentos e gastos considerados no apuramento.
  const yDet = yPpc + (ppcAno || ppc ? 5 : 3);
  const detalhe = (
    tituloTxt: string,
    x: number,
    y: number,
    rows: Array<[string, number]>,
  ) => {
    let yy = titulo(tituloTxt, x, y);
    for (const [label, value] of rows) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.4);
      doc.setTextColor(...P.medium);
      doc.text(sanitizePdf(label), x, yy);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...P.dark);
      doc.text(fmt(value), x + colW, yy, { align: 'right' });
      doc.setDrawColor(...P.pale);
      doc.line(x, yy + 1.1, x + colW, yy + 1.1);
      yy += 5.5;
    }
    return yy;
  };
  const rendimentos: Array<[string, number]> = [
    ['711 Vendas de mercadorias', state.rai_711],
    ['712 Vendas de produtos', state.rai_712],
    ['72 Prestações de serviços', state.rai_72],
    ['74 Trabalhos para a própria entidade', state.rai_74],
    ['75 Subsídios à exploração', state.rai_75],
    ['76 a 79 Outros rendimentos', state.rai_76 + state.rai_77 + state.rai_78 + state.rai_79],
    ['Total de rendimentos', r.totalRendimentos],
  ];
  const gastos: Array<[string, number]> = [
    ['CMVMC', state.rai_cmv + state.rai_cmc],
    ['62 Fornecimentos e serviços externos', state.rai_62],
    ['63 Gastos com pessoal', state.rai_63],
    ['64 Depreciações e amortizações', state.rai_64],
    ['65 a 68 Imparidade, provisões e outros gastos', state.rai_65 + state.rai_66 + state.rai_67 + state.rai_68],
    ['69 Gastos de financiamento', state.rai_69],
    ['Total de gastos', r.totalGastos],
  ];
  const yDL = detalhe('Rendimentos considerados', xL, yDet, rendimentos);
  const yDR = detalhe('Gastos considerados', xR, yDet, gastos);

  const yN = Math.max(yDL, yDR) + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...P.dark);
  doc.text('Como ler este resumo', 10, yN);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(...P.medium);
  const notas = [
    'Q07 — Apuramento: rendimentos da classe 7 menos gastos da classe 6, ajustado pelas correções fiscais.',
    'Q09 — Matéria coletável: lucro tributável após prejuízos fiscais e benefícios aplicáveis.',
    'Q10 — Liquidação: IRC, derramas e tributações autónomas, menos deduções e pagamentos por conta.',
    'PEC extinto (Lei 12/2022). PPC calculado sobre IRC menos retenções, com o limiar legal.',
    'Documento indicativo gerado a partir dos inputs do Previsão — confirme sempre com o seu TOC.',
  ];
  notas.forEach((n, i) => doc.text(sanitizePdf(n), 10, yN + 7 + i * 5.4, { maxWidth: 190 }));

  // Parâmetros considerados — evita um PDF só com números soltos.
  const yP = yN + 7 + notas.length * 5 + 5;
  if (yP + 31 < 280) {
    doc.setFillColor(...P.pale);
    doc.setDrawColor(...P.line);
    doc.roundedRect(10, yP, 190, 31, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(...P.dark);
    doc.text('Enquadramento e dados do escritório', 14, yP + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.9);
    doc.setTextColor(...P.medium);
    const st = state as unknown as Record<string, unknown>;
    const regime = String(st.regime || 'geral');
    const pme = st.isPME === false ? 'não PME' : 'PME';
    const territorio = String(st.territorio || 'continental');
    const derrama = Number(st.taxaDerramaMunicipal || 0) * 100;
    doc.text(sanitizePdf(`Regime: ${regime}  ·  ${pme}  ·  Território: ${territorio}`), 14, yP + 13);
    doc.text(sanitizePdf(`Derrama municipal: ${derrama.toFixed(2)}%  ·  Período: ${state.periodo || '—'}`), 14, yP + 19);
    const contacto = [escritorio.email, escritorio.telefone].filter(Boolean).join(' · ');
    const morada = [escritorio.morada, escritorio.codigoPostal, escritorio.localidade].filter(Boolean).join(', ');
    const occ = [escritorio.cedulaProfissional ? `Cédula ${escritorio.cedulaProfissional}` : '', escritorio.numeroInscricaoOCC ? `OCC ${escritorio.numeroInscricaoOCC}` : ''].filter(Boolean).join(' · ');
    doc.text(sanitizePdf([escritorio.nome || 'Estudo 360', escritorio.nif ? `NIF ${escritorio.nif}` : '', occ, contacto].filter(Boolean).join(' · ')), 14, yP + 25);
    if (morada) doc.text(sanitizePdf(morada), 14, yP + 29.5);
  }

  const yInd = yP + 36;
  if (yInd + 19 < 278) {
    const margemRai = r.totalRendimentos > 0 ? (r.effectiveRai / r.totalRendimentos) * 100 : 0;
    const materia = Math.max(1, r.materiaColetavel || 0);
    const taxaEfetiva = ((r.c358 || 0) + (r.taTotal || 0)) / materia * 100;
    const indicadores = [
      ['Margem antes de impostos', `${margemRai.toFixed(1).replace('.', ',')}%`],
      ['Taxa efetiva sobre matéria coletável', `${taxaEfetiva.toFixed(1).replace('.', ',')}%`],
      ['IRC liquidado + TA', fmt((r.c358 || 0) + (r.taTotal || 0))],
      ['PPC estimado do próximo ano', fmt(r.ppcProximoAno || 0)],
    ];
    const boxW = 46;
    indicadores.forEach(([label, value], index) => {
      const x = 10 + index * 47.2;
      doc.setFillColor(...P.light);
      doc.setDrawColor(...P.line);
      doc.roundedRect(x, yInd, boxW, 16, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(...P.medium);
      doc.text(sanitizePdf(label), x + 2.5, yInd + 5.3, { maxWidth: boxW - 5 });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...P.dark);
      doc.text(sanitizePdf(value), x + 2.5, yInd + 12.3);
    });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...P.medium);
  doc.text(`Gerado a ${new Date().toLocaleDateString('pt-PT')} · ${escritorio.nome || 'Estudo 360'}`, 10, 287);
  doc.text('Pág. 1/1', 200, 287, { align: 'right' });

  return doc;
}

/** Descarrega o PDF do Previsão (uma folha A4). */
export async function downloadPrevisãoPdf(state: PreviSaState, nome: string, escritorio: PrevisãoEscritorio = {}) {
  const doc = criarPrevisãoPdf(state, nome, escritorio);
  const filename = `${slugFicheiro('Previsão ' + (nome || 'Empresa') + ' ' + (state.periodo || new Date().getFullYear()))}.pdf`;
  doc.save(filename);
}
