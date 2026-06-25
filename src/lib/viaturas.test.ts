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

// ── E: PHEV compliant 44 999 € → TA 7,5% (escalão 37,5k-45k) ──
{
  const r = calcViatura({ ...base, engineType: 'phev', price: 44999, phevCompliant: true });
  approx('E: taxa TA PHEV (37,5k-45k)', r.taRate, 0.075);
  approx('E: IVA aquisição PHEV ≤50k', r.ivaAquisicaoDedutivel, 10349.77);
  approx('E: limite depreciação PHEV', r.limit, 50000);
}

// ── F: comercial diesel → IVA aquisição 50%, combustível 50%, TA 0 ──
{
  const r = calcViatura({ ...base, category: 'comercial', engineType: 'diesel', price: 30000 });
  const ivaEsperado = (30000 * 0.23) * 0.5;
  approx('F: IVA aquisição comercial diesel (50%)', r.ivaAquisicaoDedutivel, ivaEsperado);
  is('F: TA = 0 (comercial)', r.taRate, 0);
  approx('F: combustível IVA 50%', r.ivaRecupCombustivel, 115);
}

// ── G: gasolina passageiros 30 000 € → TA 8% (escalão <37,5k) ──
{
  const r = calcViatura({ ...base, engineType: 'gasoline', price: 30000 });
  approx('G: taxa TA gasolina <37,5k', r.taRate, 0.08);
  approx('G: limite depreciação 25k (gasolina)', r.limit, 25000);
}

// ── H: actividade isenta (transportes) com exemptTA → TA 0, depreciação total ──
{
  const r = calcViatura({ ...base, activity: 'public_transport', price: 80000, exemptTA: true });
  is('H: TA = 0 (transporte público)', r.taRate, 0);
  approx('H: IVA aquisição 100% (actividade isenta)', r.ivaAquisicaoDedutivel, 18400);
  is('H: limite = ∞ (deprecia total)', r.limit, Infinity);
}

if (fails) { console.error(`\\n${fails} caso(s) FALHARAM`); process.exit(1); }
else console.log('\\nTodos os casos golden de Viaturas passaram.');
