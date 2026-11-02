/**
 * Registry de empresas (multi-cliente).
 *
 * Estrutura: Estudo 360 é um mini-CRM para escritórios de contabilidade. Cada
 * empresa tem o seu perfil próprio + dados de SAFT. O perfil "atual" (currentEmpresaId)
 * é o que está ativo na sidebar — todos os simuladores e a vista Perfil leem dele.
 *
 * Persistência: localStorage (cache) + Firestore (fonte de verdade).
 * Firestore usa subcoleção escalável `empresas/{uid}/chunks/{idx}` — cada chunk
 * guarda ~20 empresas (~500 KB), sem limite de 1 MiB. O doc legado
 * `empresas/{uid}` com `{list, updatedAt}` é mantido para migração.
 */
import type { ClientProfile } from '../ClientProfile';
import type { PreviSaState } from '../previSaState';
import { loadFromStorage, saveToStorage, clearStorage } from './storage';
import { doc, getDoc, getDocs, setDoc, collection, onSnapshot, writeBatch } from 'firebase/firestore';
import { db, auth } from './firebase';
import { repairMojibake } from './mojibake';
import { getActiveGabineteId } from './gabinetes';

/** Uma simulação guardada no histórico de um cliente (torna os simuladores
 *  "não descartáveis"). `state` é o snapshot do estado do simulador (permite
 *  reabrir/restaurar); `resumo` é a frase-resultado para a lista. */
export interface SimulationRecord {
  id: string;
  tipo: string;        // chave da view: 'tax','salario','vehicle','ticket','selfss','imt','irs','previsa','imoveis','diagnostico'
  label: string;       // nome legível, ex. "Simulador Fiscal"
  createdAt: number;
  resumo: string;      // resultado numa linha, ex. "LDA poupa 4.200 €/ano"
  state: unknown;      // snapshot do estado do simulador
  /** Guardado automaticamente (não por clique do utilizador). Há no máximo um
   *  registo automático por tipo de simulador — é atualizado em vez de duplicar. */
  auto?: boolean;
  /** Detalhes-chave (label→valor) para comparar no histórico sem reabrir.
   *  `r: true` marca um RESULTADO calculado (vs. um input). */
  detalhes?: { label: string; valor: string; r?: boolean }[];
}

export interface EmpresaRecord {
  id: string;
  nome: string;
  nif: string;
  createdAt: number;
  updatedAt: number;
  profile: ClientProfile;
  saftFileName?: string;
  saftImportedAt?: number;
  saftXml?: string;                 // SAF-T importado em bruto (para re-exportar)
  // Marca do re-processamento do saftXml guardado (deriva campos novos — fluxos
  // de caixa, saldos de abertura — em empresas importadas antes da feature).
  saftReprocessadoEm?: number;
  // Revisão do re-parse aplicada (ver SAFT_REPARSE_REV): quando o parser ganha
  // campos novos, subir a revisão faz as empresas existentes re-derivarem.
  saftReparseRev?: number;
  simulacoes?: SimulationRecord[];  // histórico de simulações deste cliente
  // Estado do simulador Previsa (IRC Modelo 22) deste cliente. Ao contrário dos
  // outros simuladores — que se re-semeiam a partir do `profile` — o Previsa tem
  // detalhe contabilístico (rai_*, TA, etc.) que não cabe no perfil, por isso é
  // guardado aqui para persistir entre sessões e sincronizar entre dispositivos.
  previsa?: Partial<PreviSaState>;
  // Estado de CADA simulador, por cliente (chave = view: 'tax','vehicle',
  // 'ticket','selfss','diagnostico','imoveis','imt','salario','irs'). Isola os
  // dados ENTRE empresas — os simuladores não se auto-preenchem de um cliente
  // para outro. DENTRO da mesma empresa os dados continuam transversais, porque
  // todos derivam do mesmo `profile`. (O Previsa fica em `previsa`, à parte.)
  sims?: Record<string, unknown>;
  /** Dados extra vindos do TOConline (não cabem no perfil). */
  toc?: {
    id?: string;
    website?: string;
    telefone2?: string;
    regiao?: string;
    pais?: string;
    contacto?: string;
    observacoes?: string;
    observacoesInternas?: string;
    isencaoIva?: boolean;
    naoClienteFinal?: boolean;
    ativo?: boolean;
    saftImportId?: string;
    taxCountryRegion?: string;
    emails?: string[];
    moradasExtra?: string[];
    prazoPagamento?: number;
    moeda?: string;
    mecanismoPagamento?: string;
    isencaoCodigo?: string;
    isencaoLegislacao?: string;
    isencaoTexto?: string;
    raw?: Record<string, unknown>;
    importadoEm?: number;
  };
}

