import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pareceTerDadosCliente, mascararDados, mascararMensagens } from './_privacidade';

const msg = (content: string) => ({ role: 'user', content });

describe('privacidade — dados de cliente antes de providers free', () => {
  it('deteta NIF sem separadores', () => {
    assert.equal(pareceTerDadosCliente([msg('O cliente 501234567 tem IVA?')]), true);
  });
  it('deteta NIF com pontos e espaços', () => {
    assert.equal(pareceTerDadosCliente([msg('NIF 501.234.567, entrega quando?')]), true);
    assert.equal(pareceTerDadosCliente([msg('NIPC 501 234 567')]), true);
  });
  it('deteta IBAN português', () => {
    assert.equal(pareceTerDadosCliente([msg('IBAN PT50 0002 0123 1234 5678 9015 4')]), true);
  });
  it('deteta dados no contexto da app', () => {
    assert.equal(pareceTerDadosCliente([msg('e este cliente?')], 'NIF: 502345678'), true);
  });
  it('deteta dados no histórico, não só na última mensagem', () => {
    assert.equal(
      pareceTerDadosCliente([
        { role: 'user', content: 'O meu NIF é 501234567' },
        { role: 'assistant', content: 'Certo.' },
        { role: 'user', content: 'E o IVA?' },
      ]),
      true,
    );
  });
  it('pergunta normal passa', () => {
    assert.equal(pareceTerDadosCliente([msg('Quando entrega o IVA trimestral uma Lda?')]), false);
    assert.equal(pareceTerDadosCliente([msg('Quero saber a taxa de IVA de 2026')]), false);
  });
  it('números que não são NIF não bloqueiam', () => {
    assert.equal(pareceTerDadosCliente([msg('Faturei 25000 euros e paguei 1200 de IVA')]), false);
    assert.equal(pareceTerDadosCliente([msg('Artigo 53 permite até 15000 euros')]), false);
  });
});

describe('privacidade — mascarar antes de providers gratuitos', () => {
  it('mascara NIF e IBAN sem estragar o resto da frase', () => {
    const t = mascararDados('O cliente 501234567, IBAN PT50 0002 0123 1234 5678 9015 4, tem IVA em atraso?');
    assert.ok(!/\d{9}/.test(t), 'não pode sobrar NIF');
    assert.ok(!/PT50/.test(t), 'não pode sobrar IBAN');
    assert.ok(t.includes('[NIF]') && t.includes('[IBAN]'));
    assert.ok(t.includes('tem IVA em atraso?'), 'o resto da pergunta fica');
  });
  it('mascara em todas as mensagens', () => {
    const msgs = mascararMensagens([
      { role: 'user', content: 'NIF 501.234.567' },
      { role: 'assistant', content: 'Certo.' },
      { role: 'user', content: 'E o IVA?' },
    ]);
    assert.equal(msgs[0].content, 'NIF [NIF]');
    assert.equal(msgs[1].content, 'Certo.');
  });
  it('não mexe em números que não são NIF', () => {
    const t = 'Faturei 25000 euros e o artigo 53 permite 15000.';
    assert.equal(mascararDados(t), t);
  });
});
