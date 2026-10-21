/**
 * Link público da proposta — slug aleatório e expiração.
 *
 * O link aponta para `/p/<slug>` e o conteúdo vive em `publicPropostas/<slug>`,
 * uma coleção só de snapshots: o documento do gabinete nunca fica exposto.
 */

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const SLUG_LENGTH = 18;
export const SHARE_DAYS = 90;
export const SHARE_MS = SHARE_DAYS * 24 * 60 * 60 * 1000;

/** 18 chars base62 com crypto — ~107 bits, não é adivinhável. */
export function newSlug(): string {
  const bytes = new Uint8Array(SLUG_LENGTH);
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function expiryFromNow(now = Date.now()): number {
  return now + SHARE_MS;
}

export function isExpired(value: unknown, now = Date.now()): boolean {
  const ms = toMillis(value);
  return ms === null ? true : ms <= now;
}

/** Aceita number, Timestamp do Firestore ou string ISO. */
export function toMillis(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : null;
  }
  if (value && typeof value === 'object') {
    const v = value as { toMillis?: () => number; seconds?: number };
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.seconds === 'number') return v.seconds * 1000;
  }
  return null;
}

export function publicPath(slug: string): string {
  return `/p/${slug}`;
}

export function publicUrl(slug: string, origin?: string): string {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://estudo360.pt');
  return `${base.replace(/\/$/, '')}${publicPath(slug)}`;
}

export function slugFromPath(pathname: string): string | null {
  const m = /^\/p\/([0-9A-Za-z]{6,64})\/?$/.exec(pathname);
  return m ? m[1] : null;
}
