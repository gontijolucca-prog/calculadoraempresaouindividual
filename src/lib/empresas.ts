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
