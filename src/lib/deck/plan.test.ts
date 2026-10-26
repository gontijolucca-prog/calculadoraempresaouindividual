// Testes do motor de propostas (template + reparação do deck da AI).
// Correr: npx tsx src/lib/deck/plan.test.ts
// Sem rede e sem DOM: só funções puras.

import { buildBrief, buildTemplateCards, eur, pricingFor } from './build';
import type { DeckInput } from './build';
import { chooseDeck, prepareAiCard, prepareAiCards } from './plan';
import { cleanText, normalizeCards, validateDeck, MAX_CARDS } from './types';
import { defaultHonorariosConfig, calcularProposta } from '../honorarios';
import type { OfficeSettings } from '../officeSettings';

let fails = 0;
function check(label: string, cond: boolean) {
  if (!cond) { fails++; console.error(`✗ ${label}`); }
  else console.log(`✓ ${label}`);
}

const office = {
  tipo: 'individual',
  nome: 'Escritório Teste',
  nif: '123456789',
  cedulaProfissional: 'CC-123',
  contabilistaResponsavel: 'Ana Silva',
  numeroInscricaoOCC: '',
  representanteLegal: '',
  morada: 'Rua A 1',
  codigoPostal: '1000-001',
  localidade: 'Lisboa',
  telefone: '910000000',
  email: 'geral@teste.pt',
  website: 'https://teste.pt',
  iban: '',
  foroComarca: 'Lisboa',
  logoDataUrl: '',
  corPrimaria: '#0677FF',
  anoFundacao: 2015,
  historia: 'Somos um escritório de proximidade.',
} as OfficeSettings;

const cliente = {
  id: 'emp1',
  nome: 'Cliente Lda',
  nif: '501234567',
  profile: { tipoEntidade: 'lda' as const, faturaçaoAnualPrevista: 120000, nrFuncionarios: 2 },
};

const input: DeckInput = { office, honorarios: defaultHonorariosConfig, cliente };

// ── Template ────────────────────────────────────────────────────────────────
const template = buildTemplateCards(input);
check('template tem entre 3 e 8 cards', template.length >= 3 && template.length <= MAX_CARDS);
check('template começa na capa', template[0].kind === 'cover');
check('template fecha com contacto', template[template.length - 1].kind === 'contact');
check('template tem preço', template.some((c) => c.kind === 'pricing'));
check('template é válido', validateDeck(template).length === 0);

const preco = calcularProposta(cliente.profile as never, defaultHonorariosConfig);
const pricingCard = template.find((c) => c.kind === 'pricing')!;
check('preço do template = calcularProposta', pricingCard.items!.length === preco.itens.length);
check('subtotal do template tem o mensal', pricingCard.subtitle!.includes(eur(preco.mensalSemIVA)));
check('pricingFor devolve linhas', pricingFor(input).items.length > 0);

// Sem cliente → tabela base por tipo de entidade, nunca vazio.
const geral = pricingFor({ office, honorarios: defaultHonorariosConfig, cliente: null });
check('versão geral usa base por tipo', geral.items.length === 5);

// ── Reparação da AI ─────────────────────────────────────────────────────────
const aiRaw = [
  { kind: 'cover', title: 'Proposta para Cliente Lda', subtitle: 'Escritório Teste' },
  { kind: 'bullets', title: 'O que fazemos', items: [{ label: 'Contabilidade', note: 'Tudo tratado.' }] },
  { kind: 'pricing', title: 'Investimento', subtitle: '1 € / mês', items: [{ label: 'Inventado', value: '1 €' }] },
  { kind: 'contact', title: 'Falamos?', items: [{ label: 'Email', value: 'geral@teste.pt' }] },
];
const repaired = prepareAiCards(aiRaw, input)!;
check('AI reparada é válida', !!repaired && validateDeck(repaired).length === 0);
check('AI reparada mantém capa', repaired[0].kind === 'cover');
check('preço inventado é substituído', !repaired.some((c) => c.items?.some((i) => i.label === 'Inventado')));
check('preço reparado usa o cálculo real', repaired.some((c) => c.kind === 'pricing' && c.subtitle === pricingFor(input).subtitle));

const semCapa = prepareAiCards(
  [
    { kind: 'section', title: 'A', body: 'a' },
    { kind: 'bullets', title: 'B', items: [{ label: 'b' }] },
    { kind: 'contact', title: 'C' },
  ],
  input,
)!;
check('AI sem capa ganha capa', semCapa[0].kind === 'cover');

const semContacto = prepareAiCards(
  [
    { kind: 'cover', title: 'X' },
    { kind: 'section', title: 'A', body: 'a' },
    { kind: 'bullets', title: 'B', items: [{ label: 'b' }] },
    { kind: 'stats', title: 'C', items: [{ label: 'c', value: '1' }] },
  ],
  input,
)!;
check('AI sem contacto ganha contacto', semContacto[semContacto.length - 1].kind === 'contact');

check('AI com 2 cards é rejeitada', prepareAiCards([{ kind: 'cover', title: 'x' }, { kind: 'section', title: 'y', body: 'z' }], input) === null);
check('lixo é rejeitado', prepareAiCards('não é deck', input) === null);

const escolha = chooseDeck('lixo', input);
check('fallback cai no template', escolha.source === 'template' && escolha.cards.length === template.length);

const cardFallback = template[1];
const cardNovo = prepareAiCard([{ kind: 'section', title: 'Novo título', body: 'Novo corpo' }], input, cardFallback);
check('regerar card mantém o id', cardNovo.id === cardFallback.id && cardNovo.title === 'Novo título');

const pricingFallback = template.find((c) => c.kind === 'pricing')!;
const pricingNovo = prepareAiCard(
  [{ kind: 'pricing', title: 'Investimento', items: [{ label: 'Barato', value: '0 €' }] }],
  input,
  pricingFallback,
);
check('regerar pricing nunca aceita preço do modelo', !pricingNovo.items?.some((i) => i.label === 'Barato'));
check('regerar pricing mantém o subtotal real', pricingNovo.subtitle === pricingFor(input).subtitle);

// ── Limpeza / validação ─────────────────────────────────────────────────────
check('cleanText remove tags', cleanText('<b>Olá</b> mundo', 100) === 'Olá mundo');
check('cleanText corta ao limite', cleanText('a'.repeat(200), 10).length === 10);
check('normalizeCards ignora tipos inválidos', normalizeCards([{ kind: 'hack', title: 'x' }]).length === 0);
check('normalizeCards garante items limpos', normalizeCards([{ kind: 'bullets', items: [{ label: '<i>A</i>', value: '1' }, { note: 'sem label' }] }])[0].items!.length === 1);
check('validateDeck apanha deck pequeno', validateDeck([template[0]]).length > 0);

// ── Brief ───────────────────────────────────────────────────────────────────
const brief = buildBrief(input);
check('brief tem escritório', (brief.escritorio as { nome: string }).nome === 'Escritório Teste');
check('brief tem cliente', brief.cliente?.nome === 'Cliente Lda');
check('brief leva os totais', (brief.totais.linhas as unknown[]).length > 0);

if (fails > 0) {
  console.error(`\n${fails} falha(s)`);
  process.exit(1);
}
console.log('\nTodos os testes do deck passaram.');
