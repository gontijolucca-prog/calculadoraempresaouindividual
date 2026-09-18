/**
 * Gabinete — camada de gestão reliable + live.
 * Tudo fica sempre gravado: Firestore (live) + IndexedDB cache (offline) + localStorage fallback.
 * Coleções: gabinete/{officeId}/clientes | tarefas | obrigacoes | cofre | documentos | colaboradores
 */
import {
  collection, doc, setDoc, deleteDoc, getDoc, getDocs, writeBatch, onSnapshot,
  query, orderBy, where, serverTimestamp, Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { loadFromStorage, saveToStorage } from './storage';
import type { CofreCipher } from './cofreCrypto';
import { CALENDARIO_FISCAL_2026 } from './calendarioFiscal2026';

// ─── OfficeId (tenant) ───────────────────────────────────────────────────────
export const GABINETE_SHARED_ID = 'shared';
/** Retorna o gabineteId ativo (multi-gabinete) ou o uid legado.
 *  Lê de `gabinetes.ts:ACTIVE_KEY` (por utilizador). Fallback = uid para não quebrar
 *  quem ainda não tem gabinete ativo (legado gabinete/{uid}). */
export function getGabineteOfficeId(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Não autenticado — inicia sessão para aceder ao Gabinete.');
  try {
    const v = loadFromStorage<string | null>('gabinete:activeId:' + uid, null)
           ?? loadFromStorage<string | null>('gabinete:activeId', null)
           ?? loadFromStorage<string | null>('gabinete:officeId', null);
    if (v && typeof v === 'string' && v.length >= 3) return v;
  } catch {}
  return uid;
}
/** Usado só na migração legada shared → uid/gabinete */
export function getGabineteOfficeIdOrShared(): string {
  const uid = auth.currentUser?.uid;
  if (uid) {
    try {
      const v = loadFromStorage<string | null>('gabinete:activeId:' + uid, null)
             ?? loadFromStorage<string | null>('gabinete:activeId', null)
             ?? loadFromStorage<string | null>('gabinete:officeId', null);
      if (v && typeof v === 'string' && v.length >= 3) return v;
    } catch {}
    return uid;
  }
  return (loadFromStorage<string>('gabinete:officeId', GABINETE_SHARED_ID) as string) || GABINETE_SHARED_ID;
}
export function setGabineteOfficeId(id: string) { saveToStorage('gabinete:officeId', id); }

/** Migra uma vez dados legados de gabinete/shared/* para gabinete/{uid}/* */
export async function migrateGabineteSharedToUser(): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const markerKey = `gabinete:migrated:${uid}`;
  if (loadFromStorage<boolean>(markerKey, false)) return;
  try {
    const cols = ['clientes','tarefas','obrigacoes','cofre','colaboradores','conversas','modelos','envios','tempos','actas'];
    for (const col of cols) {
      const snap = await getDocs(collection(db, `gabinete/${GABINETE_SHARED_ID}/${col}`)).catch(()=>null);
      if (!snap || snap.empty) continue;
      // Se o destino já tem dados, não sobrescreve
      const destSnap = await getDocs(collection(db, `gabinete/${uid}/${col}`)).catch(()=>null);
      if (destSnap && !destSnap.empty) continue;
      const batch = writeBatch(db);
      snap.forEach(d => {
        batch.set(doc(db, `gabinete/${uid}/${col}`, d.id), d.data(), { merge: true });
      });
      await batch.commit();
    }
    saveToStorage(markerKey, true);
  } catch (e) {
    console.warn('[gabinete] migração shared→uid falhou:', e);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}
function colPath(col: string): string {
  return `gabinete/${getGabineteOfficeId()}/${col}`;
}
function lsKey(col: string): string { return `gabinete:${getGabineteOfficeId()}:${col}`; }

function readCache<T>(col: string, fallback: T[]): T[] {
  return loadFromStorage<T[]>(lsKey(col), fallback) ?? fallback;
}
function writeCache<T>(col: string, data: T[]): void {
  saveToStorage(lsKey(col), data);
}

/** Remove campos `undefined` (o Firestore rejeita) e serializa valores limpos. */
function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v === undefined) continue;          // Firestore: unsupported field value: undefined
    out[k] = v === null ? '' : (typeof v === 'object' ? sanitizeForFirestore(v) : v);
  }
  return out as T;
}

async function safeSetDoc(path: string, id: string, data: unknown): Promise<void> {
  // Cache local primeiro (optimistic, offline-first)
  // Firestore depois (live)
  try {
    const payload = sanitizeForFirestore({ ...data as object, _updatedAt: Date.now(), _updatedAtServer: serverTimestamp() });
    await setDoc(doc(db, path, id), payload, { merge: true });
    window.dispatchEvent(new CustomEvent('estudo360:cloud-sync', { detail: { ok: true } }));
  } catch (e) {
    console.warn(`[gabinete] setDoc falhou ${path}/${id}:`, e);
    window.dispatchEvent(new CustomEvent('estudo360:cloud-sync', { detail: { ok: false, reason: String(e) } }));
    // Mesmo sem rede, o cache já tem o dado — o sync volta a tentar quando houver snapshot
    throw e;
  }
}
async function safeDeleteDoc(path: string, id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, path, id));
    window.dispatchEvent(new CustomEvent('estudo360:cloud-sync', { detail: { ok: true } }));
  } catch (e) {
    console.warn(`[gabinete] deleteDoc falhou ${path}/${id}:`, e);
    window.dispatchEvent(new CustomEvent('estudo360:cloud-sync', { detail: { ok: false, reason: String(e) } }));
    throw e;
  }
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

// ─── Contactos de Quadros ──────────────────────────────────────────────────
export interface ContactoQuadro {
  id: string;
  nome: string;
  cargo?: string; // ex: Gerente, TOC, Administrativo
  email?: string;
  telefone?: string;
  nif?: string;
  principal?: boolean;
}

// Cliente 360 — espelho leve do EmpresaRecord + gestão
export type ClienteEstado = 'ativo' | 'arquivado';
export type ClienteRegimeIva = 'isencao53' | 'trimestral' | 'mensal';
export type ClienteTipoEntidade = 'ENI' | 'LDA' | 'UNIPESSOAL' | 'OUTRO';
export interface GabineteCliente {
  id: string;
  nome: string;
  nif: string; // 9 dígitos
  email?: string;
  telefone?: string;
  tipoEntidade: ClienteTipoEntidade;
  regimeIva: ClienteRegimeIva;
  regimeContab?: 'simplificado' | 'organizada' | 'nao_aplicavel';
  territorio?: 'continente' | 'madeira' | 'acores';
  municipio?: string;
  caes?: string;
  caeDescricao?: string;
  regimeIrc?: 'geral' | 'simplificado' | 'transparencia';
  tipoSociedade?: string;
  gerentes?: string[];
  nrTrabalhadores?: number;
  inicioAtividade?: number;
  responsavelInterno?: { nome: string; initials: string };
  apoioAdministrativo?: { nome: string; initials: string };
  supervisor?: { nome: string; initials: string };
  orientacoes?: string;
  situacaoAtual?: { texto: string; cor: 'red' | 'green' | 'orange' }[];
  faturacaoAnual?: number;
  responsavelId?: string; // colaborador
  apoioId?: string;
  supervisorId?: string;
  estado: ClienteEstado;
  tags?: string[];
  empresaId?: string; // link para EmpresaRecord existente
  observacoes?: string;
  // Fase 1 — novos campos
  contactos?: ContactoQuadro[];
  alertas?: {
    iuc?: number; // ms timestamp do próximo vencimento
    imi?: number;
    seguros?: number;
    certidaoPermanente?: number;
  };
  projectos?: string[];
  avencaMensal?: number;
  avencaPeriodicidade?: 'mensal' | 'trimestral' | 'anual';
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
}

