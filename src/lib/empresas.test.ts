// Testes do registry de empresas + lógica de sync (LWW, dedupe, migração).
// localStorage não existe em Node — shim mínimo de window antes de usar.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).window = {
  localStorage: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
  },
  dispatchEvent: () => true,
};

import {
  newId,
  listEmpresas,
  saveEmpresas,
  getEmpresasStamp,
  getEmpresa,
  upsertEmpresa,
  deleteEmpresa,
  getCurrentEmpresaId,
  setCurrentEmpresaId,
  clearCurrentEmpresaId,
  getCurrentEmpresa,
  syncProfileIntoEmpresa,
  listSimulacoes,
  addSimulacao,
  upsertAutoSimulacao,
  deleteSimulacao,
  migrateLegacyProfileIfNeeded,
  dedupeByNif,
  mergeEmpresasUnion,
  stripSaftXmlForCloud,
  adoptRemoteEmpresas,
  type EmpresaRecord,
} from './empresas';
import { repairMojibake } from './mojibake';

beforeEach(() => store.clear());

function mkEmp(partial: Partial<EmpresaRecord> = {}): EmpresaRecord {
  return {
    id: newId(),
    nome: 'Empresa Teste',
    nif: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    profile: { nomeCliente: 'Empresa Teste' } as never,
    ...partial,
  };
}

// ── ids ──────────────────────────────────────────────────────────────────
describe('newId', () => {
  it('prefixo emp_ e únicos', () => {
    const ids = new Set(Array.from({ length: 100 }, newId));
    assert.equal(ids.size, 100);
    for (const id of ids) assert.ok(id.startsWith('emp_'));
  });
});

// ── registry local + relógio monotónico ──────────────────────────────────
describe('registry local (LWW)', () => {
  it('save→list round-trip', () => {
    saveEmpresas([mkEmp({ id: 'a' }), mkEmp({ id: 'b' })]);
    assert.deepEqual(listEmpresas().map(e => e.id).sort(), ['a', 'b']);
  });

  it('stamp é monotónico mesmo no mesmo milissegundo', () => {
    saveEmpresas([]);
    const s1 = getEmpresasStamp();
    assert.ok(s1 > 0);
    saveEmpresas([]);
    saveEmpresas([]);
    const s2 = getEmpresasStamp();
    assert.ok(s2 > s1, `stamp não avançou: ${s1} → ${s2}`);
  });

  it('upsert insere e atualiza', () => {
    const e = mkEmp({ id: 'x', nome: 'Velha' });
    upsertEmpresa(e);
    assert.equal(getEmpresa('x')?.nome, 'Velha');
    upsertEmpresa({ ...e, nome: 'Nova' });
    assert.equal(listEmpresas().length, 1);
    assert.equal(getEmpresa('x')?.nome, 'Nova');
  });

  it('delete remove; se era a atual, limpa a seleção', () => {
    upsertEmpresa(mkEmp({ id: 'a' }));
    upsertEmpresa(mkEmp({ id: 'b' }));
    setCurrentEmpresaId('a');
    deleteEmpresa('a');
    assert.equal(getEmpresa('a'), undefined);
    assert.equal(getCurrentEmpresaId(), null);
    assert.equal(getCurrentEmpresa(), null);
    setCurrentEmpresaId('b');
    deleteEmpresa('a'); // apagar outra não mexe na seleção
    assert.equal(getCurrentEmpresaId(), 'b');
  });

  it('current id set/get/clear', () => {
    assert.equal(getCurrentEmpresa(), null);
    upsertEmpresa(mkEmp({ id: 'c', nome: 'C' }));
    setCurrentEmpresaId('c');
    assert.equal(getCurrentEmpresa()?.nome, 'C');
    clearCurrentEmpresaId();
    assert.equal(getCurrentEmpresaId(), null);
  });

  it('syncProfileIntoEmpresa atualiza nome/nif; null se não existe', () => {
    assert.equal(syncProfileIntoEmpresa('zz', { nomeCliente: 'X' } as never), null);
    upsertEmpresa(mkEmp({ id: 'p', nome: 'Antigo', nif: '111' }));
    const r = syncProfileIntoEmpresa('p', { nomeCliente: '  Novo Nome ', nif: '123456789' } as never);
    assert.equal(r?.nome, 'Novo Nome');
    assert.equal(r?.nif, '123456789');
  });
});

