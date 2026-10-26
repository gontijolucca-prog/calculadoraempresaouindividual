/**
 * Contrato do deck "Fazer Proposta".
 *
 * Um deck é uma lista de cards de tipos fixos. O layout é nosso; a AI só
 * escreve texto. Editor, impressão e página pública usam os mesmos tipos e o
 * mesmo renderer, por isso o que se vê no editor é o que sai no PDF e no link.
 */

export const CARD_KINDS = [
  'cover',
  'section',
  'bullets',
  'stats',
  'pricing',
  'timeline',
  'contact',
] as const;

export type CardKind = (typeof CARD_KINDS)[number];

export interface DeckItem {
  label: string;
  value?: string;
  note?: string;
}

export interface DeckCard {
  id: string;
  kind: CardKind;
  title?: string;
  subtitle?: string;
  body?: string;
  items?: DeckItem[];
}

export type DeckTheme = 'claro' | 'escuro' | 'brand';

export const DECK_THEMES: DeckTheme[] = ['claro', 'escuro', 'brand'];

export interface DeckDoc {
  v: 1;
  id: string;
  titulo: string;
  clienteId: string | null;
  clienteNome?: string;
  tema: DeckTheme;
  cards: DeckCard[];
  ownerUid: string;
  gabineteId: string;
  createdAt: number;
  updatedAt: number;
  slug?: string;
  expiresAt?: number;
  /** Respostas do briefing (4 perguntas) — guardadas para reutilizar. */
  respostas?: {
    setor?: string;
    dimensao?: string;
    faturacao?: string;
    objetivo?: string;
  };
  /** Ajuste manual ao preço da tabela, com motivo e autor (auditoria). */
  ajuste?: {
    mensal?: number;
    motivo?: string;
    por?: string;
    em?: number;
  };
}

export const MIN_CARDS = 3;
export const MAX_CARDS = 14;
export const MAX_TITLE = 90;
export const MAX_SUBTITLE = 140;
export const MAX_BODY = 700;
export const MAX_ITEMS = 8;
export const MAX_ITEM_LABEL = 90;
export const MAX_ITEM_VALUE = 60;
export const MAX_ITEM_NOTE = 160;

export function newCardId(): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `c_${Date.now().toString(36)}_${rnd}`;
}

/** Remove tags/control chars e corta ao limite — o texto vem do modelo e é
 *  mostrado na página pública, por isso nunca é injetado como HTML. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function cleanItem(raw: unknown): DeckItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const label = cleanText(o.label ?? o.descricao ?? o.title, MAX_ITEM_LABEL);
  if (!label) return null;
  const value = cleanText(o.value ?? o.valor, MAX_ITEM_VALUE);
  const note = cleanText(o.note ?? o.nota, MAX_ITEM_NOTE);
  return {
    label,
    ...(value ? { value } : {}),
    ...(note ? { note } : {}),
  };
}

export function isCardKind(value: unknown): value is CardKind {
  return typeof value === 'string' && (CARD_KINDS as readonly string[]).includes(value);
}

/** Normaliza cards vindos da AI ou do template. Não valida totais — só limpa. */
export function normalizeCards(raw: unknown): DeckCard[] {
  if (!Array.isArray(raw)) return [];
  const out: DeckCard[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const o = entry as Record<string, unknown>;
    if (!isCardKind(o.kind)) continue;
    const items = Array.isArray(o.items)
      ? o.items.map(cleanItem).filter((i): i is DeckItem => !!i).slice(0, MAX_ITEMS)
      : undefined;
    const card: DeckCard = {
      id: typeof o.id === 'string' && o.id ? o.id.slice(0, 40) : newCardId(),
      kind: o.kind,
    };
    const title = cleanText(o.title, MAX_TITLE);
    const subtitle = cleanText(o.subtitle, MAX_SUBTITLE);
    const body = cleanText(o.body, MAX_BODY);
    if (title) card.title = title;
    if (subtitle) card.subtitle = subtitle;
    if (body) card.body = body;
    if (items && items.length) card.items = items;
    out.push(card);
  }
  return out;
}

/** Erros que impedem um deck de ser mostrado. Vazio = válido. */
export function validateDeck(cards: DeckCard[]): string[] {
  const errors: string[] = [];
  if (cards.length < MIN_CARDS) errors.push(`Poucos cards (${cards.length}/${MIN_CARDS})`);
  if (cards.length > MAX_CARDS) errors.push(`Cards a mais (${cards.length}/${MAX_CARDS})`);
  const first = cards[0];
  if (first && first.kind !== 'cover') errors.push('O primeiro card tem de ser a capa');
  cards.forEach((c, i) => {
    if (!isCardKind(c.kind)) errors.push(`Card ${i + 1}: tipo inválido`);
    if (c.kind === 'cover' && !c.title) errors.push('Capa sem título');
    if ((c.kind === 'section' || c.kind === 'bullets' || c.kind === 'pricing' || c.kind === 'timeline' || c.kind === 'stats') && !c.items?.length && !c.body) {
      errors.push(`Card ${i + 1} (${c.kind}) sem conteúdo`);
    }
  });
  return errors;
}

/** Garante ids únicos (a AI às vezes repete). */
export function withUniqueIds(cards: DeckCard[]): DeckCard[] {
  const seen = new Set<string>();
  return cards.map((c) => {
    if (!c.id || seen.has(c.id)) return { ...c, id: newCardId() };
    seen.add(c.id);
    return c;
  });
}
