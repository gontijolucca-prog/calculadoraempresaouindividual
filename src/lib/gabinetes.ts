/**
 * Multi-gabinete — membership, credenciais da equipa e gabinete ativo.
 * Cada utilizador pode ter vários gabinetes: os que criou e os que lhe
 * deram acesso. Ao fazer login aparece o selector dos seus gabinetes.
 * Dados do Gabinete vivem em `gabinete/{gabineteId}/...`  (gabineteId = id do doc em `gabinetes`)
 * Legado: gabinete/{uid} continua válido — o gabinete default tem id = uid para não migrar dados.
 */
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { withTimeout } from './withTimeout';
import { loadFromStorage, saveToStorage, clearStorage } from './storage';

export type GabineteRoleBase = 'admin' | 'contabilista' | 'estagiaria';
export type GabineteRole = GabineteRoleBase | `custom:${string}`;

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
  /** Cargos personalizados do gabinete: id → { nome, permissoes }. */
  customRoles?: Record<string, { nome: string; permissoes: string[]; createdAt?: number; createdBy?: string }>;
  /** Campos legados: existem apenas até à migração e nunca são criados de novo. */
  inviteEmails?: string[];
  invites?: Array<{ email: string; role: GabineteRole; invitedAt: number; invitedBy: string; invitedByEmail: string; token?: string; expira?: number }>;
  inviteRoles?: Record<string, GabineteRole>;
  inviteExpiries?: Record<string, number>;
}

const FORCE_SELECTOR_KEY = 'gabinete:forceSelector';
const ACTIVE_KEY = 'gabinete:activeId';
let activeGabineteRuntime: string | null = null;
function perUidKey(uid: string) { return `gabinete:activeId:${uid}`; }

export function getActiveGabineteId(): string | null {
  if (activeGabineteRuntime) return activeGabineteRuntime;
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
  activeGabineteRuntime = id;
  const uid = auth.currentUser?.uid;
  if (uid) saveToStorage(perUidKey(uid), id);
  saveToStorage(ACTIVE_KEY, id);
  clearStorage(FORCE_SELECTOR_KEY);
  saveToStorage('gabinete:officeId', id); // legacy
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('estudo360:gabinete-switch', { detail: { id } } as any));
  }
}

export function clearActiveGabineteId() {
  activeGabineteRuntime = null;
  const uid = auth.currentUser?.uid;
  if (uid) clearStorage(perUidKey(uid));
  clearStorage(ACTIVE_KEY);
  clearStorage('gabinete:officeId');
}

/** Volta à lista de gabinetes: limpa o gabinete ativo e recarrega para abrir o selector. */
export function clearActiveGabineteAndReload() {
  try {
    // Marca que o utilizador quer VER o selector (não ser re-encaixado no
    // gabinete anterior pelo auto-join quando só existe um).
    saveToStorage(FORCE_SELECTOR_KEY, true);
    clearActiveGabineteId();
  } catch {
    try {
      localStorage.removeItem('estudo360:v1:gabinete:activeId');
      localStorage.removeItem('estudo360:v1:gabinete:officeId');
    } catch { /* noop */ }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('estudo360:gabinete-switch', { detail: { id: null } } as any));
    window.location.reload();
  }
}

export function isForceSelector(): boolean {
  try { return loadFromStorage<boolean>(FORCE_SELECTOR_KEY, false) === true; } catch { return false; }
}
export function clearForceSelector(): void { clearStorage(FORCE_SELECTOR_KEY); }

