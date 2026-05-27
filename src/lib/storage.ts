/**
 * Persistência simples em localStorage.
 * Usado para preservar `clientProfile` e `fichaState` entre refreshes — evita que o
 * consultor perca trabalho ao recarregar a página.
 *
 * Versionamento: bump SCHEMA_VERSION quando alterares estruturas de forma
 * incompatível — dados antigos são descartados em vez de causar TypeError.
 */

const STORAGE_PREFIX = 'estudo360:v1:';
// Prefixo antigo (antes do rebrand RECOFATIMA → Estudo 360). Lido como fallback
// e migrado para o novo, para quem já usava a app não perder o trabalho guardado.
const LEGACY_PREFIX = 'recofatima:v1:';
const SCHEMA_VERSION = 1;

interface Envelope<T> {
  v: number;
  data: T;
}

export function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    let raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    // Migração: se não há nada na chave nova, recupera da chave antiga
    // (pré-rebrand) e move-a para a nova, para o utilizador não perder dados.
    if (!raw) {
      const legacy = window.localStorage.getItem(LEGACY_PREFIX + key);
      if (legacy) {
        raw = legacy;
        window.localStorage.setItem(STORAGE_PREFIX + key, legacy);
        window.localStorage.removeItem(LEGACY_PREFIX + key);
      }
    }
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (!parsed || parsed.v !== SCHEMA_VERSION || !parsed.data) return fallback;
    return parsed.data;
  } catch {
    return fallback;
  }
}

export function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const envelope: Envelope<T> = { v: SCHEMA_VERSION, data: value };
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(envelope));
  } catch {
    // Quota cheia ou modo privado — falhar silenciosamente.
  }
}

export function clearStorage(key: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    /* noop */
  }
}