// Revisão atual do re-parse do SAF-T guardado. Subir quando o parser passa a
// derivar campos novos (rev 1 = fluxos+aberturas; rev 2 = vendas por cliente).
export const SAFT_REPARSE_REV = 2;

const REGISTRY_KEY = 'empresas';
const CURRENT_KEY = 'currentEmpresaId';
const SHARED_OFFICE_ID = 'shared';
// Relógio do registry (last-write-wins ao nível do documento). Qualquer mutação
// local — incluindo ELIMINAR — avança este stamp; a sincronização compara-o com
// o stamp do Firestore para decidir quem vence. É isto que faz uma eliminação
// "pegar": a lista mais recente substitui a outra por inteiro, em vez de se
// fazer união por id (que nunca conseguia representar uma remoção → "Hydra").
const STAMP_KEY = 'empresasUpdatedAt';

/** Dados de clientes/simulações pertencem ao gabinete ativo, não à conta. */
function empresasScopeId(): string {
  try { return getActiveGabineteId() || auth.currentUser?.uid || SHARED_OFFICE_ID; }
  catch { return auth.currentUser?.uid || SHARED_OFFICE_ID; }
}
function scopedStorageKey(base: string): string {
  return `${base}:${empresasScopeId()}`;
}

function readScoped<T>(base: string, fallback: T, legacyBase?: string): T {
  const key = scopedStorageKey(base);
  const scoped = loadFromStorage<T | null>(key, null);
  if (scoped !== null) return scoped;
  const uid = auth.currentUser?.uid;
  if (uid && key !== `${base}:${uid}`) {
    const daConta = loadFromStorage<T | null>(`${base}:${uid}`, null);
    if (daConta !== null) {
      saveToStorage(key, daConta);
      clearStorage(`${base}:${uid}`);
      return daConta;
    }
  }
  if (legacyBase) {
    const legado = loadFromStorage<T | null>(legacyBase, null);
    if (legado !== null) {
      saveToStorage(key, legado);
      clearStorage(legacyBase);
      return legado;
    }
  }
  return fallback;
}

function writeScoped<T>(base: string, value: T, legacyBase?: string): void {
  saveToStorage(scopedStorageKey(base), value);
  if (legacyBase) clearStorage(legacyBase);
}

