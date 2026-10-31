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
  inviteEmails: string[]; // lowercased
  invites: Array<{ email: string; role: GabineteRole; invitedAt: number; invitedBy: string; invitedByEmail: string; token?: string; expira?: number }>;
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

/** Volta à lista de gabinetes: limpa o gabinete ativo e recarrega para abrir o selector. */
export function clearActiveGabineteAndReload() {
  try {
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
    ownerUid: u.uid,
    ownerEmail: email,
    createdAt: now,
    updatedAt: now,
    memberUids: [u.uid],
    members: { [u.uid]: { role: 'admin', addedAt: now, email } },
    inviteEmails: [],
    invites: [],
  };
  // NIF é opcional: campo ausente, nunca `undefined` (o setDoc rebenta com undefined)
  const nifTrim = nif?.trim();
  if (nifTrim) payload.nif = nifTrim;
  await setDoc(doc(db, 'gabinetes', id), payload as any);
  return id;
}

export async function listMyGabinetes(): Promise<{ meus: GabineteMeta[]; convites: GabineteMeta[]; erro?: boolean }> {
  const u = auth.currentUser;
  if (!u) return { meus: [], convites: [], erro: true };
  const uid = u.uid;
  const emailLc = normalizeEmail(u.email || '');
  let meus: GabineteMeta[] = [];
  let convites: GabineteMeta[] = [];
  let erro = false;

  try {
    const q1 = query(collection(db, 'gabinetes'), where('memberUids', 'array-contains', uid));
    const s1 = await getDocs(q1);
    meus = s1.docs.map(d => ({ ...(d.data() as GabineteMeta), id: d.id }));
  } catch (e) {
    erro = true;
    console.warn('[gabinetes] list membros falhou', e);
  }

  // Convites pendentes: onde inviteEmails contém o meu email e eu ainda não sou membro
  if (emailLc) {
    try {
      const q2 = query(collection(db, 'gabinetes'), where('inviteEmails', 'array-contains', emailLc));
      const s2 = await getDocs(q2);
      const all = s2.docs.map(d => ({ ...(d.data() as GabineteMeta), id: d.id }));
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
  return { meus, convites, erro };
}

export async function acceptInvite(gabineteId: string): Promise<void> {
  const u = auth.currentUser;
  if (!u) throw new Error('Não autenticado');
  const emailLc = normalizeEmail(u.email || '');
  const ref = doc(db, 'gabinetes', gabineteId);
  const snap = await withTimeout(getDoc(ref), 6000, 'gabinete').catch(() => null);
  if (!snap || !snap.exists()) throw new Error('Gabinete não encontrado');
  const data = snap.data() as GabineteMeta;
  const invite = data.invites?.find(i => normalizeEmail(i.email) === emailLc);
  // As regras só permitem auto-adesão como contabilista/estagiária/cargo
  // personalizado (nunca admin). Um convite admin entra como contabilista e o
  // dono promove depois na Equipa.
  const role: GabineteRole = (invite?.role as GabineteRole) === 'admin' ? 'contabilista' : ((invite?.role as GabineteRole) || 'contabilista');
  // adiciona membro e remove convite
  await withTimeout(updateDoc(ref, {
    memberUids: arrayUnion(u.uid),
    [`members.${u.uid}`]: { role, addedAt: Date.now(), email: u.email || '' },
    inviteEmails: arrayRemove(emailLc),
    updatedAt: Date.now(),
  } as any), 6000, 'aceitar convite').catch(async () => {
    // fallback se campo não existir
    await setDoc(ref, {
      memberUids: [...(data.memberUids || []), u.uid],
      members: { ...(data.members || {}), [u.uid]: { role, addedAt: Date.now(), email: u.email || '' } },
      inviteEmails: (data.inviteEmails || []).filter(e => e !== emailLc),
      invites: (data.invites || []).filter(i => normalizeEmail(i.email) !== emailLc),
      updatedAt: Date.now(),
    } as any, { merge: true });
  });
  // Confirmar no servidor: sem isto a app entrava num gabinete onde as regras
  // ainda não reconhecem o membro (tudo dava 403 depois, em silêncio).
  const confirmacao = await getDoc(ref).catch(() => null);
  const metaFinal = confirmacao?.data() as GabineteMeta | undefined;
  const eMembro = !!metaFinal && (metaFinal.ownerUid === u.uid || (metaFinal.memberUids || []).includes(u.uid));
  if (!eMembro) {
    throw new Error('O convite não foi aceite no servidor. Peça ao admin do gabinete para o enviar novamente.');
  }

  // Marca o colaborador como ativo (a lista da Equipa deixa de dizer "pendente").
  try {
    const { collection, query, where, getDocs, updateDoc } = await import('firebase/firestore');
    const q = query(collection(db, 'gabinete', gabineteId, 'colaboradores'), where('email', '==', emailLc));
    const snap = await getDocs(q);
    if (snap.empty) {
      const { setDoc: set } = await import('firebase/firestore');
      await set(doc(db, 'gabinete', gabineteId, 'colaboradores', u.uid), {
        id: u.uid, nome: (u.displayName || emailLc.split('@')[0]), email: emailLc, role,
        status: 'ativo', linkedUid: u.uid, createdAt: Date.now(), updatedAt: Date.now(),
      }, { merge: true });
    } else {
      await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { status: 'ativo', linkedUid: u.uid, updatedAt: Date.now() })));
    }
  } catch { /* sem permissão — a aceitação já foi confirmada acima */ }

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

