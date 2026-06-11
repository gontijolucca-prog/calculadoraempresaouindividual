// Casos-teste golden do Salário Líquido (TCO). Correr com: npx tsx src/lib/salario.test.ts
// Retenção mensal = TABELAS OFICIAIS 2026 (ver retencao.test.ts para a validação
// das tabelas). Aqui valida-se a integração: SS, subsídios, duodécimos, anuais.

import { calcSalarioLiquido, type SalarioParams } from './salario';

let fails = 0;
function approx(label: string, got: number, exp: number, tol = 0.02) {
  const ok = Math.abs(got - exp) <= tol;
  if (!ok) { fails++; console.error(`✗ ${label}: esperado ${exp}, obteve ${got.toFixed(2)}`); }
  else console.log(`✓ ${label} = ${got.toFixed(2)}`);
}
function eq(label: string, a: number | string | boolean | null, b: number | string | boolean | null) {
  const ok = typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 0.005 : a === b;
  if (!ok) { fails++; console.error(`✗ ${label}: ${a} ≠ ${b}`); }
  else console.log(`✓ ${label} (${a})`);
}

const base: SalarioParams = {
  salarioBruto: 1500, estadoCivil: 'solteiro', nrDependentes: 0,
  localizacao: 'continente', duodecimos: true, subsidioAlimentacaoDiario: 6,
  tipoSubsidio: 'cartao', diasSubsidio: 22, irsJovem: false, anosAtividade: 0,
  idade: 40, taxaSeguroTrabalho: 0.01,
};
const run = (p: Partial<SalarioParams> = {}) => calcSalarioLiquido({ ...base, ...p });

// ── Caso A: solteiro, €1500, duodécimos, subsídio cartão 6€×22 (todo isento) ──
// Mês típico c/ duodécimos: cash bruto = 1500×14/12 = 1750; SS 11% = 192,50.
// Retenção: mês 168 (Tabela I) + duodécimos 2×168/12 = 28 → 196.
// Líquido = 1750 − 192,50 − 196 + 132 = 1493,50.
{
  const r = run();
  approx('A: SS trabalhador (11% × 1750)', r.ssTrabalhador, 192.5);
  approx('A: retenção IRS mensal (168 + 28 duodécimos)', r.retencaoIRS, 196);
  eq('A: tabela aplicada', r.tabelaRetencao, 'I');
  eq('A: retenção oficial', r.retencaoOficial, true);
  approx('A: salário líquido mensal', r.salarioLiquido, 1493.5);
  eq('A: nº recibos/ano (duodécimos)', r.nrPagamentos, 12);
  approx('A: bruto anual (14×1500)', r.brutoAnual, 21000);
  approx('A: retenção anual (196×12)', r.retencaoAnual, 2352);
  approx('A: líquido anual', r.salarioLiquidoAnual, 21000 - 2310 - 2352 + 132 * 11);
  // custo anual empregador: 14 × 1500×(1 + 0,2375 SS + 0,01 seguro) + subsídio 132×11
  approx('A: custo total anual', r.totalAnual, 1500 * 1.2475 * 14 + 132 * 11);
}

// ── Caso B: sem duodécimos — 14 recibos, subsídios com retenção autónoma ──
{
  const r = run({ duodecimos: false });
  eq('B: nº recibos/ano', r.nrPagamentos, 14);
  approx('B: SS do mês (11% × 1500)', r.ssTrabalhador, 165);
  approx('B: retenção do mês (tabela oficial)', r.retencaoIRS, 168);
  approx('B: retenção autónoma de cada subsídio', r.retencaoSubsidio, 168);
  approx('B: líquido mensal', r.salarioLiquido, 1500 - 165 - 168 + 132);
  approx('B: retenção anual (12×168 + 2×168)', r.retencaoAnual, 2352);
  // anuais iguais ao caso A — duodécimos não mudam o total do ano
  approx('B: líquido anual = caso A', r.salarioLiquidoAnual, run().salarioLiquidoAnual);
}

