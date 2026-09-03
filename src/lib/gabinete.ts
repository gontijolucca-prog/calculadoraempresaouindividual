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
export function getGabineteOfficeId(): string {
  const uid = auth.currentUser?.uid;
  if (uid) return uid;
  // fallback para modo local/demo (sem login) — igual ao empresas shared
  return (loadFromStorage<string>('gabinete:officeId', GABINETE_SHARED_ID) as string) || GABINETE_SHARED_ID;
}
export function setGabineteOfficeId(id: string) { saveToStorage('gabinete:officeId', id); }

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
  faturacaoAnual?: number;
  responsavelId?: string; // colaborador
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
  // segredo cifrado — NUNCA plain no Firestore
  cipher: CofreCipher;
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
  if (idx >= 0) list[idx] = c; else list.push(c);
  saveColaboradoresCache(list);
  try { await safeSetDoc(colPath('colaboradores'), c.id, c); } catch {}
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