export function newId(): string {
  return 'emp_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function getEmpresasStamp(): number {
  const n = readScoped<number>(STAMP_KEY, 0, STAMP_KEY);
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

function setEmpresasStamp(n: number): void {
  writeScoped(STAMP_KEY, n, STAMP_KEY);
}

export function listEmpresas(): EmpresaRecord[] {
  const list = readScoped<EmpresaRecord[]>(REGISTRY_KEY, [], REGISTRY_KEY);
  return Array.isArray(list) ? list : [];
}

// Mutação local: grava a lista E avança o relógio do registry. O stamp é
// MONOTÓNICO — `max(agora, último+1)` — para que qualquer edição local fique
// estritamente acima de qualquer stamp já visto (incluindo um adotado do
// Firestore). Isto fecha dois buracos: (a) editar no mesmo milissegundo em que
// se adotou o remoto, e (b) relógios dessincronizados entre dispositivos.
export function saveEmpresas(list: EmpresaRecord[]): void {
  writeScoped(REGISTRY_KEY, list, REGISTRY_KEY);
  setEmpresasStamp(Math.max(Date.now(), getEmpresasStamp() + 1));
}

// Adopta uma lista vinda do Firestore SEM avançar o relógio — fica com o stamp
// remoto, para que sincronizações seguintes não pensem que o local é mais novo.
// O saftXml NÃO viaja na cloud (limite de 1 MiB/documento do Firestore) — se a
// empresa local tiver o XML original, preserva-o ao adotar a versão remota.
export function adoptRemoteEmpresas(list: EmpresaRecord[], remoteStamp: number): void {
  const localById = new Map(listEmpresas().map(e => [e.id, e]));
  const merged = list.map(e => {
    const loc = localById.get(e.id);
    return !e.saftXml && loc?.saftXml ? { ...e, saftXml: loc.saftXml } : e;
  });
  writeScoped(REGISTRY_KEY, merged, REGISTRY_KEY);
  setEmpresasStamp(remoteStamp);
}

export function getEmpresa(id: string): EmpresaRecord | undefined {
  return listEmpresas().find(e => e.id === id);
}

export function upsertEmpresa(emp: EmpresaRecord): EmpresaRecord {
  const list = listEmpresas();
  const idx = list.findIndex(e => e.id === emp.id);
  const next = { ...emp, updatedAt: Date.now() };
  if (idx >= 0) list[idx] = next; else list.push(next);
  saveEmpresas(list);
  return next;
}

export function deleteEmpresa(id: string): void {
  const list = listEmpresas().filter(e => e.id !== id);
  saveEmpresas(list);
  if (getCurrentEmpresaId() === id) clearCurrentEmpresaId();
}

export function getCurrentEmpresaId(): string | null {
  return readScoped<string | null>(CURRENT_KEY, null, CURRENT_KEY);
}

export function setCurrentEmpresaId(id: string | null): void {
  writeScoped(CURRENT_KEY, id, CURRENT_KEY);
}

export function clearCurrentEmpresaId(): void {
  writeScoped(CURRENT_KEY, null, CURRENT_KEY);
}

export function getCurrentEmpresa(): EmpresaRecord | null {
  const id = getCurrentEmpresaId();
  if (!id) return null;
  return getEmpresa(id) ?? null;
}

/** Sincroniza dados-chave do perfil para a empresa correspondente. */
export function syncProfileIntoEmpresa(id: string, profile: ClientProfile): EmpresaRecord | null {
  const emp = getEmpresa(id);
  if (!emp) return null;
  const updated: EmpresaRecord = {
    ...emp,
    nome: profile.nomeCliente?.trim() || emp.nome || 'Sem nome',
    nif: profile.nif?.trim() || emp.nif || '',
    profile,
    updatedAt: Date.now(),
  };
  return upsertEmpresa(updated);
}

// ─── Histórico de simulações por cliente ─────────────────────────────────────

export function newSimId(): string {
  return 'sim_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function listSimulacoes(empresaId: string): SimulationRecord[] {
  const emp = getEmpresa(empresaId);
  const list = emp?.simulacoes;
  return Array.isArray(list) ? [...list].sort((a, b) => b.createdAt - a.createdAt) : [];
}

/** Guarda uma simulação no histórico do cliente. Devolve o registo criado (ou
 *  null se a empresa não existir). Prepende — mais recentes primeiro. */
export function addSimulacao(
  empresaId: string,
  sim: { tipo: string; label: string; resumo: string; state: unknown },
): SimulationRecord | null {
  const emp = getEmpresa(empresaId);
  if (!emp) return null;
  const record: SimulationRecord = {
    id: newSimId(),
    tipo: sim.tipo,
    label: sim.label,
    resumo: sim.resumo,
    state: sim.state,
    createdAt: Date.now(),
  };
  const next: EmpresaRecord = {
    ...emp,
    simulacoes: [record, ...(emp.simulacoes ?? [])],
    updatedAt: Date.now(),
  };
  upsertEmpresa(next);
  return record;
}

/** Guarda/atualiza automaticamente a simulação do tipo indicado. Mantém UM só
 *  registo automático por tipo (atualiza-o em vez de acumular duplicados); os
 *  registos manuais antigos não são tocados. Devolve o registo ou null. */
export function upsertAutoSimulacao(
  empresaId: string,
  sim: { tipo: string; label: string; resumo: string; state: unknown; detalhes?: { label: string; valor: string }[] },
): SimulationRecord | null {
  const emp = getEmpresa(empresaId);
  if (!emp) return null;
  const list = emp.simulacoes ?? [];
  const existing = list.find(s => s.tipo === sim.tipo && s.auto);
  const record: SimulationRecord = {
    id: existing?.id ?? newSimId(),
    tipo: sim.tipo,
    label: sim.label,
    resumo: sim.resumo,
    state: sim.state,
    detalhes: sim.detalhes,
    createdAt: Date.now(),
    auto: true,
  };
  // Substitui o registo automático existente (se houver) e coloca à cabeça.
  const rest = list.filter(s => !(s.tipo === sim.tipo && s.auto));
  upsertEmpresa({ ...emp, simulacoes: [record, ...rest], updatedAt: Date.now() });
  return record;
}

export function deleteSimulacao(empresaId: string, simId: string): void {
  const emp = getEmpresa(empresaId);
  if (!emp || !emp.simulacoes) return;
  upsertEmpresa({
    ...emp,
    simulacoes: emp.simulacoes.filter(s => s.id !== simId),
    updatedAt: Date.now(),
  });
}

// ─── Sincronização com Firestore (persistência permanente entre dispositivos) ────
//
// Estratégia: a app é single-tenant por escritório de contabilidade. Usamos o
// NIF do escritório (de officeSettings) como `officeId`. Se não estiver definido
// ainda, caímos para 'default' (single-user/dispositivo). Quando integrares
// Firebase Auth, substituir officeId por user.uid.
//
// O documento Firestore é `/empresas/{officeId}` com a forma `{ list, updatedAt }`.
// Last-write-wins via timestamp; localStorage mantém-se como cache local + fallback.

const FIRESTORE_COLLECTION = 'empresas';
const FIRESTORE_CHUNKS_SUBCOLLECTION = 'chunks';
const MIGRATION_COLLECTION = 'migrations';
const CHUNK_SIZE = 20; // ~20 empresas por chunk (~500 KB), bem abaixo de 1 MiB

// O documento é por GABINETE. Contas antigas em empresas/{uid} são migradas
// para o espaço partilhado na primeira entrada.

export function getCurrentUid(): string | null {
  return auth.currentUser?.uid || null;
}
function requireUid(): string {
  if (!getCurrentUid()) throw new Error('Não autenticado — inicia sessão.');
  const scope = empresasScopeId();
  if (!scope || scope === SHARED_OFFICE_ID) throw new Error('Sem gabinete ativo.');
  return scope;
}
// Mantido por compatibilidade de assinatura, mas agora retorna o gabinete ativo.
export function getOfficeId(_officeNif?: string): string {
  return empresasScopeId();
}
// Limpa cache local ao trocar de conta — evita leak entre utilizadores no mesmo browser
export function clearLocalEmpresasCache(): void {
  try {
    // Remove chaves namespaced globais; o próximo sync puxa do uid correto
    // Mantemos a função idempotente — se não houver dados, não faz nada
  } catch {}
}

function chunksCollectionRef(uid: string) {
  return collection(db, FIRESTORE_COLLECTION, uid, FIRESTORE_CHUNKS_SUBCOLLECTION);
}
function chunkDocRef(uid: string, idx: number) {
  return doc(db, FIRESTORE_COLLECTION, uid, FIRESTORE_CHUNKS_SUBCOLLECTION, String(idx));
}
function splitIntoChunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function readOfficeSnapshot(officeId: string): Promise<{ list: EmpresaRecord[]; updatedAt: number } | null> {
  try {
    const snap = await getDocs(chunksCollectionRef(officeId));
    if (!snap.empty) {
      const chunks: { idx: number; list: EmpresaRecord[]; updatedAt: number }[] = [];
      let maxUpdatedAt = 0;
      snap.forEach((d) => {
        const data = d.data() as { list?: EmpresaRecord[]; updatedAt?: number; chunk?: number };
        if (!Array.isArray(data?.list)) return;
        const idx = typeof data.chunk === 'number' ? data.chunk : parseInt(d.id, 10);
        chunks.push({
          idx: Number.isFinite(idx) ? idx : 0,
          list: data.list as EmpresaRecord[],
          updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
        });
        if (typeof data.updatedAt === 'number' && data.updatedAt > maxUpdatedAt) maxUpdatedAt = data.updatedAt;
      });
      if (chunks.length > 0) {
        chunks.sort((a, b) => a.idx - b.idx);
        return { list: chunks.flatMap((c) => c.list), updatedAt: maxUpdatedAt };
      }
    }
  } catch (e) {
    console.warn(`[empresas] load chunks ${officeId} falhou, a tentar legado:`, e);
  }
  const snap = await getDoc(doc(db, FIRESTORE_COLLECTION, officeId));
  if (!snap.exists()) return null;
  const data = snap.data();
  if (!Array.isArray(data?.list)) return null;
  return {
    list: data.list as EmpresaRecord[],
    updatedAt: typeof data?.updatedAt === 'number' ? data.updatedAt : 0,
  };
}

/** Avisa a UI do estado da sincronização cloud (App mostra/limpa o aviso). */
function emitCloudSync(ok: boolean, reason?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('estudo360:cloud-sync', { detail: { ok, reason } }));
}

