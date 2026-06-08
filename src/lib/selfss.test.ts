// Casos-teste golden da SS de Trabalhador Independente. Correr: npx tsx src/lib/selfss.test.ts
// Fixam o comportamento (anti-regressão). Valores capturados da execução atual.
// Taxa 21,4%; base 70% (serviços) / 20% (bens); mínimo 20 €/mês; teto da base
// = 12 × IAS (6 445,56 € em 2026); isenção total no 1.º ano. ⚠ Valores fiscais a
// confirmar por um contabilista — ver AUDITORIA-FISCAL-PENDENTE.md.

import { calcSelfSSContribution } from './pt2026';

let fails = 0;
function approx(label: string, got: number, exp: number, tol = 0.02) {
  const ok = Math.abs(got - exp) <= tol;
  if (!ok) { fails++; console.error(`✗ ${label}: esperado ${exp}, obteve ${got.toFixed(2)}`); }
  else console.log(`✓ ${label} = ${got.toFixed(2)}`);
}
function is(label: string, got: unknown, exp: unknown) {
  const ok = got === exp;
  if (!ok) { fails++; console.error(`✗ ${label}: esperado ${exp}, obteve ${got}`); }
  else console.log(`✓ ${label} = ${got}`);
}

// ── A: prestação de serviços, 2 000 €/mês ──
{
  const r = calcSelfSSContribution(2000, 'servicos');
  approx('A: base (70%)', r.baseCalculo, 1400);
  approx('A: mensal (21,4%)', r.mensal, 299.6);
  approx('A: trimestral', r.trimestral, 898.8);
  approx('A: anual', r.anual, 3595.2);
}

// ── B: venda de bens, 1 000 €/mês (base 20%) ──
{
  const r = calcSelfSSContribution(1000, 'bens');
  approx('B: base (20%)', r.baseCalculo, 200);
  approx('B: mensal', r.mensal, 42.8);
}

// ── C: rendimento muito baixo → mínimo de 20 €/mês ──
{
  const r = calcSelfSSContribution(50, 'servicos');
  approx('C: mensal = mínimo 20 €', r.mensal, 20);
}

// ── D: rendimento alto → teto da base 12 × IAS (6 445,56 €) ──
{
  const r = calcSelfSSContribution(12000, 'servicos');
  approx('D: base limitada a 12×IAS', r.baseCalculo, 6445.56);
  approx('D: mensal sobre o teto', r.mensal, 1379.35);
  is('D: baseLimitada = true', r.baseLimitada, true);
}

// ── E: 1.º ano de atividade → isenção total ──
{
  const r = calcSelfSSContribution(2000, 'servicos', true);
  approx('E: mensal = 0 (isento)', r.mensal, 0);
  is('E: isento = true', r.isento, true);
}

if (fails) { console.error(`\n${fails} caso(s) FALHARAM`); process.exit(1); }
else console.log('\nTodos os casos golden de SS Independente passaram.');
