import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resultSimulacao } from './simResults';

// ── resultSimulacao: tipo inválido ────────────────────────────────────
describe('resultSimulacao — tipo inválido', () => {
  it('returns [] for unknown tipo', () => assert.deepEqual(resultSimulacao('xyz', {}), []));
  it('returns [] for null state', () => assert.deepEqual(resultSimulacao('tax', null), []));
});

// ── resultSimulacao: salário ──────────────────────────────────────────
describe('resultSimulacao — salário', () => {
  const base = { salarioBruto: 2000, estadoCivil: 'solteiro', nrDependentes: 0, localizacao: 'continente' };
  it('returns [] when salarioBruto <= 0', () => assert.deepEqual(resultSimulacao('salario', { ...base, salarioBruto: 0 }), []));
  it('returns 2 items for valid salary', () => {
    const r = resultSimulacao('salario', base);
    assert.equal(r.length, 2);
    assert.ok(r[0].valor.includes('€'), 'Líquido should contain €');
  });
  it('includes custo empregador', () => {
    const r = resultSimulacao('salario', base);
    assert.ok(r[1].label.includes('Custo'), 'Second item should be custo empregador');
  });
});

// ── resultSimulacao: selfss ───────────────────────────────────────────
describe('resultSimulacao — selfss', () => {
  it('returns isento for primeiroAno', () => {
    const r = resultSimulacao('selfss', { income: 30000, tipoRendimento: 'servicos', primeiroAno: true });
    assert.ok(r.some(x => x.valor.includes('Isento')));
  });
  it('returns mensal for non-primeiroAno', () => {
    const r = resultSimulacao('selfss', { income: 30000, tipoRendimento: 'servicos', primeiroAno: false });
    assert.ok(r.some(x => x.valor.includes('€')));
  });
});

// ── resultSimulacao: ticket ───────────────────────────────────────────
describe('resultSimulacao — ticket', () => {
  it('returns 2 items', () => {
    const r = resultSimulacao('ticket', { employees: 5, ticketValue: 7.63, daysPerMonth: 22, months: 12 });
    assert.equal(r.length, 2);
    assert.ok(r[0].valor.includes('€'));
  });
});

// ── resultSimulacao: previsa ──────────────────────────────────────────
describe('resultSimulacao — previsa', () => {
  it('returns [] when no data', () => assert.deepEqual(resultSimulacao('previsa', {}), []));
  it('returns items when RAI provided', () => {
    const r = resultSimulacao('previsa', { c701_rai: 50000 });
    assert.ok(r.length >= 1);
    assert.ok(r[0].valor.includes('€'));
  });
});
