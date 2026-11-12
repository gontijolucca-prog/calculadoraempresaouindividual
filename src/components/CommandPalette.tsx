/**
 * Pesquisa global (⌘K / Ctrl+K).
 *
 * Procura num só sítio: clientes da carteira, fichas do gabinete, tarefas,
 * obrigações, credenciais do cofre (só o título/utilizador — nunca a password)
 * e ecrãs da aplicação. Navegação por teclado (↑ ↓ Enter Esc).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Briefcase, UserCircle2, CheckSquare, CalendarClock, KeyRound, LayoutGrid, CornerDownLeft } from 'lucide-react';
import { listEmpresas } from '../lib/empresas';
import { listClientesCache, listTarefasCache, listObrigacoesCache, listCofreCache } from '../lib/gabinete';
import { can, type PermissionAction } from '../lib/permissions';
import type { GabineteRole } from '../lib/gabinetes';

export type ResultadoTipo = 'empresa' | 'cliente' | 'tarefa' | 'obrigacao' | 'cofre' | 'ecra';

export interface ResultadoBusca {
  id: string;
  tipo: ResultadoTipo;
  titulo: string;
  detalhe?: string;
  acao: () => void;
}

interface Props {
  aberto: boolean;
  onFechar: () => void;
  onAbrirEmpresa: (empresaId: string, vista?: string) => void;
  onAbrirGabinete: (tab: string) => void;
  onMudarVista: (view: string) => void;
  role: GabineteRole | null;
}

const ICONES: Record<ResultadoTipo, React.ComponentType<{ className?: string }>> = {
  empresa: Briefcase,
  cliente: UserCircle2,
  tarefa: CheckSquare,
  obrigacao: CalendarClock,
  cofre: KeyRound,
  ecra: LayoutGrid,
};

const ROTULOS: Record<ResultadoTipo, string> = {
  empresa: 'Carteira',
  cliente: 'Cliente',
  tarefa: 'Tarefa',
  obrigacao: 'Obrigação',
  cofre: 'Cofre',
  ecra: 'Ecra',
};

/** Normaliza para comparar sem acentos e sem depender de maiúsculas. */
export function normalizarBusca(texto: string): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Filtra e ordena: prefixo no título primeiro, depois conteúdo. */
export function filtrarResultados(itens: ResultadoBusca[], termo: string, limite = 24): ResultadoBusca[] {
  const t = normalizarBusca(termo);
  if (!t) return itens.slice(0, limite);
  const pontuados: Array<{ item: ResultadoBusca; score: number }> = [];
  for (const item of itens) {
    const titulo = normalizarBusca(item.titulo);
    const detalhe = normalizarBusca(item.detalhe || '');
    let score = -1;
    if (titulo.startsWith(t)) score = 0;
    else if (titulo.includes(t)) score = 1;
    else if (detalhe.includes(t)) score = 2;
    if (score >= 0) pontuados.push({ item, score });
  }
  return pontuados.sort((a, b) => a.score - b.score).slice(0, limite).map((p) => p.item);
}

const ECRAS: Array<{ id: string; titulo: string; detalhe: string }> = [
  { id: 'empresas', titulo: 'Lista de Empresas', detalhe: 'Carteira de clientes' },
  { id: 'profile', titulo: 'Perfil do cliente', detalhe: 'Ficha 360' },
  { id: 'hub', titulo: 'Menu do cliente', detalhe: 'Simuladores do cliente ativo' },
  { id: 'tax', titulo: 'Simulador Fiscal', detalhe: 'ENI vs Sociedade' },
  { id: 'vehicle', titulo: 'Simulador de Viaturas', detalhe: 'Tributação autónoma' },
  { id: 'aquisicao', titulo: 'Aquisição de viatura', detalhe: 'Compra, crédito, leasing, renting' },
  { id: 'ticket', titulo: 'Simulador de Tickets', detalhe: 'Cartão refeição' },
  { id: 'selfss', titulo: 'SS Independente', detalhe: 'Contribuições' },
  { id: 'diagnostico', titulo: 'Diagnóstico de autonomia', detalhe: 'Resultado e risco' },
  { id: 'imoveis', titulo: 'Imóveis', detalhe: 'Aquisição e rendimento' },
  { id: 'imt', titulo: 'IMT', detalhe: 'Imposto municipal' },
  { id: 'salario', titulo: 'Salário líquido', detalhe: 'Retenção na fonte' },
  { id: 'irs', titulo: 'IRS', detalhe: 'Simulador anual' },
  { id: 'previsa', titulo: 'Previsão', detalhe: 'Modelo 22' },
  { id: 'historico', titulo: 'Histórico de simulações', detalhe: 'Simulações guardadas' },
  { id: 'exportar', titulo: 'Relatórios', detalhe: 'Documentos e PDFs' },
  { id: 'proposta', titulo: 'Propostas', detalhe: 'Proposta comercial' },
  { id: 'office-settings', titulo: 'Definições do Escritório', detalhe: 'Marca, honorários e cópia de segurança' },
  { id: 'legal', titulo: 'Base Legal', detalhe: 'Referências fiscais' },
];

