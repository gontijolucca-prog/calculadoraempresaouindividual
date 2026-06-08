// Casos-teste golden do motor de Viaturas. Correr: npx tsx src/lib/viaturas.test.ts
// Anti-regressão do motor extraído + agravamento de TA (+10 p.p. com prejuízo).
// ⚠ Valores a confirmar por um contabilista — ver docs/AUDITORIA-FISCAL-PENDENTE.md.

import { calcViatura, type ViaturaInput } from './viaturas';

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

const base: ViaturaInput = {
  category: 'passageiros', engineType: 'diesel', price: 40000, ivaRegime: 'normal',
  activity: 'other', maintenanceCost: 1230, insuranceCost: 500, fuelCost: 1230,
  exemptTA: false, phevCompliant: false,
};

// ── A: passageiros diesel 40 000 € (escalão TA 25%, IVA aquisição 0) ──
{
  const r = calcViatura(base);
  approx('A: taxa TA', r.taRate, 0.25);
  approx('A: TA', r.taValue, 3211.25);
  approx('A: IVA aquisição (diesel passageiros = 0)', r.ivaAquisicaoDedutivel, 0);
  approx('A: depreciação não aceite (limite 25k)', r.depNaoAceite, 3750);
}

// ── B: mesma viatura com prejuízo fiscal → TA +10 p.p. (25% → 35%) ──
{
  const r = calcViatura({ ...base, agravamentoTA: true });
  approx('B: taxa TA agravada', r.taRate, 0.35);
  approx('B: TA agravada', r.taValue, 4495.75);
}

// ── C: elétrico 50 000 € → TA 0% e IVA aquisição 100% (≤62.500) ──
{
  const r = calcViatura({ ...base, engineType: 'electric', price: 50000 });
  approx('C: taxa TA (elétrico ≤62,5k)', r.taRate, 0);
  approx('C: IVA aquisição 100%', r.ivaAquisicaoDedutivel, 11500);
}

// ── D: elétrico 70 000 € → TA 10% e IVA aquisição 0 (>62.500) ──
{
  const r = calcViatura({ ...base, engineType: 'electric', price: 70000 });
  approx('D: taxa TA (elétrico >62,5k)', r.taRate, 0.10);
  approx('D: IVA aquisição 0 (>62,5k)', r.ivaAquisicaoDedutivel, 0);
  is('D: isElecTaxed', r.isElecTaxed, true);
}

if (fails) { console.error(`\n${fails} caso(s) FALHARAM`); process.exit(1); }
else console.log('\nTodos os casos golden de Viaturas passaram.');