// ── Caso C: IRS Jovem ano 1 (isenção 100%) ──
{
  const r = run({ irsJovem: true, idade: 25, anosAtividade: 0 });
  approx('C: retenção = 0 (jovem ano 1)', r.retencaoIRS, 0);
  approx('C: líquido = cash bruto − SS + subsídio', r.salarioLiquido, 1750 - 192.5 + 132);
}

// ── Caso D: estado civil — tabelas próprias por situação familiar ──
// casado 1 titular €1500: Tabela III → 94; duodécimos 2×94/12 = 15,667 → 109,67
{
  const solteiro = run();
  const casado1 = run({ estadoCivil: 'casado_1titular' });
  const casado2 = run({ estadoCivil: 'casado_2titulares' });
  eq('D: casado 1 titular usa Tabela III', casado1.tabelaRetencao, 'III');
  approx('D: casado 1 titular retém menos', casado1.retencaoIRS, 94 + (94 * 2) / 12);
  eq('D: casado 2 titulares s/ dep usa Tabela I', casado2.tabelaRetencao, 'I');
  approx('D: casado 2 titulares = solteiro', casado2.salarioLiquido, solteiro.salarioLiquido);
}

// ── Caso E: regiões — Madeira tem tabelas PRÓPRIAS (não é fator 0,70) ──
// Madeira €1500: 100 + 2×100/12 = 116,67. Açores: estimativa sinalizada.
{
  const madeira = run({ localizacao: 'madeira' });
  approx('E: Madeira retenção (tabela regional)', madeira.retencaoIRS, 100 + 200 / 12);
  eq('E: Madeira é oficial', madeira.retencaoOficial, true);
  const acores = run({ localizacao: 'acores' });
  eq('E: Açores marcado como estimativa', acores.retencaoOficial, false);
  approx('E: Açores retenção estimada (134 + 2×134/12)', acores.retencaoIRS, 134 + 268 / 12);
}

// ── Caso F: deficiência — tabelas IV–VII ──
// €2500 solteiro deficiente: Tabela IV → 214 vs Tabela I: 2500×0,349−401,19 = 471,06 → 471
{
  const normal = run({ salarioBruto: 2500, duodecimos: false });
  const def = run({ salarioBruto: 2500, duodecimos: false, deficiente: true });
  eq('F: tabela deficiente', def.tabelaRetencao, 'IV');
  approx('F: retenção deficiente €2500', def.retencaoIRS, 214);
  approx('F: retenção não deficiente €2500', normal.retencaoIRS, 471);
}

// ── Caso G: subsídio acima do limite isento entra na remuneração sujeita ──
// cartão 12€×20: isento 209,20, tributável 30,80 → R = 1530,80 → Tabela I: 175
{
  const r = run({ subsidioAlimentacaoDiario: 12, diasSubsidio: 20, duodecimos: false });
  approx('G: subsídio isento (10,46×20)', r.subsidioAlimentacaoIsento, 209.2);
  approx('G: subsídio tributável ((12−10,46)×20)', r.subsidioAlimentacaoTributavel, 30.8);
  approx('G: retenção sobre 1530,80', r.retencaoIRS, 175);
}

// ── Caso H: acerto anual estimado coerente ──
// retenção anual ≈ IRS anual estimado (acerto pequeno face à coleta)
{
  const r = run();
  const ok = Math.abs(r.acertoEstimado) < r.irsAnualEstimado * 0.2;
  eq('H: |acerto| < 20% do IRS anual estimado', ok, true);
  approx('H: acerto = estimado − retido', r.acertoEstimado, r.irsAnualEstimado - r.retencaoAnual);
}

if (fails) { console.error(`\n${fails} caso(s) FALHARAM`); process.exit(1); }
else console.log('\nTodos os casos golden de Salário passaram.');
