import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SIM_LABELS, summarizeSimulacao, simHasData } from './simSummary';

describe('SIM_LABELS', () => {
  it('has labels for all known sim types', () => {
    assert.ok(SIM_LABELS.tax, 'tax should have label');
    assert.ok(SIM_LABELS.irs, 'irs should have label');
    assert.ok(SIM_LABELS.salario, 'salario should have label');
    assert.ok(SIM_LABELS.selfss, 'selfss should have label');
  });
});

describe('summarizeSimulacao', () => {
  it('returns string for unknown type', () => assert.equal(typeof summarizeSimulacao('xyz', {}), 'string'));
  it('returns string for null state', () => assert.equal(typeof summarizeSimulacao('tax', null), 'string'));
  it('returns non-empty for valid salário', () => {
    const r = summarizeSimulacao('salario', { salarioBruto: 2000, estadoCivil: 'solteiro', nrDependentes: 0, localizacao: 'continente' });
    assert.ok(r.length > 0, 'Should return non-empty summary');
  });
});

describe('simHasData', () => {
  it('returns false for empty state', () => assert.equal(simHasData('tax', {}), false));
  it('returns true when salary present', () => assert.equal(simHasData('salario', { salarioBruto: 2000 }), true));
  it('returns false when salary is 0', () => assert.equal(simHasData('salario', { salarioBruto: 0 }), false));
});
