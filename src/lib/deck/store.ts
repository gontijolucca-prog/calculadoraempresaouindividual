/**
 * Persistência das propostas.
 *
 * Local-first: o deck é sempre gravado em localStorage e enviado para
 * `gabinetes/{gabineteId}/propostas/{id}` pela outbox existente. O link público
 * é a única operação que exige rede — publicar tem de ser imediato e confirmado.
 */
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { getGabineteOfficeId, queueRemove, queueSet } from '../gabinete';
import { loadFromStorage, saveToStorage } from '../storage';
import type { OfficeSettings } from '../officeSettings';
import type { DeckDoc, DeckTheme } from './types';
import { expiryFromNow, isExpired, newSlug } from './share';

export interface DeckMeta {
  id: string;
  titulo: string;
  clienteNome?: string;
  updatedAt: number;
  slug?: string;
  expiresAt?: number;
}

export interface EscritorioPublico {
  nome: string;
  corPrimaria: string;
  logoDataUrl?: string;
  email?: string;
  telefone?: string;
  website?: string;
  morada?: string;
  codigoPostal?: string;
  localidade?: string;
}

export interface PublicDeck {
  slug: string;
  titulo: string;
  cards: DeckDoc['cards'];
  tema: DeckTheme;
  clienteNome?: string;
  escritorio: EscritorioPublico;
  expiresAt: unknown;
  updatedAt: number;
}

const INDEX_KEY = 'deck:index';
const DECK_KEY = (id: string) => `deck:${id}`;
const COL = 'propostas';
const colPath = (gabineteId: string) => `gabinete/${gabineteId}/${COL}`;
const PUBLIC_COL = 'publicPropostas';

function currentGabineteId(): string {
  return getGabineteOfficeId();
}

function currentUid(): string {
  return auth.currentUser?.uid || '';
}

export function listMetas(): DeckMeta[] {
  const list = loadFromStorage<DeckMeta[]>(INDEX_KEY, []);
  return Array.isArray(list) ? [...list].sort((a, b) => b.updatedAt - a.updatedAt) : [];
}

function writeMetas(list: DeckMeta[]): void {
  saveToStorage(INDEX_KEY, list.slice(0, 200));
}

function upsertMeta(deck: DeckDoc): void {
  const meta: DeckMeta = {
    id: deck.id,
    titulo: deck.titulo,
    ...(deck.clienteNome ? { clienteNome: deck.clienteNome } : {}),
    updatedAt: deck.updatedAt,
    ...(deck.slug ? { slug: deck.slug } : {}),
    ...(deck.expiresAt ? { expiresAt: deck.expiresAt } : {}),
  };
  const rest = listMetas().filter((m) => m.id !== deck.id);
  writeMetas([meta, ...rest]);
}

export function loadDeckLocal(id: string): DeckDoc | null {
  const deck = loadFromStorage<DeckDoc | null>(DECK_KEY(id), null);
  return deck && deck.id ? deck : null;
}

/** Lê local primeiro e cai no Firestore se a cache estiver vazia. */
export async function loadDeck(id: string): Promise<DeckDoc | null> {
  const local = loadDeckLocal(id);
  if (local) return local;
  try {
    const snap = await getDoc(doc(db, colPath(currentGabineteId()), id));
    if (!snap.exists()) return null;
    const deck = { ...(snap.data() as DeckDoc), id };
    saveToStorage(DECK_KEY(id), deck);
    upsertMeta(deck);
    return deck;
  } catch {
    return null;
  }
}

/** Grava local + cloud (outbox). Devolve já — a UI não espera pela rede. */
export function saveDeck(deck: DeckDoc): DeckDoc {
  const next: DeckDoc = { ...deck, updatedAt: Date.now() };
  saveToStorage(DECK_KEY(next.id), next);
  upsertMeta(next);
  const gabineteId = next.gabineteId || currentGabineteId();
  queueSet(colPath(gabineteId), next.id, next);
  return next;
}