const TABS_GABINETE: Array<{ id: string; titulo: string; detalhe: string; perm?: PermissionAction }> = [
  { id: 'visao-geral', titulo: 'Visão geral', detalhe: 'Ficha 360 do cliente' },
  { id: 'dashboard', titulo: 'Quadro de obrigações', detalhe: 'Janeiro a dezembro' },
  { id: 'mapa-controlo', titulo: 'Mapa de controlo', detalhe: '7 fases por cliente' },
  { id: 'mapa-rh', titulo: 'Mapa RH', detalhe: 'Salários, IRS, DMR' },
  { id: 'tarefas', titulo: 'Tarefas', detalhe: 'Kanban do gabinete' },
  { id: 'agenda', titulo: 'Agenda', detalhe: 'Prazos e compromissos' },
  { id: 'obrigacoes', titulo: 'Obrigações', detalhe: 'Lista e estados' },
  { id: 'cofre', titulo: 'Cofre', detalhe: 'Credenciais por cliente', perm: 'ver-cofre' },
  { id: 'equipa', titulo: 'Equipa', detalhe: 'Colaboradores e cargos', perm: 'gerir-equipa' },
  { id: 'lixeira', titulo: 'Lixeira', detalhe: 'Registos apagados' },
];

/** Constrói o índice a partir do que já está em memória (sem leituras novas). */
export function construirIndice(
  role: GabineteRole | null,
  onAbrirEmpresa: (id: string, vista?: string) => void,
  onAbrirGabinete: (tab: string) => void,
  onMudarVista: (view: string) => void,
): ResultadoBusca[] {
  const out: ResultadoBusca[] = [];

  for (const e of listEmpresas()) {
    out.push({
      id: `emp:${e.id}`,
      tipo: 'empresa',
      titulo: e.nome || 'Empresa sem nome',
      detalhe: e.nif || 'sem NIF',
      acao: () => onAbrirEmpresa(e.id, 'profile'),
    });
  }

  for (const c of listClientesCache()) {
    if (c.deletedAt) continue;
    out.push({
      id: `cli:${c.id}`,
      tipo: 'cliente',
      titulo: c.nome || 'Cliente sem nome',
      detalhe: c.nif || 'sem NIF',
      acao: () => onAbrirGabinete('visao-geral'),
    });
  }

  for (const t of listTarefasCache()) {
    if (t.deletedAt) continue;
    out.push({
      id: `tar:${t.id}`,
      tipo: 'tarefa',
      titulo: t.titulo || 'Tarefa',
      detalhe: [t.clienteNome, t.estado].filter(Boolean).join(' · '),
      acao: () => onAbrirGabinete('tarefas'),
    });
  }

  for (const o of listObrigacoesCache()) {
    if (o.deletedAt) continue;
    out.push({
      id: `obr:${o.id}`,
      tipo: 'obrigacao',
      titulo: o.titulo || 'Obrigação',
      detalhe: [o.clienteNome, o.estado].filter(Boolean).join(' · '),
      acao: () => onAbrirGabinete('obrigacoes'),
    });
  }

  if (can(role, 'ver-cofre')) {
    for (const k of listCofreCache()) {
      out.push({
        id: `cof:${k.id}`,
        tipo: 'cofre',
        titulo: k.titulo || 'Credencial',
        detalhe: [k.clienteNome, k.username].filter(Boolean).join(' · '),
        acao: () => onAbrirGabinete('cofre'),
      });
    }
  }

  for (const tab of TABS_GABINETE) {
    if (tab.perm && !can(role, tab.perm)) continue;
    out.push({
      id: `tab:${tab.id}`,
      tipo: 'ecra',
      titulo: tab.titulo,
      detalhe: `Gabinete · ${tab.detalhe}`,
      acao: () => onAbrirGabinete(tab.id),
    });
  }

  for (const v of ECRAS) {
    out.push({
      id: `view:${v.id}`,
      tipo: 'ecra',
      titulo: v.titulo,
      detalhe: v.detalhe,
      acao: () => onMudarVista(v.id),
    });
  }

  return out;
}

