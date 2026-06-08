// Casos-teste golden do IMT + Imposto de Selo. Correr: npx tsx src/lib/imt.test.ts
// Anti-regressão. Valores ⚠ a confirmar pela Sandrine (escalões CIMT 2026,
// limites do IMT Jovem) — ver AUDITORIA-FISCAL-PENDENTE.md. Selo TGIS 1.1 = 0,8%.

import { calcIMT } from './imt';

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

// ── A: HPP 100 000 € (1.º escalão 0%) → isento de IMT ──
{
  const r = calcIMT(100000, 'hpp', 'continente', false, 40);
  approx('A: IMT = 0', r.imt, 0);
  approx('A: Imposto Selo (0,8%)', r.impostoSelo, 800);
  is('A: isento', r.isento, true);
}

// ── B: HPP 200 000 € (4.º escalão 7%, dedução 10 457,96) ──
{
  const r = calcIMT(200000, 'hpp', 'continente', false, 40);
  approx('B: IMT', r.imt, 3542.04);
  approx('B: total (IMT + Selo)', r.total, 5142.04);
}

// ── C: Habitação secundária 200 000 € (7%, dedução 8 578,41) ──
{
  const r = calcIMT(200000, 'habitacao', 'continente', false, 40);
  approx('C: IMT', r.imt, 5421.59);
}

// ── D: Prédio rústico 100 000 € → taxa plana 5% ──
{
  const r = calcIMT(100000, 'rustico', 'continente', false, 40);
  approx('D: IMT (5%)', r.imt, 5000);
}

// ── E: Prédio urbano outros fins 100 000 € → taxa plana 6,5% ──
{
  const r = calcIMT(100000, 'urbano_outros', 'continente', false, 40);
  approx('E: IMT (6,5%)', r.imt, 6500);
}

// ── F: IMT Jovem ≤35, HPP, 1.ª habitação, 300 000 € → isenção total ──
{
  const r = calcIMT(300000, 'hpp', 'continente', true, 30);
  approx('F: IMT = 0 (isento jovem)', r.imt, 0);
  approx('F: Selo = 0 (isento jovem)', r.impostoSelo, 0);
  is('F: isentoJovem', r.isentoJovem, true);
}

// ── G: IMT Jovem 400 000 € (acima da isenção, ≤ limite redução) → IMT marginal ──
// IMT(400k) − IMT(330 539) = redução parcial; Selo isento.
{
  const r = calcIMT(400000, 'hpp', 'continente', true, 30);
  approx('G: IMT Jovem (redução parcial)', r.imt, 5556.88);
  approx('G: Selo = 0', r.impostoSelo, 0);
}

if (fails) { console.error(`\n${fails} caso(s) FALHARAM`); process.exit(1); }
else console.log('\nTodos os casos golden de IMT passaram.');