// ——— Visão Geral — novas coleções por cliente ———
export interface ContactoGabinete {
  id: string;
  clienteId: string;
  clienteNome?: string;
  nome: string;
  cargo?: string;
  telefone?: string;
  email?: string;
  initials?: string;
  isGerente?: boolean;
  createdAt: number;
  updatedAt: number;
}
export interface AssuntoGabinete {
  id: string;
  clienteId: string;
  clienteNome?: string;
  titulo: string;
  estado: 'em_curso' | 'aguard_cliente' | 'pendente' | 'concluido';
  updatedAt: number;
  descricao?: string;
  createdAt: number;
}
export interface AlertaGabinete {
  id: string;
  clienteId: string;
  clienteNome?: string;
  texto: string;
  createdAt: number;
  updatedAt: number;
}
export interface OcorrenciaGabinete {
  id: string;
  clienteId: string;
  clienteNome?: string;
  data: number;
  autorNome: string;
  autorInitials: string;
  descricao: string;
  createdAt: number;
}

// Tarefa / Obrigação
export type TarefaEstado = 'todo' | 'doing' | 'done' | 'atrasada';
export type TarefaTipo = 'tarefa' | 'obrigacao' | 'lembrete';
export type TarefaPrioridade = 'baixa' | 'media' | 'alta' | 'urgente';
export interface Tarefa {
  id: string;
  titulo: string;
  descricao?: string;
  tipo: TarefaTipo;
  estado: TarefaEstado;
  prioridade: TarefaPrioridade;
  clienteId?: string;
  clienteNome?: string;
  responsavelId?: string;
  responsavelNome?: string;
  dataVencimento?: number; // ms
  dataConclusao?: number;
  recorrencia?: 'unica' | 'mensal' | 'trimestral' | 'anual';
  origem: 'manual' | 'obrigacao_auto';
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
  /** Tarefa concluída movida para o arquivo (desaparece do kanban). */
  arquivada?: boolean;
  // compat: campo antigo
  tags?: string[];
}

// Obrigação fiscal — catálogo + instância por cliente/periodo
export type ObrigacaoEstado = 'pendente' | 'entregue' | 'atrasada' | 'dispensada';
export type ObrigacaoTipo = 'iva' | 'ppc' | 'ies' | 'modelo22' | 'ss' | 'retencao' | 'dossier' | 'outro';
export interface Obrigacao {
  id: string;
  tipo: ObrigacaoTipo;
  titulo: string; // ex: "IVA Julho 2026"
  descricao?: string;
  clienteId: string;
  clienteNome?: string;
  periodo: string; // "2026-07" ou "2026"
  vencimento: number; // ms
  estado: ObrigacaoEstado;
  tarefaId?: string; // link para tarefa gerada
  /** Obrigações importadas do calendário anual nacional são referência
   *  transversal, não pertencem a um cliente específico. */
  origem?: 'cliente' | 'calendario_fiscal';
  createdAt: number;
  updatedAt: number;
}

// Cofre — zero-knowledge
export type CofreCategoria = 'AT' | 'SS' | 'BANCO' | 'EMAIL' | 'EFATURA' | 'OUTRO';
export interface CofreEntrada {
  id: string;
  titulo: string; // ex: "AT - Recofatima"
  categoria: CofreCategoria;
  clienteId?: string;
  clienteNome?: string;
  username?: string;
  url?: string;
  notas?: string;
  // segredo — guardado em claro, visível só pela tua conta (gabinete/{uid}/cofre/*)
  segredo?: string;
  // legado: entradas antigas cifradas (antes do cofre simples)
  cipher?: CofreCipher;
  // audit sem expor segredo
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
  lastViewedAt?: number;
  lastViewedBy?: string;
  viewCount?: number;
}

// Colaborador
export type ColaboradorRole = 'admin' | 'contabilista' | 'estagiaria';
export interface Colaborador {
  id: string; // uid ou local id
  nome: string;
  email: string;
  role: ColaboradorRole;
  cor?: string;
  avatar?: string;
  initials?: string;
  status?: 'convite_pendente' | 'ativo';
  inviteSentAt?: number;
  linkedUid?: string;
  updatedAt?: number;
  createdAt: number;
}

// Documento meta (ficheiro vai para Storage)
export interface GabineteDocumento {
  id: string;
  clienteId: string;
  clienteNome?: string;
  nome: string;
  tipo: 'SAFT' | 'IES' | 'MODELO22' | 'CONTRATO' | 'OUTRO';
  storagePath?: string;
  tamanho?: number;
  versao?: number;
  dataUpload: number;
  uploadedBy?: string;
}

// Histórico de Conversação — Fase 1
export type ConversaTipo = 'nota' | 'chamada' | 'reuniao' | 'email' | 'outro';
export interface Conversa {
  id: string;
  clienteId: string;
  clienteNome?: string;
  tipo: ConversaTipo;
  titulo: string;
  conteudo?: string;
  data: number; // quando aconteceu
  autor?: string;
  createdAt: number;
  updatedAt: number;
}

// ─── CRUD — Clientes ─────────────────────────────────────────────────────────
export function listClientesCache(): GabineteCliente[] { return readCache<GabineteCliente>('clientes', []); }
export function saveClientesCache(list: GabineteCliente[]): void { writeCache('clientes', list); }

export async function upsertCliente(c: GabineteCliente): Promise<GabineteCliente> {
  const list = listClientesCache();
  const idx = list.findIndex(x => x.id === c.id);
  const next = { ...c, updatedAt: Date.now() };
  if (idx >= 0) list[idx] = next; else list.push(next);
  saveClientesCache(list);
  try { await safeSetDoc(colPath('clientes'), c.id, next); } catch { /* cache já tem */ }
  return next;
}
export async function deleteCliente(id: string): Promise<void> {
  const list = listClientesCache().filter(x => x.id !== id);
  saveClientesCache(list);
  try { await safeDeleteDoc(colPath('clientes'), id); } catch {}
}
export function newClienteId(): string { return newId('cli'); }

// ─── CRUD — Tarefas ──────────────────────────────────────────────────────────
export function listTarefasCache(): Tarefa[] { return readCache<Tarefa>('tarefas', []); }
export function saveTarefasCache(list: Tarefa[]): void { writeCache('tarefas', list); }

