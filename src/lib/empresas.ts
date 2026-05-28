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
import { loadFromStorage, saveToStorage } from './storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

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
  simulacoes?: SimulationRecord[];  // histórico de simulações deste cliente
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

export function getOfficeId(officeNif?: string): string {
  const nif = (officeNif ?? '').trim();
  return /^\d{9}$/.test(nif) ? nif : 'default';
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
  const remote = await loadEmpresasFromFirestore(officeNif);
  const local = listEmpresas();
  const localStamp = getEmpresasStamp();

  if (!remote) {
    // Primeira vez nesta firestore — promove o localStorage para a cloud.
    if (local.length > 0) await saveEmpresasToFirestore(officeNif, local, localStamp || Date.now());
    return local;
  }

  if (remote.updatedAt > localStamp) {
    // Remoto vence → adopta a lista remota por inteiro.
    const deduped = dedupeByNif(remote.list);
    adoptRemoteEmpresas(deduped, remote.updatedAt);
    return deduped;
  }

  // Local mais recente (ou igual). Se for estritamente mais recente, propaga
  // para a cloud — é assim que uma eliminação local "pega" mesmo que o push
  // imediato do delete tenha falhado silenciosamente.
  const deduped = dedupeByNif(local);
  if (deduped.length !== local.length) saveEmpresas(deduped);
  if (localStamp > remote.updatedAt) {
    await saveEmpresasToFirestore(officeNif, deduped, getEmpresasStamp() || Date.now());
  }
  return deduped;
}

/**
 * Remove empresas duplicadas com o MESMO NIF válido (9 dígitos), mantendo a de
 * `updatedAt` mais recente. Limpa o lixo acumulado por importações repetidas do
 * mesmo SAF-T (cada uma criava uma empresa com id diferente → "Hydra"). Empresas
 * sem NIF válido (recém-criadas, por preencher) são todas preservadas — são distintas.
 */
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
