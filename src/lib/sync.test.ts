import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { upsertOp, dropOp, bumpTries, type OutboxOp } from './sync';

function op(partial: Partial<OutboxOp>): OutboxOp {
  return { id: 'x', at: 0, tries: 0, kind: 'set', path: 'p', docId: 'd', ...partial };
}

describe('sync outbox — operações puras', () => {
  it('substitui operação anterior para o mesmo doc (sem duplicar)', () => {
    const a = op({ id: '1', docId: 'd1', data: { v: 1 } });
    const b = op({ id: '2', docId: 'd1', data: { v: 2 } });
    const out = upsertOp(upsertOp([], a), b);
    assert.equal(out.length, 1);
    assert.deepEqual(out[0].data, { v: 2 });
  });
  it('set e delete do mesmo doc não colidem entre si', () => {
    const s = op({ id: '1', docId: 'd1', kind: 'set' });
    const d = op({ id: '2', docId: 'd1', kind: 'delete' });
    assert.equal(upsertOp(upsertOp([], s), d).length, 2);
  });
  it('dropOp remove pelo id', () => {
    const out = dropOp([op({ id: '1' }), op({ id: '2' })], '1');
    assert.deepEqual(out.map(x => x.id), ['2']);
  });
  it('bumpTries incrementa só o alvo', () => {
    const list = [op({ id: '1', tries: 1 }), op({ id: '2', tries: 5 })];
    const out = bumpTries(list, '1');
    assert.equal(out[0].tries, 2);
    assert.equal(out[1].tries, 5);
  });
});