export async function upsertTarefa(t: Tarefa): Promise<Tarefa> {
  const list = listTarefasCache();
  const idx = list.findIndex(x => x.id === t.id);
  const next = { ...t, updatedAt: Date.now() };
  // auto-atrasada
  if (next.estado !== 'done' && next.dataVencimento && next.dataVencimento < Date.now() - 1000 * 60 * 60 * 24) {
    // só marca atrasada se já passou 1 dia e não foi concluída
    // (mantém tipo mas estado visual passa a atrasada)
  }
  if (idx >= 0) list[idx] = next; else list.unshift(next);
  saveTarefasCache(list);
  try { await safeSetDoc(colPath('tarefas'), t.id, next); } catch {}
  return next;
}
export async function deleteTarefa(id: string): Promise<void> {
  const list = listTarefasCache().filter(x => x.id !== id);
  saveTarefasCache(list);
  try { await safeDeleteDoc(colPath('tarefas'), id); } catch {}
}
export async function marcarTarefaFeita(id: string, done = true): Promise<void> {
  const list = listTarefasCache();
  const t = list.find(x => x.id === id);
  if (!t) return;
  await upsertTarefa({ ...t, estado: done ? 'done' : 'todo', dataConclusao: done ? Date.now() : undefined });
}
export function newTarefaId(): string { return newId('tar'); }

// ─── CRUD — Obrigações ───────────────────────────────────────────────────────
export function listObrigacoesCache(): Obrigacao[] { return readCache<Obrigacao>('obrigacoes', []); }
export function saveObrigacoesCache(list: Obrigacao[]): void { writeCache('obrigacoes', list); }
export async function upsertObrigacao(o: Obrigacao): Promise<Obrigacao> {
  const list = listObrigacoesCache();
  const idx = list.findIndex(x => x.id === o.id);
  const next = { ...o, updatedAt: Date.now() };
  if (idx >= 0) list[idx] = next; else list.push(next);
  saveObrigacoesCache(list);
  try { await safeSetDoc(colPath('obrigacoes'), o.id, next); } catch {}
  return next;
}
export async function deleteObrigacao(id: string): Promise<void> {
  const list = listObrigacoesCache().filter(x => x.id !== id);
  saveObrigacoesCache(list);
  try { await safeDeleteDoc(colPath('obrigacoes'), id); } catch {}
}
export function newObrigacaoId(): string { return newId('obr'); }

// ─── Calendário fiscal anual ─────────────────────────────────────────────────
// As obrigações do ficheiro ICS são referências nacionais/transversais: não
// pertencem a uma empresa e não devem ser confundidas com uma obrigação
// operacional gerada para um cliente. Ficam na mesma coleção para aparecerem
// na Agenda existente, mas com origem própria e sem ações "Entregue/Dispensar".
const CALENDARIO_FISCAL_CLIENTE_ID = '__calendario_fiscal_2026__';
const CALENDARIO_FISCAL_MARKER_ID = 'calendario-fiscal-2026';
const CALENDARIO_FISCAL_VERSION = 1;

/**
 * Semeia, uma vez, as 312 obrigações CF_ de 2026 no Gabinete. Os IDs são
 * determinísticos, por isso a operação é idempotente. O marker evita 312
 * escritas em cada arranque; a batch (312 + marker = 313 writes) cabe no
 * limite de 500 operações do Firestore.
 *
 * O cache local é preenchido primeiro para a Agenda funcionar offline. Se a
 * rede falhar, a próxima abertura tenta novamente até o marker ficar gravado.
 */
export async function seedCalendarioFiscal2026(): Promise<void> {
  const now = Date.now();
  const current = listObrigacoesCache();
  const currentIds = new Set(current.map((item) => item.id));
  const allRecords: (Obrigacao & { _updatedAt: number })[] = CALENDARIO_FISCAL_2026.map((event) => ({
    id: event.id,
    tipo: event.tipo,
    titulo: event.titulo,
    descricao: 'Referência do calendário fiscal nacional 2026 (importado de events (7).ics).',
    clienteId: CALENDARIO_FISCAL_CLIENTE_ID,
    clienteNome: 'Calendário fiscal 2026',
    periodo: event.data.slice(0, 7),
    vencimento: new Date(`${event.data}T00:00:00Z`).getTime(),
    estado: 'pendente',
    origem: 'calendario_fiscal',
    createdAt: now,
    updatedAt: now,
    _updatedAt: now,
  }));
  const missing = allRecords.filter((item) => !currentIds.has(item.id));
  if (missing.length > 0) saveObrigacoesCache([...current, ...missing]);

  try {
    const markerRef = doc(db, colPath('meta'), CALENDARIO_FISCAL_MARKER_ID);
    const marker = await getDoc(markerRef);
    if (marker.exists() && marker.data()?.version >= CALENDARIO_FISCAL_VERSION) return;

    const batch = writeBatch(db);
    for (const record of allRecords) {
      batch.set(doc(db, colPath('obrigacoes'), record.id), record, { merge: true });
    }
    batch.set(markerRef, {
      version: CALENDARIO_FISCAL_VERSION,
      count: allRecords.length,
      updatedAt: now,
      _updatedAt: now,
    }, { merge: true });
    await batch.commit();
  } catch (err) {
    // O cache local já está preenchido; repetir na próxima abertura é seguro.
    console.warn('[gabinete] seed do calendário fiscal falhou:', err);
  }
}

// ─── CRUD — Cofre ────────────────────────────────────────────────────────────
export function listCofreCache(): CofreEntrada[] { return readCache<CofreEntrada>('cofre', []); }
export function saveCofreCache(list: CofreEntrada[]): void { writeCache('cofre', list); }
export async function upsertCofre(e: CofreEntrada): Promise<CofreEntrada> {
  const list = listCofreCache();
  const idx = list.findIndex(x => x.id === e.id);
  const next = { ...e, updatedAt: Date.now() };
  if (idx >= 0) list[idx] = next; else list.unshift(next);
  saveCofreCache(list);
  try { await safeSetDoc(colPath('cofre'), e.id, next); } catch {}
  return next;
}
export async function deleteCofre(id: string): Promise<void> {
  const list = listCofreCache().filter(x => x.id !== id);
  saveCofreCache(list);
  try { await safeDeleteDoc(colPath('cofre'), id); } catch {}
}
export async function registarVistaCofre(id: string): Promise<void> {
  const list = listCofreCache();
  const e = list.find(x => x.id === id);
  if (!e) return;
  const next: CofreEntrada = {
    ...e,
    lastViewedAt: Date.now(),
    lastViewedBy: auth.currentUser?.email ?? auth.currentUser?.uid ?? 'local',
    viewCount: (e.viewCount ?? 0) + 1,
    updatedAt: Date.now(),
  };
  // atualiza cache e Firestore sem re-cifrar
  const idx = list.findIndex(x => x.id === id);
  list[idx] = next;
  saveCofreCache(list);
  try { await safeSetDoc(colPath('cofre'), id, next); } catch {}
}
export function newCofreId(): string { return newId('cof'); }

