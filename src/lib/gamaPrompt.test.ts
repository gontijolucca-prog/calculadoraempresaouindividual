import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildGamaPrompt } from './gamaPrompt';
import { pricingFor, type DeckCliente } from './deck/build';
import { defaultHonorariosConfig } from './honorarios';
import { defaultOfficeSettings, type OfficeSettings } from './officeSettings';

const office: OfficeSettings = {
  ...defaultOfficeSettings,
  nome: 'Escritório Teste', nif: '500000000', email: 'geral@teste.pt', telefone: '249 000 000',
};

const cliente: DeckCliente = {
  id: 'c1', nome: 'Empresa Alfa, Lda', nif: '501234567',
  profile: { tipoEntidade: 'lda', faturaçaoAnualPrevista: 250000, nrFuncionarios: 3, regimeContabilidade: 'organizada' },
};

const briefing = { setor: 'restauração', dimensao: '3 pessoas', faturacao: '250 000 €', objetivo: 'fechar contas a tempo' };

describe('gamaPrompt — mesma estrutura da proposta da app', () => {
  it('tem os 7 blocos', () => {
    const p = buildGamaPrompt(office, defaultHonorariosConfig, cliente, { briefing });
    for (const s of ['## Diagnóstico', '## Âmbito da proposta', '## Equipa e prova', '## Investimento', '## Plano de arranque', '## Próximo passo']) {
      assert.ok(p.includes(s), `falta ${s}`);
    }
    assert.ok(p.startsWith('# Proposta de Serviços de Contabilidade'));
  });

  it('usa as 4 respostas no diagnóstico', () => {
    const p = buildGamaPrompt(office, defaultHonorariosConfig, cliente, { briefing });
    assert.ok(p.includes('Setor: restauração'));
    assert.ok(p.includes('Objetivo a 12 meses: fechar contas a tempo'));
    assert.ok(p.includes('fechar contas a tempo.'));
  });

  it('preço é o do motor de honorários', () => {
    const preco = pricingFor({ office, honorarios: defaultHonorariosConfig, cliente });
    const p = buildGamaPrompt(office, defaultHonorariosConfig, cliente, { briefing });
    assert.ok(p.includes(preco.subtitle));
    for (const item of preco.items) assert.ok(p.includes(`${item.label}: ${item.value}`));
    assert.ok(/€\/mês/.test(p));
  });

  it('sem cliente usa mensalidade base', () => {
    const p = buildGamaPrompt(office, defaultHonorariosConfig, null, {});
    assert.ok(p.includes('Mensalidade base por tipo de entidade'));
    assert.ok(p.includes('não indicado'));
  });

  it('observações entram antes do fecho', () => {
    const p = buildGamaPrompt(office, defaultHonorariosConfig, cliente, { briefing, observacoes: 'Inclui reunião trimestral.' });
    assert.ok(p.indexOf('Inclui reunião trimestral.') < p.indexOf('## Próximo passo'));
  });

  it('contactos do escritório entram no fim', () => {
    const p = buildGamaPrompt(office, defaultHonorariosConfig, cliente, { briefing });
    assert.ok(p.includes('Contacto: geral@teste.pt · 249 000 000'));
    assert.ok(p.includes('NIF: 500000000'));
  });
});
