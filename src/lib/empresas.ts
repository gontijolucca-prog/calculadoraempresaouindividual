/**
 * Registry de empresas (multi-cliente).
 *
 * Estrutura: Estudo 360 é um mini-CRM para escritórios de contabilidade. Cada
 * empresa tem o seu perfil próprio + dados de SAFT. O perfil "actual" (currentEmpresaId)
 * é o que está activo na sidebar — todos os simuladores e a vista Perfil leem dele.
 *
 * Persistência actual: localStorage. Migração futura para Firestore mantém esta API.
 */
import type { ClientProfile } from '../ClientProfile';
import type { PreviSaState } from '../previSaState';
import { loadFromStorage, saveToStorage } from './storage';
import { doc, getDoc, setDoc, getDocs, collection } from 'firebase/firestore';
import { db } from './firebase';
import { repairMojibake } from './mojibake';

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
}

const REGISTRY_KEY = 'empresas';
const CURRENT_KEY = 'currentEmpresaId';
// Relógio do registry (last-write-wins ao nível do documento). Qualquer mutação
// local — incluindo ELIMINAR — avança este stamp; a sincronização compara-o com
// o stamp do Firestore para decidir quem vence. É isto que faz uma eliminação
// "pegar": a lista mais recente substitui a outra por inteiro, em vez de se
// fazer união por id (que nunca conseguia representar uma remoção → "Hydra").
const STAMP_KEY = 'empresasUpdatedAt';

