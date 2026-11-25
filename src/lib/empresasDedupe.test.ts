// Testes da deteção/fusão de empresas duplicadas (lógica pura, sem Firebase).
// Correr: node --import tsx src/lib/empresasDedupe.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gruposDuplicadas, juntarEmpresas, resumoFusao } from './empresasDedupe';
import type { EmpresaRecord } from './empresas';

const emp = (over: Partial<EmpresaRecord> & { id: string; nif: string }): EmpresaRecord => ({
  nome: `Empresa ${over.id}`,
  createdAt: 1000,
  updatedAt: 1000,
  profile: {} as EmpresaRecord['profile'],
  ...over,
});

describe('gruposDuplicadas', () => {
  it('agrupa só NIF válido repetido', () => {
    const grupos = gruposDuplicadas([
      emp({ id: 'a', nif: '500123456' }),
      emp({ id: 'b', nif: '500123456' }),
      emp({ id: 'c', nif: '500999999' }),
      emp({ id: 'd', nif: '' }),
      emp({ id: 'e', nif: '' }),
      emp({ id: 'f', nif: '123' }),
      emp({ id: 'g', nif: '500123456' }),
    ]);
    assert.equal(grupos.length, 1);
    assert.equal(grupos[0].nif, '500123456');
    assert.deepEqual(grupos[0].empresas.map((e) => e.id), ['a', 'b', 'g']);
  });

  it('aceita NIF com espaços e não junta NIF inválido', () => {
    const grupos = gruposDuplicadas([
      emp({ id: 'a', nif: '500 123 456' }),
      emp({ id: 'b', nif: '500123456' }),
      emp({ id: 'c', nif: '12345678' }),
      emp({ id: 'd', nif: '12345678' }),
    ]);
    assert.equal(grupos.length, 1);
    assert.deepEqual(grupos[0].empresas.map((e) => e.id), ['a', 'b']);
  });
});

describe('juntarEmpresas', () => {
  it('preenche campos vazios do perfil e mantém os do que fica', () => {
    const manter = emp({ id: 'a', nif: '500123456', profile: { nome: 'Certo', cae: '', email: '' } as never });
    const outro = emp({ id: 'b', nif: '500123456', profile: { nome: 'Errado', cae: '62010', email: 'x@y.pt' } as never });
    const m = juntarEmpresas(manter, [outro]);
    const p = m.profile as unknown as Record<string, unknown>;
    assert.equal(p.nome, 'Certo');
    assert.equal(p.cae, '62010');
    assert.equal(p.email, 'x@y.pt');
  });

  it('une simulações sem duplicar ids e fica com a mais recente', () => {
    const s = (id: string, createdAt: number, resumo: string) =>
      ({ id, tipo: 'irs', label: 'IRS', createdAt, resumo, state: {} });
    const manter = emp({ id: 'a', nif: '500123456', simulacoes: [s('1', 10, 'velha'), s('2', 20, 'só no manter')] });
    const outro = emp({ id: 'b', nif: '500123456', simulacoes: [s('1', 30, 'nova'), s('3', 5, 'só no outro')] });
    const m = juntarEmpresas(manter, [outro]);
    assert.equal(m.simulacoes?.length, 3);
    assert.equal(m.simulacoes?.find((x) => x.id === '1')?.resumo, 'nova');
    assert.deepEqual(m.simulacoes?.map((x) => x.id), ['1', '2', '3']);
  });

  it('preserva o SAF-T mais completo e a data de importação', () => {
    const manter = emp({ id: 'a', nif: '500123456' });
    const outro = emp({ id: 'b', nif: '500123456', saftXml: '<AuditFile>grande</AuditFile>', saftFileName: 'a.xml', saftImportedAt: 50 });
    const terceiro = emp({ id: 'c', nif: '500123456', saftXml: '<A/>', saftFileName: 'b.xml', saftImportedAt: 90 });
    const m = juntarEmpresas(manter, [outro, terceiro]);
    assert.equal(m.saftXml, '<AuditFile>grande</AuditFile>');
    assert.equal(m.saftFileName, 'a.xml');
    assert.equal(m.saftImportedAt, 90);
  });

  it('preenche estado de simuladores em falta sem sobrepor', () => {
    const manter = emp({ id: 'a', nif: '500123456', sims: { irs: { x: 1 } } });
    const outro = emp({ id: 'b', nif: '500123456', sims: { irs: { x: 9 }, salario: { y: 2 } } });
    const m = juntarEmpresas(manter, [outro]);
    assert.deepEqual(m.sims, { irs: { x: 1 }, salario: { y: 2 } });
  });

  it('guarda a data de criação mais antiga', () => {
    const manter = emp({ id: 'a', nif: '500123456', createdAt: 500 });
    const outro = emp({ id: 'b', nif: '500123456', createdAt: 200 });
    assert.equal(juntarEmpresas(manter, [outro]).createdAt, 200);
  });

  it('sem SAF-T em nenhum, não inventa campos', () => {
    const m = juntarEmpresas(emp({ id: 'a', nif: '500123456' }), [emp({ id: 'b', nif: '500123456' })]);
    assert.equal(m.saftXml, undefined);
    assert.equal(m.saftFileName, undefined);
  });
});

describe('resumoFusao', () => {
  it('conta simulações ganhas e avisa quando o SAF-T só existe nos outros', () => {
    const grupo = {
      nif: '500123456',
      empresas: [
        emp({ id: 'a', nif: '500123456', simulacoes: [{ id: '1', tipo: 'irs', label: 'IRS', createdAt: 1, resumo: '', state: {} }] }),
        emp({ id: 'b', nif: '500123456', saftXml: '<A/>', simulacoes: [{ id: '2', tipo: 'irs', label: 'IRS', createdAt: 2, resumo: '', state: {} }] }),
      ],
    };
    const r = resumoFusao(grupo, 'a');
    assert.equal(r.apagadas, 1);
    assert.equal(r.simulacoes, 2);
    assert.equal(r.simulacoesGanhas, 1);
    assert.equal(r.temSaft, true);
    assert.equal(r.saftSoNosOutros, true);
  });
});
