import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterActive, mergePrazos, tarefaFromAssunto } from './gabineteSelectors';

describe('gabineteSelectors — soft delete', () => {
  it('remove apagados da lista ativa', () => {
    const list = [{ id: 'a' }, { id: 'b', deletedAt: 123 }, { id: 'c' }];
    assert.deepEqual(filterActive(list).map(x => x.id), ['a', 'c']);
  });
});

describe('gabineteSelectors — prazos', () => {
  const now = new Date('2026-10-16T10:00:00Z').getTime();
  const obrs = [
    { id: 'o1', titulo: 'IVA Set', clienteId: 'c1', vencimento: now + 3 * 86400000, estado: 'pendente' },
    { id: 'o2', titulo: 'IES', clienteId: 'c1', vencimento: now - 2 * 86400000, estado: 'atrasada' },
    { id: 'o3', titulo: 'CF referência', clienteId: '__cal', vencimento: now + 86400000, estado: 'pendente', origem: 'calendario_fiscal' },
    { id: 'o4', titulo: 'Entregue cedo', clienteId: 'c1', vencimento: now - 86400000, estado: 'entregue' },
  ];
  const alerts = [
    { id: 'a1', texto: 'Responder SS', clienteId: 'c1', vencimento: now + 2 * 86400000, estado: 'aberto' },
    { id: 'a2', texto: 'Resolvido', clienteId: 'c1', vencimento: now + 86400000, estado: 'resolvido' },
    { id: 'a3', texto: 'Sem data', clienteId: 'c1' },
    { id: 'a4', texto: 'Atrasado sem estado', clienteId: 'c1', vencimento: now - 5 * 86400000 },
  ];

  it('junta obrigações de cliente + alertas abertos, exclui fiscal/resolvidos/sem data', () => {
    const items = mergePrazos(obrs, alerts, { now, limit: 10 });
    assert.deepEqual(items.map(i => i.id), ['a4', 'o2', 'o4', 'a1', 'o1']);
    assert.equal(items[0].kind, 'alerta');
    assert.equal(items[0].atrasado, true);
  });

  it('entregue não conta como atrasado', () => {
    const items = mergePrazos(obrs, [], { now, limit: 10 });
    const o4 = items.find(i => i.id === 'o4');
    assert.equal(o4?.atrasado, false);
  });

  it('respeita o limite', () => {
    assert.equal(mergePrazos(obrs, alerts, { now, limit: 2 }).length, 2);
  });
});

describe('gabineteSelectors — migração assunto→tarefa', () => {
  it('mapeia estados e mantém datas', () => {
    const t = tarefaFromAssunto({
      id: 'as1', clienteId: 'c1', clienteNome: 'Cliente', titulo: 'Compensação SS',
      estado: 'aguard_cliente', createdAt: 1, updatedAt: 2,
    }, 'tar_x');
    assert.equal(t.id, 'tar_x');
    assert.equal(t.estado, 'todo');
    assert.equal(t.clienteId, 'c1');
    assert.equal(t.createdAt, 1);
    assert.equal(t.updatedAt, 2);
    assert.equal(t.origem, 'manual');
  });
  it('concluído vira done e em_curso vira doing', () => {
    const base = { id: 'as', clienteId: 'c', titulo: 'T', createdAt: 0, updatedAt: 0 } as const;
    assert.equal(tarefaFromAssunto({ ...base, estado: 'concluido' }, 't1').estado, 'done');
    assert.equal(tarefaFromAssunto({ ...base, estado: 'em_curso' }, 't2').estado, 'doing');
    assert.equal(tarefaFromAssunto({ ...base, estado: 'pendente' }, 't3').estado, 'todo');
  });
});
