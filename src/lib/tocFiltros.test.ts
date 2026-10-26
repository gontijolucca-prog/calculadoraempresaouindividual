import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classificarNif, primeiroDigito, filtrarClientes, localidadesDe, nifsDuplicados } from './tocFiltros';

const lista = [
  { nome: 'Restaurante Alfa, Lda', nif: '501234567', localidade: 'Fátima' },
  { nome: 'João Silva', nif: '123456789', localidade: 'Fátima' },
  { nome: 'Condomínio Rua X', nif: '980000001', localidade: 'Ourém' },
  { nome: 'Câmara Municipal', nif: '600000001', localidade: 'Ourém' },
  { nome: 'Sem número', nif: '', localidade: '' },
  { nome: 'Empresa Beta, SA', nif: '502345678', localidade: 'Leiria' },
];

describe('toconline — classificação por NIF', () => {
  it('5 é empresa, 1/2/3 é particular, 6/7/9 é outro', () => {
    assert.equal(classificarNif('501234567'), 'empresa');
    assert.equal(classificarNif('123456789'), 'particular');
    assert.equal(classificarNif('299999999'), 'particular');
    assert.equal(classificarNif('300000000'), 'particular');
    assert.equal(classificarNif('600000001'), 'outro');
    assert.equal(classificarNif('700000001'), 'outro');
    assert.equal(classificarNif('980000001'), 'outro');
  });
  it('sem NIF e com letras', () => {
    assert.equal(classificarNif(''), 'sem-nif');
    assert.equal(classificarNif(undefined), 'sem-nif');
    assert.equal(classificarNif('NIF 501 234 567'), 'empresa');
  });
  it('primeiro dígito', () => {
    assert.equal(primeiroDigito('501234567'), '5');
    assert.equal(primeiroDigito(''), '');
  });
});

describe('toconline — filtros', () => {
  it('filtra por tipo empresa', () => {
    assert.deepEqual(filtrarClientes(lista, { tipos: ['empresa'] }).map((c) => c.nome), ['Restaurante Alfa, Lda', 'Empresa Beta, SA']);
  });
  it('filtra por particulares', () => {
    assert.deepEqual(filtrarClientes(lista, { tipos: ['particular'] }).map((c) => c.nome), ['João Silva']);
  });
  it('filtra por primeiro dígito 9', () => {
    assert.deepEqual(filtrarClientes(lista, { digitos: ['9'] }).map((c) => c.nome), ['Condomínio Rua X']);
  });
  it('pesquisa por nome sem acentos', () => {
    assert.deepEqual(filtrarClientes(lista, { q: 'joao' }).map((c) => c.nome), ['João Silva']);
  });
  it('pesquisa por NIF e localidade', () => {
    assert.deepEqual(filtrarClientes(lista, { q: '5023' }).map((c) => c.nome), ['Empresa Beta, SA']);
    assert.deepEqual(filtrarClientes(lista, { q: 'ourem' }).map((c) => c.nome), ['Condomínio Rua X', 'Câmara Municipal']);
  });
  it('combina filtros (tipo + localidade)', () => {
    assert.deepEqual(filtrarClientes(lista, { tipos: ['empresa', 'particular'], localidade: 'Fátima' }).map((c) => c.nome), ['Restaurante Alfa, Lda', 'João Silva']);
  });
  it('só novos ignora NIF já existente', () => {
    const existentes = new Set(['501234567']);
    assert.deepEqual(filtrarClientes(lista, { soNovos: true }, existentes).map((c) => c.nome), ['João Silva', 'Condomínio Rua X', 'Câmara Municipal', 'Sem número', 'Empresa Beta, SA']);
  });
  it('localidades únicas ordenadas', () => {
    assert.deepEqual(localidadesDe(lista), ['Fátima', 'Leiria', 'Ourém']);
  });
  it('duplicados dentro da lista', () => {
    const d = nifsDuplicados([...lista, { nome: 'Repetido', nif: '501234567' }]);
    assert.ok(d.has('501234567'));
    assert.equal(d.size, 1);
  });
});
