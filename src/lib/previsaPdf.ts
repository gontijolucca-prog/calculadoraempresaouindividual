import jsPDF from 'jspdf';
import type { PreviSaState } from '../previSaState';
import { calculate } from './previsaCalc';
import { sanitizePdf, slugFicheiro } from './reportPdf';

export interface PrevisaEscritorio {
  nome?: string;
  logoDataUrl?: string;
  corPrimaria?: string;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n || 0);
}

/**
 * PDF do Previsa — UMA única folha A4, com todos os resultados e valores
 * finais (apuramento + liquidação), marca do escritório e notas de leitura.
 * Sem Excel: o documento é este PDF.
 */
export async function downloadPrevisaPdf(state: PreviSaState, nome: string, escritorio: PrevisaEscritorio = {}) {
  const r = calculate(state) as any;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;

  // Cabeçalho com marca do escritório
  doc.setFillColor(26, 26, 24);
  doc.rect(0, 0, W, 24, 'F');
  doc.setFillColor(176, 109, 53);
  doc.rect(0, 24, W, 1.4, 'F');
  let xTexto = 10;
  if (escritorio.logoDataUrl) {
    try {
      const props = doc.getImageProperties(escritorio.logoDataUrl);
      const h = 11;
      const w = Math.min(28, (props.width / props.height) * h);
      doc.addImage(escritorio.logoDataUrl, 'PNG', 10, 4.5, w, h);
      xTexto = 10 + w + 4;
    } catch { /* logo inválido: fica só o nome */ }
  }
  doc.setTextColor(253, 251, 247);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Previsa — Modelo 22', xTexto, 11);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(231, 224, 213);
  doc.text(sanitizePdf(escritorio.nome || 'Estudo 360'), xTexto, 16);
  doc.text(sanitizePdf(`${nome || 'Empresa'} · Período ${state.periodo || '—'}`), 10, 21);

  const colW = 92;
  const xL = 10;
  const xR = 108;
  let yL = 34;
  let yR = 34;

  const titulo = (txt: string, x: number, y: number) => {
    doc.setTextColor(26, 26, 24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(txt, x, y);
    doc.setDrawColor(220, 220, 215);
    doc.line(x, y + 1.5, x + colW, y + 1.5);
    return y + 8;
  };
  const linha = (label: string, val: number | string, x: number, y: number, forte = false) => {
    doc.setFont('helvetica', forte ? 'bold' : 'normal');
    doc.setFontSize(8.4);
    doc.setTextColor(forte ? 26 : 70, forte ? 26 : 70, forte ? 24 : 70);
    doc.text(sanitizePdf(String(label).slice(0, 48)), x, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 26, 24);
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
  doc.setFillColor(245, 240, 232);
  doc.rect(10, yF, 190, 16, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(26, 26, 24);
  doc.text('Resultado do período', 14, yF + 6.5);
  doc.setFontSize(14);
  doc.text(fmt(r.c367 || 0), 196, yF + 10.5, { align: 'right' });

  // O PPC do ano seguinte não entra no total deste período — fica separado.
  const ppc = Number(r.ppcProximoAno || 0);
  if (ppc) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(90, 90, 86);
    doc.text(sanitizePdf(`PPC do próximo período (estimativa, fora deste total): ${fmt(ppc)}`), 10, yF + 22);
  }

  // Notas de leitura (ocupam o espaço restante com utilidade)
  const yN = yF + (ppc ? 32 : 25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(26, 26, 24);
  doc.text('Como ler este resumo', 10, yN);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(90, 90, 86);
  const notas = [
    'Q07 — Apuramento: rendimentos da classe 7 menos gastos da classe 6, ajustado pelas correções fiscais.',
    'Q09 — Matéria coletável: lucro tributável após prejuízos fiscais e benefícios aplicáveis.',
    'Q10 — Liquidação: IRC, derramas e tributações autónomas, menos deduções e pagamentos por conta.',
    'PEC extinto (Lei 12/2022). PPC calculado sobre IRC menos retenções, com o limiar legal.',
    'Documento indicativo gerado a partir dos inputs do Previsa — confirme sempre com o seu TOC.',
  ];
  notas.forEach((n, i) => doc.text(sanitizePdf(n), 10, yN + 7 + i * 5.4, { maxWidth: 190 }));

  // Parâmetros considerados — evita um PDF só com números soltos.
  const yP = yN + 7 + notas.length * 5.4 + 7;
  if (yP + 26 < 280) {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(10, yP, 190, 24, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(26, 26, 24);
    doc.text('Parâmetros considerados', 14, yP + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(90, 90, 86);
    const st = state as unknown as Record<string, unknown>;
    const regime = String(st.regime || 'geral');
    const pme = st.isPME === false ? 'não PME' : 'PME';
    const territorio = String(st.territorio || 'continental');
    const derrama = Number(st.taxaDerramaMunicipal || 0) * 100;
    doc.text(sanitizePdf(`Regime: ${regime}  ·  ${pme}  ·  Território: ${territorio}`), 14, yP + 13);
    doc.text(sanitizePdf(`Derrama municipal: ${derrama.toFixed(2)}%  ·  Período: ${state.periodo || '—'}`), 14, yP + 19);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(140, 140, 135);
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-PT')} — estudo360.pt`, 10, 287);
  doc.text('Pág. 1/1', 200, 287, { align: 'right' });

  const filename = `${slugFicheiro('Previsa ' + (nome || 'Empresa') + ' ' + (state.periodo || new Date().getFullYear()))}.pdf`;
  doc.save(filename);
}