export function newId(): string {
  return 'emp_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function getEmpresasStamp(): number {
  const n = loadFromStorage<number>(STAMP_KEY, 0);
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

function setEmpresasStamp(n: number): void {
  saveToStorage(STAMP_KEY, n);
}

export function listEmpresas(): EmpresaRecord[] {
  const list = loadFromStorage<EmpresaRecord[]>(REGISTRY_KEY, []);
  return Array.isArray(list) ? list : [];
}

// Mutação local: grava a lista E avança o relógio do registry. O stamp é
// MONOTÓNICO — `max(agora, último+1)` — para que qualquer edição local fique
// estritamente acima de qualquer stamp já visto (incluindo um adoptado do
// Firestore). Isto fecha dois buracos: (a) editar no mesmo milissegundo em que
// se adoptou o remoto, e (b) relógios dessincronizados entre dispositivos.
export function saveEmpresas(list: EmpresaRecord[]): void {
  saveToStorage(REGISTRY_KEY, list);
  setEmpresasStamp(Math.max(Date.now(), getEmpresasStamp() + 1));
}

// Adopta uma lista vinda do Firestore SEM avançar o relógio — fica com o stamp
// remoto, para que sincronizações seguintes não pensem que o local é mais novo.
function adoptRemoteEmpresas(list: EmpresaRecord[], remoteStamp: number): void {
  saveToStorage(REGISTRY_KEY, list);
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
  return loadFromStorage<string | null>(CURRENT_KEY, null);
}

export function setCurrentEmpresaId(id: string | null): void {
  saveToStorage(CURRENT_KEY, id);
}

export function clearCurrentEmpresaId(): void {
  saveToStorage(CURRENT_KEY, null);
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

// Documento ÚNICO e partilhado por todos os dispositivos. Antes a chave do
// documento era o NIF do escritório (ou 'default' quando estava vazio) — o que
// partia os dados em baldes diferentes consoante o dispositivo tivesse, ou não,
// o NIF preenchido, e impedia a sincronização "em qualquer computador". A app é
// single-tenant (um escritório), por isso um documento fixo dá sync fiável.
// [Quando houver multi-escritório → trocar por request.auth.uid + Firebase Auth.]
const SHARED_OFFICE_ID = 'shared';
const MIGRATED_KEY = 'empresasMigratedToShared';

// Mantido por compatibilidade de assinatura, mas agora todos os dispositivos
// apontam ao mesmo documento partilhado (o NIF deixou de definir o balde).
export function getOfficeId(_officeNif?: string): string {
  return SHARED_OFFICE_ID;
}

export async function saveEmpresasToFirestore(
  officeNif: string | undefined,
  list: EmpresaRecord[],
  stamp?: number,
): Promise<void> {
  const officeId = getOfficeId(officeNif);
  try {
    await setDoc(doc(db, FIRESTORE_COLLECTION, officeId), {
      list,
      // Propaga o relógio do registry local. Sem isto, cada escrita levava
      // updatedAt=now e a sincronização nunca distinguia uma eliminação de
      // um estado mais antigo legítimo.
      updatedAt: stamp ?? getEmpresasStamp() ?? Date.now(),
    });
  } catch (err) {
    // Falha silenciosa — localStorage continua a ter os dados.
    console.warn('[empresas] firestore save falhou:', err);
  }
}

export async function loadEmpresasFromFirestore(
  officeNif: string | undefined,
): Promise<{ list: EmpresaRecord[]; updatedAt: number } | null> {
  const officeId = getOfficeId(officeNif);
  try {
    const snap = await getDoc(doc(db, FIRESTORE_COLLECTION, officeId));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (!Array.isArray(data?.list)) return null;
    const updatedAt = typeof data?.updatedAt === 'number' ? data.updatedAt : 0;
    return { list: data.list as EmpresaRecord[], updatedAt };
  } catch (err) {
    console.warn('[empresas] firestore load falhou:', err);
    return null;
  }
}

/**
 * Repara "mojibake" — texto UTF-8 que foi lido como Latin-1/Windows-1252 (ex.
 * "AtlÃ¢ntico" → "Atlântico"). Os nomes importados de SAF-T ANTES da correcção
 * de detecção de codificação ficaram corrompidos e já estão gravados na cloud;
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

// Repara os campos de texto (shallow) de um objecto plano, devolvendo uma cópia
// apenas se algo mudou. Não percorre objectos aninhados nem blobs.
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
 *   • remoto mais recente  → adopta a lista remota (suporta edições/eliminações
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
export async function syncEmpresasFromFirestore(officeNif: string | undefined): Promise<EmpresaRecord[]> {
  // Uma vez por dispositivo: junta no documento partilhado tudo o que estava
  // espalhado pelos baldes antigos (NIF do escritório + 'default'), para não se
  // perder nada na transição para a chave fixa.
  await migrateLegacyBucketsToShared();

  const remote = await loadEmpresasFromFirestore(officeNif);
  const local = listEmpresas();
  const localStamp = getEmpresasStamp();

  if (!remote) {
    // Primeira vez nesta firestore — promove o localStorage para a cloud.
    if (local.length > 0) await saveEmpresasToFirestore(officeNif, local, localStamp || Date.now());
    return finalizeEmpresas(officeNif, local);
  }

  if (remote.updatedAt > localStamp) {
    // Remoto vence → adopta a lista remota por inteiro.
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
function mergeEmpresasUnion(lists: EmpresaRecord[][]): EmpresaRecord[] {
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

/**
 * Migração única para o documento partilhado. Lê TODOS os documentos da coleção
 * `empresas` (os baldes antigos por NIF + 'default'), junta-os com a lista local
 * e grava o resultado no documento partilhado. Idempotente (a união converge) e
 * protegida por uma flag em localStorage para não correr a cada arranque.
 */
async function migrateLegacyBucketsToShared(): Promise<void> {
  if (loadFromStorage<boolean>(MIGRATED_KEY, false)) return;
  try {
    const snap = await getDocs(collection(db, FIRESTORE_COLLECTION));
    const lists: EmpresaRecord[][] = [listEmpresas()];
    snap.forEach(d => {
      const data = d.data() as { list?: EmpresaRecord[] } | undefined;
      if (Array.isArray(data?.list)) lists.push(data!.list);
    });
    const merged = mergeEmpresasUnion(lists);
    if (merged.length > 0) {
      saveEmpresas(merged); // grava local + avança o relógio do registry
      await setDoc(doc(db, FIRESTORE_COLLECTION, SHARED_OFFICE_ID), {
        list: merged,
        updatedAt: getEmpresasStamp(),
      });
    }
    saveToStorage(MIGRATED_KEY, true);
  } catch (err) {
    // Falha silenciosa — repete-se no próximo arranque (flag não fica marcada).
    console.warn('[empresas] migração para documento partilhado falhou:', err);
  }
}

function dedupeByNif(list: EmpresaRecord[]): EmpresaRecord[] {
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
