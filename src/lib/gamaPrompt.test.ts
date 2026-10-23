import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildGamaPrompt } from './gamaPrompt';
import { pricingFor, type DeckCliente } from './deck/build';
import { defaultHonorariosConfig } from './honorarios';
import { defaultOfficeSettings, type OfficeSettings } from './officeSettings';

const office: OfficeSettings = {
  ...defaultOfficeSettings,
  nome: 'Escritório Teste',
  nif: '500000000',
  email: 'geral@teste.pt',
  telefone: '249 000 000',
  historia: 'Nascemos em Fátima em 2009.',
};

const cliente: DeckCliente = {
  id: 'c1',
  nome: 'Empresa Alfa, Lda',
  nif: '501234567',
  profile: { tipoEntidade: 'lda', faturaçaoAnualPrevista: 250000, nrFuncionarios: 3, regimeContabilidade: 'organizada' },
};

describe('gamaPrompt — texto da proposta (estrutura Ativiwise)', () => {
  it('tem as secções todas por omissão', () => {
    const p = buildGamaPrompt(office, defaultHonorariosConfig, cliente);
    for (const s of [
      'Sobre nós', 'A nossa equipa', 'Os nossos valores', 'contabilidade digital',
      'Âmbito da proposta', 'Benefícios exclusivos', 'A nossa proposta para si',
      'Investimento — Honorários', 'Agradecemos a oportunidade',
    ]) {
      assert.ok(p.includes(s), `falta a secção: ${s}`);
    }
    assert.ok(p.startsWith('# Proposta de Serviços de Contabilidade — Escritório Teste para Empresa Alfa, Lda'));
    assert.ok(p.includes('Nascemos em Fátima em 2009.'));
  });

  it('desligar Equipa/Valores/Benefícios remove só essas secções', () => {
    const p = buildGamaPrompt(office, defaultHonorariosConfig, cliente, {
      equipa: false, valores: false, beneficios: false,
    });
    assert.ok(!p.includes('## A nossa equipa'));
    assert.ok(!p.includes('## Os nossos valores'));
    assert.ok(!p.includes('## Benefícios exclusivos'));
    assert.ok(p.includes('## âmbito da proposta'.replace('â', 'Â')));
    assert.ok(p.includes('## Investimento — Honorários'));
  });

  it('preço é o mesmo do motor de honorários (pricingFor)', () => {
    const preco = pricingFor({ office, honorarios: defaultHonorariosConfig, cliente });
    const p = buildGamaPrompt(office, defaultHonorariosConfig, cliente);
    assert.ok(preco.subtitle && p.includes(preco.subtitle), 'subtotal do preço tem de aparecer no texto');
    for (const item of preco.items) {
      assert.ok(p.includes(`${item.label}: ${item.value}`), `linha de preço em falta: ${item.label}`);
    }
    assert.ok(/€\/mês/.test(p), 'tem de haver valor mensal em euros');
  });

  it('sem cliente usa a mensalidade base por tipo de entidade', () => {
    const p = buildGamaPrompt(office, defaultHonorariosConfig, null);
    assert.ok(p.includes('Mensalidade base por tipo de entidade'));
    assert.ok(p.includes('€/mês'));
    assert.ok(!p.includes('## A nossa proposta para si'));
  });

  it('observações entram antes do fecho', () => {
    const p = buildGamaPrompt(office, defaultHonorariosConfig, cliente, { observacoes: 'Inclui reunião trimestral.' });
    assert.ok(p.includes('Inclui reunião trimestral.'));
    assert.ok(p.indexOf('Inclui reunião trimestral.') < p.indexOf('## Agradecemos a oportunidade'));
  });

  it('contactos e identificação do escritório entram no fim', () => {
    const p = buildGamaPrompt(office, defaultHonorariosConfig, cliente);
    assert.ok(p.includes('Contacto: geral@teste.pt · 249 000 000'));
    assert.ok(p.includes('NIF: 500000000'));
  });
});
