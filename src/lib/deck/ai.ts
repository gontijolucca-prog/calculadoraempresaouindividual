/**
 * Cliente do proxy `/api/deck` (Cloudflare Function). A chave do modelo nunca
 * chega ao browser; aqui só se envia o brief e recebe-se JSON.
 */
import type { DeckCard } from './types';

export interface DeckAiRequest {
  mode: 'plan' | 'rewrite';
  brief: unknown;
  card?: DeckCard;
  instruction?: string;
}

const TIMEOUT_MS = 120_000;

/** Devolve o array `cards` cru (a validação vive em plan.ts) ou null. */
export async function requestAiCards(req: DeckAiRequest): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('/api/deck', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { cards?: unknown };
    return Array.isArray(data.cards) ? data.cards : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
