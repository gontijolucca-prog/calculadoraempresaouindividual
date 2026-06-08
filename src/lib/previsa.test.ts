// Casos-teste golden do motor Previsa (IRC Modelo 22). Correr: npx tsx src/lib/previsa.test.ts
// Cobrem as partes ESTÁVEIS (coleta IRC PME/geral, derrama estadual por escalões,
// tributação autónoma de viaturas, matéria coletável). NÃO cobrem o PEC, cuja
// fórmula/limite em 2026 está por confirmar (ver AUDITORIA-FISCAL-PENDENTE.md).
// Valores ⚠ a confirmar pela Sandrine; isto é anti-regressão, não a liquidação da AT.

import { calculate, calcTAVeiculo, calcDerramaEstadual } from './previsaCalc';
import { defaultPreviSaState } from '../previSaState';

let fails = 0;
function approx(label: string, got: number, exp: number, tol = 0.5) {
  const ok = Math.abs(got - exp) <= tol;
  if (!ok) { fails++; console.error(`✗ ${label}: esperado ${exp}, obteve ${got.toFixed(2)}`); }
  else console.log(`✓ ${label} = ${got.toFixed(2)}`);
}

// ── A: PME geral, matéria coletável 40 000 € → 15% ──
{
  const s = defaultPreviSaState();
  s.isPME = true; s.regime = 'geral'; s.useRaiCalc = false; s.c701_rai = 40000;
  const r = calculate(s);
  approx('A: matéria coletável', r.materiaColetavel, 40000);
  approx('A: coleta IRC (15%)', r.ircColeta, 6000);
  approx('A: c358 IRC liquidado', r.c358, 6000);
}

// ── B: PME geral, 80 000 € → 50k×15% + 30k×19% ──
{
  const s = defaultPreviSaState();
  s.isPME = true; s.regime = 'geral'; s.c701_rai = 80000;
  const r = calculate(s);
  approx('B: coleta (7500 + 5700)', r.ircColeta, 13200);
}

// ── C: não-PME geral, 100 000 € → 19% ──
{
  const s = defaultPreviSaState();
  s.isPME = false; s.regime = 'geral'; s.c701_rai = 100000;
  const r = calculate(s);
  approx('C: coleta (19%)', r.ircColeta, 19000);
}

// ── D: Derrama estadual continental, MC = 2 000 000 € → (2M−1,5M)×3% ──
{
  approx('D: derrama estadual (15 000)', calcDerramaEstadual(2_000_000, 'continental'), 15000);
  approx('D: derrama isenta até 1,5M', calcDerramaEstadual(1_400_000, 'continental'), 0);
}

// ── E: Tributação autónoma de viatura convencional 40 000 € (escalão 0,25) ──
{
  const v = { id: 'x', ano: 2025, combustivel: 'convencional' as const, custoHistorico: 40000, encargos: 10000 };
  approx('E: TA viatura (25%)', calcTAVeiculo(v, false), 2500);
  approx('E: TA viatura c/ agravamento (×1,1)', calcTAVeiculo(v, true), 2750);
}

// ── F: viatura elétrica até 62 500 € → 0% de TA ──
{
  const v = { id: 'e', ano: 2025, combustivel: 'eletrico' as const, custoHistorico: 50000, encargos: 8000 };
  approx('F: TA viatura elétrica = 0', calcTAVeiculo(v, false), 0);
}

if (fails) { console.error(`\n${fails} caso(s) FALHARAM`); process.exit(1); }
else console.log('\nTodos os casos golden do Previsa passaram.');
