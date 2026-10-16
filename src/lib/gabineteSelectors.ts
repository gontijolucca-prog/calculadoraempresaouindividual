/**
 * Seletores puros do Gabinete — sem Firestore, testáveis em node.
 * Usados pela Visão Geral, Agenda, Lixeira e pela migração de assuntos.
 */
import type { Tarefa } from './gabinete';

export interface ComDeletedAt { deletedAt?: number }

export function isActive<T extends ComDeletedAt>(item: T): boolean {
  return !item.deletedAt;
}
export function filterActive<T extends ComDeletedAt>(list: T[]): T[] {
  return list.filter(isActive);
}

export interface ObrigacaoLike {
  id: string;
  titulo: string;
  clienteId?: string;
  vencimento: number;
  estado: string;
  origem?: string;
}
export interface AlertaLike {
  id: string;
  texto: string;
  clienteId?: string;
  vencimento?: number;
  estado?: string;
}
export interface PrazoItem {
  id: string;
  kind: 'obrigacao' | 'alerta';
  titulo: string;
  clienteId?: string;
  vencimento: number;
  estado: string;
  atrasado: boolean;
}

/** Junta obrigações de cliente + alertas abertos com data, ordenados por vencimento. */
export function mergePrazos(
  obrigacoes: ObrigacaoLike[],
  alertas: AlertaLike[],
  opts?: { now?: number; limit?: number },
): PrazoItem[] {
  const now = opts?.now ?? Date.now();
  const items: PrazoItem[] = [];
  for (const o of obrigacoes) {
    if (o.origem === 'calendario_fiscal') continue;
    if (!o.vencimento) continue;
    const fechada = o.estado === 'entregue' || o.estado === 'dispensada';
    items.push({
      id: o.id, kind: 'obrigacao', titulo: o.titulo, clienteId: o.clienteId,
      vencimento: o.vencimento, estado: o.estado, atrasado: !fechada && o.vencimento < now,
    });
  }
  for (const a of alertas) {
    if ((a.estado ?? 'aberto') !== 'aberto') continue;
    if (!a.vencimento) continue;
    items.push({
      id: a.id, kind: 'alerta', titulo: a.texto, clienteId: a.clienteId,
      vencimento: a.vencimento, estado: a.estado ?? 'aberto', atrasado: a.vencimento < now,
    });
  }
  return items.sort((x, y) => x.vencimento - y.vencimento).slice(0, opts?.limit ?? 5);
}

export interface AssuntoLegacy {
  id: string;
  clienteId: string;
  clienteNome?: string;
  titulo: string;
  estado: 'em_curso' | 'aguard_cliente' | 'pendente' | 'concluido';
  createdAt: number;
  updatedAt: number;
}

export function tarefaFromAssunto(a: AssuntoLegacy, id: string): Tarefa {
  const estado: Tarefa['estado'] =
    a.estado === 'concluido' ? 'done' :
    a.estado === 'em_curso' ? 'doing' : 'todo';
  return {
    id,
    titulo: a.titulo,
    tipo: 'tarefa',
    estado,
    prioridade: 'media',
    clienteId: a.clienteId,
    clienteNome: a.clienteNome,
    origem: 'manual',
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}
