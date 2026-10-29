import jsPDF from 'jspdf';
import type { PreviSaState } from '../previSaState';
import { calculate } from './previsaCalc';

function fmt(n: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n || 0);
}

/**
 * PDF do Previsa — UMA única folha A4, com todos os resultados e valores
 * finais (apuramento + liquidação). Sem Excel: o documento é este PDF.
 */
export async function downloadPrevisaPdf(state: PreviSaState, nome: string) {
  const r = calculate(state) as any;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;

  // Cabeçalho
  doc.setFillColor(26, 26, 24);
  doc.rect(0, 0, W, 18, 'F');
  doc.setTextColor(253, 251, 247);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Previsa — Modelo 22', 10, 11);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`${nome || 'Empresa'} · Período ${state.periodo || '—'}`, 10, 15);

  const colW = 92;
  const xL = 10;
  const xR = 108;
  let yL = 28;
  let yR = 28;

  const titulo = (txt: string, x: number, y: number) => {
    doc.setTextColor(26, 26, 24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(txt, x, y);
    doc.setDrawColor(220, 220, 215);
    doc.line(x, y + 1.5, x + colW, y + 1.5);
    return y + 7;
  };
  const linha = (label: string, val: number | string, x: number, y: number, forte = false) => {
    doc.setFont('helvetica', forte ? 'bold' : 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(forte ? 26 : 70, forte ? 26 : 70, forte ? 24 : 70);
    doc.text(String(label).slice(0, 46), x, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 26, 24);
    doc.text(typeof val === 'number' ? fmt(val) : String(val), x + colW, y, { align: 'right' });
    return y + 5.2;
  };

  // Coluna esquerda — apuramento
  yL = titulo('Apuramento (Q07)', xL, yL);
  yL = linha('Total de rendimentos', r.totalRendimentos, xL, yL);
  yL = linha('Total de gastos', -Math.abs(r.totalGastos || 0), xL, yL);
  yL = linha('Resultado antes de impostos', r.effectiveRai, xL, yL, true);
  yL = linha('Correções (+)', r.acrescer || 0, xL, yL);
  yL = linha('Lucro tributável', r.lucroTributavel || 0, xL, yL);
  yL = linha('Prejuízos utilizados', -(r.prejuziosEfetivos || 0), xL, yL);
  yL = linha('Matéria coletável (Q09)', r.materiaColetavel || 0, xL, yL, true);

  // Coluna direita — liquidação
  yR = titulo('Liquidação (Q10)', xR, yR);
  yR = linha('IRC (coleta)', r.ircColeta || 0, xR, yR);
  yR = linha('Derrama estadual', r.derramaEstadual || 0, xR, yR);
  yR = linha('Derrama municipal', r.derrMunicipal || 0, xR, yR);
  yR = linha('Deduções à coleta', -(r.deducoesColeta || 0), xR, yR);
  yR = linha('IRC a pagar (Q10)', r.c358 || 0, xR, yR, true);
  yR = linha('Tributações autónomas', r.taTotal || 0, xR, yR);
  yR = linha('Pagamentos por conta', -(r.totalPagamentos || 0), xR, yR);
  yR = linha('PEC / PPC', r.ppcProximoAno || 0, xR, yR);
  yR = linha('Total a pagar / a recuperar', r.c367 || 0, xR, yR, true);

  // Faixa final
  const yF = Math.max(yL, yR) + 4;
  doc.setFillColor(245, 240, 232);
  doc.rect(10, yF, 190, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(26, 26, 24);
  doc.text('Resultado do período', 14, yF + 6);
  doc.setFontSize(12);
  doc.text(fmt(r.c367 || 0), 196, yF + 9, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 115);
  doc.text('Valores calculados a partir dos inputs do Previsa. Documento de apoio à decisão — confirme com o seu TOC.', 10, 280);
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-PT')} — estudo360.pt`, 10, 287);
  doc.text('Pág. 1/1', 200, 287, { align: 'right' });

  const filename = `Previsa_${(nome || 'Empresa').replace(/\s+/g, '_')}_${state.periodo || new Date().getFullYear()}.pdf`;
  doc.save(filename);
}
