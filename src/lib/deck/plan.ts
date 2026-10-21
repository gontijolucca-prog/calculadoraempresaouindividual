/**
 * Validação e reparação do deck vindo da AI.
 *
 * Regra de ouro: o modelo só escreve texto. Estrutura mínima, preço e cartão de
 * contacto são sempre impostos por nós. Se não der para reparar, o chamador usa
 * o template determinístico.
 */
import { buildTemplateCards, pricingFor, type DeckInput } from './build';
import {
  MAX_CARDS,
  MIN_CARDS,
  normalizeCards,
  validateDeck,
  withUniqueIds,
  type DeckCard,
} from './types';

function insertBeforeContact(cards: DeckCard[], card: DeckCard): DeckCard[] {
  const contactIdx = cards.findIndex((c) => c.kind === 'contact');
  if (contactIdx === -1) return [...cards, card];
  return [...cards.slice(0, contactIdx), card, ...cards.slice(contactIdx)];
}

/**
 * Repara e valida cards da AI. Devolve `null` quando não é seguro mostrar
 * (o chamador cai no template).
 */
export function prepareAiCards(raw: unknown, input: DeckInput): DeckCard[] | null {
  const template = buildTemplateCards(input);
  let cards = withUniqueIds(normalizeCards(raw)).slice(0, MAX_CARDS);
  if (cards.length < MIN_CARDS) return null;

  // Capa sempre primeiro e sempre com o nome do escritório/cliente.
  if (cards[0].kind !== 'cover') {
    cards = [{ ...template[0] }, ...cards.filter((c) => c.kind !== 'cover')];
  } else {
    cards[0] = {
      ...cards[0],
      subtitle: cards[0].subtitle || template[0].subtitle,
    };
  }

  // Preço: substitui tudo o que o modelo inventou pelo cálculo real.
  const pricing = pricingFor(input);
  const pricingCard: DeckCard = {
    id: 'pricing',
    kind: 'pricing',
    title: 'Investimento',
    subtitle: pricing.subtitle,
    items: pricing.items,
  };
  const hadPricing = cards.some((c) => c.kind === 'pricing');
  cards = cards.map((c) => (c.kind === 'pricing' ? { ...pricingCard, id: c.id } : c));
  if (!hadPricing) cards = insertBeforeContact(cards, pricingCard);

  // Fecho sempre com contacto — sem isto a proposta não serve para nada.
  if (!cards.some((c) => c.kind === 'contact')) {
    cards = [...cards, { ...template[template.length - 1] }];
  }

  cards = cards.slice(0, MAX_CARDS);
  return validateDeck(cards).length === 0 ? cards : null;
}

export interface DeckResult {
  cards: DeckCard[];
  source: 'ai' | 'template';
}

/** Escolhe o melhor deck disponível: AI reparada ou template. */
export function chooseDeck(raw: unknown, input: DeckInput): DeckResult {
  const ai = prepareAiCards(raw, input);
  if (ai) return { cards: ai, source: 'ai' };
  return { cards: buildTemplateCards(input), source: 'template' };
}

/** Aplica só o texto — usado ao regerar um card, para não perder o preço. */
export function prepareAiCard(raw: unknown, input: DeckInput, fallback: DeckCard): DeckCard {
  const [card] = normalizeCards(Array.isArray(raw) ? raw : [raw]);
  if (!card) return fallback;
  if (card.kind === 'pricing') {
    const pricing = pricingFor(input);
    return { ...fallback, title: card.title || fallback.title, subtitle: pricing.subtitle, items: pricing.items };
  }
  return { ...card, id: fallback.id };
}
