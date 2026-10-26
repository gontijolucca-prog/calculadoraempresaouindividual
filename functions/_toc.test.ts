import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { urlClientes, mapTocCustomer, explicarErroOauth } from './_toc';

describe('toconline — URL de clientes', () => {
  it('acrescenta /customers quando falta', () => {
    assert.equal(urlClientes('https://api32.toconline.pt', 2), 'https://api32.toconline.pt/customers?page[number]=2&page[size]=100&include=main_address,main_email_address');
  });
  it('não duplica /customers', () => {
    assert.equal(urlClientes('https://api32.toconline.pt/customers/', 1), 'https://api32.toconline.pt/customers?page[number]=1&page[size]=100&include=main_address,main_email_address');
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

describe('toconline — dados completos (included)', () => {
  const incluidos = {
    addresses: new Map([['67', { attributes: { address_detail: 'Rua 1, nº 2', city: 'Fátima', postcode: '2495-000', region: 'Santarém' } }]]),
    emails: new Map([['24', { attributes: { email: 'geral@empresa.pt', is_primary: true } }]]),
  };

  it('junta morada e email principais', () => {
    const c = mapTocCustomer({
      id: '61',
      attributes: { business_name: 'Empresa X', tax_registration_number: '501234567', mobile_number: '912345678', phone_number: '249111222', website: 'https://x.pt', contact_name: 'Ana', observations: 'nota', not_final_customer: true, is_tax_exempt: true, active: true },
      relationships: { main_address: { data: { id: '67' } }, main_email_address: { data: { id: '24' } } },
    }, incluidos);
    assert.equal(c.tocId, '61');
    assert.equal(c.morada, 'Rua 1, nº 2');
    assert.equal(c.localidade, 'Fátima');
    assert.equal(c.codigoPostal, '2495-000');
    assert.equal(c.regiao, 'Santarém');
    assert.equal(c.email, 'geral@empresa.pt');
    assert.equal(c.telefone, '912345678');
    assert.equal(c.telefone2, '249111222');
    assert.equal(c.contacto, 'Ana');
    assert.equal(c.website, 'https://x.pt');
    assert.equal(c.isencaoIva, true);
    assert.equal(c.naoClienteFinal, true);
    assert.equal(c.ativo, true);
  });

  it('sem incluídos usa só os atributos e não inventa', () => {
    const c = mapTocCustomer({ attributes: { business_name: 'Y', tax_registration_number: '501234567' } });
    assert.equal(c.morada, undefined);
    assert.equal(c.email, undefined);
    assert.equal(c.telefone, undefined);
    assert.equal(c.isencaoIva, false);
  });

  it('URL da página inclui os recursos relacionados', () => {
    const u = urlClientes('https://api32.toconline.pt', 3);
    assert.ok(u.includes('include=main_address,main_email_address'));
    assert.ok(u.includes('page[number]=3'));
  });
});
