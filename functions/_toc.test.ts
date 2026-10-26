import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { urlClientes, mapTocCustomer, explicarErroOauth } from './_toc';

describe('toconline — URL de clientes', () => {
  it('acrescenta /customers quando falta', () => {
    assert.equal(urlClientes('https://api32.toconline.pt', 2), 'https://api32.toconline.pt/customers?page[number]=2&page[size]=100');
  });
  it('não duplica /customers', () => {
    assert.equal(urlClientes('https://api32.toconline.pt/customers/', 1), 'https://api32.toconline.pt/customers?page[number]=1&page[size]=100');
  });
});

describe('toconline — normalização de clientes', () => {
  it('lê attributes JSON:API', () => {
    const c = mapTocCustomer({ attributes: { business_name: 'Restaurante Alfa, Lda', tax_registration_number: '501 234 567', email: 'a@b.pt', city: 'Fátima' } });
    assert.equal(c.nome, 'Restaurante Alfa, Lda');
    assert.equal(c.nif, '501234567');
    assert.equal(c.email, 'a@b.pt');
    assert.equal(c.localidade, 'Fátima');
  });
  it('aceita campos alternativos', () => {
    const c = mapTocCustomer({ name: 'Beta', fiscal_id: '502345678', phone_number: '249 000 000', postcode: '2495-000' });
    assert.equal(c.nome, 'Beta');
    assert.equal(c.nif, '502345678');
    assert.equal(c.telefone, '249 000 000');
    assert.equal(c.codigoPostal, '2495-000');
  });
  it('sem NIF devolve string vazia (não inventa)', () => {
    assert.equal(mapTocCustomer({ attributes: { business_name: 'X' } }).nif, '');
  });
});

describe('toconline — erros de OAuth explicados', () => {
  it('unauthorized_client → redirect não registado', () => {
    assert.equal(explicarErroOauth(401, { error: 'unauthorized_client' }), 'redirect_uri_nao_registado');
  });
  it('invalid_grant → código expirado', () => {
    assert.equal(explicarErroOauth(400, { error: 'invalid_grant' }), 'codigo_expirado');
  });
  it('outros mantêm o código', () => {
    assert.equal(explicarErroOauth(500, { error: 'server_error' }), 'server_error');
    assert.equal(explicarErroOauth(500, {}), 'erro_500');
  });
});
