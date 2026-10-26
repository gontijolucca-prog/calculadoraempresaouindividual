import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPropostaTailored } from './tailoring';
import { pricingFor, type DeckCliente } from './build';
import { defaultHonorariosConfig } from '../honorarios';
import { defaultOfficeSettings, type OfficeSettings } from '../officeSettings';

const office: OfficeSettings = {
  ...defaultOfficeSettings, nome: 'Escritório Teste', nif: '500000000',
  email: 'geral@teste.pt', telefone: '249 000 000', cedulaProfissional: '12345',
};
const cliente: DeckCliente = {
  id: 'c1', nome: 'Empresa Alfa, Lda', nif: '501234567',
  profile: { tipoEntidade: 'lda', faturaçaoAnualPrevista: 250000, nrFuncionarios: 3, regimeContabilidade: 'organizada' },
};
const briefing = { setor: 'restauração', dimensao: '3 pessoas', faturacao: '250 000 €', objetivo: 'fechar contas a tempo' };

const base = {
  id: 'd1', office, honorarios: defaultHonorariosConfig, cliente, briefing,
  ownerUid: 'u1', gabineteId: 'g1',
};

describe('buildPropostaTailored — 7 blocos com os dados do cliente', () => {
  it('tem os 7 tipos de card na ordem certa', () => {
    const deck = buildPropostaTailored(base);
    assert.deepEqual(deck.cards.map((c) => c.kind), ['cover', 'bullets', 'bullets', 'stats', 'pricing', 'timeline', 'contact']);
    assert.equal(deck.cards.length, 7);
  });

  it('leva as 4 respostas no diagnóstico', () => {
    const deck = buildPropostaTailored(base);
    const diag = deck.cards[1];
    assert.equal(diag.title, 'Diagnóstico');
    const texto = JSON.stringify(diag);
    assert.ok(texto.includes('restauração'));
    assert.ok(texto.includes('fechar contas a tempo'));
    assert.deepEqual(deck.respostas, briefing);
  });

  it('preço é o mesmo do motor (sem ajuste)', () => {
    const deck = buildPropostaTailored(base);
    const preco = pricingFor({ office, honorarios: defaultHonorariosConfig, cliente });
    const card = deck.cards.find((c) => c.kind === 'pricing');
    assert.ok(card);
    assert.equal(card!.subtitle, preco.subtitle);
    assert.deepEqual(card!.items, preco.items);
  });

  it('ajuste manual aparece e fica registado no deck', () => {
    const deck = buildPropostaTailored({ ...base, ajuste: { mensal: -25, motivo: 'cliente antigo', por: 'lucca' } });
    const card = deck.cards.find((c) => c.kind === 'pricing');
    assert.ok(card!.body?.includes('Valor acordado'));
    assert.ok(card!.body?.includes('cliente antigo'));
    assert.equal(deck.ajuste?.mensal, -25);
    assert.equal(deck.ajuste?.motivo, 'cliente antigo');
    assert.ok(deck.ajuste?.em);
  });

  it('sem cliente gera proposta geral', () => {
    const deck = buildPropostaTailored({ ...base, cliente: null });
    assert.equal(deck.clienteId, null);
    assert.ok(deck.titulo.includes('o cliente') || deck.titulo.includes('Proposta'));
    const card = deck.cards.find((c) => c.kind === 'pricing');
    assert.ok(card!.subtitle?.includes('Mensalidade base'));
  });
});
