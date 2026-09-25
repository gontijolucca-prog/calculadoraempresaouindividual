import fs from 'fs';
import puppeteer from 'puppeteer';
import { calcViatura } from './src/lib/viaturas.ts';

const outDir = './docs-export-review';
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
async function pdf(name, html) {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({ path: `${outDir}/${name}.pdf`, format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
  console.log('✓', name);
  await page.close();
}
const base = `<style>@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;600&family=Cormorant+Garamond:wght@300&display=swap'); body{font-family:Geist, sans-serif; color:#1A1A18; padding:20px} h1{font-family:'Cormorant Garamond', serif; font-size:26px; font-weight:300} h2{font-size:14px; font-weight:600; margin-top:16px} .badge{background:#1A1A18; color:#FDFBF7; padding:4px 10px; border-radius:999px; font-size:11px} .card{background:#F5F0E8; border-radius:12px; padding:16px; margin-top:12px} table{width:100%; border-collapse:collapse; margin-top:10px} th,td{border:1px solid #E5DDD0; padding:7px; font-size:11px; text-align:left} th{background:#1A1A18; color:#FDFBF7}</style>`;

const v = calcViatura({ category:'passageiros', engineType:'diesel', price:35000, ivaRegime:'normal', activity:'other', maintenanceCost:1200, insuranceCost:800, fuelCost:2400, exemptTA:false, phevCompliant:false });

// 10 simuladores + apresentação gamma para cada
const sims = [
  ['ENI_vs_Sociedade', 'ENI vs Sociedade', 'IRS/IRC comparado, SS e total anual'],
  ['Viaturas', 'Viaturas', `IVA ${v.ivaTotalDedutivel.toFixed(0)}€ · TA ${v.taValue.toFixed(0)}€ (${(v.taRate*100).toFixed(1)}%)`],
  ['Tickets', 'Tickets', 'Poupança vs aumento salarial'],
  ['SS_Independente', 'SS Independente', '21,4% sobre base'],
  ['Diagnostico', 'Diagnóstico', 'Autonomia e risco'],
  ['Imoveis', 'Imóveis', 'Arrendamento vs empresa'],
  ['IMT', 'IMT', 'IMT + IS sobre compra'],
  ['Salario_Liquido', 'Salário Líquido', 'Bruto → líquido + custo empresa'],
  ['IRS', 'IRS', 'Escalões e taxa efetiva'],
  ['Previsa', 'Previsa', 'Volume 120k — RAI 15k'],
];
for (const [id, titulo, desc] of sims) {
  await pdf(`Simulador_${id}_Exemplo_Lda`, `<html><head>${base}</head><body><span class="badge">Simulador</span><h1>${titulo} — Exemplo Lda</h1><p style="color:#6B7280">${desc}</p><div class="card"><b>Resultados</b><br>Tabela e gráficos como no site (botão Imprimir)</div><h2>Apresentação (Gamma)</h2><div class="card">Slides gerados via gamma.app — capa + 6 slides</div></body></html>`);
  await pdf(`Apresentacao_${id}_Exemplo_Lda`, `<html><head>${base}</head><body><span class="badge">Apresentação Gamma</span><h1>Apresentação — ${titulo}</h1><p style="color:#6B7280">Gerada para enviar ao cliente</p><div class="card">Capa com marca do gabinete + slides com resultados</div></body></html>`);
}
// Pacote
await pdf('Simulacao_Fiscal_Exemplo_Lda', `<html><head>${base}</head><body><span class="badge">Pacote</span><h1>Simulação Fiscal Completa</h1><div class="card">ENI vs Sociedade com cenários</div></body></html>`);
await pdf('Proposta_Honorarios_Exemplo_Lda', `<html><head>${base}</head><body><span class="badge">Pacote</span><h1>Proposta de Honorários</h1><div class="card">Carta com honorários</div></body></html>`);
await pdf('Minuta_Contrato_Exemplo_Lda', `<html><head>${base}</head><body><span class="badge">Pacote</span><h1>Minuta OCC</h1><div class="card">Contrato preenchido</div></body></html>`);

await browser.close();
console.log('done');
