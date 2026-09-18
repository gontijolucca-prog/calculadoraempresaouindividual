// Goldens de Tickets — isento vs excedente (OE 2026, Despacho 233-A/2026).
// Prova que acima do limite só o excedente é tributável, não o total.
// Correr: npx tsx src/lib/ticket.test.ts

import { calcTicketIsencao, calcTicketAnual } from './ticket';
import { TICKET_LIMITS_2026 } from './pt2026';

let fails = 0;
function approx(label: string, got: number, exp: number, tol = 0.005) {
  const ok = Math.abs(got - exp) <= tol;
  if (!ok) { fails++; console.error(`✗ ${label}: esperado ${exp.toFixed(2)}, obteve ${got.toFixed(2)}`); }
  else console.log(`✓ ${label} = ${got.toFixed(2)}`);
}
function is(label: string, got: unknown, exp: unknown) {
  const ok = got === exp;
  if (!ok) { fails++; console.error(`✗ ${label}: esperado ${exp}, obteve ${got}`); }
  else console.log(`✓ ${label} = ${got}`);
}

const L = TICKET_LIMITS_2026.cartao; // 10.46
const Ldin = TICKET_LIMITS_2026.dinheiro; // 6.15

// (a) valor == limite → 100% isento, 0 tributável
{
  const { isentoDiario, tributavelDiario } = calcTicketIsencao(L, L);
  approx('(a) isento == limite (10.46)', isentoDiario, 10.46);
  approx('(a) tributável == 0', tributavelDiario, 0);
  const an = calcTicketAnual(1, L, L, 22, 12);
  approx('(a) custoIsento anual 1×10.46×22×12', an.custoIsento, 10.46 * 22 * 12);
  approx('(a) custoExcedente 0', an.custoExcedente, 0);
}

// (b) valor == limite + 0.01 → só 0.01 tributável (não tudo)
{
  const { isentoDiario, tributavelDiario } = calcTicketIsencao(L + 0.01, L);
  approx('(b) isento = limite (10.46)', isentoDiario, 10.46);
  approx('(b) tributável = 0.01', tributavelDiario, 0.01);
  const an = calcTicketAnual(1, L + 0.01, L, 22, 12);
  approx('(b) isento anual 10.46×22×12', an.custoIsento, 10.46 * 22 * 12);
  approx('(b) excedente anual 0.01×22×12=2.64', an.custoExcedente, 0.01 * 22 * 12);
  // Prova contra o bug antigo: tributável NÃO é 10.47×264
  is('(b) bug check: excedente ≠ custoAnual', an.custoExcedente !== an.custoAnual, true);
}

// (c) valor >> limite (15€) → 10.46 isento + 4.54 tributável
{
  const { isentoDiario, tributavelDiario } = calcTicketIsencao(15, L);
  approx('(c) isento 10.46', isentoDiario, 10.46);
  approx('(c) tributável 4.54', tributavelDiario, 4.54);
  const an = calcTicketAnual(2, 15, L, 22, 12);
  approx('(c) custoAnual 2×15×264', an.custoAnual, 2 * 15 * 22 * 12);
  approx('(c) custoIsento 2×10.46×264', an.custoIsento, 2 * 10.46 * 22 * 12);
  approx('(c) custoExcedente 2×4.54×264', an.custoExcedente, 2 * 4.54 * 22 * 12);
  // Prova manual do Verification: 10.47 → isento 10.46, tributável 0.01/dia → anual 2.64
  const an2 = calcTicketAnual(1, 10.47, L, 22, 12);
  approx('(c) Verification: 10.47 isento anual 2761.44', an2.custoIsento, 10.46 * 22 * 12);
  approx('(c) Verification: 10.47 excedente anual 2.64', an2.custoExcedente, 0.01 * 22 * 12);
}

// (d) valor < limite → tudo isento
{
  const { isentoDiario, tributavelDiario } = calcTicketIsencao(5, L);
  approx('(d) isento 5 (< limite)', isentoDiario, 5);
  approx('(d) tributável 0', tributavelDiario, 0);
  const an = calcTicketAnual(1, 5, L, 22, 12);
  approx('(d) custoIsento == custoAnual', an.custoIsento, an.custoAnual);
  is('(d) custoExcedente 0', an.custoExcedente, 0);
}

// (e) dinheiro limite 6.15 — excedente mínimo
{
  const { isentoDiario, tributavelDiario } = calcTicketIsencao(6.16, Ldin);
  approx('(e) dinheiro isento 6.15', isentoDiario, 6.15);
  approx('(e) dinheiro tributável 0.01', tributavelDiario, 0.01);
}

if (fails) { console.error(`\n${fails} caso(s) FALHARAM`); process.exit(1); }
else console.log('\nTodos os casos golden de Tickets passaram.');
