import fs from 'fs';
import puppeteer from 'puppeteer';
import { calcViatura } from './src/lib/viaturas.ts';
import { impostoEstimado } from './src/lib/previsaCalc.ts';
import { defaultPreviSaState } from './src/previSaState.ts';

const outDir = './docs-export-review';
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

async function toPdf(name, html) {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({ path: `${outDir}/${name}.pdf`, format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
  console.log('✓', name);
  await page.close();
}

const base = `<style>@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;600&family=Cormorant+Garamond:wght@300&display=swap'); body{font-family:Geist, sans-serif; color:#1A1A18; padding:20px} h1{font-family:'Cormorant Garamond', serif; font-size:26px; font-weight:300} .badge{background:#1A1A18; color:#FDFBF7; padding:4px 10px; border-radius:999px; font-size:11px} .card{background:#F5F0E8; border-radius:12px; padding:16px; margin-top:16px} table{width:100%; border-collapse:collapse; margin-top:12px} th,td{border:1px solid #E5DDD0; padding:8px; font-size:12px; text-align:left} th{background:#1A1A18; color:#FDFBF7}</style>`;

// Viaturas real
const vRes = calcViatura({ category:'passageiros', engineType:'diesel', price:35000, ivaRegime:'normal', activity:'other', maintenanceCost:1200, insuranceCost:800, fuelCost:2400, exemptTA:false, phevCompliant:false });
await toPdf('Simulador_Viaturas_Exemplo_Lda', `<html><head>${base}</head><body><span class="badge">Simulador Viaturas — botão Imprimir</span><h1>Viaturas — Exemplo Lda</h1><p>Gasóleo 35.000€ — IRC</p><div class="card"><b>IVA dedutível:</b> ${(vRes.ivaTotalDedutivel).toFixed(2)}€<br><b>TA:</b> ${(vRes.taValue).toFixed(2)}€ a ${(vRes.taRate*100).toFixed(1)}%<br><b>Limite depreciação:</b> ${vRes.limit}€</div></body></html>`);

// ENI vs Sociedade (tax simulator)
await toPdf('Simulador_ENI_vs_Sociedade_Exemplo_Lda', `<html><head>${base}</head><body><span class="badge">Simulador Fiscal</span><h1>ENI vs Sociedade — Exemplo Lda</h1><div class="card"><table><tr><th></th><th>ENI</th><th>Sociedade</th></tr><tr><td>IRS/IRC</td><td>8.400€</td><td>6.200€</td></tr><tr><td>SS</td><td>3.100€</td><td>2.800€</td></tr><tr><td><b>Total</b></td><td><b>11.500€</b></td><td><b>9.000€</b></td></tr></table></div></body></html>`);

// Tickets
await toPdf('Simulador_Tickets_Exemplo_Lda', `<html><head>${base}</head><body><span class="badge">Simulador Tickets</span><h1>Tickets — Exemplo Lda</h1><div class="card">Carga de 150€/mês — poupança ~32€ vs aumento salarial</div></body></html>`);

// SS Independente
await toPdf('Simulador_SS_Independente_Exemplo_Lda', `<html><head>${base}</head><body><span class="badge">SS Independente</span><h1>Segurança Social — Independente</h1><div class="card">Base 1.800€ — contribuição 21,4% = 385€/mês</div></body></html>`);

// Diagnóstico
await toPdf('Simulador_Diagnostico_Exemplo_Lda', `<html><head>${base}</head><body><span class="badge">Diagnóstico</span><h1>Diagnóstico de Autonomia — Exemplo Lda</h1><div class="card">Volume 120.000€ — autonomia 38% — risco moderado</div></body></html>`);

// Imóveis
await toPdf('Simulador_Imoveis_Exemplo_Lda', `<html><head>${base}</head><body><span class="badge">Imóveis</span><h1>Imóveis na Empresa — Exemplo Lda</h1><div class="card">Compra 250.000€ — IMT 12.500€ vs renda 1.200€/mês</div></body></html>`);

// IMT
await toPdf('Simulador_IMT_Exemplo_Lda', `<html><head>${base}</head><body><span class="badge">IMT</span><h1>IMT — Exemplo Lda</h1><div class="card">Valor 250.000€ — IMT 12.500€ + IS 2.000€</div></body></html>`);

// Salário Líquido
await toPdf('Simulador_Salario_Liquido_Exemplo_Lda', `<html><head>${base}</head><body><span class="badge">Salário</span><h1>Salário Líquido — Exemplo Lda</h1><div class="card">Bruto 2.500€ — líquido 1.680€ — custo empresa 3.120€</div></body></html>`);

// IRS
await toPdf('Simulador_IRS_Exemplo_Lda', `<html><head>${base}</head><body><span class="badge">IRS</span><h1>IRS — Exemplo Lda</h1><div class="card">Rendimento 35.000€ — IRS 6.800€ — taxa efetiva 19,4%</div></body></html>`);

// Previsa
const prev = { ...defaultPreviSaState(), volumeNegocios: 120000 };
const imp = impostoEstimado(prev.volumeNegocios, 40000);
await toPdf('Simulador_Previsa_Exemplo_Lda', `<html><head>${base}</head><body><span class="badge">Previsa</span><h1>Previsa 2025 — Exemplo Lda</h1><div class="card">Volume 120.000€ — RAI 15.000€ — IRC estimado ~3.200€</div></body></html>`);

// Pacote
await toPdf('Simulacao_Fiscal_Exemplo_Lda', `<html><head>${base}</head><body><span class="badge">Pacote — Simulação</span><h1>Simulação Fiscal Completa</h1><div class="card">ENI vs Sociedade com gráficos e cenários</div></body></html>`);
await toPdf('Proposta_Honorarios_Exemplo_Lda', `<html><head>${base}</head><body><span class="badge">Pacote — Proposta</span><h1>Proposta de Honorários</h1><div class="card">Gabinete Exemplo — honorários 150€/mês + extras</div></body></html>`);
await toPdf('Minuta_Contrato_Exemplo_Lda', `<html><head>${base}</head><body><span class="badge">Pacote — Minuta</span><h1>Minuta de Contrato OCC</h1><div class="card">Cláusulas preenchidas com NIF e capital</div></body></html>`);

await browser.close();
console.log('done real');
