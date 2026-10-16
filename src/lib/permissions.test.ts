import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { can, deriveRole } from './permissions';

describe('permissions — matriz por cargo', () => {
  it('admin pode tudo', () => {
    for (const a of ['editar-operacional','editar-clientes','gerir-obrigacoes','ver-cofre','editar-cofre','apagar','restaurar','purgar','gerir-equipa','gerir-gabinete'] as const) {
      assert.equal(can('admin', a), true, a);
    }
  });

  it('contabilista apaga e restaura, mas não purga nem gere equipa', () => {
    assert.equal(can('contabilista', 'apagar'), true);
    assert.equal(can('contabilista', 'restaurar'), true);
    assert.equal(can('contabilista', 'editar-clientes'), true);
    assert.equal(can('contabilista', 'gerir-obrigacoes'), true);
    assert.equal(can('contabilista', 'purgar'), false);
    assert.equal(can('contabilista', 'gerir-equipa'), false);
    assert.equal(can('contabilista', 'gerir-gabinete'), false);
  });

  it('estagiária só edita operacional — sem apagar, sem cofre, sem ficha/obrigações', () => {
    assert.equal(can('estagiaria', 'editar-operacional'), true);
    assert.equal(can('estagiaria', 'apagar'), false);
    assert.equal(can('estagiaria', 'ver-cofre'), false);
    assert.equal(can('estagiaria', 'editar-clientes'), false);
    assert.equal(can('estagiaria', 'gerir-obrigacoes'), false);
  });

  it('sem cargo não há permissões', () => {
    assert.equal(can(null, 'editar-operacional'), false);
    assert.equal(can(undefined, 'ver-cofre'), false);
  });
});

describe('permissions — deriveRole', () => {
  it('dono é admin', () => {
    assert.equal(deriveRole({ ownerUid: 'u1', memberUids: ['u1'], members: {} }, 'u1'), 'admin');
  });
  it('usa o role do mapa members', () => {
    assert.equal(deriveRole({ ownerUid: 'u1', memberUids: ['u1','u2'], members: { u2: { role: 'estagiaria' } } }, 'u2'), 'estagiaria');
  });
  it('membro legado sem role conta como contabilista', () => {
    assert.equal(deriveRole({ ownerUid: 'u1', memberUids: ['u1','u3'], members: {} }, 'u3'), 'contabilista');
  });
  it('quem não é membro não tem role', () => {
    assert.equal(deriveRole({ ownerUid: 'u1', memberUids: ['u1'], members: {} }, 'zzz'), null);
  });
});
