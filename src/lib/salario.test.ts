// Casos-teste golden do Salário Líquido (TCO). Correr com: npx tsx src/lib/salario.test.ts
// Fixam o COMPORTAMENTO ATUAL (anti-regressão) ao refatorar o motor.
// Os valores ESPERADOS foram capturados da execução atual — NÃO são a
// liquidação oficial da AT. A retenção é uma estimativa anualizada (escalões
// 2026 ÷ nº de pagamentos), não a tabela mensal oficial — ver AUDITORIA-SALARIO.md.

import { calcSalarioLiquido, type SalarioParams } from './salario';

let fails = 0;
function approx(label: string, got: number, exp: number, tol = 0.02) {
  const ok = Math.abs(got - exp) <= tol;
  if (!ok) { fails++; console.error(`✗ ${label}: esperado ${exp}, obteve ${got.toFixed(2)}`); }
  else console.log(`✓ ${label} = ${got.toFixed(2)}`);
}
function eq(label: string, a: number, b: number) {
  const ok = Math.abs(a - b) < 0.005;
  if (!ok) { fails++; console.error(`✗ ${label}: ${a.toFixed(2)} ≠ ${b.toFixed(2)}`); }
  else console.log(`✓ ${label} (iguais: ${a.toFixed(2)})`);
}

const base: SalarioParams = {
  salarioBruto: 1500, estadoCivil: 'solteiro', nrDependentes: 0,
  localizacao: 'continente', duodecimos: true, subsidioAlimentacaoDiario: 6,
  tipoSubsidio: 'cartao', diasSubsidio: 22, irsJovem: false, anosAtividade: 0,
  idade: 40, taxaSeguroTrabalho: 0.01,
};
const run = (p: Partial<SalarioParams> = {}) => calcSalarioLiquido({ ...base, ...p });

// ── Caso A: solteiro, €1500, 14 pagamentos, subsídio cartão 6€×22 (todo isento) ──
{
  const r = run();
  approx('A: SS trabalhador (11%)', r.ssTrabalhador, 165);
  approx('A: retenção IRS mensal (estimativa)', r.retencaoIRS, 180.02);
  approx('A: salário líquido mensal', r.salarioLiquido, 1286.98);
  approx('A: custo total empregador', r.custoEmpregadorReal, 2003.25);
}

// ── Caso B: IRS Jovem ano 1 (isenção 100%) ──
{
  const r = run({ irsJovem: true, idade: 25, anosAtividade: 0 });
  approx('B: retenção IRS = 0 (jovem ano 1)', r.retencaoIRS, 0);
  approx('B: líquido = bruto − SS + subsídio', r.salarioLiquido, 1467);
}

// ── Caso C: estado civil — casado 1 titular beneficia do quociente conjugal ──
// casado_1titular retém menos (IRS(base/2)×2); casado_2titulares = solteiro (qf=1).
{
  const solteiro = run({ estadoCivil: 'solteiro' });
  const casado1 = run({ estadoCivil: 'casado_1titular' });
  const casado2 = run({ estadoCivil: 'casado_2titulares' });
  approx('C: casado 1 titular retém menos', casado1.retencaoIRS, 146.54);
  eq('C: casado 2 titulares = solteiro', casado2.salarioLiquido, solteiro.salarioLiquido);
}

// ── Caso D: região REDUZ a retenção (mesmo fator do simulador de IRS) ──
// Açores ×0,80 e Madeira ×0,70 sobre a coleta. ⚠ % a confirmar pela Sandrine.
{
  const continente = run({ localizacao: 'continente' });
  const madeira = run({ localizacao: 'madeira' });
  const acores = run({ localizacao: 'acores' });
  approx('D: Madeira retenção = Continente ×0,70', madeira.retencaoIRS, continente.retencaoIRS * 0.70);
  approx('D: Açores retenção = Continente ×0,80', acores.retencaoIRS, continente.retencaoIRS * 0.80);
  approx('D: Madeira líquido (retenção menor)', madeira.salarioLiquido, 1340.98);
  approx('D: Açores líquido', acores.salarioLiquido, 1322.98);
}

// ── Caso E: subsídio acima do limite isento gera parte tributável ──
// cartão limite 10,46 €/dia; 12 €/dia × 20 → isento 10,46×20, tributável (12−10,46)×20
{
  const r = run({ subsidioAlimentacaoDiario: 12, diasSubsidio: 20, tipoSubsidio: 'cartao' });
  approx('E: subsídio isento (10,46×20)', r.subsidioAlimentacaoIsento, 209.2);
  approx('E: subsídio tributável ((12−10,46)×20)', r.subsidioAlimentacaoTributavel, 30.8);
}

if (fails) { console.error(`\n${fails} caso(s) FALHARAM`); process.exit(1); }
else console.log('\nTodos os casos golden de Salário passaram.');
