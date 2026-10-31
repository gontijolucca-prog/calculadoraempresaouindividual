/**
 * Sincronização de escritas — local-first.
 * Cada escrita atualiza primeiro o cache local; o envio para Firestore corre em
 * background. Se o servidor rejeitar (permission-denied, rede), a operação fica
 * numa outbox local com repetição manual/automática — nada se perde em silêncio.
 */
import { loadFromStorage, saveToStorage } from './storage';

export interface OutboxOp {
  id: string;
  at: number;
  tries: number;
  kind: 'set' | 'delete';
  path: string;
  docId: string;
  data?: unknown;
}

export interface SyncSnapshot {
  pending: number; // escritas em voo
  queued: number;  // operações na outbox à espera de repetição
  error: string | null;
}

type Listener = () => void;

const QUEUE_KEY = 'syncOutbox';

let inflight = 0;
let lastError: string | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) {
    try { l(); } catch { /* listener partido não pode partir o sync */ }
  }
}

function readQueue(): OutboxOp[] {
  return loadFromStorage<OutboxOp[]>(QUEUE_KEY, []);
}
function writeQueue(q: OutboxOp[]): void {
  // O limite protege o localStorage, mas não pode ser silencioso: ficam as 200
  // operações mais recentes e o utilizador é avisado de que houve descarte.
  if (q.length > 200) lastError = `Demasiadas alterações pendentes (${q.length}); foram mantidas as 200 mais recentes.`;
  saveToStorage(QUEUE_KEY, q.slice(-200));
}

// ——— helpers puros (testáveis) ———
export function upsertOp(list: OutboxOp[], op: OutboxOp): OutboxOp[] {
  const without = list.filter(x => !(x.docId === op.docId && x.kind === op.kind && x.path === op.path));
  return [...without, op];
}
export function dropOp(list: OutboxOp[], id: string): OutboxOp[] {
  return list.filter(x => x.id !== id);
}

function opId(): string {
  return `op_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

export function subscribeSync(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getSyncSnapshot(): SyncSnapshot {
  return { pending: inflight, queued: readQueue().length, error: lastError };
}

export function beginWrite(): void { inflight++; emit(); }
export function endWrite(error?: unknown): void {
  inflight = Math.max(0, inflight - 1);
  if (error !== undefined) lastError = String(error);
  else if (inflight === 0 && readQueue().length === 0) lastError = null;
  emit();
}
export function clearSyncError(): void { lastError = null; emit(); }
/** Limpa a fila de operações que o servidor recusou (ex.: após migração). */
export function clearOutbox(): void { saveToStorage(QUEUE_KEY, []); clearSyncError(); }

export function enqueueOp(op: Omit<OutboxOp, 'id' | 'at' | 'tries'>): void {
  writeQueue(upsertOp(readQueue(), { ...op, id: opId(), at: Date.now(), tries: 0 }));
  emit();
}
export function listOps(): OutboxOp[] { return readQueue(); }
export function dropOpById(id: string): void { writeQueue(dropOp(readQueue(), id)); emit(); }
export function bumpTries(list: OutboxOp[], id: string): OutboxOp[] {
  return list.map(x => (x.id === id ? { ...x, tries: x.tries + 1 } : x));
}
export function saveOps(list: OutboxOp[]): void { writeQueue(list); emit(); }
