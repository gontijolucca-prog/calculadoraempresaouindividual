import jsPDF from 'jspdf';
import type { PreviSaState } from '../previSaState';
import { calculate } from './previsaCalc';

function fmt(n: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(n || 0);
}

export async function downloadPrevisaPdf(state: PreviSaState, nome: string) {
  const res = calculate(state);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  let y = 14;

  // Header — bege calm
  doc.setFillColor(26, 26, 24);
  doc.rect(0, 0, W, 18, 'F');
  doc.setTextColor(253, 251, 247);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Previsa 2025 — Modelo 22', 10, 11);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text((nome || 'Empresa') + ` · Período ${state.periodo || '—'}`, 10, 15);

  y = 24;
  doc.setTextColor(26, 26, 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Resumo — apuramento', 10, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const rows: [string, number][] = [
    ['Volume de negócios', state.volumeNegocios || 0],
    ['Total de rendimentos', (res as any).totalRendimentos || 0],
    ['Total de gastos', (res as any).totalGastos || 0],
    ['Resultado antes de impostos', (res as any).effectiveRai || 0],
    ['Matéria coletável', (res as any).materiaColetavel || 0],
    ['IRC + Tributações Autónomas', ((res as any).c358 || 0) + ((res as any).taTotal || 0)],
    ['Total a pagar / a recuperar', (res as any).c367 || 0],
  ];
  for (const [label, val] of rows) {
    doc.setFillColor(val < 0 ? 254 : 245, val < 0 ? 242 : 240, val < 0 ? 242 : 232);
    doc.rect(10, y - 4, 190, 7, 'F');
    doc.setFont('helvetica', 'normal');
    doc.text(label, 12, y);
    doc.setFont('helvetica', 'bold');
    doc.text(fmt(val), 200, y, { align: 'right' });
    y += 7;
  }

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Notas', 10, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('Valores calculados a partir dos inputs do Previsa. O Excel original com 13 folhas e fórmulas continua disponível como template,', 10, y);
  y += 4;
  doc.text('mas a exportação passa a ser em PDF para impressão e envio ao cliente, como pediu.', 10, y);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-PT')} — estudo360.pt`, 10, 287);
  doc.text('Pág. 1/1', 200, 287, { align: 'right' });

  const filename = `Previsa_${(nome || 'Empresa').replace(/\s+/g,'_')}_${state.periodo || new Date().getFullYear()}.pdf`;
  doc.save(filename);
}
