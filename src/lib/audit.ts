// Audit — grava cada input/mutação em Firestore (audit_events) + localStorage queue.
// Falha aberto: nunca bloqueia a app. Para recuperar o que a equipa fez hoje.
// Coleção: audit_events/{id} {uid,email,type,detail,payload,empresaId,ts}
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { loadFromStorage, saveToStorage } from './storage';

const COL = 'audit_events';
const QUEUE_KEY = 'auditQueue';

export type AuditEvent = {
  id: string;
  ts: number;
  uid: string;
  email?: string;
  type: string;
  detail?: string;
  empresaId?: string;
  // payload leve (ex: nif, nome, sim tipo) — nunca saftXml
  payload?: unknown;
};

function nid(): string { return Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-4); }
function uid(): string | null { return auth.currentUser?.uid ?? null; }

/** Remove campos `undefined` — o setDoc do Firestore rejeita-os com throw síncrono. */
function semUndefined<T>(v: T): T {
  if (Array.isArray(v)) return v.map(semUndefined) as unknown as T;
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (x === undefined) continue;
      out[k] = semUndefined(x);
    }
    return out as T;
  }
  return v;
}

function queueLocal(ev: AuditEvent): void {
  try {
    const q = loadFromStorage<AuditEvent[]>(QUEUE_KEY, []);
    q.push(ev);
    saveToStorage(QUEUE_KEY, q.slice(-300));
  } catch {}
}

/** Log fire-and-forget. Nunca lança. */
export function logAudit(type: string, detail?: string, payload?: unknown, empresaId?: string): void {
  try {
    const u = uid();
    const ev: AuditEvent = {
      id: nid(),
      ts: Date.now(),
      uid: u ?? 'anon',
      email: auth.currentUser?.email ?? undefined,
      type,
      detail: detail?.slice(0, 500),
      empresaId,
      payload,
    };
    queueLocal(ev);
    if (!u) return;
    // Só eventos críticos vão para o Firestore: gravar TODAS as ações duplicava
    // as escritas e esgotava a quota gratuita em horas. O resto fica local.
    const CRITICO = /(login|signup|logout|delete_|invite|convite|colaborador|cargo|gabinete|cofre|export|restaur|purgar)/i;
    if (!CRITICO.test(ev.type)) return;
    try { setDoc(doc(db, COL, ev.id), semUndefined(ev) as any).catch(()=>{}); } catch {}
  } catch {}
}

/** Tenta reenviar queue local (chamado no arranque e antes de unload). */
export async function flushAuditQueue(): Promise<void> {
  const u = uid();
  if (!u) return;
  const q = loadFromStorage<AuditEvent[]>(QUEUE_KEY, []);
  if (!q.length) return;
  const pending = q.filter(e => e.uid === u || e.uid === 'anon');
  const enviados = new Set<string>();
  for (const ev of pending.slice(-80)) {
    const toSend = ev.uid === 'anon' ? { ...ev, uid: u, email: auth.currentUser?.email ?? undefined } : ev;
    try { await setDoc(doc(db, COL, toSend.id), semUndefined(toSend) as any); enviados.add(ev.id); } catch {}
  }
  // Sem remover os enviados, cada abertura da app reescrevia os mesmos 80
  // eventos para sempre — foi isto que esgotou as 20 mil gravações diárias.
  if (enviados.size > 0) {
    saveToStorage(QUEUE_KEY, q.filter(e => !enviados.has(e.id)));
  }
}
