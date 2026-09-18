/**
 * Multi-gabinete — membership, convites e gabinete ativo.
 * Cada utilizador pode ter vários gabinetes: os que criou e os que lhe
 * convidaram. Ao fazer login aparece o selector (meus + convites + criar).
 * Dados do Gabinete vivem em `gabinete/{gabineteId}/...`  (gabineteId = id do doc em `gabinetes`)
 * Legado: gabinete/{uid} continua válido — o gabinete default tem id = uid para não migrar dados.
 */
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, arrayUnion, arrayRemove, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { loadFromStorage, saveToStorage, clearStorage } from './storage';

export type GabineteRole = 'admin' | 'contabilista' | 'estagiaria';

export interface GabineteMeta {
  id: string;
  nome: string;
  nif?: string;
  ownerUid: string;
  ownerEmail: string;
  createdAt: number;
  updatedAt: number;
  memberUids: string[];
  members: Record<string, { role: GabineteRole; addedAt: number; email: string }>;
  inviteEmails: string[]; // lowercased
  invites: Array<{ email: string; role: GabineteRole; invitedAt: number; invitedBy: string; invitedByEmail: string }>;
}

const ACTIVE_KEY = 'gabinete:activeId';
function perUidKey(uid: string) { return `gabinete:activeId:${uid}`; }

export function getActiveGabineteId(): string | null {
  const uid = auth.currentUser?.uid;
  if (uid) {
    const v = loadFromStorage<string | null>(perUidKey(uid), null);
    if (v) return v;
  }
  const g = loadFromStorage<string | null>(ACTIVE_KEY, null);
  if (g) return g;
  return null;
}

export function setActiveGabineteId(id: string) {
  const uid = auth.currentUser?.uid;
  if (uid) saveToStorage(perUidKey(uid), id);
  saveToStorage(ACTIVE_KEY, id);
  saveToStorage('gabinete:officeId', id); // legacy
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('estudo360:gabinete-switch', { detail: { id } } as any));
  }
}

export function clearActiveGabineteId() {
  const uid = auth.currentUser?.uid;
  if (uid) clearStorage(perUidKey(uid));
  clearStorage(ACTIVE_KEY);
  clearStorage('gabinete:officeId');
}