function newGabineteId(): string {
  return `gab_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

function normalizeEmail(e: string) { return e.trim().toLowerCase(); }

async function employeeGabineteClaim(): Promise<string | null> {
  const u = auth.currentUser;
  if (!u) return null;
  try {
    const token = await u.getIdTokenResult();
    const claims = token.claims as Record<string, unknown>;
    return claims.employeeOnly === true && typeof claims.gabineteId === 'string'
      ? claims.gabineteId
      : null;
  } catch {
    return null;
  }
}

export async function ensureDefaultGabinete(): Promise<string | null> {
  const u = auth.currentUser;
  if (!u) return null;
  const employeeGabineteId = await employeeGabineteClaim();
  if (employeeGabineteId) {
    setActiveGabineteId(employeeGabineteId);
    return employeeGabineteId;
  }
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
  };
  await setDoc(ref, payload as any);
  return uid;
}

export async function createGabinete(nome: string, nif?: string): Promise<string> {
  const u = auth.currentUser;
  if (!u) throw new Error('Não autenticado');
  if (await employeeGabineteClaim()) {
    throw new Error('O acesso de colaborador não pode criar gabinetes.');
  }
  const id = newGabineteId();
  const now = Date.now();
  const email = (u.email || '').trim();
  const payload: GabineteMeta = {
    id,
    nome: nome.trim() || 'Novo Gabinete',
    ownerUid: u.uid,
    ownerEmail: email,
    createdAt: now,
    updatedAt: now,
    memberUids: [u.uid],
    members: { [u.uid]: { role: 'admin', addedAt: now, email } },
  };
  // NIF é opcional: campo ausente, nunca `undefined` (o setDoc rebenta com undefined)
  const nifTrim = nif?.trim();
  if (nifTrim) payload.nif = nifTrim;
  await setDoc(doc(db, 'gabinetes', id), payload as any);
  return id;
}

export async function listMyGabinetes(): Promise<{ meus: GabineteMeta[]; erro?: boolean }> {
  const u = auth.currentUser;
  if (!u) return { meus: [], erro: true };
  const uid = u.uid;
  let meus: GabineteMeta[] = [];
  let erro = false;

  try {
    const q1 = query(collection(db, 'gabinetes'), where('memberUids', 'array-contains', uid));
    const s1 = await getDocs(q1);
    meus = s1.docs.map(d => ({ ...(d.data() as GabineteMeta), id: d.id }));
  } catch (e) {
    erro = true;
    console.warn('[gabinetes] list membros falhou', e);
  }

  // ordenar: mais recente primeiro
  meus.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return { meus, erro };
}

/** Revoga o acesso de um membro (o dono nunca sai). Usado como fallback legado. */
export async function removeFromGabinete(gabineteId: string, email: string, uid?: string): Promise<void> {
  const u = auth.currentUser;
  if (!u) throw new Error('Não autenticado');
  const emailLc = normalizeEmail(email);
  const ref = doc(db, 'gabinetes', gabineteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return;
  }
  const data = snap.data() as GabineteMeta;
  if ((uid && data.ownerUid === uid) || normalizeEmail(data.ownerEmail || '') === emailLc) {
    throw new Error('O dono do gabinete não pode ser removido.');
  }
  const members: Record<string, unknown> = { ...(data.members || {}) };
  const removidos = new Set<string>();
  if (uid) { removidos.add(uid); delete members[uid]; }
  for (const [k, v] of Object.entries(members)) {
    const em = normalizeEmail((v as { email?: string } | undefined)?.email || '');
    if (k !== data.ownerUid && em && em === emailLc) { removidos.add(k); delete members[k]; }
  }
  // updateDoc substitui os campos por inteiro — o merge do setDoc deixaria
  // ficar o membro antigo dentro de `members`.
  await updateDoc(ref, {
    // Remove todos os uids identificados (por uid e/ou por email), nunca o dono.
    memberUids: (data.memberUids || []).filter(x => x === data.ownerUid || !removidos.has(x)),
    inviteEmails: (data.inviteEmails || []).filter(e => e !== emailLc),
    invites: (data.invites || []).filter(i => normalizeEmail(i.email) !== emailLc),
    inviteRoles: Object.fromEntries(Object.entries(data.inviteRoles || {}).filter(([email]) => normalizeEmail(email) !== emailLc)),
    inviteExpiries: Object.fromEntries(Object.entries(data.inviteExpiries || {}).filter(([email]) => normalizeEmail(email) !== emailLc)),
    members,
    updatedAt: Date.now(),
  } as any);
}

// Cache curta do documento do gabinete: a mesma meta era lida várias vezes
// por ecrã (cargo, equipa, topo), consumindo leituras sem necessidade.
const metaCache = new Map<string, { at: number; meta: GabineteMeta | null }>();
const META_TTL_MS = 15_000;

export function clearGabineteMemoryCache(): void {
  metaCache.clear();
  void import('./permissions').then((m) => m.setCustomRolesCache({})).catch(() => {});
}

export async function getGabineteMeta(id: string, opts?: { force?: boolean }): Promise<GabineteMeta | null> {
  const cached = metaCache.get(id);
  if (!opts?.force && cached && Date.now() - cached.at < META_TTL_MS) {
    try { const { setCustomRolesCache } = await import('./permissions'); setCustomRolesCache(cached.meta?.customRoles || {}); } catch {}
    return cached.meta;
  }
  const snap = await withTimeout(getDoc(doc(db, 'gabinetes', id)), 5000, 'gabinete').catch(() => null);
  if (!snap || !snap.exists()) { metaCache.set(id, { at: Date.now(), meta: null }); return null; }
  const meta = snap.data() as GabineteMeta;
  metaCache.set(id, { at: Date.now(), meta });
  // Mantém a matriz de permissões a par dos cargos personalizados deste gabinete.
  try {
    const { setCustomRolesCache } = await import('./permissions');
    setCustomRolesCache(meta.customRoles || {});
  } catch { /* sem cache: os cargos base continuam a funcionar */ }
  return meta;
}


/** Atualiza o cargo de um colaborador ativo. */
export async function atualizarCargoColaborador(gabineteId: string, email: string, role: GabineteRole, uid?: string): Promise<void> {
  const u = auth.currentUser;
  if (!u) throw new Error('Não autenticado');
  const emailLc = normalizeEmail(email);
  const ref = doc(db, 'gabinetes', gabineteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as GabineteMeta;
  if ((uid && data.ownerUid === uid) || normalizeEmail(data.ownerEmail || '') === emailLc) {
    throw new Error('O cargo do dono do gabinete não pode ser alterado.');
  }
  const members: Record<string, { role: GabineteRole; addedAt: number; email: string }> = { ...(data.members || {}) };
  let alterado = false;
  for (const [k, v] of Object.entries(members)) {
    const mesmoUid = !!uid && k === uid;
    const mesmoEmail = normalizeEmail(v?.email || '') === emailLc;
    if (membroEhDono(k, data) === false && (mesmoUid || mesmoEmail)) {
      members[k] = { ...v, role };
      alterado = true;
    }
  }
  if (!alterado) return;
  await updateDoc(ref, { members, updatedAt: Date.now() } as any);
}

function membroEhDono(uid: string, data: GabineteMeta): boolean {
  return uid === data.ownerUid;
}

// ——— Revogações de acesso em atraso ————————————————————————————————
// Se o servidor não confirmar a remoção (quota/rede), guardamos o pedido e
// repetimos automaticamente; caso contrário a pessoa continuaria com acesso.
export interface RevogacaoPendente {
  gabineteId: string;
  email: string;
  uid?: string;
  criadoEm: number;
}

const REVOGACOES_KEY = 'revogacoes-pendentes';

export function listarRevogacoesPendentes(): RevogacaoPendente[] {
  return loadFromStorage<RevogacaoPendente[]>(REVOGACOES_KEY, []) ?? [];
}

export function enfileirarRevogacao(gabineteId: string, email: string, uid?: string): void {
  const emailLc = normalizeEmail(email);
  const atuais = listarRevogacoesPendentes().filter((r) => !(r.gabineteId === gabineteId && normalizeEmail(r.email) === emailLc));
  atuais.push({ gabineteId, email: emailLc, uid, criadoEm: Date.now() });
  saveToStorage(REVOGACOES_KEY, atuais);
}

/** Tenta concluir as revogações pendentes. Devolve quantas ficaram pendentes. */
export async function processarRevogacoesPendentes(): Promise<number> {
  const pendentes = listarRevogacoesPendentes();
  if (pendentes.length === 0) return 0;
  const restantes: RevogacaoPendente[] = [];
  for (const r of pendentes) {
    try {
      await removeFromGabinete(r.gabineteId, r.email, r.uid);
    } catch {
      restantes.push(r);
    }
  }
  saveToStorage(REVOGACOES_KEY, restantes);
  return restantes.length;
}

// ——— Cargos personalizados: gravação com repetição ——————————————————
export type CargoCustom = { nome: string; permissoes: string[]; createdAt?: number; createdBy?: string };
export type CargosCustom = Record<string, CargoCustom>;

const CARGOS_PEND_KEY = 'cargos-pendentes';

function lerCargosPendentes(): Record<string, CargosCustom> {
  return loadFromStorage<Record<string, CargosCustom>>(CARGOS_PEND_KEY, {}) ?? {};
}

/** Cargos que ainda não chegaram ao servidor para este gabinete (se houver). */
export function cargosPendentesDe(gabineteId: string): CargosCustom | null {
  return lerCargosPendentes()[gabineteId] || null;
}

/** Grava o mapa completo de cargos; se falhar, guarda para repetir depois. */
export async function guardarCargos(gabineteId: string, cargos: CargosCustom): Promise<boolean> {
  try {
    await withTimeout(updateDoc(doc(db, 'gabinetes', gabineteId), { customRoles: cargos, updatedAt: Date.now() } as any), 6000, 'cargos');
    const pend = lerCargosPendentes();
    delete pend[gabineteId];
    saveToStorage(CARGOS_PEND_KEY, pend);
    return true;
  } catch {
    const pend = lerCargosPendentes();
    pend[gabineteId] = cargos;
    saveToStorage(CARGOS_PEND_KEY, pend);
    return false;
  }
}

/** Repete as gravações de cargos pendentes; devolve quantos gabinetes falharam. */
export async function processarCargosPendentes(): Promise<number> {
  const pend = lerCargosPendentes();
  const ids = Object.keys(pend);
  if (ids.length === 0) return 0;
  let falhas = 0;
  for (const id of ids) {
    try {
      await withTimeout(updateDoc(doc(db, 'gabinetes', id), { customRoles: pend[id], updatedAt: Date.now() } as any), 6000, 'cargos');
      delete pend[id];
    } catch { falhas++; }
  }
  saveToStorage(CARGOS_PEND_KEY, pend);
  return falhas;
}