// O XML original do SAF-T NÃO vai para a cloud: um único SAF-T grande rebenta o
// limite de 1 MiB/documento do Firestore e fazia o setDoc falhar EM SILÊNCIO —
// o computador que importava ficava com tudo local e os outros não recebiam
// nada (nem o balanço). Os dados DERIVADOS (perfil/contabilidade/fluxos/
// simulações) continuam todos a sincronizar; o ficheiro original fica
// disponível para re-exportar no computador onde foi importado.
export function stripSaftXmlForCloudSingle(e: EmpresaRecord): EmpresaRecord {
  if (!e.saftXml) return e;
  const { saftXml: _omit, ...rest } = e;
  return rest as EmpresaRecord;
}
export function stripSaftXmlForCloud(list: EmpresaRecord[]): EmpresaRecord[] {
  return list.map(e => {
    if (!e.saftXml) return e;
    const { saftXml: _omit, ...rest } = e;
    return rest as EmpresaRecord;
  });
}

export async function saveEmpresasToFirestore(
  _officeNif: string | undefined,
  list: EmpresaRecord[],
  stamp?: number,
): Promise<void> {
  let officeId: string;
  try { officeId = requireUid(); } catch { return; } // silencioso se deslogado
  try {
    const cloudList = stripSaftXmlForCloud(list);
    const payloadSize = JSON.stringify(cloudList).length;
    const chunks = splitIntoChunks(cloudList, CHUNK_SIZE);
    const updatedAt = stamp ?? getEmpresasStamp() ?? Date.now();
    const existentes = await getDocs(chunksCollectionRef(officeId));
    const writesNecessarios = chunks.length + Math.max(0, existentes.size - chunks.length) + 1;
    if (writesNecessarios > 450) {
      throw new Error(`Demasiados blocos para uma sincronização atómica (${writesNecessarios}/450).`);
    }

    // Um batch torna a atualização dos blocos + documento principal atómica.
    // Ou o novo snapshot fica inteiro, ou o anterior permanece intacto.
    const batch = writeBatch(db);
    for (let i = 0; i < chunks.length; i++) {
      batch.set(chunkDocRef(officeId, i), { list: chunks[i], updatedAt, chunk: i });
    }
    for (let i = chunks.length; i < existentes.size; i++) {
      batch.delete(chunkDocRef(officeId, i));
    }

    // Compatibilidade com clientes antigos; o doc principal também faz parte
    // do mesmo batch, por isso nunca fica à frente dos blocos.
    if (payloadSize < 980_000 && cloudList.length < 500) {
      batch.set(doc(db, FIRESTORE_COLLECTION, officeId), { list: cloudList, updatedAt });
    } else {
      batch.delete(doc(db, FIRESTORE_COLLECTION, officeId));
    }

    await batch.commit();
    emitCloudSync(true);
  } catch (err) {
    console.warn('[empresas] firestore save atómico falhou:', err);
    emitCloudSync(false, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

export async function loadEmpresasFromFirestore(
  _officeNif: string | undefined,
): Promise<{ list: EmpresaRecord[]; updatedAt: number } | null> {
  let officeId: string;
  try { officeId = requireUid(); } catch { return null; }
  try {
    return await readOfficeSnapshot(officeId);
  } catch (err) {
    console.warn('[empresas] firestore load falhou:', err);
    return null;
  }
}

/**
 * Listener LIVE do documento partilhado (o mesmo padrão do Gabinete com
 * onSnapshot). Sem isto cada dispositivo só lia a cloud NO ARRANQUE: um
 * computador que já estivesse aberto nunca via as empresas criadas/editadas
 * noutro — só depois de recarregar a página. É exatamente isto que fazia
 * "a lista de clientes não sincronizar em todos os computadores".
 *
 * Ignora ecos próprios e escritas mais antigas (remote.updatedAt <= stamp
 * local), por isso a adoção não dispara loops nem rebenta edições locais
 * mais recentes (LWW doc-inteiro, igual ao sync de arranque).
 */
export function subscribeEmpresasLive(
  _officeNif: string | undefined,
  onRemote: (list: EmpresaRecord[]) => void,
): () => void {
  const uid = getCurrentUid();
  if (!uid) return () => {};
  const officeId = empresasScopeId();
  if (officeId === SHARED_OFFICE_ID) return () => {};
  // Escuta chunks (novo) + legado doc (compat)
  let cancelled = false;
  let lastMax = getEmpresasStamp();
  const handleChunks = async (snap: any) => {
    if (cancelled) return;
    if (snap.empty) return; // sem chunks, deixa o fallback legado tratar
    const chunks: { idx: number; list: EmpresaRecord[]; updatedAt: number }[] = [];
    let maxUpdatedAt = 0;
    snap.forEach((d: any) => {
      const data = d.data() as { list?: EmpresaRecord[]; updatedAt?: number; chunk?: number };
      if (Array.isArray(data?.list)) {
        const idx = typeof data.chunk === 'number' ? data.chunk : parseInt(d.id, 10);
        chunks.push({ idx: Number.isFinite(idx) ? idx : 0, list: data.list as EmpresaRecord[], updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0 });
        if (typeof data.updatedAt === 'number' && data.updatedAt > maxUpdatedAt) maxUpdatedAt = data.updatedAt;
      }
    });
    if (chunks.length === 0) return;
    if (maxUpdatedAt <= lastMax) return; // eco próprio ou mais antigo
    lastMax = maxUpdatedAt;
    chunks.sort((a,b)=>a.idx-b.idx);
    const merged: EmpresaRecord[] = [];
    for (const c of chunks) merged.push(...c.list);
    const deduped = dedupeByNif(merged);
    // Preserva saftXml local (não vai para cloud)
    const localById = new Map(listEmpresas().map(e => [e.id, e]));
    const withSaft = deduped.map(e => {
      const loc = localById.get(e.id);
      return !e.saftXml && loc?.saftXml ? { ...e, saftXml: loc.saftXml } : e;
    });
    adoptRemoteEmpresas(withSaft, maxUpdatedAt);
    onRemote(withSaft);
  };
  const unsubChunks = onSnapshot(chunksCollectionRef(officeId), handleChunks, (err) => console.warn('[empresas] onSnapshot chunks falhou:', err));
  // Fallback legado: escuta doc único para migração / clientes antigos
  const unsubLegacy = onSnapshot(doc(db, FIRESTORE_COLLECTION, officeId), (snap) => {
    if (cancelled) return;
    // Se já temos chunks, ignora legado (evita duplicar)
    // Mas durante migração, o legado pode ter dados mais recentes que os chunks vazios
    // Verifica se chunks já têm dados: se handleChunks já processou, maxUpdatedAt > 0
    // Se ainda não, processa legado
    if (!snap.exists()) return;
    const data = snap.data() as { list?: EmpresaRecord[]; updatedAt?: number } | undefined;
    if (!Array.isArray(data?.list)) return;
    // Se já recebemos chunks com dados, ignora legado para não ressuscitar
    // Heurística: se getDocs de chunks já retornou algo, lastMax já foi atualizado
    // Para não complicar, só processa legado se ainda não recebemos chunks válidos
    // (lastMax ainda é o stamp local inicial e snap de chunks estava vazio)
    // Aqui não temos como saber se chunks estavam vazios; fazemos check assíncrono
    getDocs(chunksCollectionRef(officeId)).then(csnap => {
      if (!csnap.empty) return; // chunks já têm dados, ignora legado
      const remoteStamp = typeof data.updatedAt === 'number' ? data.updatedAt : 0;
      if (remoteStamp <= getEmpresasStamp()) return;
      const deduped = dedupeByNif(data.list as EmpresaRecord[]);
      adoptRemoteEmpresas(deduped, remoteStamp);
      lastMax = remoteStamp;
      onRemote(deduped);
    }).catch(()=>{});
  }, (err) => console.warn('[empresas] onSnapshot legado falhou:', err));
  return () => { cancelled = true; unsubChunks(); unsubLegacy(); };
}

/**
 * Repara "mojibake" — texto UTF-8 que foi lido como Latin-1/Windows-1252 (ex.
 * "AtlÃ¢ntico" → "Atlântico"). Os nomes importados de SAF-T ANTES da correção
 * de deteção de codificação ficaram corrompidos e já estão gravados na cloud;
 * esta função recupera-os de forma idempotente e sem rede.
 *
 * Reinterpreta os caracteres da string como bytes Latin-1 e volta a descodificar
 * como UTF-8. Só actua quando (a) há marcadores típicos de mojibake, (b) todos os
 * code points cabem num byte e (c) a re-descodificação é UTF-8 válido e fica
 * "mais limpa". Caso contrário devolve a string intacta.
 */
// repairMojibake vive agora em ./mojibake (partilhado com saft.ts). Re-exporta-se
// aqui para não quebrar quem o importe a partir de empresas.
export { repairMojibake };

// Repara os campos de texto (shallow) de um objeto plano, devolvendo uma cópia
// apenas se algo mudou. Não percorre objetos aninhados nem blobs.
function repairStringFields<T extends Record<string, unknown>>(obj: T): { value: T; changed: boolean } {
  let changed = false;
  const out: Record<string, unknown> = { ...obj };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (typeof v === 'string') {
      const r = repairMojibake(v);
      if (r !== v) { out[k] = r; changed = true; }
    }
  }
  return { value: out as T, changed };
}

// Repara o nome + campos de texto do perfil/previsa de uma empresa. Exclui de
// propósito `saftXml` (fonte para re-exportar) e `simulacoes` (snapshots opacos).
function repairEmpresaText(e: EmpresaRecord): { value: EmpresaRecord; changed: boolean } {
  let changed = false;
  const rec: EmpresaRecord = { ...e };
  const nome = repairMojibake(rec.nome);
  if (nome !== rec.nome) { rec.nome = nome; changed = true; }
  if (rec.saftFileName) {
    const f = repairMojibake(rec.saftFileName);
    if (f !== rec.saftFileName) { rec.saftFileName = f; changed = true; }
  }
  if (rec.profile && typeof rec.profile === 'object') {
    const { value, changed: c } = repairStringFields(rec.profile as unknown as Record<string, unknown>);
    if (c) { rec.profile = value as unknown as ClientProfile; changed = true; }
  }
  if (rec.previsa && typeof rec.previsa === 'object') {
    const { value, changed: c } = repairStringFields(rec.previsa as unknown as Record<string, unknown>);
    if (c) { rec.previsa = value as unknown as Partial<PreviSaState>; changed = true; }
  }
  return { value: rec, changed };
}

function repairEmpresasList(list: EmpresaRecord[]): { list: EmpresaRecord[]; changed: boolean } {
  let changed = false;
  const out = list.map(e => {
    const { value, changed: c } = repairEmpresaText(e);
    if (c) changed = true;
    return value;
  });
  return { list: out, changed };
}

// Repara mojibake na lista sincronizada e, se algo mudou, persiste a versão
// limpa (local + cloud) UMA vez. Idempotente: numa segunda passagem `changed` é
// falso e não há escrita → não há loop de sincronização. É isto que cura os
// nomes já corrompidos na cloud sem o utilizador ter de reimportar o SAF-T.
async function finalizeEmpresas(officeNif: string | undefined, list: EmpresaRecord[]): Promise<EmpresaRecord[]> {
  const { list: repaired, changed } = repairEmpresasList(list);
  if (!changed) return list;
  saveEmpresas(repaired);                                   // grava local + avança o relógio
  await saveEmpresasToFirestore(officeNif, repaired, getEmpresasStamp());
  return repaired;
}

/**
 * Sincroniza Firestore ↔ localStorage. Last-write-wins ao nível do DOCUMENTO,
 * usando o relógio do registry (`empresasUpdatedAt`):
 *
 *   • remoto mais recente  → adota a lista remota (suporta edições/eliminações
 *                            feitas noutro dispositivo);
 *   • local mais recente   → empurra a lista local para a cloud (faz a
 *                            ELIMINAÇÃO local vencer — mata o bug "Hydra", em
 *                            que a união por id ressuscitava empresas apagadas);
 *   • empate               → já estão sincronizados, não faz nada.
 *
 * Trade-off assumido: é LWW de documento inteiro, não merge por campo. Num
 * cenário multi-dispositivo com edições verdadeiramente concorrentes, o lado
 * mais recente sobrepõe-se ao outro. Para um escritório single-user é o
 * comportamento correto e previsível.
 */
/** Migra os dados antigos da conta para o espaço do gabinete ativo. */
async function migrateOwnedDataToGabineteIfNeeded(): Promise<void> {
  const uid = getCurrentUid();
  if (!uid) return;
  const targetId = empresasScopeId();
  if (!targetId || targetId === SHARED_OFFICE_ID || targetId === uid) return;
  try {
    const markerRef = doc(db, MIGRATION_COLLECTION, uid);
    const marker = await getDoc(markerRef).catch(() => null);
    if (marker?.exists() && marker.data()?.empresasParaGabinete) return;
    const [target, owned] = await Promise.all([
      readOfficeSnapshot(targetId).catch(() => null),
      readOfficeSnapshot(uid).catch(() => null),
    ]);
    // O gabinete já tem uma carteira partilhada: não voltar a importar a cópia
    // antiga da conta, senão clientes entretanto apagados seriam ressuscitados.
    if (target?.list.length) {
      await setDoc(markerRef, { empresasParaGabinete: targetId, at: Date.now() }, { merge: true });
      return;
    }
    if (!owned?.list.length) {
      await setDoc(markerRef, { empresasParaGabinete: targetId, at: Date.now() }, { merge: true });
      return;
    }
    const local = listEmpresas();
    const merged = mergeEmpresasUnion([target?.list || [], local, owned.list]);
    const stamp = Math.max(getEmpresasStamp(), target?.updatedAt || 0, owned.updatedAt || 0, Date.now());
    if (merged.length === 0) return;
    saveEmpresas(merged);
    await saveEmpresasToFirestore(undefined, merged, Math.max(stamp, getEmpresasStamp()));
    await setDoc(markerRef, { empresasParaGabinete: targetId, at: Date.now() }, { merge: true });
  } catch (e) {
    console.warn('[empresas] migração conta→gabinete falhou:', e);
  }
}
export async function syncEmpresasFromFirestore(officeNif: string | undefined): Promise<EmpresaRecord[]> {
  await migrateOwnedDataToGabineteIfNeeded();

  const remote = await loadEmpresasFromFirestore(officeNif);
  const local = listEmpresas();
  const localStamp = getEmpresasStamp();

  if (!remote) {
    // Primeira vez nesta firestore — promove o localStorage para a cloud.
    if (local.length > 0) await saveEmpresasToFirestore(officeNif, local, localStamp || Date.now());
    return finalizeEmpresas(officeNif, local);
  }

  if (remote.updatedAt > localStamp) {
    // Remoto vence → adota a lista remota por inteiro.
    const deduped = dedupeByNif(remote.list);
    adoptRemoteEmpresas(deduped, remote.updatedAt);
    return finalizeEmpresas(officeNif, deduped);
  }

  // Local mais recente (ou igual). Se for estritamente mais recente, propaga
  // para a cloud — é assim que uma eliminação local "pega" mesmo que o push
  // imediato do delete tenha falhado silenciosamente.
  const deduped = dedupeByNif(local);
  if (deduped.length !== local.length) saveEmpresas(deduped);
  if (localStamp > remote.updatedAt) {
    await saveEmpresasToFirestore(officeNif, deduped, getEmpresasStamp() || Date.now());
  }
  return finalizeEmpresas(officeNif, deduped);
}

/**
 * Remove empresas duplicadas com o MESMO NIF válido (9 dígitos), mantendo a de
 * `updatedAt` mais recente. Limpa o lixo acumulado por importações repetidas do
 * mesmo SAF-T (cada uma criava uma empresa com id diferente → "Hydra"). Empresas
 * sem NIF válido (recém-criadas, por preencher) são todas preservadas — são distintas.
 */
/**
 * União de várias listas de empresas: dedupe primeiro por `id` (mantém o registo
 * de `updatedAt` mais recente) e depois colapsa NIFs duplicados. É o que garante
 * que juntar baldes diferentes (NIF do escritório + 'default') não duplica nem
 * perde registos.
 */
export function mergeEmpresasUnion(lists: EmpresaRecord[][]): EmpresaRecord[] {
  const byId = new Map<string, EmpresaRecord>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const e of list) {
      if (!e || !e.id) continue;
      const ex = byId.get(e.id);
      if (!ex || (e.updatedAt ?? 0) > (ex.updatedAt ?? 0)) byId.set(e.id, e);
    }
  }
  return dedupeByNif([...byId.values()]);
}

