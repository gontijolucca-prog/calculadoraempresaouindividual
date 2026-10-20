/**
 * Identidade de célula nos mapas (Quadro Resumo, Mapa RH, Mapa Controlo).
 *
 * Antes, uma célula era "qualquer obrigação cujo `tipo` esteja nos tipos do
 * pilar". Vários pilares partilham os mesmos tipos (Salários e Pagamentos usam
 * ss+retencao), por isso marcar uma célula acendia várias e a escolha entre
 * elas era arbitrária. Agora cada obrigação sabe a que célula pertence
 * (`catalogoId` no Quadro; `mapa` + `pilarId` nos mapas) e o legado é
 * atribuído a um único pilar de forma determinística.
 */
import type { Obrigacao, ObrigacaoEstado, ObrigacaoTipo } from './gabinete';

export type MapaCelula = 'quadro' | 'controlo' | 'rh';
export type CelulaStatus = 'concluido' | 'nao_concluido' | 'sem_dados';

export interface CellKey {
  clienteId: string;
  mapa: MapaCelula;
  refId: string;
  ano: number;
  mes: number;
}

export interface PilarRef {
  id: string;
  label: string;
  labelFull?: string;
  tipos: readonly ObrigacaoTipo[];
}

export function chaveCelula(k: CellKey): string {
  return `${k.clienteId}|${k.mapa}|${k.refId}|${k.ano}-${String(k.mes).padStart(2, '0')}`;
}

const mesmoPeriodo = (o: Obrigacao, ano: number, mes: number): boolean => {
  const d = new Date(o.vencimento);
  return d.getFullYear() === ano && d.getMonth() + 1 === mes;
};

/** Um só pilar por obrigação legada: o que tem menos tipos (mais específico) e, em empate, o primeiro. */
export function resolverPilarLegado(
  obrigacoes: Obrigacao[],
  pilares: PilarRef[],
): Map<string, string> {
  const out = new Map<string, string>();
  for (const o of obrigacoes) {
    if (o.pilarId) continue;
    if (o.catalogoId) continue;
    let melhor: PilarRef | null = null;
    for (const p of pilares) {
      if (!p.tipos.includes(o.tipo)) continue;
      if (!melhor || p.tipos.length < melhor.tipos.length) melhor = p;
    }
    if (melhor) out.set(o.id, melhor.id);
  }
  return out;
}

/** A obrigação pertence a esta célula? */
export function correspondeCelula(
  o: Obrigacao,
  k: CellKey,
  tiposLegado: readonly ObrigacaoTipo[] = [],
  legado?: Map<string, string>,
): boolean {
  if (o.clienteId !== k.clienteId) return false;
  if (o.deletedAt) return false;
  if (!mesmoPeriodo(o, k.ano, k.mes)) return false;

  if (k.mapa === 'quadro') {
    if (o.catalogoId) return o.catalogoId === k.refId;
    if (o.mapa && o.pilarId) return false; // célula de mapa, não do quadro
    if (tiposLegado.length === 0) return false;
    return tiposLegado.includes(o.tipo);
  }

  if (o.mapa && o.pilarId) return o.mapa === k.mapa && o.pilarId === k.refId;
  if (o.pilarId) return o.pilarId === k.refId;
  if (o.catalogoId) return false;
  if (tiposLegado.length === 0) return false;
  if (legado) return legado.get(o.id) === k.refId;
  return tiposLegado.includes(o.tipo);
}

const prioridade = (s: ObrigacaoEstado): number => (s === 'entregue' ? 0 : s === 'atrasada' ? 1 : 2);

/** A obrigação efectiva da célula, com desempate estável (entregue > atrasada > pendente). */
export function obterObrigacaoCelula(
  obrigacoes: Obrigacao[],
  k: CellKey,
  tiposLegado: readonly ObrigacaoTipo[] = [],
  legado?: Map<string, string>,
): Obrigacao | undefined {
  let best: Obrigacao | undefined;
  for (const o of obrigacoes) {
    if (!correspondeCelula(o, k, tiposLegado, legado)) continue;
    if (!best) { best = o; continue; }
    const p = prioridade(o.estado);
    const pb = prioridade(best.estado);
    if (p < pb || (p === pb && (o.updatedAt || 0) > (best.updatedAt || 0))) best = o;
  }
  return best;
}

export function estadoCelula(o?: Obrigacao): CelulaStatus {
  if (!o) return 'sem_dados';
  return o.estado === 'entregue' ? 'concluido' : 'nao_concluido';
}

/** Próximo estado ao clicar: sem registo → concluído; concluído → não concluído; resto → concluído. */
export function proximoEstado(status: CelulaStatus): ObrigacaoEstado {
  return status === 'concluido' ? 'atrasada' : 'entregue';
}

const tituloMap: Record<string, string> = {
  modelo44: 'Modelo 44', saft: 'Envio SAF-T', iva: 'IVA', ies: 'IES',
  modelo10: 'Modelo 10', dmr: 'DMR', ss: 'Segurança Social',
};

export interface ClienteRef { id: string; nome: string }

/**
 * Payload da obrigação de uma célula. Preserva id/createdAt quando já existe e
 * grava sempre a identidade da célula (catalogoId ou mapa+pilarId).
 */
export function construirObrigacaoDaCelula(
  k: CellKey,
  pilar: PilarRef,
  cli: ClienteRef,
  existente?: Obrigacao,
  agora: number = Date.now(),
): Obrigacao {
  const mm = String(k.mes).padStart(2, '0');
  const venc = new Date(k.ano, k.mes - 1, 20).getTime();
  const label = pilar.labelFull?.trim() || pilar.label || pilar.id;
  const tituloBase = k.mapa === 'quadro' ? (tituloMap[pilar.id] || pilar.label) : label;
  const payload: Obrigacao = {
    ...(existente ?? {}),
    id: existente?.id || `obr_${Math.random().toString(36).slice(2, 9)}${agora.toString(36).slice(-4)}`,
    tipo: (pilar.tipos[0] as ObrigacaoTipo) || existente?.tipo || 'outro',
    titulo: `${tituloBase} ${mm}/${k.ano} — ${cli.nome}`,
    clienteId: cli.id,
    clienteNome: cli.nome,
    periodo: `${k.ano}-${mm}`,
    vencimento: venc,
    estado: proximoEstado(existente ? estadoCelula(existente) : 'sem_dados'),
    origem: existente?.origem ?? 'cliente',
    createdAt: existente?.createdAt || agora,
    updatedAt: agora,
  };
  if (k.mapa === 'quadro') {
    payload.catalogoId = pilar.id;
    delete payload.mapa;
    delete payload.pilarId;
  } else {
    payload.mapa = k.mapa;
    payload.pilarId = pilar.id;
  }
  return payload;
}
