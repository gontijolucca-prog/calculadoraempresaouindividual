import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { emailValido, montarEmailConvite } from './api/equipa-convite';

describe('convite por email — validação', () => {
  it('aceita emails normais e rejeita lixo', () => {
    assert.equal(emailValido('ana@estudo360.pt'), true);
    assert.equal(emailValido('a.b+c@sub.dominio.pt'), true);
    assert.equal(emailValido('sem-arroba'), false);
    assert.equal(emailValido('a@b'), false);
    assert.equal(emailValido(''), false);
  });
});

describe('convite por email — conteúdo', () => {
  it('inclui nome, email, gabinete e passos', () => {
    const m = montarEmailConvite('Ana Silva', 'ana@empresa.pt', 'Silva & Associados', 'estagiaria');
    assert.match(m.subject, /Convite para a equipa/);
    assert.match(m.text, /Ana/);
    assert.match(m.text, /ana@empresa\.pt/);
    assert.match(m.text, /Silva & Associados/);
    assert.match(m.text, /password forte/i);
    assert.match(m.html, /ana@empresa\.pt/);
    assert.match(m.html, /estagiária/);
  });
  it('escapa HTML do nome do gabinete', () => {
    const m = montarEmailConvite('Ana', 'ana@empresa.pt', '<script>x</script>', 'contabilista');
    assert.ok(!m.html.includes('<script>'));
    assert.ok(m.html.includes('&lt;script&gt;'));
  });
});