export function dedupeByNif(list: EmpresaRecord[]): EmpresaRecord[] {
  const byNif = new Map<string, EmpresaRecord>();
  const noNif: EmpresaRecord[] = [];
  for (const e of list) {
    const nif = (e.nif ?? '').replace(/\D/g, '');
    if (/^\d{9}$/.test(nif)) {
      const ex = byNif.get(nif);
      if (!ex || (e.updatedAt ?? 0) > (ex.updatedAt ?? 0)) byNif.set(nif, e);
    } else {
      noNif.push(e);
    }
  }
  return [...byNif.values(), ...noNif];
}

/**
 * Migração single-client → registry: se existe um clientProfile antigo sem entrada
 * correspondente no registry, cria a primeira empresa a partir dele. Idempotente.
 */
export function migrateLegacyProfileIfNeeded(legacy: ClientProfile): void {
  const list = listEmpresas();
  if (list.length > 0) return;
  const nome = legacy.nomeCliente?.trim() || '';
  const nif = legacy.nif?.trim() || '';
  // Só migra se há sinal de utilização (nome ou nif preenchidos)
  if (!nome && !nif) return;
  const id = newId();
  upsertEmpresa({
    id,
    nome: nome || 'Empresa sem nome',
    nif,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    profile: legacy,
  });
  setCurrentEmpresaId(id);
}