function newGabineteId(): string {
  return `gab_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

function normalizeEmail(e: string) { return e.trim().toLowerCase(); }

export async function ensureDefaultGabinete(): Promise<string | null> {
  const u = auth.currentUser;
  if (!u) return null;
  const uid = u.uid;
  const email = (u.email || '').trim();
  // Se já existe gabinete com id = uid, nada a fazer
  const ref = doc(db, 'gabinetes', uid);
  const snap = await getDoc(ref).catch(() => null);
  if (snap && snap.exists()) {
    return uid;
  }
  // Se já tem algum gabinete como membro, não criar default
  try {
    const q = query(collection(db, 'gabinetes'), where('memberUids', 'array-contains', uid));
    const s = await getDocs(q).catch(() => null);
    if (s && !s.empty) return s.docs[0].id;
  } catch {}
  // Criar default com id = uid (preserva path legado gabinete/{uid})
  const nome = u.displayName ? `Gabinete de ${u.displayName}` : email ? `Gabinete de ${email.split('@')[0]}` : 'Meu Gabinete';
  const now = Date.now();
  const payload: GabineteMeta = {
    id: uid,
    nome,
    ownerUid: uid,
    ownerEmail: email,
    createdAt: now,
    updatedAt: now,
    memberUids: [uid],
    members: { [uid]: { role: 'admin', addedAt: now, email } },
    inviteEmails: [],
    invites: [],
  };
  await setDoc(ref, payload as any).catch(() => {});
  return uid;
}

export async function createGabinete(nome: string, nif?: string): Promise<string> {
  const u = auth.currentUser;
  if (!u) throw new Error('Não autenticado');
  const id = newGabineteId();
  const now = Date.now();
  const email = (u.email || '').trim();
  const payload: GabineteMeta = {
    id,
    nome: nome.trim() || 'Novo Gabinete',
    nif: nif?.trim() || undefined,
    ownerUid: u.uid,
    ownerEmail: email,
    createdAt: now,
    updatedAt: now,
    memberUids: [u.uid],
    members: { [u.uid]: { role: 'admin', addedAt: now, email } },
    inviteEmails: [],
    invites: [],
  };
  await setDoc(doc(db, 'gabinetes', id), payload as any);
  return id;
}

export async function listMyGabinetes(): Promise<{ meus: GabineteMeta[]; convites: GabineteMeta[] }> {
  const u = auth.currentUser;
  if (!u) return { meus: [], convites: [] };
  const uid = u.uid;
  const emailLc = normalizeEmail(u.email || '');
  let meus: GabineteMeta[] = [];
  let convites: GabineteMeta[] = [];

  try {
    const q1 = query(collection(db, 'gabinetes'), where('memberUids', 'array-contains', uid));
    const s1 = await getDocs(q1);
    meus = s1.docs.map(d => d.data() as GabineteMeta);
  } catch (e) {
    console.warn('[gabinetes] list membros falhou', e);
  }

  // Convites pendentes: onde inviteEmails contém o meu email e eu ainda não sou membro
  if (emailLc) {
    try {
      const q2 = query(collection(db, 'gabinetes'), where('inviteEmails', 'array-contains', emailLc));
      const s2 = await getDocs(q2);
      const all = s2.docs.map(d => d.data() as GabineteMeta);
      // filtra os que já sou membro (evita duplicar)
      const meusIds = new Set(meus.map(g => g.id));
      convites = all.filter(g => !meusIds.has(g.id));
    } catch (e) {
      console.warn('[gabinetes] list convites falhou', e);
    }
  }

  // ordenar: mais recente primeiro
  meus.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  convites.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return { meus, convites };
}

export async function acceptInvite(gabineteId: string): Promise<void> {
  const u = auth.currentUser;
  if (!u) throw new Error('Não autenticado');
  const emailLc = normalizeEmail(u.email || '');
  const ref = doc(db, 'gabinetes', gabineteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Gabinete não encontrado');
  const data = snap.data() as GabineteMeta;
  const invite = data.invites?.find(i => normalizeEmail(i.email) === emailLc);
  const role: GabineteRole = (invite?.role as GabineteRole) || 'contabilista';
  // adiciona membro e remove convite
  await updateDoc(ref, {
    memberUids: arrayUnion(u.uid),
    [`members.${u.uid}`]: { role, addedAt: Date.now(), email: u.email || '' },
    inviteEmails: arrayRemove(emailLc),
    updatedAt: Date.now(),
  } as any).catch(async () => {
    // fallback se campo não existir
    await setDoc(ref, {
      memberUids: [...(data.memberUids || []), u.uid],
      members: { ...(data.members || {}), [u.uid]: { role, addedAt: Date.now(), email: u.email || '' } },
      inviteEmails: (data.inviteEmails || []).filter(e => e !== emailLc),
      invites: (data.invites || []).filter(i => normalizeEmail(i.email) !== emailLc),
      updatedAt: Date.now(),
    } as any, { merge: true });
  });
  // também limpar invites array
  try {
    const fresh = await getDoc(ref);
    const d = fresh.data() as GabineteMeta;
    const filtered = (d.invites || []).filter(i => normalizeEmail(i.email) !== emailLc);
    if (filtered.length !== (d.invites || []).length) {
      await updateDoc(ref, { invites: filtered } as any);
    }
  } catch {}
}

export async function declineInvite(gabineteId: string): Promise<void> {
  const u = auth.currentUser;
  if (!u) throw new Error('Não autenticado');
  const emailLc = normalizeEmail(u.email || '');
  const ref = doc(db, 'gabinetes', gabineteId);
  await updateDoc(ref, {
    inviteEmails: arrayRemove(emailLc),
    updatedAt: Date.now(),
  } as any).catch(() => {});
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const d = snap.data() as GabineteMeta;
      const filtered = (d.invites || []).filter(i => normalizeEmail(i.email) !== emailLc);
      await updateDoc(ref, { invites: filtered } as any).catch(() => {});
    }
  } catch {}
}

export async function inviteToGabinete(gabineteId: string, email: string, role: GabineteRole = 'contabilista'): Promise<void> {
  const u = auth.currentUser;
  if (!u) throw new Error('Não autenticado');
  const emailLc = normalizeEmail(email);
  if (!emailLc.includes('@')) throw new Error('Email inválido');
  const ref = doc(db, 'gabinetes', gabineteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Gabinete não encontrado');
  const data = snap.data() as GabineteMeta;
  // só membros podem convidar
  if (!data.memberUids?.includes(u.uid) && data.ownerUid !== u.uid) throw new Error('Sem permissão');
  await updateDoc(ref, {
    inviteEmails: arrayUnion(emailLc),
    invites: arrayUnion({ email: emailLc, role, invitedAt: Date.now(), invitedBy: u.uid, invitedByEmail: u.email || '' }),
    updatedAt: Date.now(),
  } as any).catch(async () => {
    await setDoc(ref, {
      inviteEmails: [...(data.inviteEmails || []), emailLc],
      invites: [...(data.invites || []), { email: emailLc, role, invitedAt: Date.now(), invitedBy: u.uid, invitedByEmail: u.email || '' }],
      updatedAt: Date.now(),
    } as any, { merge: true });
  });
}

export async function getGabineteMeta(id: string): Promise<GabineteMeta | null> {
  const snap = await getDoc(doc(db, 'gabinetes', id)).catch(() => null);
  if (!snap || !snap.exists()) return null;
  return snap.data() as GabineteMeta;
}