// ── histórico de simulações ──────────────────────────────────────────────
describe('histórico de simulações', () => {
  it('add em empresa inexistente = null', () => {
    assert.equal(addSimulacao('zz', { tipo: 'irs', label: 'L', resumo: 'R', state: {} }), null);
  });

  it('adiciona e lista (recentes primeiro); apaga', () => {
    upsertEmpresa(mkEmp({ id: 'h' }));
    addSimulacao('h', { tipo: 'irs', label: 'IRS', resumo: 'r1', state: {} });
    addSimulacao('h', { tipo: 'tax', label: 'Fiscal', resumo: 'r2', state: {} });
    const list = listSimulacoes('h');
    assert.equal(list.length, 2);
    assert.ok(list[0].createdAt >= list[1].createdAt);
    deleteSimulacao('h', list[0].id);
    assert.equal(listSimulacoes('h').length, 1);
  });

  it('auto: UM registo por tipo (atualiza, não duplica); manual intacto', () => {
    upsertEmpresa(mkEmp({ id: 'a2' }));
    const m = addSimulacao('a2', { tipo: 'irs', label: 'IRS', resumo: 'manual', state: {} });
    const r1 = upsertAutoSimulacao('a2', { tipo: 'irs', label: 'IRS', resumo: 'auto1', state: {} });
    const r2 = upsertAutoSimulacao('a2', { tipo: 'irs', label: 'IRS', resumo: 'auto2', state: {} });
    assert.equal(r1?.id, r2?.id); // mesmo registo atualizado
    const all = listSimulacoes('a2');
    assert.equal(all.filter(s => s.tipo === 'irs' && s.auto).length, 1);
    assert.equal(all.find(s => s.id === m?.id)?.resumo, 'manual'); // manual tocado? não
  });
});

// ── migração perfil legado ───────────────────────────────────────────────
describe('migrateLegacyProfileIfNeeded', () => {
  it('perfil vazio não migra', () => {
    migrateLegacyProfileIfNeeded({} as never);
    assert.equal(listEmpresas().length, 0);
  });

  it('migra nome+nif e seleciona a empresa', () => {
    migrateLegacyProfileIfNeeded({ nomeCliente: 'Cliente Antigo', nif: '222333444' } as never);
    const list = listEmpresas();
    assert.equal(list.length, 1);
    assert.equal(list[0].nome, 'Cliente Antigo');
    assert.equal(getCurrentEmpresaId(), list[0].id);
  });

  it('não corre se já há empresas', () => {
    upsertEmpresa(mkEmp({ id: 'ex' }));
    migrateLegacyProfileIfNeeded({ nomeCliente: 'Outro', nif: '999' } as never);
    assert.equal(listEmpresas().length, 1);
  });
});

// ── dedupe / merge (anti-Hydra) ──────────────────────────────────────────
describe('dedupeByNif', () => {
  it('mesmo NIF fica o mais recente', () => {
    const out = dedupeByNif([
      mkEmp({ id: 'old', nif: '123456789', updatedAt: 100 }),
      mkEmp({ id: 'new', nif: '123 456 789', updatedAt: 200 }),
      mkEmp({ id: 'other', nif: '987654321', updatedAt: 50 }),
    ]);
    assert.deepEqual(out.map(e => e.id).sort(), ['new', 'other']);
  });

  it('sem NIF válido preserva todas (são distintas)', () => {
    const out = dedupeByNif([mkEmp({ id: 'a', nif: '' }), mkEmp({ id: 'b', nif: 'abc' })]);
    assert.equal(out.length, 2);
  });
});

describe('mergeEmpresasUnion', () => {
  it('junta por id (mais recente vence) e colapsa NIFs', () => {
    const out = mergeEmpresasUnion([
      [mkEmp({ id: 'x', nif: '111222333', nome: 'Velho', updatedAt: 10 })],
      [mkEmp({ id: 'x', nif: '111222333', nome: 'Novo', updatedAt: 20 }), mkEmp({ id: 'y', nif: '', updatedAt: 5 })],
      null as never, // lixo tolerado
    ]);
    assert.equal(out.length, 2);
    assert.equal(out.find(e => e.id === 'x')?.nome, 'Novo');
  });
});

// ── cloud: XML fora, stamp adotado ───────────────────────────────────────
describe('stripSaftXmlForCloud', () => {
  it('remove saftXml e mantém o resto', () => {
    const withXml = mkEmp({ id: 's', saftXml: '<xml>grande</xml>' });
    const [stripped] = stripSaftXmlForCloud([withXml, mkEmp({ id: 't' })]);
    assert.ok(!('saftXml' in stripped));
    assert.equal(stripped.id, 's');
    assert.equal(withXml.saftXml, '<xml>grande</xml>'); // original intacto
  });
});

describe('adoptRemoteEmpresas', () => {
  it('adota stamp remoto exato e preserva XML local', () => {
    upsertEmpresa(mkEmp({ id: 'k', saftXml: '<local/>', nif: '555666777' }));
    const before = getEmpresasStamp();
    adoptRemoteEmpresas([mkEmp({ id: 'k', nif: '555666777' })], before - 50);
    assert.equal(getEmpresasStamp(), before - 50); // não avança o relógio
    assert.equal(getEmpresa('k')?.saftXml, '<local/>'); // XML preservado
  });
});

// ── mojibake (cura nomes corrompidos da cloud) ───────────────────────────
describe('repairMojibake', () => {
  it('repara UTF-8 lido como Latin-1 e não toca em texto limpo', () => {
    const bom = 'Sociedade Atlântico, Lda — çãõ';
    const mau = Buffer.from(bom, 'utf8').toString('latin1');
    assert.notEqual(mau, bom);
    assert.equal(repairMojibake(mau), bom);
    assert.equal(repairMojibake(bom), bom);
    assert.equal(repairMojibake('Empresa simples 123'), 'Empresa simples 123');
  });
});
