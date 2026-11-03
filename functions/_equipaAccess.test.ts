import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  emailValido,
  passwordValida,
  parseCustomClaims,
  podeGerirAcessos,
  podeAtribuirCargo,
  roleValida,
  origemPermitida,
  corsHeaders,
  type GabineteMetaLite,
} from './_equipaAccess';

const meta: GabineteMetaLite = {
  id: 'gab_1',
  ownerUid: 'owner',
  memberUids: ['owner', 'admin', 'financeiro', 'estagiaria'],
  members: {
    owner: { role: 'admin', email: 'owner@empresa.pt' },
    admin: { role: 'admin', email: 'admin@empresa.pt' },
    financeiro: { role: 'custom:financeiro', email: 'fin@empresa.pt' },
    estagiaria: { role: 'estagiaria', email: 'estagio@empresa.pt' },
  },
  customRoles: {
    financeiro: { nome: 'Financeiro', permissoes: ['gerir-acessos'] },
  },
};

describe('credenciais da equipa — validação', () => {
  it('aceita emails reais e rejeita formatos incompletos', () => {
    assert.equal(emailValido('ana@empresa.pt'), true);
    assert.equal(emailValido('ana+equipa@sub.empresa.pt'), true);
    assert.equal(emailValido('sem-arroba'), false);
    assert.equal(emailValido('ana@empresa'), false);
    assert.equal(emailValido(`${'a'.repeat(250)}@x.pt`), false);
  });

  it('exige letra e número e limita espaços nas pontas', () => {
    assert.equal(passwordValida('Teste12345!'), true);
    assert.equal(passwordValida('12345678'), false);
    assert.equal(passwordValida('abcdefgh'), false);
    assert.equal(passwordValida(' Teste123'), false);
    assert.equal(passwordValida('Teste123 '), false);
    assert.equal(passwordValida('A1b2c3d4'), true);
  });

  it('interpreta custom claims sem confiar em JSON inválido', () => {
    assert.deepEqual(parseCustomClaims('{"employeeOnly":true}'), { employeeOnly: true });
    assert.deepEqual(parseCustomClaims('{invalido'), {});
    assert.deepEqual(parseCustomClaims('[]'), {});
  });
});

describe('credenciais da equipa — autorização', () => {
  it('dono e admin gerem acessos por defeito', () => {
    assert.equal(podeGerirAcessos(meta, 'owner'), true);
    assert.equal(podeGerirAcessos(meta, 'admin'), true);
  });

  it('cargo personalizado só gere acessos se tiver a permissão', () => {
    assert.equal(podeGerirAcessos(meta, 'financeiro'), true);
    assert.equal(podeGerirAcessos(meta, 'estagiaria'), false);
  });

  it('gestor personalizado não consegue criar ou assumir cargos superiores', () => {
    const authFinanceiro = { uid: 'financeiro', email: 'fin@empresa.pt', claims: {} };
    const authAdmin = { uid: 'admin', email: 'admin@empresa.pt', claims: {} };
    assert.equal(podeAtribuirCargo(meta, authFinanceiro, 'admin'), false);
    assert.equal(podeAtribuirCargo(meta, authFinanceiro, 'contabilista'), false);
    assert.equal(podeAtribuirCargo(meta, authFinanceiro, 'custom:financeiro'), true);
    assert.equal(podeAtribuirCargo(meta, authAdmin, 'admin'), true);
  });

  it('valida cargos base e personalizados existentes', () => {
    assert.equal(roleValida(meta, 'contabilista'), true);
    assert.equal(roleValida(meta, 'custom:financeiro'), true);
    assert.equal(roleValida(meta, 'custom:inexistente'), false);
    assert.equal(roleValida(meta, 'root'), false);
  });

  it('só aceita origens oficiais', () => {
    assert.equal(origemPermitida('https://estudo360.pt', null), true);
    assert.equal(origemPermitida(null, 'https://www.estudo360.pt/equipa'), true);
    assert.equal(origemPermitida('http://estudo360.pt', null), false);
    assert.equal(origemPermitida('https://estudo360.pt.evil.example', null), false);
    assert.equal(origemPermitida('http://localhost:3000', null), true);
    assert.equal(corsHeaders('https://estudo360.pt')['Access-Control-Allow-Origin'], 'https://estudo360.pt');
  });
});