export function novoTokenConvite(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Apaga os documentos públicos `convites/{token}` deste gabinete para um email.
 * Usado ao reenviar (o link antigo deixa de valer) e ao remover da equipa.
 * As regras só deixam apagar a quem convidou; uma falha de permissão/rede nunca
 * bloqueia o fluxo principal.
 */
export async function revokeInviteToken(gabineteId: string, email: string): Promise<void> {
  const emailLc = normalizeEmail(email);
  if (!gabineteId || !emailLc) return;
  try {
    const q = query(
      collection(db, 'convites'),
      where('gabineteId', '==', gabineteId),
      where('email', '==', emailLc),
    );
    const snap = await withTimeout(getDocs(q), 5000, 'convites').catch(() => null);
    if (snap) await Promise.all(snap.docs.map((d) => withTimeout(deleteDoc(d.ref), 4000, 'convite').catch(() => {})));
  } catch (e) {
    console.warn('[gabinetes] revogar convites antigos falhou', e);
  }
}

/** Cria o convite no gabinete e devolve o token para o link/email. */
export class ConviteError extends Error {
  codigo: 'quota' | 'rede' | 'permissao' | 'desconhecido';
  constructor(codigo: ConviteError['codigo'], mensagem: string) { super(mensagem); this.codigo = codigo; }
}
function classificarErroConvite(e: unknown): ConviteError {
  const raw = String((e as { code?: string; message?: string })?.code || (e as Error)?.message || e);
  if (/resource-exhausted|quota/i.test(raw)) return new ConviteError('quota', 'O servidor está sem quota de escrita. Tente novamente depois das 07:00.');
  // O Firestore em backoff (quota/rede) faz a promessa expirar no nosso prazo:
  // isso não é "internet do utilizador".
  if (/tempo esgotado|timeout/i.test(raw)) {
    return new ConviteError('rede', 'O servidor não respondeu a tempo (6 s). Pode ser a quota gratuita esgotada ou a ligação lenta — tente outra vez daqui a pouco.');
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return new ConviteError('rede', 'Está sem ligação à internet. Verifique a rede e tente outra vez.');
  if (/unavailable|network|offline/i.test(raw)) return new ConviteError('rede', 'O servidor não respondeu (pode ser a quota gratuita esgotada ou a rede). Tente outra vez daqui a pouco.');
  if (/permission-denied|insufficient/i.test(raw)) return new ConviteError('permissao', 'A sua conta não tem permissão para convidar neste gabinete.');
  return new ConviteError('desconhecido', 'Não consegui criar o link do convite. Tente outra vez.');
}

export async function inviteToGabinete(gabineteId: string, email: string, role: GabineteRole = 'contabilista', opts?: { link?: boolean }): Promise<{ token: string }> {
  const u = auth.currentUser;
  if (!u) throw new Error('Não autenticado');
  const emailLc = normalizeEmail(email);
  if (!emailLc.includes('@')) throw new Error('Email inválido');
  const ref = doc(db, 'gabinetes', gabineteId);
  const snap = await withTimeout(getDoc(ref), 6000, 'gabinete').catch(() => null);
  if (!snap || !snap.exists()) throw new Error('Gabinete não encontrado');
  const data = snap.data() as GabineteMeta;
  // só membros podem convidar
  if (!data.memberUids?.includes(u.uid) && data.ownerUid !== u.uid) throw new Error('Sem permissão');
  // Reenviar tem de invalidar os links antigos: apaga os docs `convites` deste
  // email antes de criar o novo (o token antigo deixa de abrir a página).
  await revokeInviteToken(gabineteId, emailLc);
  const comLink = opts?.link !== false;
  const token = comLink ? novoTokenConvite() : '';
  const expira = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payloadConvite = {
    gabineteId, gabineteNome: (data as any).nome || '', email: emailLc, role,
    invitedBy: u.uid, invitedByEmail: u.email || '', createdAt: Date.now(), expiresAt: expira,
  };
  // 1) Documento público primeiro (com 2 tentativas). Sem ele o /convite não
  //    pede password, por isso nunca devolvemos um link sem este documento.
  let criado = !comLink;
  for (let tentativa = 1; tentativa <= 2 && !criado; tentativa++) {
    try {
      await withTimeout(setDoc(doc(db, 'convites', token), payloadConvite), 6000, 'link do convite');
      criado = true;
    } catch (e) {
      if (tentativa === 2) throw classificarErroConvite(e);
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
  // 2) Registo no gabinete; se falhar, apaga o documento público (rollback).
  try {
    await withTimeout(updateDoc(ref, {
      inviteEmails: arrayUnion(emailLc),
      invites: arrayUnion({
        email: emailLc, role, invitedAt: Date.now(), invitedBy: u.uid, invitedByEmail: u.email || '', expira,
        ...(token ? { token } : {}),
      }),
      updatedAt: Date.now(),
    } as any), 6000, 'convite');
  } catch (e) {
    if (token) { try { await deleteDoc(doc(db, 'convites', token)); } catch { /* fica órfão; expira em 7 dias */ } }
    throw classificarErroConvite(e);
  }

  return { token };
}

/** Revoga o acesso de um membro/convite (o dono nunca sai). Usado ao remover da equipa. */
export async function removeFromGabinete(gabineteId: string, email: string, uid?: string): Promise<void> {
  const u = auth.currentUser;
  if (!u) throw new Error('Não autenticado');
  const emailLc = normalizeEmail(email);
  const ref = doc(db, 'gabinetes', gabineteId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await revokeInviteToken(gabineteId, emailLc);
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
    members,
    updatedAt: Date.now(),
  } as any);

  // Sem isto o link do convite pendente continuava a funcionar depois de a
  // pessoa ser removida da equipa.
  await revokeInviteToken(gabineteId, emailLc);
}

// Cache curta do documento do gabinete: a mesma meta era lida várias vezes
// por ecrã (cargo, equipa, topo), consumindo leituras sem necessidade.
const metaCache = new Map<string, { at: number; meta: GabineteMeta | null }>();
const META_TTL_MS = 15_000;

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


/** Atualiza o cargo de um colaborador já existente (membro ativo ou convite pendente). */
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
  const invites = (data.invites || []).map(i => normalizeEmail(i.email) === emailLc ? { ...i, role } : i);
  if (!alterado && invites.every(i => normalizeEmail(i.email) !== emailLc)) return;
  await updateDoc(ref, { members, invites, updatedAt: Date.now() } as any);
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
