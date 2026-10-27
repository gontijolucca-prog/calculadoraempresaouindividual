import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { can, deriveRole, tabsGabinete, setCustomRolesCache } from './permissions';

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

/**
 * Matriz completa, célula a célula. Se alguém alargar um cargo por engano, este
 * teste falha e obriga a olhar para as firestore.rules antes de mexer.
 */
describe('permissions — matriz completa (espelho das firestore.rules)', () => {
  const acoes = [
    'editar-operacional', 'editar-clientes', 'gerir-obrigacoes',
    'ver-cofre', 'editar-cofre', 'apagar', 'restaurar', 'purgar',
    'gerir-equipa', 'gerir-gabinete',
  ] as const;

  const esperado: Record<string, Record<string, boolean>> = {
    admin: Object.fromEntries(acoes.map(a => [a, true])),
    contabilista: {
      'editar-operacional': true, 'editar-clientes': true, 'gerir-obrigacoes': true,
      'ver-cofre': true, 'editar-cofre': true, 'apagar': true, 'restaurar': true,
      'purgar': false, 'gerir-equipa': false, 'gerir-gabinete': false,
    },
    estagiaria: {
      'editar-operacional': true, 'editar-clientes': false, 'gerir-obrigacoes': false,
      'ver-cofre': false, 'editar-cofre': false, 'apagar': false, 'restaurar': false,
      'purgar': false, 'gerir-equipa': false, 'gerir-gabinete': false,
    },
  };

  for (const [cargo, linha] of Object.entries(esperado)) {
    it(`${cargo}: ${Object.entries(linha).filter(([, v]) => v).map(([k]) => k).join(', ') || 'nada'}`, () => {
      for (const acao of acoes) {
        assert.equal(
          can(cargo as 'admin' | 'contabilista' | 'estagiaria', acao),
          linha[acao],
          `${cargo} × ${acao}`,
        );
      }
    });
  }
});

describe('permissions — cargo desconhecido não abre nada', () => {
  it('role fora da lista é negado', () => {
    assert.equal(can('estagiario' as never, 'editar-operacional'), false);
    assert.equal(can('' as never, 'editar-operacional'), false);
  });
  it('deriveRole ignora role inválido e cai no membro legado', () => {
    assert.equal(
      deriveRole({ ownerUid: 'u1', memberUids: ['u1', 'u2'], members: { u2: { role: 'chefe' as never } } }, 'u2'),
      'contabilista',
    );
  });
});

describe('permissions — tabs do gabinete', () => {
  it('admin vê tudo', () => {
    const t = tabsGabinete('admin')!;
    assert.deepEqual(t, ['visao-geral', 'dashboard', 'mapa-controlo', 'mapa-rh', 'tarefas', 'agenda', 'obrigacoes', 'cofre', 'equipa', 'lixeira']);
  });
  it('contabilista vê cofre e lixeira, não vê equipa', () => {
    const t = tabsGabinete('contabilista')!;
    assert.ok(t.includes('cofre') && t.includes('lixeira'));
    assert.ok(!t.includes('equipa'));
  });
  it('estagiária só vê o operacional', () => {
    const t = tabsGabinete('estagiaria')!;
    assert.ok(t.includes('tarefas'));
    for (const escondida of ['cofre', 'equipa', 'lixeira']) assert.ok(!t.includes(escondida));
  });
  it('sem cargo não esconde nada', () => {
    assert.equal(tabsGabinete(null), null);
    assert.equal(tabsGabinete(undefined), null);
  });
});

describe('permissions — cargos personalizados', () => {
  it('permissões do cargo personalizado valem e as outras não', () => {
    setCustomRolesCache({ 'custom:gestor': { nome: 'Gestor', permissoes: ['ver-cofre', 'editar-clientes'] } });
    const role = 'custom:gestor' as const;
    assert.equal(can(role, 'ver-cofre'), true);
    assert.equal(can(role, 'editar-clientes'), true);
    assert.equal(can(role, 'purgar'), false);
    assert.equal(can(role, 'gerir-equipa'), false);
    setCustomRolesCache({});
  });
  it('cargo personalizado inexistente não concede nada', () => {
    setCustomRolesCache({});
    assert.equal(can('custom:nao-existe' as const, 'ver-cofre'), false);
  });
  it('deriveRole reconhece o cargo personalizado do membro', () => {
    const meta = { ownerUid: 'u1', memberUids: ['u2'], members: { u2: { role: 'custom:gestor' as const } }, customRoles: { 'custom:gestor': { nome: 'Gestor', permissoes: [] } } };
    assert.equal(deriveRole(meta as never, 'u2'), 'custom:gestor');
  });
});
