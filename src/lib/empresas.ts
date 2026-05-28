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

export interface EmpresaRecord {
  id: string;
  nome: string;
  nif: string;
  createdAt: number;
  updatedAt: number;
  profile: ClientProfile;
  saftFileName?: string;
  saftImportedAt?: number;
}

const REGISTRY_KEY = 'empresas';
const CURRENT_KEY = 'currentEmpresaId';

export function newId(): string {
  return 'emp_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function listEmpresas(): EmpresaRecord[] {
  const list = loadFromStorage<EmpresaRecord[]>(REGISTRY_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function saveEmpresas(list: EmpresaRecord[]): void {
  saveToStorage(REGISTRY_KEY, list);
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

export async function saveEmpresasToFirestore(officeNif: string | undefined, list: EmpresaRecord[]): Promise<void> {
  const officeId = getOfficeId(officeNif);
  try {
    await setDoc(doc(db, FIRESTORE_COLLECTION, officeId), {
      list,
      updatedAt: Date.now(),
    });
  } catch (err) {
    // Falha silenciosa — localStorage continua a ter os dados.
    console.warn('[empresas] firestore save falhou:', err);
  }
}

export async function loadEmpresasFromFirestore(officeNif: string | undefined): Promise<EmpresaRecord[] | null> {
  const officeId = getOfficeId(officeNif);
  try {
    const snap = await getDoc(doc(db, FIRESTORE_COLLECTION, officeId));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (!Array.isArray(data?.list)) return null;
    return data.list as EmpresaRecord[];
  } catch (err) {
    console.warn('[empresas] firestore load falhou:', err);
    return null;
  }
}

/**
 * Sincroniza Firestore → localStorage no arranque da app.
 * Estratégia merge: Firestore wins por id+updatedAt; novos items do
 * localStorage que não existam no Firestore são adicionados ao registry.
 */
export async function syncEmpresasFromFirestore(officeNif: string | undefined): Promise<EmpresaRecord[]> {
  const remote = await loadEmpresasFromFirestore(officeNif);
  const local = listEmpresas();
  if (!remote) {
    // Primeira vez nesta firestore — promove o localStorage para a cloud.
    if (local.length > 0) await saveEmpresasToFirestore(officeNif, local);
    return local;
  }
  // Merge by id, mais recente updatedAt vence.
  const byId = new Map<string, EmpresaRecord>();
  for (const e of remote) byId.set(e.id, e);
  for (const e of local) {
    const existing = byId.get(e.id);
    if (!existing || (e.updatedAt ?? 0) > (existing.updatedAt ?? 0)) byId.set(e.id, e);
  }
  const merged = Array.from(byId.values());
  saveEmpresas(merged);
  return merged;
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