export function removeDeck(id: string): void {
  // Se a proposta tinha link público, apaga-o também — apagar a proposta não
  // pode deixar uma cópia pública viva durante 90 dias.
  const local = loadDeckLocal(id);
  if (local?.slug) void revokeDeck(local.slug).catch(() => {});
  writeMetas(listMetas().filter((m) => m.id !== id));
  saveToStorage(DECK_KEY(id), null);
  queueRemove(colPath(currentGabineteId()), id);
}

/** Junta as metas locais com as que existem no Firestore (outros dispositivos). */
export async function syncMetas(): Promise<DeckMeta[]> {
  const local = listMetas();
  try {
    const snap = await getDocs(collection(db, colPath(currentGabineteId())));
    const byId = new Map(local.map((m) => [m.id, m]));
    snap.forEach((d) => {
      const deck = d.data() as DeckDoc;
      const meta: DeckMeta = {
        id: d.id,
        titulo: deck.titulo || 'Proposta',
        ...(deck.clienteNome ? { clienteNome: deck.clienteNome } : {}),
        updatedAt: Number(deck.updatedAt) || Date.now(),
        ...(deck.slug ? { slug: deck.slug } : {}),
        ...(deck.expiresAt ? { expiresAt: Number(deck.expiresAt) } : {}),
      };
      const prev = byId.get(d.id);
      if (!prev || prev.updatedAt < meta.updatedAt) byId.set(d.id, meta);
    });
    const merged = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    writeMetas(merged);
    return merged;
  } catch {
    return local;
  }
}

function publicPayload(deck: DeckDoc, office: OfficeSettings, expiresAt: number): PublicDeck & { ownerUid: string } {
  return {
    slug: deck.slug || '',
    titulo: deck.titulo,
    cards: deck.cards,
    tema: deck.tema,
    ...(deck.clienteNome ? { clienteNome: deck.clienteNome } : {}),
    escritorio: {
      nome: office.nome || '',
      corPrimaria: office.corPrimaria || '#0677FF',
      ...(office.logoDataUrl ? { logoDataUrl: office.logoDataUrl } : {}),
      ...(office.email ? { email: office.email } : {}),
      ...(office.telefone ? { telefone: office.telefone } : {}),
      ...(office.website ? { website: office.website } : {}),
      ...(office.morada ? { morada: office.morada } : {}),
      ...(office.codigoPostal ? { codigoPostal: office.codigoPostal } : {}),
      ...(office.localidade ? { localidade: office.localidade } : {}),
    },
    expiresAt: Timestamp.fromMillis(expiresAt),
    updatedAt: Date.now(),
    ownerUid: currentUid(),
  };
}

export interface PublishResult {
  slug: string;
  expiresAt: number;
}

/** Cria/substitui o snapshot público. Reutiliza o slug se a proposta já foi publicada. */
export async function publishDeck(deck: DeckDoc, office: OfficeSettings): Promise<PublishResult> {
  const uid = currentUid();
  if (!uid) throw new Error('Sessão expirada — entra de novo para publicar.');
  const slug = deck.slug || newSlug();
  const expiresAt = expiryFromNow();
  const payload = publicPayload({ ...deck, slug }, office, expiresAt);
  await setDoc(doc(db, PUBLIC_COL, slug), payload);
  return { slug, expiresAt };
}

export async function revokeDeck(slug: string): Promise<void> {
  await deleteDoc(doc(db, PUBLIC_COL, slug));
}

export interface PublicLoad {
  deck: PublicDeck | null;
  reason?: 'expirada' | 'indisponivel';
}

/** Leitura anónima. Regras do Firestore deixam ler só enquanto não expirou. */
export async function loadPublicDeck(slug: string): Promise<PublicLoad> {
  try {
    const snap = await getDoc(doc(db, PUBLIC_COL, slug));
    if (!snap.exists()) return { deck: null, reason: 'indisponivel' };
    const deck = snap.data() as PublicDeck;
    if (isExpired(deck.expiresAt)) return { deck: null, reason: 'expirada' };
    return { deck };
  } catch {
    return { deck: null, reason: 'expirada' };
  }
}
