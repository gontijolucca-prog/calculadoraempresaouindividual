// Casos-teste golden do cálculo de honorários (proposta do escritório).
// Correr: npx tsx src/lib/honorarios.test.ts
// Não é cálculo fiscal — é a tabela de preços do escritório (configurável).
// Só o IVA (23%) é fiscal. Anti-regressão da função pura calcularProposta.

import { calcularProposta, defaultHonorariosConfig } from './honorarios';
import type { ClientProfile } from '../ClientProfile';

let fails = 0;
function approx(label: string, got: number, exp: number, tol = 0.02) {
  const ok = Math.abs(got - exp) <= tol;
  if (!ok) { fails++; console.error(`✗ ${label}: esperado ${exp}, obteve ${got.toFixed(2)}`); }
  else console.log(`✓ ${label} = ${got.toFixed(2)}`);
}

const cfg = defaultHonorariosConfig;
const prof = (over: Partial<ClientProfile>): ClientProfile => (over as ClientProfile);

// ── A: ENI, 0 funcionários, faturação 30 000 €, serviços por defeito ──
// base 100 + (saft 15 + iva 25 + modelo22 30) = 170. IVA 23% = 39,10.
{
  const r = calcularProposta(prof({ tipoEntidade: 'eni', nrFuncionarios: 0, faturaçaoAnualPrevista: 30000 }), cfg);
  approx('A: mensal sem IVA', r.mensalSemIVA, 170);
  approx('A: IVA (23%)', r.iva, 39.1);
  approx('A: mensal com IVA', r.mensalComIVA, 209.1);
  approx('A: anual com IVA', r.anualComIVA, 2509.2);
}

// ── B: Lda, 3 funcionários, faturação 150 000 €, serviços por defeito ──
// base 200 + 2 func×15=30 + escalão 100-250k=60 + serviços 70 = 360.
{
  const r = calcularProposta(prof({ tipoEntidade: 'lda', nrFuncionarios: 3, faturaçaoAnualPrevista: 150000 }), cfg);
  approx('B: mensal sem IVA', r.mensalSemIVA, 360);
  approx('B: mensal com IVA', r.mensalComIVA, 442.8);
}

// ── C: SA, 0 func, faturação 600 000 €, SEM serviços extra ──
// base 350 + escalão >500k=250 = 600.
{
  const r = calcularProposta(prof({ tipoEntidade: 'sa', nrFuncionarios: 0, faturaçaoAnualPrevista: 600000 }), cfg, []);
  approx('C: mensal sem IVA (base + escalão)', r.mensalSemIVA, 600);
}

if (fails) { console.error(`\n${fails} caso(s) FALHARAM`); process.exit(1); }
else console.log('\nTodos os casos golden de Honorários passaram.');