export default function CommandPalette({ aberto, onFechar, onAbrirEmpresa, onAbrirGabinete, onMudarVista, role }: Props) {
  const [termo, setTermo] = useState('');
  const [ativo, setAtivo] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  const indice = useMemo(
    () => (aberto ? construirIndice(role, onAbrirEmpresa, onAbrirGabinete, onMudarVista) : []),
    [aberto, role, onAbrirEmpresa, onAbrirGabinete, onMudarVista],
  );

  const resultados = useMemo(() => filtrarResultados(indice, termo), [indice, termo]);

  useEffect(() => {
    if (!aberto) return;
    setTermo('');
    setAtivo(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [aberto]);

  useEffect(() => { setAtivo(0); }, [termo]);

  const executar = useCallback((item: ResultadoBusca | undefined) => {
    if (!item) return;
    onFechar();
    // Deixa o modal fechar antes de navegar (evita disputa de foco).
    window.setTimeout(() => item.acao(), 0);
  }, [onFechar]);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onFechar(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAtivo((i) => Math.min(resultados.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAtivo((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        executar(resultados[ativo]);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [aberto, resultados, ativo, executar, onFechar]);

  useEffect(() => {
    const el = listaRef.current?.querySelector<HTMLElement>(`[data-idx="${ativo}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [ativo]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center bg-black/40 p-4 pt-[10vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Pesquisa global"
      onClick={onFechar}
    >
      <div
        className="w-full max-w-[560px] overflow-hidden rounded-[16px] border border-[#E2E8F0] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[#E2E8F0] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[#94A3B8]" aria-hidden="true" />
          <input
            ref={inputRef}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Procurar cliente, tarefa, obrigação, credencial ou ecrã…"
            aria-label="Procurar"
            className="w-full bg-transparent text-[14px] font-[600] text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
          />
          <kbd className="hidden shrink-0 rounded border border-[#E2E8F0] px-1.5 py-0.5 font-mono text-[10px] text-[#94A3B8] sm:block">ESC</kbd>
        </div>

        <div ref={listaRef} className="max-h-[52vh] overflow-y-auto p-2" role="listbox" aria-label="Resultados">
          {resultados.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12.5px] text-[#64748B]">Sem resultados para «{termo}».</p>
          ) : (
            resultados.map((r, i) => {
              const Icone = ICONES[r.tipo];
              const selecionado = i === ativo;
              return (
                <button
                  key={r.id}
                  type="button"
                  role="option"
                  aria-selected={selecionado}
                  data-idx={i}
                  onMouseEnter={() => setAtivo(i)}
                  onClick={() => executar(r)}
                  className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors ${selecionado ? 'bg-[var(--accent-soft)]' : 'hover:bg-[#F8FAFC]'}`}
                >
                  <Icone className={`h-4 w-4 shrink-0 ${selecionado ? 'text-[var(--accent)]' : 'text-[#94A3B8]'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-[700] text-[#0F172A]">{r.titulo}</span>
                    {r.detalhe && <span className="block truncate text-[11.5px] text-[#64748B]">{r.detalhe}</span>}
                  </span>
                  <span className="shrink-0 rounded bg-[#F1F5F9] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#64748B]">
                    {ROTULOS[r.tipo]}
                  </span>
                  {selecionado && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" aria-hidden="true" />}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-[10.5px] text-[#64748B]">
          <span>↑ ↓ para escolher · Enter para abrir · Esc para fechar</span>
          <span>{resultados.length} resultado(s)</span>
        </div>
      </div>
    </div>
  );
}