// ─── Colaboradores ───────────────────────────────────────────────────────────
export function listColaboradoresCache(): Colaborador[] { return readCache<Colaborador>('colaboradores', []); }
export function saveColaboradoresCache(list: Colaborador[]): void { writeCache('colaboradores', list); }
export async function upsertColaborador(c: Colaborador): Promise<void> {
  const list = listColaboradoresCache();
  const idx = list.findIndex(x => x.id === c.id);
  const now = Date.now();
  const withTs = { ...c, updatedAt: now, initials: c.initials || getColaboradorInitials(c.nome), status: c.status || 'ativo' as const };
  if (idx >= 0) list[idx] = withTs as Colaborador; else list.push(withTs as Colaborador);
  saveColaboradoresCache(list);
  try { await safeSetDoc(colPath('colaboradores'), c.id, withTs); } catch {}
}
export async function deleteColaborador(id: string): Promise<void> {
  const list = listColaboradoresCache().filter(x => x.id !== id);
  saveColaboradoresCache(list);
  try { await safeDeleteDoc(colPath('colaboradores'), id); } catch {}
}
export function newColaboradorId(): string { return newId('col'); }
export function getColaboradorInitials(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0,2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
export async function linkColaboradorPorEmail(email: string, uid: string): Promise<void> {
  const lower = email.toLowerCase();
  const list = listColaboradoresCache();
  let changed = false;
  for (const c of list) {
    if (c.email.toLowerCase() === lower && c.status !== 'ativo') {
      c.status = 'ativo';
      c.linkedUid = uid;
      c.updatedAt = Date.now();
      changed = true;
      try { await safeSetDoc(colPath('colaboradores'), c.id, c); } catch {}
    }
  }
  if (changed) saveColaboradoresCache(list);
}

// ─── CRUD — Conversas (Histórico) — Fase 1 ────────────────────────────────────
export function listConversasCache(): Conversa[] { return readCache<Conversa>('conversas', []); }
export function saveConversasCache(list: Conversa[]): void { writeCache('conversas', list); }
export async function upsertConversa(c: Conversa): Promise<Conversa> {
  const list = listConversasCache();
  const idx = list.findIndex(x => x.id === c.id);
  const next = { ...c, updatedAt: Date.now() };
  if (idx >= 0) list[idx] = next; else list.unshift(next);
  saveConversasCache(list);
  try { await safeSetDoc(colPath('conversas'), c.id, next); } catch {}
  return next;
}
export async function deleteConversa(id: string): Promise<void> {
  const list = listConversasCache().filter(x => x.id !== id);
  saveConversasCache(list);
  try { await safeDeleteDoc(colPath('conversas'), id); } catch {}
}
export function newConversaId(): string { return newId('cnv'); }

// ─── Comunicação — Fase 2 ────────────────────────────────────────────────────
export type ModeloTipo = 'email' | 'sms' | 'carta';
export interface ModeloComunicacao {
  id: string;
  titulo: string;
  tipo: ModeloTipo;
  assunto?: string;
  corpo: string; // com variáveis {{cliente.nome}} {{nif}} etc
  categoria?: string;
  createdAt: number;
  updatedAt: number;
}
export interface EnvioComunicacao {
  id: string;
  clienteId: string;
  clienteNome?: string;
  modeloId?: string;
  tipo: ModeloTipo;
  destinatario: string;
  assunto?: string;
  corpo: string;
  data: number;
  estado: 'enviado' | 'pendente';
  autor?: string;
  createdAt: number;
}
export function listModelosCache(): ModeloComunicacao[] { return readCache<ModeloComunicacao>('modelos', []); }
export function saveModelosCache(list: ModeloComunicacao[]): void { writeCache('modelos', list); }
export async function upsertModelo(m: ModeloComunicacao): Promise<ModeloComunicacao> {
  const list = listModelosCache(); const idx=list.findIndex(x=>x.id===m.id); const next={...m, updatedAt: Date.now()}; if(idx>=0) list[idx]=next; else list.unshift(next); saveModelosCache(list); try{ await safeSetDoc(colPath('modelos'), m.id, next);}catch{}
  return next;
}
export async function deleteModelo(id:string):Promise<void>{ const list=listModelosCache().filter(x=>x.id!==id); saveModelosCache(list); try{ await safeDeleteDoc(colPath('modelos'), id);}catch{} }
export function newModeloId():string{ return newId('mdl'); }
export function listEnviosCache(): EnvioComunicacao[] { return readCache<EnvioComunicacao>('envios', []); }
export function saveEnviosCache(list: EnvioComunicacao[]): void { writeCache('envios', list); }
export async function upsertEnvio(e: EnvioComunicacao): Promise<EnvioComunicacao> {
  const list=listEnviosCache(); const idx=list.findIndex(x=>x.id===e.id); if(idx>=0) list[idx]=e; else list.unshift(e); saveEnviosCache(list); try{ await safeSetDoc(colPath('envios'), e.id, e);}catch{} return e;
}
export function newEnvioId():string{ return newId('env'); }

// ─── Rentabilidade — Fase 3 ──────────────────────────────────────────────────
export interface Tempo {
  id: string;
  clienteId: string;
  clienteNome?: string;
  colaboradorId?: string;
  colaboradorNome?: string;
  data: number;
  minutos: number;
  descricao?: string;
  faturavel: boolean;
  valor?: number; // custo calculado
  createdAt: number;
  updatedAt: number;
}
export function listTemposCache(): Tempo[] { return readCache<Tempo>('tempos', []); }
export function saveTemposCache(list: Tempo[]): void { writeCache('tempos', list); }
export async function upsertTempo(t: Tempo): Promise<Tempo> {
  const list=listTemposCache(); const idx=list.findIndex(x=>x.id===t.id); const next={...t, updatedAt: Date.now()}; if(idx>=0) list[idx]=next; else list.unshift(next); saveTemposCache(list); try{ await safeSetDoc(colPath('tempos'), t.id, next);}catch{} return next;
}
export async function deleteTempo(id:string):Promise<void>{ const list=listTemposCache().filter(x=>x.id!==id); saveTemposCache(list); try{ await safeDeleteDoc(colPath('tempos'), id);}catch{} }
export function newTempoId():string{ return newId('tmp'); }

// ─── Actas & Guias — Fase 4 ──────────────────────────────────────────────────
export interface Acta {
  id: string;
  clienteId: string;
  clienteNome?: string;
  data: number;
  tipo: 'ordinaria' | 'extraordinaria' | 'outro';
  titulo: string;
  conteudo: string;
  createdAt: number;
  updatedAt: number;
}
export function listActasCache(): Acta[] { return readCache<Acta>('actas', []); }
export function saveActasCache(list: Acta[]): void { writeCache('actas', list); }
export async function upsertActa(a: Acta): Promise<Acta> {
  const list=listActasCache(); const idx=list.findIndex(x=>x.id===a.id); const next={...a, updatedAt: Date.now()}; if(idx>=0) list[idx]=next; else list.unshift(next); saveActasCache(list); try{ await safeSetDoc(colPath('actas'), a.id, next);}catch{} return next;
}
export async function deleteActa(id:string):Promise<void>{ const list=listActasCache().filter(x=>x.id!==id); saveActasCache(list); try{ await safeDeleteDoc(colPath('actas'), id);}catch{} }
export function newActaId():string{ return newId('act'); }

// ——— CRUD — Visão Geral: Contactos/Assuntos/Alertas/Ocorrências/Documentos ———
export function listContactosCache(): ContactoGabinete[] { return readCache<ContactoGabinete>('contactosGeral', []); }
export function saveContactosCache(list: ContactoGabinete[]): void { writeCache('contactosGeral', list); }
export async function upsertContactoGabinete(c: ContactoGabinete): Promise<ContactoGabinete> {
  const list = listContactosCache(); const idx = list.findIndex(x=>x.id===c.id); const next={...c, updatedAt: Date.now()}; if(idx>=0) list[idx]=next; else list.unshift(next); saveContactosCache(list); try{ await safeSetDoc(colPath('contactosGeral'), c.id, next);}catch{} return next;
}
export async function deleteContactoGabinete(id:string):Promise<void>{ const list=listContactosCache().filter(x=>x.id!==id); saveContactosCache(list); try{ await safeDeleteDoc(colPath('contactosGeral'), id);}catch{} }
export function newContactoGabineteId():string{ return newId('cgc'); }

export function listAssuntosCache(): AssuntoGabinete[] { return readCache<AssuntoGabinete>('assuntosGeral', []); }
export function saveAssuntosCache(list: AssuntoGabinete[]): void { writeCache('assuntosGeral', list); }
export async function upsertAssuntoGabinete(a: AssuntoGabinete): Promise<AssuntoGabinete> {
  const list = listAssuntosCache(); const idx=list.findIndex(x=>x.id===a.id); const next={...a, updatedAt: Date.now()}; if(idx>=0) list[idx]=next; else list.unshift(next); saveAssuntosCache(list); try{ await safeSetDoc(colPath('assuntosGeral'), a.id, next);}catch{} return next;
}
export async function deleteAssuntoGabinete(id:string):Promise<void>{ const list=listAssuntosCache().filter(x=>x.id!==id); saveAssuntosCache(list); try{ await safeDeleteDoc(colPath('assuntosGeral'), id);}catch{} }
export function newAssuntoGabineteId():string{ return newId('ass'); }

export function listAlertasCache(): AlertaGabinete[] { return readCache<AlertaGabinete>('alertasGeral', []); }
export function saveAlertasCache(list: AlertaGabinete[]): void { writeCache('alertasGeral', list); }
export async function upsertAlertaGabinete(a: AlertaGabinete): Promise<AlertaGabinete> {
  const list=listAlertasCache(); const idx=list.findIndex(x=>x.id===a.id); const next={...a, updatedAt: Date.now()}; if(idx>=0) list[idx]=next; else list.unshift(next); saveAlertasCache(list); try{ await safeSetDoc(colPath('alertasGeral'), a.id, next);}catch{} return next;
}
export async function deleteAlertaGabinete(id:string):Promise<void>{ const list=listAlertasCache().filter(x=>x.id!==id); saveAlertasCache(list); try{ await safeDeleteDoc(colPath('alertasGeral'), id);}catch{} }
export function newAlertaGabineteId():string{ return newId('alt'); }

export function listOcorrenciasCache(): OcorrenciaGabinete[] { return readCache<OcorrenciaGabinete>('ocorrencias', []); }
export function saveOcorrenciasCache(list: OcorrenciaGabinete[]): void { writeCache('ocorrencias', list); }
export async function upsertOcorrencia(o: OcorrenciaGabinete): Promise<OcorrenciaGabinete> {
  const list=listOcorrenciasCache(); const idx=list.findIndex(x=>x.id===o.id); if(idx>=0) list[idx]=o; else list.unshift(o); saveOcorrenciasCache(list); try{ await safeSetDoc(colPath('ocorrencias'), o.id, o);}catch{} return o;
}
export async function deleteOcorrencia(id:string):Promise<void>{ const list=listOcorrenciasCache().filter(x=>x.id!==id); saveOcorrenciasCache(list); try{ await safeDeleteDoc(colPath('ocorrencias'), id);}catch{} }
export function newOcorrenciaId():string{ return newId('oco'); }

export function listDocumentosGeralCache(): GabineteDocumento[] { return readCache<GabineteDocumento>('documentos', []); }
export function saveDocumentosGeralCache(list: GabineteDocumento[]): void { writeCache('documentos', list); }
export async function upsertDocumentoGeral(d: GabineteDocumento): Promise<GabineteDocumento> {
  const list=listDocumentosGeralCache(); const idx=list.findIndex(x=>x.id===d.id); if(idx>=0) list[idx]=d; else list.unshift(d); saveDocumentosGeralCache(list); try{ await safeSetDoc(colPath('documentos'), d.id, d as unknown as Record<string,unknown>);}catch{} return d;
}
export async function deleteDocumentoGeral(id:string):Promise<void>{ const list=listDocumentosGeralCache().filter(x=>x.id!==id); saveDocumentosGeralCache(list); try{ await safeDeleteDoc(colPath('documentos'), id);}catch{} }
export function newDocumentoGeralId():string{ return newId('doc'); }

// Fase 3 — avença já no GabineteCliente acima

// ─── Alertas — helpers Fase 1 ────────────────────────────────────────────────
export function getAlertasVencidos(cli: GabineteCliente, diasAviso = 30): { tipo: keyof NonNullable<GabineteCliente['alertas']>; vencimento: number; dias: number }[] {
  if (!cli.alertas) return [];
  const now = Date.now();
  const out: { tipo: keyof NonNullable<GabineteCliente['alertas']>; vencimento: number; dias: number }[] = [];
  for (const [k, v] of Object.entries(cli.alertas) as [keyof NonNullable<GabineteCliente['alertas']>, number | undefined][]) {
    if (!v) continue;
    const dias = Math.ceil((v - now) / 86400000);
    if (dias <= diasAviso) out.push({ tipo: k, vencimento: v, dias });
  }
  return out.sort((a,b)=> a.vencimento - b.vencimento);
}

// ─── Subscriptions LIVE (onSnapshot) ─────────────────────────────────────────
// Cada subscribe tenta Firestore live; se falhar (offline/sem auth), devolve o cache
// e mantém o callback com o cache. Quando a rede voltar, o snapshot atualiza sozinho.

function makeSubscriber<T>(col: string, mapFn?: (d: unknown) => T) {
  return (cb: (items: T[]) => void): Unsubscribe => {
    // emite cache imediatamente (sem flash vazio)
    try { cb(readCache<T>(col, [])); } catch {}
    // tenta live
    try {
      const q = query(collection(db, colPath(col)), orderBy('_updatedAt', 'desc'));
      const unsub = onSnapshot(q, (snap) => {
        const items: T[] = [];
        snap.forEach(docSnap => {
          const data = docSnap.data() as T;
          // remove campo interno _updatedAtServer se vier
          items.push(mapFn ? mapFn(data) : data);
        });
        // atualiza cache para offline
        writeCache(col, items as unknown as T[]);
        cb(items);
      }, (err) => {
        console.warn(`[gabinete] onSnapshot ${col} erro:`, err);
        // mantém cache
      });
      return unsub;
    } catch (e) {
      console.warn(`[gabinete] subscribe ${col} sem Firestore (offline/demo):`, e);
      return () => {};
    }
  };
}

export const subscribeClientes = makeSubscriber<GabineteCliente>('clientes');
export const subscribeTarefas = makeSubscriber<Tarefa>('tarefas');
export const subscribeObrigacoes = makeSubscriber<Obrigacao>('obrigacoes');
export const subscribeCofre = makeSubscriber<CofreEntrada>('cofre');
export const subscribeColaboradores = makeSubscriber<Colaborador>('colaboradores');
export const subscribeContactosGeral = makeSubscriber<ContactoGabinete>('contactosGeral');
export const subscribeAssuntosGeral = makeSubscriber<AssuntoGabinete>('assuntosGeral');
export const subscribeAlertasGeral = makeSubscriber<AlertaGabinete>('alertasGeral');
export const subscribeOcorrencias = makeSubscriber<OcorrenciaGabinete>('ocorrencias');
export const subscribeDocumentosGeral = makeSubscriber<GabineteDocumento>('documentos');
export const subscribeConversas = makeSubscriber<Conversa>('conversas');
export const subscribeModelos = makeSubscriber<ModeloComunicacao>('modelos');
export const subscribeEnvios = makeSubscriber<EnvioComunicacao>('envios');
export const subscribeTempos = makeSubscriber<Tempo>('tempos');
export const subscribeActas = makeSubscriber<Acta>('actas');

// One-shot fetch (para seed/migração)
export async function fetchAll<T>(col: string): Promise<T[]> {
  try {
    const snap = await getDocs(collection(db, colPath(col)));
    const items: T[] = [];
    snap.forEach(d => items.push(d.data() as T));
    if (items.length) writeCache(col, items as unknown as T[]);
    return items.length ? items : readCache<T>(col, []);
  } catch {
    return readCache<T>(col, []);
  }
}

// ─── Gerador automático de obrigações fiscais ─────────────────────────────────
// Cria instâncias do ano com base no perfil do cliente (regime IVA, volume, território).
// Idempotente: não duplica se já existe mesmo (clienteId+tipo+periodo).
export function gerarObrigacoesParaCliente(cli: GabineteCliente, ano = new Date().getFullYear()): Obrigacao[] {
  const existentes = listObrigacoesCache();
  const key = (t: ObrigacaoTipo, periodo: string) => `${cli.id}:${t}:${periodo}`;
  const jaExiste = new Set(existentes.map(o => `${o.clienteId}:${o.tipo}:${o.periodo}`));
  const novas: Obrigacao[] = [];
  const push = (o: Omit<Obrigacao, 'id' | 'createdAt' | 'updatedAt'>) => {
    const k = key(o.tipo, o.periodo);
    if (jaExiste.has(k)) return;
    jaExiste.add(k);
    novas.push({ ...o, id: newObrigacaoId(), createdAt: Date.now(), updatedAt: Date.now() });
  };

  // IVA
  if (cli.regimeIva === 'mensal') {
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      // Vencimento ~ dia 20 do 2º mês seguinte? Simplificado: 20 do mês seguinte para mensal
      // Para PT: mensal até dia 20 do mês seguinte (n+1), trimestral até 20 do 2º mês seguinte.
      // Aqui usamos 20 do mês seguinte para demo.
      const venc = new Date(ano, m, 20).getTime(); // m é 0-index, então m = mês seguinte
      push({
        tipo: 'iva',
        titulo: `IVA ${mm}/${ano} — ${cli.nome}`,
        clienteId: cli.id,
        clienteNome: cli.nome,
        periodo: `${ano}-${mm}`,
        vencimento: venc,
        estado: venc < Date.now() ? 'atrasada' : 'pendente',
      });
    }
  } else if (cli.regimeIva === 'trimestral') {
    const trimestres = [3, 6, 9, 12]; // meses de fecho
    const vencMeses = [5, 8, 11, 2]; // venc 20 do 2º mês seguinte (março→maio, junho→agosto, set→nov, dez→fev ano+1)
    trimestres.forEach((mesFim, i) => {
      const mm = String(mesFim).padStart(2, '0');
      const vencMes = vencMeses[i];
      const vencAno = vencMes === 2 ? ano + 1 : ano;
      const venc = new Date(vencAno, vencMes - 1, 20).getTime();
      push({
        tipo: 'iva',
        titulo: `IVA T${i + 1} ${ano} — ${cli.nome}`,
        clienteId: cli.id,
        clienteNome: cli.nome,
        periodo: `${ano}-T${i + 1}`,
        vencimento: venc,
        estado: venc < Date.now() ? 'atrasada' : 'pendente',
      });
    });
  }
  // PPC — 3 prestações jul/set/dez (se não for isento simplificado sem coleta)
  // Sempre cria as 3 do ano; marcar dispensada manualmente se coleta <200€
  [
    { m: 7, label: '1.º PPC' },
    { m: 9, label: '2.º PPC' },
    { m: 12, label: '3.º PPC' },
  ].forEach(({ m, label }) => {
    const dia = m === 12 ? 15 : 31; // 15 dez
    const venc = new Date(ano, m - 1, dia).getTime();
    push({
      tipo: 'ppc',
      titulo: `${label} IRC ${ano} — ${cli.nome}`,
      clienteId: cli.id,
      clienteNome: cli.nome,
      periodo: `${ano}-PPC${m}`,
      vencimento: venc,
      estado: venc < Date.now() ? 'atrasada' : 'pendente',
    });
  });
  // Modelo 22 / IES (anuais)
  push({
    tipo: 'modelo22',
    titulo: `Modelo 22 ${ano - 1} — ${cli.nome}`,
    clienteId: cli.id,
    clienteNome: cli.nome,
    periodo: `${ano - 1}`,
    vencimento: new Date(ano, 4, 31).getTime(), // 31 maio
    estado: new Date(ano, 4, 31).getTime() < Date.now() ? 'atrasada' : 'pendente',
  });
  push({
    tipo: 'ies',
    titulo: `IES ${ano - 1} — ${cli.nome}`,
    clienteId: cli.id,
    clienteNome: cli.nome,
    periodo: `${ano - 1}`,
    vencimento: new Date(ano, 6, 15).getTime(), // 15 julho
    estado: new Date(ano, 6, 15).getTime() < Date.now() ? 'atrasada' : 'pendente',
  });

  // Persiste as novas (cache + Firestore fire-and-forget)
  if (novas.length) {
    const all = [...existentes, ...novas];
    saveObrigacoesCache(all);
    novas.forEach(o => safeSetDoc(colPath('obrigacoes'), o.id, o).catch(() => {}));
    // também cria tarefas espelho para cada obrigação
    novas.forEach(o => {
      const t: Tarefa = {
        id: newTarefaId(),
        titulo: o.titulo,
        tipo: 'obrigacao',
        estado: o.estado === 'atrasada' ? 'atrasada' : 'todo',
        prioridade: o.tipo === 'iva' ? 'alta' : 'media',
        clienteId: cli.id,
        clienteNome: cli.nome,
        dataVencimento: o.vencimento,
        origem: 'obrigacao_auto',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      // cache + firestore
      const tList = listTarefasCache();
      tList.unshift(t);
      saveTarefasCache(tList);
      safeSetDoc(colPath('tarefas'), t.id, t).catch(() => {});
    });
  }
  return novas;
}

// ——— Seed demo: garante que o cliente do mockup existe com dados completos ———
export async function seedMykolaVasylDemo(): Promise<string | null> {
  const TARGET_NIF = '518123456';
  const TARGET_NOME = 'Mykola & Vasyl, Lda';
  const existentes = listClientesCache();
  const byNif = existentes.find(c => (c.nif||'').replace(/\D/g,'') === TARGET_NIF);
  const byNome = existentes.find(c => c.nome === TARGET_NOME);
  if (byNif || byNome) {
    const cli = byNif || byNome;
    if (!cli) return null;
    // Se já existe mas falta campos do mockup, completa
    let needsUpdate = false;
    if (!cli.caeDescricao) { cli.caeDescricao = 'Instalações elétricas'; cli.caes = '43210'; needsUpdate = true; }
    if (!cli.regimeIrc) { cli.regimeIrc = 'geral'; needsUpdate = true; }
    if (!cli.tipoSociedade) { cli.tipoSociedade = 'Sociedade por quotas'; needsUpdate = true; }
    if (!cli.gerentes || cli.gerentes.length === 0) { cli.gerentes = ['Mykola Ivanenko', 'Vasyl Petrenko']; needsUpdate = true; }
    if (cli.nrTrabalhadores == null) { cli.nrTrabalhadores = 3; needsUpdate = true; }
    if (!cli.inicioAtividade) { cli.inicioAtividade = new Date('2025-12-15').getTime(); needsUpdate = true; }
    if (!cli.responsavelInterno) { cli.responsavelInterno = { nome: 'Ana Margarida', initials: 'AM' }; needsUpdate = true; }
    if (!cli.apoioAdministrativo) { cli.apoioAdministrativo = { nome: 'Vilma', initials: 'VI' }; needsUpdate = true; }
    if (!cli.supervisor) { cli.supervisor = { nome: 'Sandrine Reis', initials: 'SR' }; needsUpdate = true; }
    if (!cli.orientacoes) { cli.orientacoes = 'Todas as faturas devem ser digitalizadas e inseridas no TOCOnline no momento da receção.\nCliente prefere comunicação por WhatsApp.\nConfirmar sempre a afetação de despesas (pessoal vs. empresa).\nValidar dedutibilidade de despesas com viatura, combustível e portagens.\nAntes de fechar o mês, confirmar se existem documentos em falta.'; needsUpdate = true; }
    if (!cli.situacaoAtual) {
      cli.situacaoAtual = [
        { texto: 'Documentação de julho e agosto em falta', cor: 'red' },
        { texto: 'IVA tratado até julho', cor: 'green' },
        { texto: 'Contabilidade em dia', cor: 'green' },
        { texto: 'Processo de compensação Segurança Social pendente', cor: 'orange' },
        { texto: 'Salários atualizados', cor: 'green' },
      ];
      needsUpdate = true;
    }
    if (needsUpdate) { cli.updatedAt = Date.now(); await upsertCliente(cli); }
    // Garante tarefas/assuntos/alertas/contactos/ocorrencias/documentos/cofre
    await ensureMykolaDependencias(cli.id, cli.nome);
    return cli.id;
  }
  const cli: GabineteCliente = {
    id: newClienteId(),
    nome: TARGET_NOME,
    nif: TARGET_NIF,
    tipoEntidade: 'LDA',
    regimeIva: 'trimestral',
    regimeIrc: 'geral',
    tipoSociedade: 'Sociedade por quotas',
    caes: '43210',
    caeDescricao: 'Instalações elétricas',
    gerentes: ['Mykola Ivanenko', 'Vasyl Petrenko'],
    nrTrabalhadores: 3,
    inicioAtividade: new Date('2025-12-15').getTime(),
    responsavelInterno: { nome: 'Ana Margarida', initials: 'AM' },
    apoioAdministrativo: { nome: 'Vilma', initials: 'VI' },
    supervisor: { nome: 'Sandrine Reis', initials: 'SR' },
    orientacoes: 'Todas as faturas devem ser digitalizadas e inseridas no TOCOnline no momento da receção.\nCliente prefere comunicação por WhatsApp.\nConfirmar sempre a afetação de despesas (pessoal vs. empresa).\nValidar dedutibilidade de despesas com viatura, combustível e portagens.\nAntes de fechar o mês, confirmar se existem documentos em falta.',
    situacaoAtual: [
      { texto: 'Documentação de julho e agosto em falta', cor: 'red' },
      { texto: 'IVA tratado até julho', cor: 'green' },
      { texto: 'Contabilidade em dia', cor: 'green' },
      { texto: 'Processo de compensação Segurança Social pendente', cor: 'orange' },
      { texto: 'Salários atualizados', cor: 'green' },
    ],
    estado: 'ativo',
    createdAt: new Date('2025-12-15').getTime(),
    updatedAt: Date.now(),
  };
  await upsertCliente(cli);
  // Cria EmpresaRecord espelho para lista de empresas
  try {
    const { upsertEmpresa, listEmpresas: listEmp } = await import('./empresas');
    const exists = listEmp().find(e => (e.nif||'').replace(/\D/g,'') === TARGET_NIF);
    if (!exists) {
      const { newId } = await import('./empresas');
      const emp = { id: cli.id, nome: TARGET_NOME, nif: TARGET_NIF, createdAt: Date.now(), updatedAt: Date.now(), profile: { nomeCliente: TARGET_NOME } as unknown as import('./empresas').EmpresaRecord['profile'] };
      upsertEmpresa(emp as import('./empresas').EmpresaRecord);
    }
  } catch {}
  await ensureMykolaDependencias(cli.id, cli.nome);
  gerarObrigacoesParaCliente(cli, new Date().getFullYear());
  return cli.id;
}

async function ensureMykolaDependencias(clienteId: string, clienteNome: string): Promise<void> {
  // Contactos
  if (listContactosCache().filter(c=>c.clienteId===clienteId).length === 0) {
    for (const c of [
      { nome: 'Mykola Ivanenko', cargo: 'Gerente', telefone: '+351 9XX XXX XXX', initials: 'MI', isGerente: true },
      { nome: 'Vasyl Petrenko', cargo: 'Gerente', telefone: '+351 9XX XXX XXX', initials: 'VP', isGerente: true },
      { nome: 'Iryna', cargo: 'Administrativa', telefone: '+351 9XX XXX XXX', initials: 'IA' },
    ] as const) {
      await upsertContactoGabinete({ id: newContactoGabineteId(), clienteId, clienteNome, nome: c.nome, cargo: c.cargo, telefone: c.telefone, initials: c.initials, isGerente: (c as unknown as {isGerente?:boolean}).isGerente, createdAt: Date.now(), updatedAt: Date.now() });
    }
  }
  // Alertas
  if (listAlertasCache().filter(a=>a.clienteId===clienteId).length === 0) {
    for (const texto of [
      'Cliente tem dificuldade em reunir documentação.',
      'Todas as faturas devem ser enviadas por WhatsApp assim que são recebidas.',
      'Atenção à dedutibilidade de despesas com viatura.',
    ]) {
      await upsertAlertaGabinete({ id: newAlertaGabineteId(), clienteId, clienteNome, texto, createdAt: Date.now(), updatedAt: Date.now() });
    }
  }
  // Assuntos = também cria tarefas ligadas (funcional: assuntos são tarefas)
  if (listAssuntosCache().filter(a=>a.clienteId===clienteId).length === 0) {
    const now = Date.now();
    const assuntosSeed: { titulo: string; estado: AssuntoGabinete['estado']; updatedAt: number }[] = [
      { titulo: 'Duplicação de contribuições Segurança Social', estado: 'em_curso', updatedAt: new Date('2026-09-16').getTime() },
      { titulo: 'Viatura da empresa', estado: 'aguard_cliente', updatedAt: new Date('2026-09-08').getTime() },
      { titulo: 'Documentação em falta (Jul-Ago)', estado: 'pendente', updatedAt: new Date('2026-09-16').getTime() },
    ];
    for (const s of assuntosSeed) {
      await upsertAssuntoGabinete({ id: newAssuntoGabineteId(), clienteId, clienteNome, titulo: s.titulo, estado: s.estado, updatedAt: s.updatedAt, createdAt: now });
      // Tarefa espelho para funcionalidade Tarefas
      const tid = newTarefaId();
      const t: Tarefa = { id: tid, titulo: s.titulo, tipo: 'tarefa', origem: 'manual', estado: s.estado === 'pendente' ? 'todo' : s.estado === 'aguard_cliente' ? 'todo' : 'doing', prioridade: 'media' as const, clienteId, clienteNome, createdAt: s.updatedAt, updatedAt: s.updatedAt };
      await upsertTarefa(t);
    }
  } else if (listTarefasCache().filter(t=>t.clienteId===clienteId).length === 0) {
    // Se assuntos já existem mas sem tarefas, cria tarefas
    for (const a of listAssuntosCache().filter(x=>x.clienteId===clienteId)) {
      await upsertTarefa({ id: newTarefaId(), titulo: a.titulo, tipo: 'tarefa', origem: 'manual', estado: a.estado==='pendente'?'todo':'doing', prioridade: 'media', clienteId, clienteNome, createdAt: a.updatedAt, updatedAt: a.updatedAt });
    }
  }
  // Ocorrências
  if (listOcorrenciasCache().filter(o=>o.clienteId===clienteId).length === 0) {
    for (const o of [
      { data: new Date('2026-09-16').getTime(), autorNome: 'Sandrine Reis', autorInitials: 'SR', descricao: 'Atualização: sem resposta da Segurança Social.' },
      { data: new Date('2026-09-08').getTime(), autorNome: 'Ana Margarida', autorInitials: 'AM', descricao: 'Envio do pedido de compensação SS.' },
      { data: new Date('2026-09-07').getTime(), autorNome: 'Ana Margarida', autorInitials: 'AM', descricao: 'Pagamento duplicado de €445,18.' },
      { data: new Date('2026-05-05').getTime(), autorNome: 'Ana Margarida', autorInitials: 'AM', descricao: 'Pagamento duplicado de €445,18.' },
      { data: new Date('2025-12-15').getTime(), autorNome: 'Sandrine Reis', autorInitials: 'SR', descricao: 'Constituição da sociedade.' },
    ] as const) {
      await upsertOcorrencia({ id: newOcorrenciaId(), clienteId, clienteNome, data: o.data, autorNome: o.autorNome, autorInitials: o.autorInitials, descricao: o.descricao, createdAt: o.data });
    }
  }
  // Documentos
  if (listDocumentosGeralCache().filter(d=>d.clienteId===clienteId).length === 0) {
    for (const d of [
      { nome: 'Contrato de constituição.pdf', dataUpload: new Date('2025-12-12').getTime() },
      { nome: 'Certidão permanente.pdf', dataUpload: new Date('2025-12-12').getTime() },
      { nome: 'Contrato de arrendamento.pdf', dataUpload: new Date('2026-01-03').getTime() },
      { nome: 'Financiamento viatura.pdf', dataUpload: new Date('2026-02-15').getTime() },
      { nome: 'Parecer OCC – viatura.pdf', dataUpload: new Date('2026-08-27').getTime() },
    ] as const) {
      await upsertDocumentoGeral({ id: newDocumentoGeralId(), clienteId, clienteNome, nome: d.nome, tipo: 'OUTRO', dataUpload: d.dataUpload });
    }
  }
  // Equipa demo (se vazia global, cria 3 colaboradores)
  if (listColaboradoresCache().length === 0) {
    for (const col of [
      { nome: 'Ana Margarida', email: 'ana.margarida@estudo360.pt', role: 'contabilista' as const, status: 'ativo' as const },
      { nome: 'Vilma', email: 'vilma@estudo360.pt', role: 'estagiaria' as const, status: 'ativo' as const },
      { nome: 'Sandrine Reis', email: 'admin@estudo360.pt', role: 'admin' as const, status: 'ativo' as const },
    ]) {
      await upsertColaborador({ id: newColaboradorId(), nome: col.nome, email: col.email, role: col.role, status: col.status, initials: getColaboradorInitials(col.nome), createdAt: Date.now(), updatedAt: Date.now() });
    }
  }
  // Cofre — entradas placeholder (o utilizador completa depois)
  if (listCofreCache().filter(c=>c.clienteId===clienteId).length === 0) {
    for (const a of [
      { categoria: 'AT' as const, titulo: 'Portal das Finanças', username: '518123456' },
      { categoria: 'SS' as const, titulo: 'Segurança Social Direta', username: '518123456' },
      { categoria: 'OUTRO' as const, titulo: 'TOConline', username: 'mykola.vasyl' },
      { categoria: 'OUTRO' as const, titulo: 'Homebanking BPI', username: 'mykola.vasyl' },
    ] as const) {
      await upsertCofre({ id: newCofreId(), titulo: a.titulo, categoria: a.categoria, clienteId, clienteNome, username: a.username, segredo: '—', createdAt: Date.now(), updatedAt: Date.now() } as unknown as CofreEntrada);
    }
  }
}

export async function ensureAllClientesDefaults(): Promise<void> {
  const all = listClientesCache();
  let changed = false;
  for (const cli of all) {
    let upd = false;
    if (!cli.situacaoAtual || cli.situacaoAtual.length === 0) {
      cli.situacaoAtual = [
        { texto: 'Documentação de julho e agosto em falta', cor: 'red' },
        { texto: 'IVA tratado até julho', cor: 'green' },
        { texto: 'Contabilidade em dia', cor: 'green' },
        { texto: 'Processo de compensação Segurança Social pendente', cor: 'orange' },
        { texto: 'Salários atualizados', cor: 'green' },
      ];
      upd = true;
    }
    if (!cli.orientacoes) {
      cli.orientacoes = 'Todas as faturas devem ser digitalizadas e inseridas no TOCOnline no momento da receção.\nCliente prefere comunicação por WhatsApp.\nConfirmar sempre a afetação de despesas (pessoal vs. empresa).\nValidar dedutibilidade de despesas com viatura, combustível e portagens.\nAntes de fechar o mês, confirmar se existem documentos em falta.';
      upd = true;
    }
    if (upd) { cli.updatedAt = Date.now(); await upsertCliente(cli); changed = true; }
  }
}

// Migração: cada EmpresaRecord vira GabineteCliente (one-off, idempotente por NIF)
export async function migrarEmpresasParaGabinete(empresas: { id: string; nome: string; nif: string }[]): Promise<number> {
  const existentes = listClientesCache();
  const nifsExistentes = new Set(existentes.map(c => (c.nif || '').replace(/\D/g, '')));
  let criados = 0;
  for (const e of empresas) {
    const nifDigits = (e.nif || '').replace(/\D/g, '');
    if (nifDigits && nifsExistentes.has(nifDigits)) continue;
    const cli: GabineteCliente = {
      id: newClienteId(),
      nome: e.nome || 'Sem nome',
      nif: e.nif || '',
      tipoEntidade: 'LDA',
      regimeIva: 'trimestral',
      estado: 'ativo',
      empresaId: e.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await upsertCliente(cli);
    criados++;
    if (nifDigits) nifsExistentes.add(nifDigits);
  }
  return criados;
}
