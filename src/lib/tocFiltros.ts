/**
 * Filtros da importação TOConline.
 *
 * A mesma conta TOConline pode ter clientes de negócios diferentes (contabilidade,
 * condomínios, gestão de imóveis…). Antes de importar, o utilizador filtra por
 * tipo de NIF (empresa vs particular), primeiro dígito, nome/NIF/email e
 * localidade — e escolhe só o que quer.
 */

import type { TocCustomerDraft } from './toconline';

export type TipoCliente = 'empresa' | 'particular' | 'outro' | 'sem-nif';

/** 1/2/3 = pessoa singular · 5 = sociedade · 6 = entidade pública · 7 = não residente · 9 = outros. */
export function classificarNif(nif: string | undefined): TipoCliente {
  const d = String(nif || '').replace(/\D/g, '');
  if (!d) return 'sem-nif';
  const p = d[0];
  if (p === '1' || p === '2' || p === '3') return 'particular';
  if (p === '5') return 'empresa';
  if (p === '6' || p === '7' || p === '9') return 'outro';
  return 'outro';
}

export function primeiroDigito(nif: string | undefined): string {
  const d = String(nif || '').replace(/\D/g, '');
  return d ? d[0] : '';
}

export interface FiltrosToc {
  /** Texto livre: nome, NIF, email ou localidade. */
  q?: string;
  tipos?: TipoCliente[];      // vazio = todos
  digitos?: string[];         // vazio = todos
  localidade?: string;        // '' = todas
  soNovos?: boolean;
}

const norm = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function filtrarClientes(
  lista: TocCustomerDraft[],
  filtros: FiltrosToc,
  nifsExistentes: Set<string> = new Set(),
): TocCustomerDraft[] {
  const q = norm(filtros.q || '').trim();
  const tipos = filtros.tipos?.length ? new Set(filtros.tipos) : null;
  const digitos = filtros.digitos?.length ? new Set(filtros.digitos) : null;
  const loc = norm(filtros.localidade || '').trim();
  return lista.filter((c) => {
    if (filtros.soNovos && c.nif && nifsExistentes.has(c.nif)) return false;
    if (tipos && !tipos.has(classificarNif(c.nif))) return false;
    if (digitos && !digitos.has(primeiroDigito(c.nif))) return false;
    if (loc && norm(c.localidade) !== loc) return false;
    if (q) {
      const alvo = `${norm(c.nome)} ${c.nif || ''} ${norm(c.email)} ${norm(c.localidade)}`;
      if (!alvo.includes(q)) return false;
    }
    return true;
  });
}

/** Localidades distintas, ordenadas, para o seletor. */
export function localidadesDe(lista: TocCustomerDraft[]): string[] {
  return Array.from(new Set(lista.map((c) => (c.localidade || '').trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'pt'));
}

/** NIFs repetidos dentro da própria lista (não importar duas vezes). */
export function nifsDuplicados(lista: TocCustomerDraft[]): Set<string> {
  const vistos = new Set<string>();
  const dups = new Set<string>();
  for (const c of lista) {
    if (!c.nif) continue;
    if (vistos.has(c.nif)) dups.add(c.nif); else vistos.add(c.nif);
  }
  return dups;
}

export const ROTULO_TIPO: Record<TipoCliente, string> = {
  empresa: 'Empresas',
  particular: 'Particulares',
  outro: 'Outros',
  'sem-nif': 'Sem NIF',
};
