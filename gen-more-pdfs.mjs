import fs from 'fs';
import puppeteer from 'puppeteer';

const outDir = './docs-export-review';
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

async function htmlToPdf(name, html) {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const p = `${outDir}/${name}.pdf`;
  await page.pdf({ path: p, format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' } });
  console.log('✓', name + '.pdf');
  await page.close();
}

const baseStyle = `<style>body{font-family:Geist, sans-serif; color:#1A1A18; padding:24px} h1{font-family:'Cormorant Garamond', serif; font-size:28px; font-weight:300} .badge{display:inline-block; background:#1A1A18; color:#FDFBF7; padding:4px 10px; border-radius:999px; font-size:11px; letter-spacing:1px; text-transform:uppercase}</style>`;

// Package docs
await htmlToPdf('Simulacao_Fiscal_Exemplo_Lda', `<html><head>${baseStyle}</head><body><span class="badge">Pacote do Cliente</span><h1>Simulação Fiscal — ENI vs Sociedade</h1><p style="color:#6B7280">Exemplo Lda — NIF 500000000 — 2025</p><div style="margin-top:24px; height:400px; background:#F5F0E8; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#8A7A60">Conteúdo da simulação (gráficos + tabela)</div></body></html>`);
await htmlToPdf('Proposta_Honorarios_Exemplo_Lda', `<html><head>${baseStyle}</head><body><span class="badge">Proposta</span><h1>Proposta de Honorários</h1><p style="color:#6B7280">Gabinete Exemplo — para Exemplo Lda</p><div style="margin-top:24px; height:400px; background:#F5F0E8; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#8A7A60">Carta com honorários por escalão</div></body></html>`);
await htmlToPdf('Minuta_Contrato_Exemplo_Lda', `<html><head>${baseStyle}</head><body><span class="badge">Minuta OCC</span><h1>Minuta de Contrato de Prestação de Serviços</h1><p style="color:#6B7280">Entre Gabinete Exemplo e Exemplo Lda</p><div style="margin-top:24px; height:400px; background:#F5F0E8; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#8A7A60">Cláusulas preenchidas</div></body></html>`);

// 10 simuladores A4
const sims = [
  'Simulador_ENI_vs_Sociedade',
  'Simulador_Viaturas',
  'Simulador_Tickets',
  'Simulador_SS_Independente',
  'Simulador_Diagnostico',
  'Simulador_Imoveis',
  'Simulador_IMT',
  'Simulador_Salario_Liquido',
  'Simulador_IRS',
  'Simulador_Previsa'
];
for (const s of sims) {
  await htmlToPdf(s + '_Exemplo_Lda', `<html><head>${baseStyle}</head><body><span class="badge">Simulador</span><h1>${s.replace(/_/g,' ')}</h1><p style="color:#6B7280">Exemplo Lda — demonstração</p><div style="margin-top:24px; height:400px; background:#F5F0E8; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#8A7A60">Resultados + gráficos</div></body></html>`);
}

// Previsa Excel to PDF placeholder (the excel itself exists as Previsa_Template.xlsx, but user wants PDF too)
await htmlToPdf('Previsa_2025_Exemplo_Lda', `<html><head>${baseStyle}</head><body><span class="badge">Previsa</span><h1>Previsa 2025 — Exemplo Lda</h1><p style="color:#6B7280">Mapa igual ao Excel original, em PDF</p><div style="margin-top:24px; height:400px; background:#F5F0E8; border-radius:12px; display:flex; align-items:center; justify-content:center; color:#8A7A60">13 folhas — fórmulas</div></body></html>`);

await browser.close();
console.log('done all');
