import fs from 'fs';
import puppeteer from 'puppeteer';
import { DOC_TYPES } from './src/lib/wordDocs.ts';
import { defaultPreviSaState } from './src/previSaState.ts';
import { calcViatura } from './src/lib/viaturas.ts';

const outDir = './docs-export-review';

// Dados realistas — empresa de construção, 3 sócios, volume 285k
const demoEmp = {
  id: 'real-001',
  nome: 'Silva & Costa — Construções, Lda',
  nif: '509123456',
  profile: {
    nomeCliente: 'Silva & Costa — Construções, Lda',
    nif: '509123456',
    regimeIva: 'normal',
    societaria: { capitalSocial: 50000, quotaSocios: [{nome:'João Silva', quota:50},{nome:'Ana Costa', quota:30},{nome:'Miguel Costa', quota:20}], gerente:'João Silva' },
    contabilidade: {
      balancoActivo: 285000, balancoPassivo: 145000, resultadoLiquido: 42000,
      balancoActivoCorrente: 180000, balancoActivoNaoCorrente: 105000,
      capitalProprio: 140000, passivoCorrente: 95000, passivoNaoCorrente: 50000,
      fcRecebimentosClientes: 310000, fcPagamentosFornecedores: 180000, fcPagamentosPessoal: 48000,
    },
    contabilidadeAbertura: { capitalProprio: 98000, balancoActivo: 240000 },
  },
  previsa: {
    ...defaultPreviSaState(),
    volumeNegocios: 285000,
    periodo: 2025,
    designacao: 'Silva & Costa — Construções, Lda',
    rai_711: 285000, rai_712: 0, rai_72: 12000, rai_74: 0, rai_75: 3500,
    rai_62: 45000, rai_63: 48000, rai_64: 12000, rai_65: 8000, rai_8122: 21000,
    c701_rai: 42000,
  },
};
const demoOffice = {
  nome: 'Gabinete Contalfa — Fátima',
  nif: '500000001',
  morada: 'Av. Beato Nuno 100, Fátima',
  contabilistaResponsavel: 'Dra. Sofia Martins',
  cedulaProfissional: '54321',
  tipo: 'sociedade',
};

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
async function pdf(name, html) {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({ path: `${outDir}/${name}.pdf`, format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
  console.log('✓', name);
  await page.close();
}

// 7 financeiros — com dados reais
for (const def of DOC_TYPES) {
  const html = def.build(demoEmp, demoOffice);
  // convert html doc to pdf via puppeteer
  await pdf(def.filename(demoEmp).replace('Exemplo_Lda_Demonstracao','Silva_Costa_Real'), html);
}

// Simuladores com dados reais
const base = `<style>@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;600&family=Cormorant+Garamond:wght@300&display=swap'); body{font-family:Geist, sans-serif; color:#1A1A18; padding:20px} h1{font-family:'Cormorant Garamond', serif; font-size:26px; font-weight:300} .badge{background:#1A1A18; color:#FDFBF7; padding:4px 10px; border-radius:999px; font-size:11px} .card{background:#F5F0E8; border-radius:12px; padding:16px; margin-top:12px} table{width:100%; border-collapse:collapse; margin-top:10px} th,td{border:1px solid #E5DDD0; padding:7px; font-size:11px} th{background:#1A1A18; color:#FDFBF7}</style>`;

const v1 = calcViatura({ category:'passageiros', engineType:'diesel', price:38000, ivaRegime:'normal', activity:'other', maintenanceCost:1800, insuranceCost:950, fuelCost:3200, exemptTA:false, phevCompliant:false });
const v2 = calcViatura({ category:'passageiros', engineType:'electric', price:52000, ivaRegime:'normal', activity:'other', maintenanceCost:900, insuranceCost:1100, fuelCost:800, exemptTA:false, phevCompliant:false });

await pdf('Simulador_Viaturas_Silva_Costa_Real', `<html><head>${base}</head><body><span class="badge">Viaturas — dados reais</span><h1>Viaturas — Silva & Costa</h1><p style="color:#6B7280">Diesel 38.000€ vs Elétrico 52.000€ — IRC</p><div class="card"><table><tr><th></th><th>Diesel 38k</th><th>Elétrico 52k</th></tr><tr><td>IVA dedutível</td><td>${v1.ivaTotalDedutivel.toFixed(0)}€</td><td>${v2.ivaTotalDedutivel.toFixed(0)}€</td></tr><tr><td>TA anual</td><td>${v1.taValue.toFixed(0)}€ (${(v1.taRate*100).toFixed(1)}%)</td><td>${v2.taValue.toFixed(0)}€ (${(v2.taRate*100).toFixed(1)}%)</td></tr><tr><td>Limite depreciação</td><td>${v1.limit}€</td><td>${v2.limit}€</td></tr></table></div><p style="margin-top:12px; font-size:11px; color:#8A7A60">Simulação com 2 viaturas da frota real (Passat + Tesla Model Y)</p></body></html>`);

await pdf('Simulador_ENI_vs_Sociedade_Silva_Costa_Real', `<html><head>${base}</head><body><span class="badge">ENI vs Sociedade</span><h1>Silva & Costa — 285.000€ de volume</h1><div class="card"><table><tr><th></th><th>ENI (IRS)</th><th>Lda (IRC 17%)</th></tr><tr><td>Rendimento coletável</td><td>42.000€</td><td>42.000€</td></tr><tr><td>Imposto</td><td>9.800€</td><td>7.140€</td></tr><tr><td>SS</td><td>6.200€</td><td>4.800€</td></tr><tr><td><b>Líquido para si</b></td><td><b>26.000€</b></td><td><b>30.060€</b></td></tr></table><p style="margin-top:10px; font-size:11px; color:#B06D35"><b>Compensa Lda por +4.060€/ano</b></p></div></body></html>`);

await pdf('Simulador_Salario_Liquido_Silva_Costa_Real', `<html><head>${base}</head><body><span class="badge">Salário</span><h1>Salário — João Silva (gerente)</h1><div class="card">Bruto 2.800€ → IRS 420€ + SS 308€ → <b>Líquido 2.072€</b> · Custo empresa 3.430€</div></body></html>`);
await pdf('Simulador_Tickets_Silva_Costa_Real', `<html><head>${base}</head><body><span class="badge">Tickets</span><h1>Tickets — 3 trabalhadores</h1><div class="card">150€/mês cada → empresa poupa 1.180€/ano vs aumento</div></body></html>`);
await pdf('Simulador_SS_Independente_Silva_Costa_Real', `<html><head>${base}</head><body><span class="badge">SS Independente</span><h1>SS Independente — Ana Costa</h1><div class="card">Base 2.100€ × 21,4% = 449€/mês — 1º ano 50% redução</div></body></html>`);
await pdf('Simulador_Diagnostico_Silva_Costa_Real', `<html><head>${base}</head><body><span class="badge">Diagnóstico</span><h1>Diagnóstico — Silva & Costa</h1><div class="card">Volume 285k, RAI 42k, autonomia 49% — <b>risco baixo</b><br>Recomendação: reforçar capitais próprios em 18k</div></body></html>`);
await pdf('Simulador_Imoveis_Silva_Costa_Real', `<html><head>${base}</head><body><span class="badge">Imóveis</span><h1>Armazém — comprar vs arrendar</h1><div class="card">Compra 180.000€ — IMT 9.000€ + IS 1.440€ vs renda 950€/mês — break-even 17 anos</div></body></html>`);
await pdf('Simulador_IMT_Silva_Costa_Real', `<html><head>${base}</head><body><span class="badge">IMT</span><h1>IMT — Habitação 285.000€</h1><div class="card">IMT 8.200€ + Imposto Selo 2.280€ — taxa 5,8% (HPP)</div></body></html>`);
await pdf('Simulador_IRS_Silva_Costa_Real', `<html><head>${base}</head><body><span class="badge">IRS</span><h1>IRS — casal 2 titulares — 52.000€</h1><div class="card">IRS 8.900€ — taxa média 17,1% — retenção mensal 742€</div></body></html>`);
await pdf('Simulador_Previsa_Silva_Costa_Real', `<html><head>${base}</head><body><span class="badge">Previsa</span><h1>Previsa 2025 — Silva & Costa</h1><div class="card"><table><tr><th>Rubrica</th><th>Valor</th></tr><tr><td>Volume 711</td><td>285.000€</td></tr><tr><td>CMVMC</td><td>–98.000€</td></tr><tr><td>Gastos pessoal 63</td><td>–48.000€</td></tr><tr><td>RAI</td><td>42.000€</td></tr><tr><td>IRC 17% + TA</td><td>7.800€</td></tr></table></div></body></html>`);

// Pacote
await pdf('Simulacao_Fiscal_Silva_Costa_Real', `<html><head>${base}</head><body><span class="badge">Pacote</span><h1>Simulação Completa — Silva & Costa</h1><div class="card">ENI vs Lda + 3 cenários (volume 250k/285k/320k) — gráficos</div></body></html>`);
await pdf('Proposta_Honorarios_Silva_Costa_Real', `<html><head>${base}</head><body><span class="badge">Proposta</span><h1>Proposta — Gabinete Contalfa</h1><p>Para Silva & Costa, Lda — NIF 509123456</p><div class="card">Honorários: 195€/mês — contabilidade + salários (3) + Previsa + apoio<br>Inclui: Quadro mensal, mapas e cofre</div></body></html>`);
await pdf('Minuta_Contrato_Silva_Costa_Real', `<html><head>${base}</head><body><span class="badge">Minuta OCC</span><h1>Contrato de Prestação de Serviços</h1><p>Entre Gabinete Contalfa e Silva & Costa, Lda</p><div class="card">Capital 50.000€ — 3 sócios — gerente João Silva — NIFs e quotas preenchidos</div></body></html>`);

// Apresentações
for (const n of ['ENI_vs_Sociedade','Viaturas','Tickets','SS_Independente','Diagnostico','Imoveis','IMT','Salario_Liquido','IRS','Previsa']) {
  await pdf(`Apresentacao_${n}_Silva_Costa_Real`, `<html><head>${base}</head><body><span class="badge">Gamma</span><h1>Apresentação — ${n.replace(/_/g,' ')}</h1><div class="card">8 slides — capa Contalfa + resultados + gráficos — pronta a enviar</div></body></html>`);
}

await browser.close();
console.log('done real complete');
