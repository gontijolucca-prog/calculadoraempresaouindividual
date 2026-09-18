import React, { useMemo, useState } from 'react';
import { Search, Plus, Users, CheckSquare, Calendar, Lock, Building2, Trash2, Eye, EyeOff, Copy, Shield, AlertTriangle, ArrowRight, Sparkles, ChevronLeft, ChevronRight, Clock, Briefcase, MessageSquare, X, Send, Archive, Share2 } from 'lucide-react';
import { useGabineteClientes, useGabineteTarefas, useGabineteObrigacoes, useGabineteCofre, useGabineteContactosGeral, useGabineteAssuntos, useGabineteAlertas, useGabineteOcorrencias, useGabineteDocumentos, useGabineteColaboradores } from './lib/useGabinete';
import { seedMykolaVasylDemo, ensureAllClientesDefaults, linkColaboradorPorEmail } from './lib/gabinete';
import {
  upsertTarefa, deleteTarefa, marcarTarefaFeita, newTarefaId,
  upsertObrigacao,
  upsertCofre, deleteCofre, registarVistaCofre, newCofreId,
  type GabineteCliente, type Tarefa, type Obrigacao, type ObrigacaoTipo, type ObrigacaoEstado, type CofreEntrada,
} from './lib/gabinete';
import { listEmpresas } from './lib/empresas';
import { getActiveGabineteId, clearActiveGabineteId, getGabineteMeta } from './lib/gabinetes';
import { loadOfficeSettings } from './lib/officeSettings';
// Cofre simples (sem cifra) — Firestore só visível pela própria conta (gabinete/{uid}/cofre/*)
import GuiaSugestao from './components/GuiaSugestao';
import type { ViewKey } from './lib/guias';
import { GabineteGallery, GabineteIntro, GABINET_FUNCTIONS, type GabTab, type GabineteTab } from './GabineteHub';
import VisaoGeralView from './VisaoGeralView';
import GabineteEquipa from './GabineteEquipa';

// Guia por tab interna do Gabinete (a sugestão muda conforme a tab ativa)
const GAB_TAB_GUIA: Record<GabTab, ViewKey> = {
  'mapa-controlo': 'gabinete',
  dashboard: 'gabinete',
  'visao-geral': 'gab-visao-geral',
  equipa: 'gab-equipa',
  agenda: 'gab-agenda',
  tarefas: 'gab-tarefas',
  obrigacoes: 'gab-obrigacoes',
  cofre: 'gab-cofre',
};

// ─── Layout ─────────────────────────────────────────────────────────────────

const VALID_GAB_TABS_SET = new Set<GabineteTab>(['dashboard','mapa-controlo','visao-geral','equipa','agenda','tarefas','obrigacoes','cofre','gallery']);
export default function Gabinete({ tab: controlledTab, onTabChange, onStartTour, activeEmpresaId, activeEmpresaNome, onGoEmpresas }: { tab?: GabineteTab; onTabChange?: (t: GabineteTab) => void; onStartTour?: (v: ViewKey) => void; activeEmpresaId?: string | null; activeEmpresaNome?: string | null; onGoEmpresas?: () => void }) {
  const [internalTab, setInternalTab] = useState<GabTab>('dashboard');
  const rawTab: GabineteTab = controlledTab ?? internalTab;
  const tab: GabineteTab = VALID_GAB_TABS_SET.has(rawTab) ? rawTab : 'gallery';
  const setTab = (onTabChange ?? setInternalTab) as (t: GabineteTab) => void;
  // Cada função abre primeiro o card informativo. O botão "Abrir função"
  // marca apenas a função atual como vista e mostra o ecrã funcional.
  const [introDismissedFor, setIntroDismissedFor] = useState<GabTab | null>(null);
  const showIntro = tab !== 'gallery' && tab !== 'visao-geral' && tab !== 'cofre' && introDismissedFor !== tab;
  const openFunction = (target: GabTab) => setTab(target);
  const openCurrentFunction = () => {
    if (tab !== 'gallery') setIntroDismissedFor(tab);
  };
  const backToGallery = () => {
    setIntroDismissedFor(null);
    setTab('gallery');
  };
  const activeFunction = tab === 'gallery' ? null : GABINET_FUNCTIONS.find((item) => item.id === tab);
  const clientes = useGabineteClientes();
  const tarefasRaw = useGabineteTarefas();
  const obrigacoesRaw = useGabineteObrigacoes();
  const cofre = useGabineteCofre();
  const contactosAll = useGabineteContactosGeral();
  const assuntosAll = useGabineteAssuntos();
  const alertasAll = useGabineteAlertas();
  const ocorrenciasAll = useGabineteOcorrencias();
  const documentosAll = useGabineteDocumentos();
  const tarefas = useMemo(() => activeEmpresaId ? tarefasRaw.filter(t => !t.clienteId || t.clienteId === activeEmpresaId) : tarefasRaw, [tarefasRaw, activeEmpresaId]);
  const obrigacoes = useMemo(() => activeEmpresaId ? obrigacoesRaw.filter(o => !o.clienteId || o.clienteId === activeEmpresaId) : obrigacoesRaw, [obrigacoesRaw, activeEmpresaId]);
  const contactosF = useMemo(() => activeEmpresaId ? contactosAll.filter(c => c.clienteId === activeEmpresaId) : contactosAll, [contactosAll, activeEmpresaId]);
  const assuntosF = useMemo(() => activeEmpresaId ? assuntosAll.filter(a => a.clienteId === activeEmpresaId) : assuntosAll, [assuntosAll, activeEmpresaId]);
  const alertasF = useMemo(() => activeEmpresaId ? alertasAll.filter(a => a.clienteId === activeEmpresaId) : alertasAll, [alertasAll, activeEmpresaId]);
  const ocorrenciasF = useMemo(() => activeEmpresaId ? ocorrenciasAll.filter(o => o.clienteId === activeEmpresaId) : ocorrenciasAll, [ocorrenciasAll, activeEmpresaId]);
  const documentosF = useMemo(() => activeEmpresaId ? documentosAll.filter(d => d.clienteId === activeEmpresaId) : documentosAll, [documentosAll, activeEmpresaId]);
  const colaboradores = useGabineteColaboradores();
  React.useEffect(() => { seedMykolaVasylDemo().catch(()=>{}); ensureAllClientesDefaults().catch(()=>{}); import('./lib/firebase').then(m=>{ const uid = m.auth?.currentUser?.uid; const email = m.auth?.currentUser?.email; if(uid && email) linkColaboradorPorEmail(email, uid).catch(()=>{}); }).catch(()=>{}); }, []);
  const clienteAtivo = useMemo(() => {
    if (!activeEmpresaId) return null;
    const gc = clientes.find(c => c.id === activeEmpresaId);
    if (gc) return gc;
    // Fallback: tenta EmpresaRecord
    try {
      const er = listEmpresas().find(e => e.id === activeEmpresaId);
      if (er) {
        const parts = (er.nome || '').trim().split(/\s+/);
        const ini = parts.slice(0,2).map(s=>s[0]?.toUpperCase()||'').join('') || 'CL';
        return {
          id: er.id, nome: er.nome || 'Empresa', nif: er.nif || '', tipoEntidade: 'LDA' as const,
          regimeIva: 'trimestral' as const, estado: 'ativo' as const,
          createdAt: Date.now(), updatedAt: Date.now(), empresaId: er.id,
        } as unknown as GabineteCliente;
      }
    } catch {}
    return null;
  }, [clientes, activeEmpresaId]);

  // Por defeito, se o App não passar callback, navega para o dashboard (no-op)
  const startTour = (v: ViewKey) => onStartTour?.(v);
  const activeGabineteLabel = (() => {
    try { const v = getActiveGabineteId(); return v; } catch { return null; }
  })();
  const activeGabineteIdForHeader = activeGabineteLabel;
  const [activeGabineteNome, setActiveGabineteNome] = useState<string | null>(() => {
    try {
      const off = loadOfficeSettings();
      if (off?.nome?.trim()) return off.nome.trim();
    } catch {}
    return null;
  });
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = activeGabineteIdForHeader;
      if (!id) return;
      try {
        const meta = await getGabineteMeta(id);
        if (!cancelled && meta?.nome) setActiveGabineteNome(meta.nome);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [activeGabineteIdForHeader]);
  const guideView = tab === 'gallery' ? null : GAB_TAB_GUIA[tab];
  const clearGabineteAndReload = () => {
    try { clearActiveGabineteId(); } catch {
      try { localStorage.removeItem('estudo360:v1:gabinete:activeId'); localStorage.removeItem('estudo360:v1:gabinete:officeId'); } catch {}
    }
    window.dispatchEvent(new CustomEvent('estudo360:gabinete-switch', { detail: { id: null } } as any));
    window.location.reload();
  };
  const functionLabel = activeFunction?.label ?? 'Centro de operação';
  const functionDesc = activeFunction?.desc ?? 'Escolhe uma função para começar';
  const goFunction = (target: GabTab) => setTab(target);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-6 text-zinc-900">
      {/* A galeria tem os seus próprios tiles informativos; cada função mantém
          a sugestão de guia contextual quando já estamos dentro dela. */}
      {guideView && <GuiaSugestao view={guideView} onStart={startTour} />}

      {/* Header — sem tabs no topo; navegação continua no dropdown da sidebar */}
      <div className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0677FF] text-sm font-bold text-white">360</div>
            <div>
              <div className="font-semibold leading-none">Gabinete</div>
              <div className="hidden text-xs text-zinc-500 sm:block">{functionLabel} · {functionDesc}</div>
            </div>
          </div>
          <button onClick={clearGabineteAndReload} className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">
              {(activeGabineteNome || 'Gabinete').slice(0, 28)} · Trocar
            </button>
          <div className="hidden sm:flex items-center gap-2 text-right text-xs text-zinc-500">
            <span>{clientes.length} clientes</span>
            <span className="opacity-30">•</span>
            <span>{tarefas.filter(t=>t.estado!=='done').length} tarefas abertas</span>
            <span className="opacity-30">•</span>
            <span>{cofre.length} acessos</span>
          </div>
          <button onClick={clearGabineteAndReload} className="sm:hidden inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700">Trocar</button>
          <div className="sm:hidden text-right text-[11px] leading-tight text-zinc-500">
            <div>{clientes.length} clientes</div>
            <div>{tarefas.filter(t=>t.estado!=='done').length} abertas</div>
          </div>
        </div>
      </div>
      {activeEmpresaNome && (
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 pt-3">
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm flex items-center gap-2">
            <span className="font-semibold text-[#0677FF]">A trabalhar: {activeEmpresaNome}</span>
            <span className="text-zinc-500">— agenda, tarefas e obrigações filtradas para este cliente.</span>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        {tab === 'gallery' && <GabineteGallery onOpen={openFunction} />}
        {tab !== 'gallery' && showIntro && (
          <GabineteIntro tab={tab} onOpen={openCurrentFunction} onBack={backToGallery} />
        )}
        {tab !== 'gallery' && !showIntro && (
          <>
            {tab === 'visao-geral' && (!activeEmpresaId ? <div className="bg-white rounded-2xl border p-8 text-center"><p className="text-sm text-zinc-600">Escolhe um cliente na lista para ver a visão geral.</p><button onClick={()=>onGoEmpresas?.()} className="mt-3 px-4 py-2 rounded-xl bg-[#0677FF] text-white text-sm">Ir para Lista de Empresas</button></div> : <VisaoGeralView cliente={clienteAtivo} contactos={contactosF} assuntos={assuntosF} alertas={alertasF} ocorrencias={ocorrenciasF} tarefas={tarefas} obrigacoes={obrigacoes} cofre={cofre} documentos={documentosF} colaboradores={colaboradores} onEditCliente={()=>{}} onGo={(tab)=>setTab(tab as GabineteTab)} onOpenCofre={()=>setTab('cofre')} />)}
            {tab === 'dashboard' && <Dashboard clientes={clientes} tarefas={tarefasRaw} obrigacoes={obrigacoesRaw} cofre={cofre} onGo={goFunction} />}
            {tab === 'mapa-controlo' && <MapaControloView clientes={clientes} obrigacoes={obrigacoesRaw} />}
            {tab === 'agenda' && (!activeEmpresaId ? <div className="bg-white rounded-2xl border p-8 text-center"><p className="text-sm text-zinc-600">Escolhe um cliente na lista para ver a agenda.</p><button onClick={()=>onGoEmpresas?.()} className="mt-3 px-4 py-2 rounded-xl bg-[#0677FF] text-white text-sm">Ir para Lista de Empresas</button></div> : <AgendaView tarefas={tarefas} obrigacoes={obrigacoes} clientes={clientes} />)}
            {tab === 'tarefas' && (!activeEmpresaId ? <div className="bg-white rounded-2xl border p-8 text-center"><p className="text-sm text-zinc-600">Escolhe um cliente na lista para ver as tarefas.</p><button onClick={()=>onGoEmpresas?.()} className="mt-3 px-4 py-2 rounded-xl bg-[#0677FF] text-white text-sm">Ir para Lista de Empresas</button></div> : <TarefasView tarefas={tarefas} clientes={clientes} obrigacoes={obrigacoes} activeEmpresaId={activeEmpresaId} activeEmpresaNome={activeEmpresaNome} />)}
            {tab === 'obrigacoes' && (!activeEmpresaId ? <div className="bg-white rounded-2xl border p-8 text-center"><p className="text-sm text-zinc-600">Escolhe um cliente na lista para ver as obrigações.</p><button onClick={()=>onGoEmpresas?.()} className="mt-3 px-4 py-2 rounded-xl bg-[#0677FF] text-white text-sm">Ir para Lista de Empresas</button></div> : <ObrigacoesView obrigacoes={obrigacoes} clientes={clientes} activeEmpresaId={activeEmpresaId} />)}
            {tab === 'equipa' && <GabineteEquipa />}
            {tab === 'cofre' && <CofreView cofre={cofre} clientes={clientes} />}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Kpi({ label, value, sub, icon: Icon, tone = 'blue' }: { label:string; value:string|number; sub?:string; icon: React.ElementType; tone?: string }) {
  const tones: Record<string,string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    rose: 'bg-rose-50 text-rose-600 border-rose-200',
    zinc: 'bg-zinc-50 text-zinc-600 border-zinc-200',
  };
  return (
    <div className={`rounded-2xl border p-4 bg-white ${tones[tone] ?? tones.blue} border-current/20`}>
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${tones[tone]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-2xl font-bold text-zinc-900">{value}</span>
      </div>
      <div className="mt-3 text-sm font-medium text-zinc-900">{label}</div>
      {sub && <div className="text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

function Dashboard({ clientes, tarefas, obrigacoes, cofre, onGo }: { clientes:GabineteCliente[]; tarefas:Tarefa[]; obrigacoes:Obrigacao[]; cofre:CofreEntrada[]; onGo:(t:GabTab)=>void }) {
  const colaboradores = useGabineteColaboradores();
  const meses = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'] as const;

  // —— Definição das linhas do quadro (igual ao screenshot) ——
  type LinhaDef = { id: string; label: string; tipos: ObrigacaoTipo[]; fallback?: string };
  const linhasDef: LinhaDef[] = [
    { id: 'modelo44', label: 'Modelo 44', tipos: ['modelo22','dossier'] },
    { id: 'saft', label: 'Envio SAFT', tipos: ['dossier','outro'] },
    { id: 'iva', label: 'Iva Trimestral', tipos: ['iva'] },
    { id: 'ies', label: 'IES', tipos: ['ies'] },
    { id: 'pec', label: 'PEC', tipos: ['ppc'] },
    { id: 'modelo10', label: 'Modelo 10', tipos: ['retencao'] },
    { id: 'dmr', label: 'DMR', tipos: ['retencao','ss'] },
    { id: 'ss', label: 'Segurança Social', tipos: ['ss'] },
  ];

  // —— Filtros (como na imagem) ——
  const [todosClientes, setTodosClientes] = useState(true);
  const [filtroClienteTexto, setFiltroClienteTexto] = useState('');
  const [gestorFiltro, setGestorFiltro] = useState<string>(''); // '' = todos
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [todasObrigacoes, setTodasObrigacoes] = useState(true);
  const [filtroObrigacao, setFiltroObrigacao] = useState<string>(''); // id da linha
  const [soNaoConcluido, setSoNaoConcluido] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Auto-expandir no primeiro load quando há clientes
  useMemo(() => {
    if (clientes.length && expanded.size === 0) {
      setExpanded(new Set(clientes.slice(0, 4).map(c => c.id)));
    }
  }, []);

  const toggleCliente = (id: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const expandirTodos = () => setExpanded(new Set(clientes.map(c => c.id)));
  const colapsarTodos = () => setExpanded(new Set());

  // Filtragem de clientes
  const clientesFiltrados = useMemo(() => {
    let list = [...clientes];
    if (!todosClientes) {
      const t = filtroClienteTexto.trim().toLowerCase();
      if (t) list = list.filter(c => (c.nome + ' ' + c.nif).toLowerCase().includes(t));
    }
    if (gestorFiltro) {
      list = list.filter(c => {
        const g = gestorFiltro.toLowerCase();
        const ri = (c.responsavelInterno?.nome || '').toLowerCase();
        const sup = (c.supervisor?.nome || '').toLowerCase();
        const adm = (c.apoioAdministrativo?.nome || '').toLowerCase();
        const rid = (c as any).responsavelId || '';
        const sid = (c as any).supervisorId || '';
        // tenta match por id ou nome
        return rid === gestorFiltro || sid === gestorFiltro || ri.includes(g) || sup.includes(g) || adm.includes(g);
      });
    }
    if (soNaoConcluido) {
      // só clientes que têm pelo menos um Não Concluído no ano
      // calcula rápido via obrigacoes
      // filtrado mais abaixo — por agora mantém todos, filtra na render
    }
    return list;
  }, [clientes, todosClientes, filtroClienteTexto, gestorFiltro]);

  const linhasFiltradas = useMemo(() => {
    if (todasObrigacoes) return linhasDef;
    if (!filtroObrigacao) return linhasDef;
    return linhasDef.filter(l => l.id === filtroObrigacao);
  }, [todasObrigacoes, filtroObrigacao]);

  const isEmptyGlobal = clientes.length === 0 && tarefas.length === 0 && obrigacoes.length === 0;
  const hasAlgumaObrigacao = obrigacoes.length > 0;

  // —— Estado da célula ——
  type CellStatus = 'concluido' | 'nao_aplicavel' | 'inexistente' | 'nao_concluido';
  const getStatusExemplo = (linhaId: string, mes: number): CellStatus => {
    // replica o screenshot 2017 para quando não há dados reais
    switch(linhaId) {
      case 'modelo44': return mes === 1 ? 'concluido' : 'inexistente';
      case 'saft': if (mes <= 2) return 'nao_aplicavel'; if (mes <= 8) return 'concluido'; return 'nao_concluido';
      case 'iva': if ([2,5,8].includes(mes)) return 'concluido'; if (mes === 11) return 'nao_concluido'; return 'inexistente';
      case 'ies': return mes === 7 ? 'concluido' : 'inexistente';
      case 'pec': if (mes === 3) return 'concluido'; if (mes === 11) return 'nao_concluido'; return 'inexistente';
      case 'modelo10': return mes === 2 ? 'concluido' : 'inexistente';
      case 'dmr': return mes <= 8 ? 'concluido' : 'nao_concluido';
      case 'ss': return mes <= 8 ? 'concluido' : 'nao_concluido';
      default: return 'inexistente';
    }
  };

  const getCellStatus = (cli: GabineteCliente, linha: LinhaDef, mes: number, anoNum: number): CellStatus => {
    // Procura obrigação real para este cliente/mês/tipo
    // match por vencimento mês/ano e tipo
    const hits = obrigacoes.filter(o => {
      if (o.clienteId !== cli.id) return false;
      const d = new Date(o.vencimento);
      if (d.getFullYear() !== anoNum) return false;
      if (d.getMonth() + 1 !== mes) return false;
      // tipo mapping: linha.tipos inclui o.tipo
      // para IVA/mensal vs trimestral, aceita qualquer iva
      return linha.tipos.includes(o.tipo as ObrigacaoTipo) || linha.tipos.includes(o.tipo as any);
    });
    // se houver mais de uma, prioriza entregue > dispensada > atrasada > pendente
    let best: Obrigacao | undefined;
    for (const o of hits) {
      if (!best) { best = o; continue; }
      const prio = (s: ObrigacaoEstado) => s === 'entregue' ? 0 : s === 'dispensada' ? 1 : s === 'atrasada' ? 2 : 3;
      if (prio(o.estado) < prio(best.estado)) best = o;
    }
    if (best) {
      if (best.estado === 'entregue') return 'concluido';
      if (best.estado === 'dispensada') return 'nao_aplicavel';
      if (best.estado === 'atrasada') return 'nao_concluido';
      // pendente
      // se vencimento < hoje => não concluído, senão inexistente? mas para futuro marca como não concluído para bater com print
      if (best.vencimento < Date.now()) return 'nao_concluido';
      return 'nao_concluido';
    }
    // Nenhum registo real -> se não há qualquer obrigação no sistema, mostra exemplo
    if (!hasAlgumaObrigacao) {
      return getStatusExemplo(linha.id, mes);
    }
    // Marca Não Aplicável por regime: IVA isento
    if (linha.id === 'iva' && cli.regimeIva === 'isencao53') return 'nao_aplicavel';
    // Se cliente não tem obrigação desse tipo naquele mês, é Inexistente
    return 'inexistente';
  };

  const toggleCell = async (cli: GabineteCliente, linha: LinhaDef, mes: number) => {
    const status = getCellStatus(cli, linha, mes, ano);
    // ciclo: inexistente -> concluido -> nao_concluido -> nao_aplicavel -> inexistente
    let nextEstado: ObrigacaoEstado | null = null;
    let nextStatus: CellStatus;
    if (status === 'inexistente') nextStatus = 'concluido';
    else if (status === 'concluido') nextStatus = 'nao_concluido';
    else if (status === 'nao_concluido') nextStatus = 'nao_aplicavel';
    else nextStatus = 'inexistente';

    if (nextStatus === 'inexistente') {
      // remove obrigação desse mês/tipo se existir
      const hits = obrigacoes.filter(o => o.clienteId === cli.id && new Date(o.vencimento).getMonth()+1 === mes && new Date(o.vencimento).getFullYear() === ano && linha.tipos.includes(o.tipo as any));
      for (const h of hits) {
        const { deleteObrigacao } = await import('./lib/gabinete');
        // também apaga tarefa espelho? não necessário
        try { await deleteObrigacao(h.id); } catch {}
      }
      return;
    }
    if (nextStatus === 'concluido') nextEstado = 'entregue';
    else if (nextStatus === 'nao_aplicavel') nextEstado = 'dispensada';
    else if (nextStatus === 'nao_concluido') nextEstado = 'atrasada';

    // cria ou atualiza
    const venc = new Date(ano, mes - 1, 20).getTime();
    // procura existente para update
    const existing = obrigacoes.find(o => o.clienteId === cli.id && new Date(o.vencimento).getMonth()+1 === mes && new Date(o.vencimento).getFullYear() === ano && linha.tipos.includes(o.tipo as any));
    const tituloMap: Record<string,string> = { modelo44:'Modelo 44', saft:'Envio SAFT', iva: cli.regimeIva === 'mensal' ? 'IVA Mensal' : 'Iva Trimestral', ies:'IES', pec:'PEC', modelo10:'Modelo 10', dmr:'DMR', ss:'Segurança Social' };
    const titulo = `${tituloMap[linha.id] || linha.label} ${String(mes).padStart(2,'0')}/${ano} — ${cli.nome}`;
    const payload: Obrigacao = {
      id: existing?.id || ('obr_' + Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-4)),
      tipo: (linha.tipos[0] as ObrigacaoTipo) || 'outro',
      titulo,
      clienteId: cli.id,
      clienteNome: cli.nome,
      periodo: `${ano}-${String(mes).padStart(2,'0')}`,
      vencimento: venc,
      estado: nextEstado!,
      origem: 'cliente',
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    await upsertObrigacao(payload);
  };

  const renderIcon = (s: CellStatus, withBg = false) => {
    if (s === 'concluido') return <span title="Concluído" className={`inline-flex w-6 h-6 items-center justify-center font-bold text-[13px] leading-none rounded ${withBg ? 'bg-emerald-600 text-white' : 'text-emerald-600'}`}>✓</span>;
    if (s === 'nao_aplicavel') return <span title="Não Aplicável" className="inline-flex w-6 h-6 items-center justify-center text-zinc-900 text-[12px] leading-none rounded bg-zinc-100 border border-zinc-200">●</span>;
    if (s === 'nao_concluido') return <span title="Não Concluído" className={`inline-flex w-6 h-6 items-center justify-center font-bold text-[13px] leading-none rounded ${withBg ? 'bg-red-600 text-white' : 'text-red-600'}`}>✕</span>;
    return <span title="Inexistente" className="inline-flex w-6 h-6 items-center justify-center text-zinc-500 text-[13px] leading-none rounded bg-zinc-50 border border-zinc-200">∅</span>;
  };

  const handleImprimir = () => window.print();
  const handleExportExcel = () => {
    const rows: string[] = [];
    const header = ['Cliente','Obrigação',...meses].join(';');
    rows.push(header);
    for (const cli of clientesFiltrados) {
      for (const linha of linhasFiltradas) {
        const cells = meses.map((_, i) => {
          const st = getCellStatus(cli, linha, i+1, ano);
          const map: Record<CellStatus,string> = { concluido:'Concluído', nao_aplicavel:'Não Aplicável', inexistente:'Inexistente', nao_concluido:'Não Concluído' };
          return map[st];
        });
        rows.push([cli.nome, linha.label, ...cells].join(';'));
      }
    }
    const csv = rows.join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Quadro_Resumo_Obrigacoes_${ano}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const showVazio = clientesFiltrados.length === 0;

  return (
    <div className="space-y-3 print:space-y-2">
      {/* Barra de filtros — replica a imagem */}
      <div className="bg-white rounded-[10px] border border-zinc-300 shadow-sm overflow-hidden print:shadow-none">
        <div className="px-3 py-2.5 border-b border-zinc-200 bg-[#F8FAFC] flex flex-wrap items-center gap-2.5">
          <label className="inline-flex items-center gap-1.5 text-[13px] font-medium">
            <input type="checkbox" checked={todosClientes} onChange={e=>setTodosClientes(e.target.checked)} className="w-4 h-4 rounded border-zinc-400 text-[#0677FF] focus:ring-[#0677FF]" />
            Todos os Clientes
          </label>
          <div className="flex items-center gap-1">
            <input value={filtroClienteTexto} onChange={e=>setFiltroClienteTexto(e.target.value)} disabled={todosClientes} placeholder={todosClientes ? '' : 'pesquisar cliente…'} className={`w-[160px] px-2 py-1.5 rounded border text-sm ${todosClientes ? 'bg-zinc-100 border-zinc-200 text-zinc-400' : 'bg-white border-zinc-300'}`} />
            <button disabled={todosClientes} className="px-2 py-1.5 rounded border border-zinc-300 bg-zinc-50 text-xs disabled:opacity-50">…</button>
          </div>
          <input value={filtroClienteTexto} onChange={e=>setFiltroClienteTexto(e.target.value)} disabled={todosClientes} placeholder={todosClientes ? '' : 'filtrar por nome/NIF…'} className={`flex-1 min-w-[180px] px-2 py-1.5 rounded border text-sm ${todosClientes ? 'bg-zinc-100 border-zinc-200' : 'bg-white border-zinc-300'}`} />
          <span className="text-sm text-zinc-600">Gestor</span>
          <select value={gestorFiltro} onChange={e=>setGestorFiltro(e.target.value)} className="min-w-[160px] px-2 py-1.5 rounded border border-zinc-300 bg-white text-sm">
            <option value="">(todos)</option>
            {colaboradores.map(c=> <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <span className="text-sm text-zinc-600">Ano</span>
          <input type="number" value={ano} onChange={e=>setAno(parseInt(e.target.value)|| new Date().getFullYear())} className="w-[78px] px-2 py-1.5 rounded border border-zinc-300 bg-white text-sm" />
          <button onClick={()=>{ /* filtros já são live */ }} className="ml-auto px-6 py-1.5 rounded border-2 border-[#0677FF] bg-white text-[#0677FF] font-semibold text-sm hover:bg-blue-50">Ok</button>
        </div>
        <div className="px-3 py-2 flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-[13px] font-medium">
            <input type="checkbox" checked={todasObrigacoes} onChange={e=>setTodasObrigacoes(e.target.checked)} className="w-4 h-4 rounded border-zinc-400 text-[#0677FF] focus:ring-[#0677FF]" />
            Todas as Obrigações
          </label>
          <select value={filtroObrigacao} onChange={e=>setFiltroObrigacao(e.target.value)} disabled={todasObrigacoes} className={`flex-1 px-2 py-1.5 rounded border text-sm ${todasObrigacoes ? 'bg-zinc-100 border-zinc-200 text-zinc-400' : 'bg-white border-zinc-300'}`}>
            <option value="">(todas)</option>
            {linhasDef.map(l=> <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-[10px] border border-zinc-300 shadow-sm overflow-hidden print:border-zinc-400">
        <div className="overflow-auto max-h-[62vh] print:max-h-none print:overflow-visible">
          <table className="w-full text-[13px] border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#4A4A4A] text-white text-[11px] tracking-wide">
                <th className="text-left font-semibold px-2 py-2 w-[280px] min-w-[220px] sticky left-0 bg-[#4A4A4A] z-20 border-r border-[#606060]">Cliente</th>
                {meses.map(m=> <th key={m} className="text-center font-semibold px-1 py-2 w-[56px] min-w-[48px] border-l border-[#606060]">{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {showVazio ? (
                <tr><td colSpan={13} className="px-4 py-16 text-center">
                  <div className="text-zinc-500 text-sm">Nenhum cliente corresponde aos filtros.</div>
                  <div className="text-zinc-400 text-xs mt-1">Cria clientes na carteira ou limpa os filtros.</div>
                </td></tr>
              ) : clientesFiltrados.map(cli => {
                const isExpanded = expanded.has(cli.id);
                return (
                  <React.Fragment key={cli.id}>
                    <tr className="bg-[#ECECEC] border-t border-zinc-300">
                      <td className="px-1 py-1.5 sticky left-0 bg-[#ECECEC] z-[5] border-r border-zinc-300">
                        <button onClick={()=>toggleCliente(cli.id)} className="inline-flex items-center gap-1.5 w-full text-left">
                          <span className="w-4 h-4 rounded-[3px] border border-zinc-400 bg-white flex items-center justify-center text-[11px] leading-none shrink-0">{isExpanded ? '−' : '+'}</span>
                          <span className="font-semibold text-[#0F172A] truncate">{cli.nome}</span>
                        </button>
                      </td>
                      {meses.map((_, i)=> <td key={i} className="border-l border-zinc-200 bg-[#ECECEC]"></td>)}
                    </tr>
                    {isExpanded && linhasFiltradas.map(linha => (
                      <tr key={linha.id} className="border-t border-zinc-200 hover:bg-zinc-50/70">
                        <td className="px-2 py-1.5 pl-7 flex items-center gap-1.5 sticky left-0 bg-white z-[5] border-r border-zinc-200">
                          <span className="w-4 h-4 rounded-[3px] border border-amber-400 bg-amber-50 flex items-center justify-center shrink-0">
                            <span className="w-2 h-2 rounded-[1px] bg-amber-500 block" />
                          </span>
                          <span className="text-amber-700 font-medium truncate">{linha.label}</span>
                        </td>
                        {meses.map((_, idx) => {
                          const mesNum = idx + 1;
                          const st = getCellStatus(cli, linha, mesNum, ano);
                          const cellBg = st==='concluido' ? 'bg-emerald-50' : st==='nao_concluido' ? 'bg-red-50' : '';
                          return (
                            <td key={idx} className={`text-center border-l border-zinc-200 py-0.5 ${cellBg}`}>
                              <button onClick={()=>toggleCell(cli, linha, mesNum)} className="w-full h-full flex items-center justify-center hover:brightness-95 rounded py-1">
                                {renderIcon(st, true)}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Rodapé — botões + legenda (igual à imagem) */}
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 bg-[#F1F1F1] border-t border-zinc-300 text-xs print:bg-white">
          <button onClick={handleImprimir} className="px-3 py-1.5 rounded border border-zinc-400 bg-gradient-to-b from-white to-zinc-100 hover:from-zinc-50 hover:to-zinc-200 text-zinc-800 font-medium shadow-sm">Imprimir</button>
          <button onClick={handleExportExcel} className="px-3 py-1.5 rounded border border-zinc-400 bg-gradient-to-b from-white to-zinc-100 hover:from-zinc-50 hover:to-zinc-200 text-zinc-800 font-medium shadow-sm">Exportar Excel</button>
          <button onClick={expandirTodos} className="px-3 py-1.5 rounded border border-zinc-400 bg-gradient-to-b from-white to-zinc-100 hover:from-zinc-50 hover:to-zinc-200 text-zinc-800 font-medium shadow-sm">Expandir todos</button>
          <button onClick={colapsarTodos} className="px-3 py-1.5 rounded border border-zinc-400 bg-gradient-to-b from-white to-zinc-100 hover:from-zinc-50 hover:to-zinc-200 text-zinc-800 font-medium shadow-sm">Colapsar todos</button>
          <div className="ml-auto flex flex-wrap items-center gap-4 text-[12px] text-zinc-700">
            <span className="inline-flex items-center gap-1.5"><span className="text-emerald-600 font-bold">✓</span> Concluído</span>
            <span className="inline-flex items-center gap-1.5"><span className="text-zinc-900">●</span> Não Aplicável</span>
            <span className="inline-flex items-center gap-1.5"><span className="text-zinc-600">∅</span> Inexistente</span>
            <span className="inline-flex items-center gap-1.5"><span className="text-red-600 font-bold">✕</span> Não Concluído</span>
          </div>
        </div>
      </div>

      {isEmptyGlobal && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900 flex gap-2">
          <span className="font-bold">Exemplo:</span>
          <span>Sem clientes ainda — a mostrar como fica com dados. Cria clientes e as obrigações ganham estado real (clica numa célula para alternar: ✓ → ✕ → ● → ∅).</span>
        </div>
      )}
      <div className="text-[11px] text-zinc-500 px-1">
        Clica numa célula para alternar o estado. Filtros: cliente / gestor / ano / obrigação. O quadro guarda em Firestore e atualiza live para toda a equipa.
      </div>
    </div>
  );
}

// ─── Mapa de Controlo Contabilidade — 7 pilares por trimestre ──────────────
function MapaControloView({ clientes, obrigacoes }: { clientes:GabineteCliente[]; obrigacoes:Obrigacao[] }) {
  const colabs = useGabineteColaboradores();
  const meses = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'] as const;

  // 7 colunas do screenshot 1 (cores distintas)
  type Pilar = { key: string; labelShort: string; labelFull: string; color: string; bgHeader: string; tipos: ObrigacaoTipo[] };
  const pilares: Pilar[] = [
    { key:'docfalta',  labelShort:'Gestão Doc.',  labelFull:'Gestão Doc. em Falta',     color:'#0B57D0', bgHeader:'bg-[#E8F0FE]', tipos:['dossier','outro'] },
    { key:'vendas',    labelShort:'Vendas',       labelFull:'Vendas/Recebimentos',      color:'#0F9D58', bgHeader:'bg-[#E6F4EA]', tipos:['iva','dossier'] },
    { key:'compras',   labelShort:'Compras',      labelFull:'Compras/Pagamentos',       color:'#F29900', bgHeader:'bg-[#FEF7E0]', tipos:['iva','dossier'] },
    { key:'salarios',  labelShort:'Salários',     labelFull:'Interface Salários',       color:'#7C4DFF', bgHeader:'bg-[#F3E8FD]', tipos:['retencao','ss'] },
    { key:'aft',       labelShort:'AFT',          labelFull:'AFT - Aquisição/Alienação',color:'#E91E63', bgHeader:'bg-[#FCE8EF]', tipos:['dossier','outro'] },
    { key:'banco',     labelShort:'Banco',        labelFull:'Rec. Bancária',            color:'#0097A7', bgHeader:'bg-[#E0F7FA]', tipos:['dossier','outro'] },
    { key:'balancete', labelShort:'Balancete',    labelFull:'Verificação do Balancete Analítico', color:'#EF6C00', bgHeader:'bg-[#FFF3E0]', tipos:['ies','modelo22','dossier'] },
  ];

  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [trim, setTrim] = useState<string>(''); // '' = todos, '1'..'4'
  const [filtroCliente, setFiltroCliente] = useState('');
  const [gestor, setGestor] = useState<string>('');
  const [grupo, setGrupo] = useState<string>(''); // tag cliente
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (id: string) => setCollapsed(prev => { const n=new Set(prev); if(n.has(id)) n.delete(id); else n.add(id); return n; });

  const visMeses = (() => {
    if (trim==='1') return [0,1,2];
    if (trim==='2') return [3,4,5];
    if (trim==='3') return [6,7,8];
    if (trim==='4') return [9,10,11];
    return [0,1,2,3,4,5,6,7,8,9,10,11];
  })();

  const clientesFiltrados = (() => {
    let list=[...clientes];
    const t=filtroCliente.trim().toLowerCase();
    if(t) list=list.filter(c=> (c.nome+' '+c.nif+' '+(c.tags||[]).join(' ')).toLowerCase().includes(t));
    if(gestor){ const g=gestor.toLowerCase(); list=list.filter(c=> { const ri=(c.responsavelInterno?.nome||'').toLowerCase(); const sup=(c.supervisor?.nome||'').toLowerCase(); const rid=(c as any).responsavelId||''; const sid=(c as any).supervisorId||''; return rid===gestor || sid===gestor || ri.includes(g) || sup.includes(g); }); }
    if(grupo){ list=list.filter(c=> (c.tags||[]).includes(grupo)); }
    return list;
  })();

  const getStatus = (cli:GabineteCliente, pilar:Pilar, mes:number): 'concluido'|'nao_aplicavel'|'inexistente'|'nao_concluido' => {
    const hits = obrigacoes.filter(o=> o.clienteId===cli.id && new Date(o.vencimento).getFullYear()===ano && new Date(o.vencimento).getMonth()+1===mes && pilar.tipos.includes(o.tipo as any));
    let best: Obrigacao | undefined;
    for(const o of hits){ if(!best) best=o; else { const prio=(s:ObrigacaoEstado)=> s==='entregue'?0:s==='dispensada'?1:s==='atrasada'?2:3; if(prio(o.estado)<prio(best.estado)) best=o; } }
    if(best){ if(best.estado==='entregue') return 'concluido'; if(best.estado==='dispensada') return 'nao_aplicavel'; if(best.estado==='atrasada') return 'nao_concluido'; return best.vencimento < Date.now() ? 'nao_concluido' : 'nao_concluido'; }
    // fallback demo quando vazio
    if(obrigacoes.length===0){
      const h=(cli.id.charCodeAt(0)+mes*7)%4;
      return (['concluido','nao_aplicavel','inexistente','nao_concluido'] as const)[h];
    }
    return 'inexistente';
  };

  const toggleCell = async (cli:GabineteCliente, pilar:Pilar, mes:number) => {
    const cur=getStatus(cli,pilar,mes);
    let next: 'concluido'|'nao_aplicavel'|'inexistente'|'nao_concluido';
    if(cur==='inexistente') next='concluido';
    else if(cur==='concluido') next='nao_concluido';
    else if(cur==='nao_concluido') next='nao_aplicavel';
    else next='inexistente';
    if(next==='inexistente'){
      const hits=obrigacoes.filter(o=> o.clienteId===cli.id && new Date(o.vencimento).getMonth()+1===mes && new Date(o.vencimento).getFullYear()===ano && pilar.tipos.includes(o.tipo as any));
      for(const h of hits){ try{ const {deleteObrigacao}=await import('./lib/gabinete'); await deleteObrigacao(h.id);}catch{} }
      return;
    }
    const estado: ObrigacaoEstado = next==='concluido'?'entregue': next==='nao_aplicavel'?'dispensada':'atrasada';
    const venc=new Date(ano,mes-1,20).getTime();
    const existing=obrigacoes.find(o=> o.clienteId===cli.id && new Date(o.vencimento).getMonth()+1===mes && new Date(o.vencimento).getFullYear()===ano && pilar.tipos.includes(o.tipo as any));
    const payload: Obrigacao = {
      id: existing?.id || ('obr_'+Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4)),
      tipo: pilar.tipos[0] as any || 'outro',
      titulo: `${pilar.labelFull} ${String(mes).padStart(2,'0')}/${ano} — ${cli.nome}`,
      clienteId: cli.id, clienteNome: cli.nome,
      periodo: `${ano}-${String(mes).padStart(2,'0')}`,
      vencimento: venc, estado, origem:'cliente',
      createdAt: existing?.createdAt || Date.now(), updatedAt: Date.now(),
    };
    await upsertObrigacao(payload);
  };

  const renderIcon = (st:string, withBg=false) => {
    if(st==='concluido') return <span className={`inline-flex w-6 h-6 items-center justify-center font-bold text-[13px] rounded ${withBg?'bg-emerald-600 text-white':'text-emerald-600'}`}>✓</span>;
    if(st==='nao_aplicavel') return <span className="inline-flex w-6 h-6 items-center justify-center text-zinc-900 text-[11px] rounded bg-zinc-100 border border-zinc-200">●</span>;
    if(st==='nao_concluido') return <span className={`inline-flex w-6 h-6 items-center justify-center font-bold text-[13px] rounded ${withBg?'bg-red-600 text-white':'text-red-600'}`}>✕</span>;
    return <span className="inline-flex w-6 h-6 items-center justify-center text-zinc-500 text-[11px] rounded bg-zinc-50 border border-zinc-200">∅</span>;
  };

  const exportCSV = () => {
    const rows:string[]=[]; const header=['Cliente','Nº',...pilares.flatMap(pi=> meses.filter((_,i)=>visMeses.includes(i)).map(m=> `${pi.labelShort} ${m}`))].join(';'); rows.push(header);
    for(const cli of clientesFiltrados){ const cells=pilares.flatMap(pi=> meses.filter((_,i)=>visMeses.includes(i)).map((_,idx)=>{ const mes=visMeses[idx]+1; const st=getStatus(cli,pi,mes); const map:any={concluido:'Concluído',nao_aplicavel:'Não Aplicável',inexistente:'Inexistente',nao_concluido:'Não Concluído'}; return map[st]; })); rows.push([cli.nome, cli.nif||'', ...cells].join(';')); }
    const csv=rows.join('\n'); const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`Mapa_Controlo_${ano}${trim?'_T'+trim:''}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const grupos = Array.from(new Set(clientes.flatMap(c=> c.tags||[])));

  return (
    <div className="space-y-3">
      {/* Filtros — réplica imagem 2 (Nº Mapa, Ano, Trimestre, Cliente, Gestor, Grupo) + ano local */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-3 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-zinc-600">Nº Mapa</span>
          <input value="5" readOnly className="w-[70px] px-2 py-1.5 rounded border border-zinc-300 bg-zinc-50 text-sm text-center" />
          <span className="text-sm text-zinc-600">Ano</span>
          <select value={String(ano)} onChange={e=>setAno(parseInt(e.target.value)||new Date().getFullYear())} className="px-2 py-1.5 rounded border border-zinc-300 bg-white text-sm">
            {[ano-2,ano-1,ano,ano+1,ano+2].map(a=> <option key={a} value={String(a)}>{a}</option>)}
          </select>
          <span className="text-sm text-zinc-600">Trimestre</span>
          <select value={trim} onChange={e=>setTrim(e.target.value)} className="px-2 py-1.5 rounded border border-zinc-300 bg-white text-sm min-w-[140px]">
            <option value="">—</option>
            <option value="1">1º Trimestre</option><option value="2">2º Trimestre</option><option value="3">3º Trimestre</option><option value="4">4º Trimestre</option>
          </select>
          <button onClick={()=>{}} className="px-4 py-1.5 rounded border-2 border-[#3B82F6] text-[#2563EB] font-semibold text-sm bg-white">Ok</button>
          <div className="ml-auto flex gap-1.5">
            <button onClick={()=>window.print()} className="px-3 py-1.5 rounded border border-zinc-300 bg-white text-xs font-medium">Imprimir</button>
            <button onClick={exportCSV} className="px-3 py-1.5 rounded border border-zinc-300 bg-white text-xs font-medium">Exportar XLS</button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-600 whitespace-nowrap">Pesquisa Cliente</span>
            <input value={filtroCliente} onChange={e=>setFiltroCliente(e.target.value)} placeholder="nome ou NIF…" className="flex-1 px-2 py-1.5 rounded border border-zinc-300 bg-white text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-600">Gestor</span>
            <select value={gestor} onChange={e=>setGestor(e.target.value)} className="flex-1 px-2 py-1.5 rounded border border-zinc-300 bg-white text-sm">
              <option value="">(todos)</option>
              {colabs.map(c=> <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-600">Grupo</span>
            <select value={grupo} onChange={e=>setGrupo(e.target.value)} className="flex-1 px-2 py-1.5 rounded border border-zinc-300 bg-white text-sm">
              <option value="">(todos)</option>
              {grupos.map(g=> <option key={g} value={g}>{g}</option>)}
            </select>
            <button onClick={()=>{ setFiltroCliente(''); setGestor(''); setGrupo(''); setTrim(''); }} className="px-3 py-1.5 rounded border border-zinc-300 bg-white text-xs">Limpar</button>
          </div>
        </div>
      </div>

      {/* Header 7 pilares — faixa verde da imagem 1 com cores distintas por pilar */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="grid" style={{gridTemplateColumns: `repeat(${pilares.length}, minmax(0,1fr))`}}>
          {pilares.map(pi=> (
            <div key={pi.key} className={`px-3 py-3 text-center border-r last:border-0 border-zinc-200 ${pi.bgHeader}`} style={{borderTop:`4px solid ${pi.color}`}}>
              <div className="text-[12px] font-extrabold leading-tight" style={{color: pi.color}}>{pi.labelFull}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabela principal — clientes agrupados por trimestre/mês */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[62vh]">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#3D5A73] text-white text-[11px]">
                <th className="text-left px-2 py-2 sticky left-0 bg-[#3D5A73] z-20 border-r border-[#2F455C] min-w-[180px]">Nº / Cliente</th>
                {pilares.map(pi=> (
                  <th key={pi.key} colSpan={visMeses.length} className="text-center px-1 py-2 border-l border-[#2F455C]" style={{background: pi.color}}>{pi.labelShort}</th>
                ))}
              </tr>
              <tr className="bg-[#E8EEF3] text-[11px] font-bold text-zinc-700">
                <th className="sticky left-0 bg-[#E8EEF3] z-10 border-r border-zinc-300 px-2 py-1.5"></th>
                {pilares.map(pi=> visMeses.map(mi=> <th key={pi.key+'-'+mi} className="text-center px-1 py-1.5 border-l border-zinc-300 min-w-[44px]">{meses[mi]}</th>))}
              </tr>
              {/* segunda linha de colunas curtas como no screenshot (Rec./Arq./Lang./Conf.) — aqui simplificado por mês */}
            </thead>
            <tbody>
              {clientesFiltrados.length===0 ? (
                <tr><td colSpan={1+pilares.length*visMeses.length} className="px-4 py-12 text-center text-sm text-zinc-500">Sem clientes para os filtros. Cria clientes ou limpa filtros.</td></tr>
              ) : clientesFiltrados.map((cli, idx)=> (
                <React.Fragment key={cli.id}>
                  <tr className={`border-t ${idx%2===0?'bg-[#F8F9FA]':'bg-white'}`}>
                    <td className={`px-2 py-2 sticky left-0 z-[5] border-r border-zinc-200 font-medium ${idx%2===0?'bg-[#F8F9FA]':'bg-white'}`}>
                      <button onClick={()=>toggle(cli.id)} className="flex items-center gap-1.5 w-full text-left">
                        <span className="text-zinc-500 text-[11px]">{collapsed.has(cli.id) ? '▶' : '▼'}</span>
                        <span className="text-[11px] text-zinc-500">SW{String(idx+1).padStart(3,'0')}</span>
                        <span className="text-[12px] font-semibold text-[#1A3A5A] truncate">{cli.nome}</span>
                      </button>
                    </td>
                    {pilares.map(pi=> visMeses.map(mi=> {
                      const mes=mi+1; const st=getStatus(cli,pi,mes); const withBg = st==='concluido' || st==='nao_concluido';
                      const cellBg = st==='concluido' ? 'bg-emerald-50' : st==='nao_concluido' ? 'bg-red-50' : '';
                      return (
                        <td key={pi.key+'-'+mi} className={`text-center border-l border-zinc-200 py-1 ${cellBg}`}>
                          <button onClick={()=>toggleCell(cli,pi,mes)} className="w-full flex items-center justify-center py-0.5">
                            {renderIcon(st, withBg)}
                          </button>
                        </td>
                      );
                    }))}
                  </tr>
                  {!collapsed.has(cli.id) && null /* reserva para detalhe expandido se precisares */}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 bg-[#F1F1F1] border-t border-zinc-300 text-xs">
          <div className="flex gap-1.5">
            <button onClick={()=>window.print()} className="px-3 py-1.5 rounded border border-zinc-400 bg-white">Imprimir</button>
            <button onClick={exportCSV} className="px-3 py-1.5 rounded border border-zinc-400 bg-white">Exportar XLS</button>
            <button onClick={()=>{ const s=new Set<string>(); clientesFiltrados.forEach(c=>s.add(c.id)); setCollapsed(new Set()); }} className="hidden sm:inline-flex px-3 py-1.5 rounded border border-zinc-400 bg-white">Expandir todos</button>
            <button onClick={()=>setCollapsed(new Set(clientesFiltrados.map(c=>c.id)))} className="hidden sm:inline-flex px-3 py-1.5 rounded border border-zinc-400 bg-white">Colapsar todos</button>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-700">
            <span className="inline-flex items-center gap-1.5"><span className="inline-flex w-5 h-5 items-center justify-center rounded bg-emerald-600 text-white font-bold text-[11px]">✓</span> Concluído</span>
            <span className="inline-flex items-center gap-1.5"><span className="inline-flex w-5 h-5 items-center justify-center rounded bg-zinc-100 border border-zinc-300 text-[10px]">●</span> Não Aplicável</span>
            <span className="inline-flex items-center gap-1.5"><span className="inline-flex w-5 h-5 items-center justify-center rounded bg-zinc-50 border border-zinc-200 text-zinc-500 text-[10px]">∅</span> Inexistente</span>
            <span className="inline-flex items-center gap-1.5"><span className="inline-flex w-5 h-5 items-center justify-center rounded bg-red-600 text-white font-bold text-[11px]">✕</span> Não Concluído</span>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-zinc-500 px-1">Mapa de controlo por gabinete isolado: cada célula guarda uma obrigação (clica para alternar: ∅ → ✓ → ✕ → ●). Filtros por cliente, gestor, grupo e trimestre. Cores vivas por fase da contabilidade.</p>
    </div>
  );
}


// ─── Agenda — Fase 1 ────────────────────────────────────────────────────────
function AgendaView({ tarefas, obrigacoes, clientes }: { tarefas: Tarefa[]; obrigacoes: Obrigacao[]; clientes: GabineteCliente[] }) {
  // Agenda com padding extra no mobile para não tapar com a pill

  const [cur, setCur] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [sel, setSel] = useState<number | null>(() => new Date().getDate());
  const ym = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`;
  const daysInMonth = new Date(cur.getFullYear(), cur.getMonth()+1, 0).getDate();
  const startWeek = new Date(cur.getFullYear(), cur.getMonth(), 1).getDay(); // 0 Sun
  const startMon = (startWeek + 6) % 7; // 0 Mon
  const eventsByDay = useMemo(() => {
    const map: Record<number, { tarefas: Tarefa[]; obrs: Obrigacao[] }> = {};
    const add = (d: number, t?: Tarefa, o?: Obrigacao) => {
      if (!map[d]) map[d] = { tarefas: [], obrs: [] };
      if (t) map[d].tarefas.push(t);
      if (o) map[d].obrs.push(o);
    };
    const y = cur.getFullYear(), m = cur.getMonth();
    tarefas.forEach(t => { if (!t.dataVencimento) return; const d = new Date(t.dataVencimento); if (d.getFullYear()===y && d.getMonth()===m) add(d.getDate(), t); });
    obrigacoes.forEach(o => { const d = new Date(o.vencimento); if (d.getFullYear()===y && d.getMonth()===m) add(d.getDate(), undefined, o); });
    return map;
  }, [tarefas, obrigacoes, cur]);
  const selEvents = sel ? (eventsByDay[sel] || { tarefas: [], obrs: [] }) : { tarefas: [], obrs: [] };
  const weekDays = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  const mesLabel = cur.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold capitalize flex items-center gap-2"><Calendar className="w-5 h-5 text-[#0677FF]" /> {mesLabel}</h2>
        <div className="flex gap-1">
          <button onClick={() => setCur(d => { const n=new Date(d); n.setMonth(n.getMonth()-1); return n; })} className="p-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => { const n=new Date(); n.setDate(1); setCur(n); setSel(n.getDate()); }} className="px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm hover:bg-zinc-50">Hoje</button>
          <button onClick={() => setCur(d => { const n=new Date(d); n.setMonth(n.getMonth()+1); return n; })} className="p-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-200 p-4">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-zinc-500 mb-2">{weekDays.map(w=> <div key={w} className="py-2">{w}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({length: startMon}).map((_,i)=> <div key={'e'+i} className="h-[84px]" />)}
            {Array.from({length: daysInMonth}).map((_,i)=> {
              const d = i+1;
              const ev = eventsByDay[d];
              const count = ev ? ev.tarefas.length + ev.obrs.length : 0;
              const isSel = sel===d;
              const isToday = new Date().getFullYear()===cur.getFullYear() && new Date().getMonth()===cur.getMonth() && new Date().getDate()===d;
              return (
                <button key={d} onClick={()=>setSel(d)} className={`h-[84px] rounded-xl border text-left p-2 flex flex-col gap-1 transition ${isSel ? 'bg-[#0677FF] text-white border-[#0677FF] shadow' : isToday ? 'bg-blue-50 border-blue-200' : 'bg-white border-zinc-200 hover:bg-zinc-50'}`}>
                  <span className={`text-sm font-bold ${isSel ? 'text-white' : isToday ? 'text-[#0677FF]' : 'text-zinc-900'}`}>{d}</span>
                  {count>0 && (
                    <div className="space-y-0.5">
                      {ev.tarefas.slice(0,2).map(t=> <div key={t.id} className={`text-[10px] truncate px-1.5 py-0.5 rounded-full ${isSel ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>{t.titulo.slice(0,18)}</div>)}
                      {ev.obrs.slice(0,2).map(o=> <div key={o.id} className={`text-[10px] truncate px-1.5 py-0.5 rounded-full ${isSel ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'}`}>{o.tipo.toUpperCase()}</div>)}
                      {count>4 && <div className={`text-[10px] ${isSel? 'text-white/70':'text-zinc-500'}`}>+{count-4} mais</div>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <h3 className="font-semibold flex items-center gap-2">{sel ? `${sel} de ${mesLabel}` : 'Seleciona um dia'} {sel && <span className="text-xs font-normal text-zinc-500">({(selEvents.tarefas.length+selEvents.obrs.length)} itens)</span>}</h3>
          {!sel ? <div className="py-12 text-center text-sm text-zinc-500">Clica num dia do calendário</div> : (selEvents.tarefas.length+selEvents.obrs.length===0 ? <div className="py-12 text-center text-sm text-zinc-500 border-2 border-dashed border-zinc-200 rounded-xl mt-3">Nada para este dia. Cria uma tarefa para {sel}/{cur.getMonth()+1}</div> : (
            <div className="space-y-2 mt-3">
              {selEvents.tarefas.map(t=> (
                <div key={t.id} className="p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50">
                  <div className="text-sm font-medium">{t.titulo}</div>
                  <div className="text-xs text-zinc-500">{t.clienteNome||'—'} • {t.prioridade} • {t.estado}</div>
                </div>
              ))}
              {selEvents.obrs.map(o=> (
                <div key={o.id} className="p-3 rounded-xl border border-amber-200 bg-amber-50/50">
                  <div className="text-sm font-medium">{o.titulo}</div>
                  <div className="text-xs text-zinc-600">{o.clienteNome||'—'} • {o.tipo} • {o.estado}</div>
                </div>
              ))}
            </div>
          ))}
          <div className="mt-4 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
            <div className="text-xs font-bold text-zinc-700 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Legenda</div>
            <div className="text-xs text-zinc-600 mt-1 space-y-1"><div><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-2" />Tarefas</div><div><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2" />Obrigações fiscais</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tarefas (Kanban) ─────────────────────────────────────────────────────────
function TarefasView({ tarefas, clientes, obrigacoes, activeEmpresaId, activeEmpresaNome }: { tarefas:Tarefa[]; clientes:GabineteCliente[]; obrigacoes:Obrigacao[]; activeEmpresaId?: string|null; activeEmpresaNome?: string|null }) {
  const [q, setQ] = useState('');
  const [filtroCli, setFiltroCli] = useState<string>('todos');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<Partial<Tarefa>>({ tipo:'tarefa', prioridade:'media', estado:'todo' });
  // Arquivo: tarefas feitas saem do kanban; podem ser vistas e restauradas.
  const [verArquivadas, setVerArquivadas] = useState(false);

  const arquivadas = useMemo(()=> tarefas.filter(t=> t.arquivada), [tarefas]);

  // Obrigações fiscais nacionais do MÊS ATUAL aparecem como tarefas no kanban
  // (pendente → A fazer, vencida → Atrasada, entregue → Feito).
  const obrigacoesMes = useMemo(()=> {
    const agora = new Date();
    return obrigacoes
      .filter(o=> o.origem === 'calendario_fiscal')
      .filter(o=> { const d = new Date(o.vencimento); return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear(); })
      .map(o=>({
        id: 'obr_' + o.id,
        fiscal: true as const,
        registo: o,
        titulo: o.titulo,
        estado: o.estado === 'entregue' ? 'done' : o.estado === 'atrasada' ? 'atrasada' : 'todo',
        clienteNome: o.clienteNome || 'Calendário fiscal',
        dataVencimento: o.vencimento,
      }));
  }, [obrigacoes]);

  const filtered = useMemo(()=> {
    const s=q.toLowerCase();
    return tarefas.filter(t=> {
      if (t.arquivada) return false; // arquivadas vivem na secção própria
      if (filtroCli!=='todos' && t.clienteId!==filtroCli) return false;
      if (!s) return true;
      return (t.titulo + ' ' + (t.clienteNome||'')).toLowerCase().includes(s);
    });
  }, [tarefas,q,filtroCli]);

  const cols: { id: Tarefa['estado']; label:string }[] = [
    { id:'todo', label:'A fazer' },
    { id:'doing', label:'Em curso' },
    { id:'done', label:'Feito' },
    { id:'atrasada', label:'Atrasada' },
  ];

  const colItems = (colId: Tarefa['estado']) => {
    const t = filtered.filter(x=> x.estado===colId);
    const o = obrigacoesMes.filter(x=> x.estado===colId);
    return [...t, ...o];
  };

  const handleSave = async () => {
    if (!form.titulo?.trim()) return alert('Título obrigatório');
    const t: Tarefa = {
      id: (form.id as string) || newTarefaId(),
      titulo: form.titulo!.trim(),
      descricao: form.descricao?.trim(),
      tipo: (form.tipo as Tarefa['tipo']) || 'tarefa',
      estado: (form.estado as Tarefa['estado']) || 'todo',
      prioridade: (form.prioridade as Tarefa['prioridade']) || 'media',
      clienteId: (form.clienteId as string) || activeEmpresaId || undefined,
      clienteNome: clientes.find(c=>c.id=== (form.clienteId || activeEmpresaId))?.nome || activeEmpresaNome || undefined,
      dataVencimento: form.dataVencimento ? (typeof form.dataVencimento === 'number' ? form.dataVencimento : new Date(form.dataVencimento as unknown as string).getTime()) : undefined,
      origem: 'manual',
      createdAt: (form.createdAt as number) || Date.now(),
      updatedAt: Date.now(),
    };
    await upsertTarefa(t);
    setShowNew(false); setForm({ tipo:'tarefa', prioridade:'media', estado:'todo' });
  };

  const mesLabel = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' }).format(new Date());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Pesquisar tarefa..." className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm" />
        </div>
        <select value={filtroCli} onChange={e=>setFiltroCli(e.target.value)} disabled={!!activeEmpresaId} className={`px-3 py-2.5 rounded-xl border text-sm ${activeEmpresaId ? "bg-zinc-100 text-zinc-500" : "bg-white border-zinc-200"}`}>
          <option value="todos">Todos clientes</option>
          {clientes.map(c=> <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <button onClick={()=>setVerArquivadas(v=>!v)} className={`px-4 py-2.5 rounded-xl border text-sm font-medium flex items-center gap-2 transition-colors ${verArquivadas ? 'bg-[#0F172A] text-white border-[#0F172A]' : 'bg-white border-zinc-200 hover:bg-zinc-50'}`}>
          <Archive className="w-4 h-4" /> Ver arquivadas ({arquivadas.length})
        </button>
        <button onClick={()=>{ setForm({ tipo:'tarefa', prioridade:'media', estado:'todo' }); setShowNew(true); }} className="px-4 py-2.5 rounded-xl bg-[#0677FF] text-white text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" /> Nova tarefa</button>
      </div>

      {verArquivadas ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm flex items-center gap-2"><Archive className="w-4 h-4 text-zinc-400" /> Tarefas arquivadas</h4>
            <span className="text-xs px-2 py-1 rounded-full bg-zinc-100 border border-zinc-200">{arquivadas.length}</span>
          </div>
          {arquivadas.length === 0 ? <div className="py-10 text-center text-sm text-zinc-400 border-2 border-dashed border-zinc-200 rounded-xl">Nenhuma tarefa arquivada.</div> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {arquivadas.map(t=> (
                <div key={t.id} className="p-3 rounded-xl border border-zinc-200 bg-zinc-50/50">
                  <div className="text-sm font-medium leading-tight line-clamp-2">{t.titulo}</div>
                  <div className="text-xs text-zinc-500 mt-1">{t.clienteNome || '—'} • {t.dataVencimento ? new Date(t.dataVencimento).toLocaleDateString('pt-PT') : 'sem prazo'}</div>
                  <div className="flex gap-1 mt-2">
                    <button onClick={()=>upsertTarefa({...t, arquivada:false})} className="flex-1 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs">Restaurar</button>
                    <button onClick={()=>deleteTarefa(t.id)} className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-zinc-200"><Trash2 className="w-3.5 h-3.5 text-zinc-500" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 px-1">
            <Calendar className="w-3.5 h-3.5 text-[#0677FF]" />
            <span><strong className="text-zinc-700 capitalize">{mesLabel}</strong> — {obrigacoesMes.length} obrigação(ões) fiscais no calendário</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {cols.map(col=> {
              const items = colItems(col.id);
              return (
                <div key={col.id} className="bg-white rounded-2xl border border-zinc-200 p-3 min-h-[360px]">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-sm">{col.label}</h4>
                    <span className="text-xs px-2 py-1 rounded-full bg-zinc-100 border border-zinc-200">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.length===0 ? <div className="py-8 text-center text-xs text-zinc-400 border-2 border-dashed border-zinc-200 rounded-xl">Vazio</div> :
                    items.map(item=> {
                      // Obrigação fiscal do calendário → cartão com badge Fiscal
                      if ('fiscal' in item && item.fiscal) {
                        const o = item.registo;
                        return (
                          <div key={item.id} className="p-3 rounded-xl border border-blue-200 bg-blue-50/40">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0677FF] text-white font-bold uppercase">Fiscal</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-blue-200">{o.tipo}</span>
                            </div>
                            <div className="text-sm font-medium leading-tight line-clamp-2 mt-1.5">{item.titulo}</div>
                            <div className="text-xs text-zinc-500 mt-1">{item.dataVencimento ? new Date(item.dataVencimento).toLocaleDateString('pt-PT') : ''}</div>
                            <div className="flex gap-1 mt-2">
                              {o.estado !== 'entregue' && <button onClick={()=>upsertObrigacao({...o, estado:'entregue'})} className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium">Entregue</button>}
                              {o.estado !== 'pendente' && o.estado !== 'dispensada' && <button onClick={()=>upsertObrigacao({...o, estado:'pendente'})} className="flex-1 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs">Repor</button>}
                              {o.estado === 'entregue' && <span className="flex-1 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs text-center">✓ Entregue</span>}
                            </div>
                          </div>
                        );
                      }
                      const t = item as Tarefa;
                      return (
                        <div key={t.id} className="p-3 rounded-xl border border-zinc-200 hover:border-zinc-300 bg-zinc-50/50">
                          <div className="text-sm font-medium leading-tight line-clamp-2">{t.titulo}</div>
                          <div className="text-xs text-zinc-500 mt-1">{t.clienteNome || '—'} • {t.dataVencimento ? new Date(t.dataVencimento).toLocaleDateString('pt-PT') : 'sem prazo'}</div>
                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            <span className={`text-[11px] px-2 py-1 rounded-full border ${t.prioridade==='urgente' ? 'bg-rose-50 text-rose-700 border-rose-200' : t.prioridade==='alta' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-zinc-600 border-zinc-200'}`}>{t.prioridade}</span>
                            <span className="text-[11px] px-2 py-1 rounded-full bg-white border border-zinc-200">{t.tipo}</span>
                          </div>
                          <div className="flex gap-1 mt-2">
                            {col.id!=='done' && <button onClick={()=>marcarTarefaFeita(t.id,true)} className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium">Feito</button>}
                            {col.id!=='todo' && col.id!=='done' && <button onClick={()=>upsertTarefa({...t, estado:'todo'})} className="flex-1 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs">A fazer</button>}
                            {col.id==='todo' && <button onClick={()=>upsertTarefa({...t, estado:'doing'})} className="flex-1 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs">Em curso</button>}
                            {col.id==='done' && <button onClick={()=>upsertTarefa({...t, arquivada:true})} className="flex-1 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs flex items-center justify-center gap-1"><Archive className="w-3 h-3" /> Arquivar</button>}
                            <button onClick={()=>deleteTarefa(t.id)} className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-zinc-200"><Trash2 className="w-3.5 h-3.5 text-zinc-500" /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showNew && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setShowNew(false)}>
          <div className="w-full max-w-[560px] bg-white rounded-2xl p-6 border border-zinc-200 shadow-xl" onClick={e=>e.stopPropagation()}>
            <h3 className="font-semibold">{form.id ? 'Editar tarefa' : 'Nova tarefa'}</h3>
            <p className="text-sm text-zinc-500">Preenche os campos. Fica guardada no gabinete e aparece no Kanban.</p>
            <div className="grid grid-cols-1 gap-3 mt-4">
              <div>
                <label className="block text-[11px] font-[700] uppercase tracking-[1px] text-zinc-500 mb-1">Título <span className="text-red-500">*</span></label>
                <input value={form.titulo||''} onChange={e=>setForm({...form, titulo:e.target.value})} placeholder="ex: Pedir documentos em falta" className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" />
              </div>
              <textarea value={form.descricao||''} onChange={e=>setForm({...form, descricao:e.target.value})} placeholder="Descrição (opcional)" rows={2} className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-[700] uppercase tracking-[1px] text-zinc-500 mb-1">Cliente</label>
                  <select value={(form.clienteId as string) || activeEmpresaId || ''} onChange={e=>setForm({...form, clienteId:e.target.value||undefined})} className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm">
                    <option value="">Sem cliente (gabinete)</option>
                    {clientes.map(c=> <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-[700] uppercase tracking-[1px] text-zinc-500 mb-1">Vencimento</label>
                  <input type="date" value={form.dataVencimento ? new Date(form.dataVencimento as unknown as number).toISOString().slice(0,10) : ''} onChange={e=>setForm({...form, dataVencimento: e.target.value ? new Date(e.target.value).getTime() as unknown as typeof form.dataVencimento : undefined})} className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <select value={form.tipo} onChange={e=>setForm({...form, tipo:e.target.value as never})} className="px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm"><option value="tarefa">Tarefa</option><option value="obrigacao">Obrigação</option><option value="lembrete">Lembrete</option></select>
                <select value={form.prioridade} onChange={e=>setForm({...form, prioridade:e.target.value as never})} className="px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm"><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select>
                <select value={form.estado} onChange={e=>setForm({...form, estado:e.target.value as never})} className="px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm"><option value="todo">A fazer</option><option value="doing">Em curso</option><option value="done">Feito</option><option value="atrasada">Atrasada</option></select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6"><button onClick={()=>{ setShowNew(false); setForm({ tipo:'tarefa', prioridade:'media', estado:'todo' }); }} className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm">Cancelar</button><button onClick={handleSave} className="px-4 py-2.5 rounded-xl bg-[#0677FF] text-white text-sm font-medium">Guardar tarefa</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Obrigações ───────────────────────────────────────────────────────────────
function ObrigacoesView({ obrigacoes, clientes, activeEmpresaId }: { obrigacoes:Obrigacao[]; clientes:GabineteCliente[]; activeEmpresaId?: string|null }) {
  const [mes, setMes] = useState(()=> new Date().toISOString().slice(0,7)); // YYYY-MM
  const [filtroCli, setFiltroCli] = useState('todos');
  const filtered = useMemo(()=> {
    return obrigacoes.filter(o=>{
      if (filtroCli === 'fiscal' && o.origem !== 'calendario_fiscal') return false;
      if (filtroCli !== 'todos' && filtroCli !== 'fiscal' && o.clienteId!==filtroCli) return false;
      const ym = new Date(o.vencimento).toISOString().slice(0,7);
      return ym===mes;
    }).sort((a,b)=>a.vencimento-b.vencimento);
  }, [obrigacoes,mes,filtroCli]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <input type="month" value={mes} onChange={e=>setMes(e.target.value)} className="px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm" />
        <select value={filtroCli} onChange={e=>setFiltroCli(e.target.value)} disabled={!!activeEmpresaId} className={`px-3 py-2.5 rounded-xl border text-sm ${activeEmpresaId ? "bg-zinc-100 text-zinc-500" : "bg-white border-zinc-200"}`}>
          <option value="todos">Todos clientes</option>
          <option value="fiscal">Calendário fiscal 2026</option>
          {clientes.map(c=> <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <span className="text-sm text-zinc-500">{filtered.length} obrigações em {mes}</span>
      </div>
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-600"><tr><th className="text-left px-4 py-3">Vencimento</th><th className="text-left px-4 py-3">Obrigação</th><th className="text-left px-4 py-3">Cliente</th><th className="text-left px-4 py-3">Tipo</th><th className="text-left px-4 py-3">Estado</th><th className="text-right px-4 py-3">Ação</th></tr></thead>
            <tbody className="divide-y divide-zinc-200">
              {filtered.length===0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-zinc-500">Nada para este mês. Gera obrigações a partir da ficha do cliente.</td></tr> :
              filtered.map(o=> (
                <tr key={o.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(o.vencimento).toLocaleDateString('pt-PT')}</td>
                  <td className="px-4 py-3 font-medium">{o.titulo}</td>
                  <td className="px-4 py-3 text-zinc-600">{o.clienteNome}</td>
                  <td className="px-4 py-3"><span className="px-2 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-xs">{o.tipo}</span></td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs border ${o.estado==='entregue' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : o.estado==='atrasada' ? 'bg-rose-50 text-rose-700 border-rose-200' : o.estado==='dispensada' ? 'bg-zinc-100 text-zinc-500 border-zinc-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{o.estado}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {o.origem === 'calendario_fiscal'
                        ? <span className="px-2 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 text-xs whitespace-nowrap">Referência</span>
                        : <>
                            {o.estado!=='entregue' && <button onClick={()=>upsertObrigacao({...o, estado:'entregue'})} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs">Entregue</button>}
                            {o.estado!=='dispensada' && <button onClick={()=>upsertObrigacao({...o, estado:'dispensada'})} className="px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs">Dispensar</button>}
                          </>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-zinc-500">O calendário inclui as obrigações fiscais nacionais de 2026 importadas do ficheiro events (7).ics. As obrigações dos clientes são geradas automaticamente ao criar/editar a ficha. Tudo fica guardado em Firestore + IndexedDB e atualizado live.</p>
    </div>
  );
}

// ─── Cofre — estilo Chrome Password Manager ───────────────────────────────
function CofreView({ cofre, clientes }: { cofre:CofreEntrada[]; clientes:GabineteCliente[] }) {
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<CofreEntrada & { secretPlain?: string }>>({ categoria:'AT' });
  const [showSecret, setShowSecret] = useState(false);
  const [plain, setPlain] = useState<string | null>(null);

  const filtered = useMemo(()=> {
    const s=q.toLowerCase().trim();
    if (!s) return [...cofre].sort((a,b)=> (a.titulo||'').localeCompare(b.titulo||''));
    return cofre.filter(c=> [c.titulo,c.username,c.clienteNome,c.categoria,c.url].join(' ').toLowerCase().includes(s))
      .sort((a,b)=> (a.titulo||'').localeCompare(b.titulo||''));
  }, [cofre,q]);

  const selected = useMemo(()=> filtered.find(c=>c.id===selectedId) || null, [filtered, selectedId]);

  React.useEffect(()=> {
    if (!editing && !selectedId && filtered.length) setSelectedId(filtered[0].id);
    if (selectedId && !filtered.some(c=>c.id===selectedId)) setSelectedId(filtered[0]?.id || null);
  }, [filtered]);

  React.useEffect(()=> { setPlain(null); setShowSecret(false); }, [selectedId]);

  const getSegredo = (e: CofreEntrada) => (e as unknown as { segredo?: string }).segredo || '';

  const handleCopy = async (text: string) => { try { await navigator.clipboard.writeText(text); } catch {} };

  const handleReveal = async () => {
    if (!selected) return;
    if (plain) { setPlain(null); return; }
    const seg = getSegredo(selected);
    if (!seg) { alert('Sem segredo guardado'); return; }
    const hasLegacy = !!(selected as unknown as { cipher?: unknown }).cipher && !seg;
    if (hasLegacy) { alert('Entrada antiga cifrada. Edita e volta a guardar.'); return; }
    setPlain(seg);
    registarVistaCofre(selected.id).catch(()=>{});
  };

  const handleShare = async () => {
    if (!selected) return;
    const seg = plain || '';
    const text = `${selected.username || selected.titulo}\n${selected.titulo}${selected.url ? ` (${selected.url})` : ''}\n${selected.notas || ''}${seg ? `\n${seg}` : ''}`;
    try {
      const nav = navigator as unknown as { share?: (d:{title:string;text:string})=>Promise<void> };
      if (nav.share) await nav.share({ title: selected.titulo, text });
      else await navigator.clipboard.writeText(text);
    } catch {}
  };

  const startCreate = () => { setForm({ categoria:'AT' }); setEditing(true); setSelectedId(null); setPlain(null); };
  const startEdit = () => {
    if (!selected) return;
    setForm({ ...selected, secretPlain: getSegredo(selected) } as any);
    setEditing(true);
    setPlain(null);
  };
  const cancelEdit = () => { setEditing(false); setShowSecret(false); if (!selectedId) setForm({ categoria:'AT' }); };
  const handleSave = async () => {
    if (!form.titulo?.trim()) return alert('Título é obrigatório');
    const atual = (form as unknown as { segredo?: string }).segredo?.trim() || '';
    const novo = (form as unknown as { secretPlain?: string }).secretPlain?.trim() || '';
    const finalSeg = novo || atual;
    if (!finalSeg) return alert('Password é obrigatória');
    const entry: CofreEntrada = {
      id: (form.id as string) || newCofreId(),
      titulo: form.titulo!.trim(),
      categoria: (form.categoria as CofreEntrada['categoria']) || 'OUTRO',
      clienteId: form.clienteId,
      clienteNome: clientes.find(c=>c.id===form.clienteId)?.nome,
      username: form.username?.trim(),
      url: form.url?.trim(),
      notas: form.notas?.trim(),
      segredo: finalSeg,
      createdAt: (form.createdAt as number) || Date.now(),
      updatedAt: Date.now(),
      createdBy: 'local',
    } as unknown as CofreEntrada;
    await upsertCofre(entry);
    setEditing(false); setShowSecret(false); setSelectedId(entry.id); setForm({ categoria:'AT' });
  };
  const handleDelete = async (id: string) => {
    if (!confirm('Apagar esta entrada do cofre?')) return;
    await deleteCofre(id);
    if (selectedId === id) setSelectedId(filtered.find(c=>c.id!==id)?.id || null);
  };

  // vazio total
  if (cofre.length === 0 && !editing) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-zinc-200 flex items-center gap-3 bg-zinc-50">
            <div className="relative flex-1 max-w-[360px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Pesquisar passwords" className="w-full pl-9 pr-3 py-2 rounded-full border border-zinc-200 bg-white text-sm placeholder:text-zinc-400" />
            </div>
            <button onClick={startCreate} className="ml-auto px-4 py-2 rounded-full bg-[#0677FF] text-white text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" /> Adicionar</button>
          </div>
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto"><Lock className="w-6 h-6 text-zinc-400" /></div>
            <h3 className="mt-3 font-semibold text-zinc-900">Cofre vazio</h3>
            <p className="mt-1 text-sm text-zinc-500 max-w-md mx-auto">Guarda acessos — só a tua conta vê.</p>
            <button onClick={startCreate} className="mt-4 px-5 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-medium">Guardar primeiro</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col min-h-[520px] max-h-[72vh]">
      <div className="px-3 sm:px-4 py-3 border-b border-zinc-200 bg-white flex items-center gap-3 shrink-0">
        <div className="relative flex-1 max-w-[560px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Pesquisar passwords" className="w-full pl-9 pr-3 py-2 rounded-full bg-zinc-100 border border-transparent focus:bg-white focus:border-zinc-300 focus:outline-none text-sm placeholder:text-zinc-500" />
        </div>
        <button onClick={startCreate} className="hidden sm:inline-flex px-4 py-2 rounded-full bg-[#0B57D0] text-white text-sm font-medium hover:bg-[#0B4BBA]"><Plus className="w-4 h-4 mr-1.5" /> Adicionar</button>
        <button onClick={startCreate} className="sm:hidden w-9 h-9 rounded-full bg-[#0B57D0] text-white flex items-center justify-center"><Plus className="w-4 h-4" /></button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Lista minimalista — só site */}
        <div className="w-full sm:w-[380px] border-r border-zinc-200 bg-white flex flex-col min-h-0">
          <div className="flex-1 overflow-auto">
            {filtered.length===0 ? (
              <div className="p-6 text-center text-sm text-zinc-500">Sem resultados para "{q}".</div>
            ) : filtered.map(entry => {
              const isSel = entry.id === selectedId && !editing;
              const isEditingThis = editing && form.id === entry.id;
              return (
                <button
                  key={entry.id}
                  onClick={()=>{ setSelectedId(entry.id); setEditing(false); }}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 border-b border-zinc-100 last:border-0 hover:bg-zinc-50 ${isSel ? 'bg-[#E8F0FE]' : isEditingThis ? 'bg-amber-50' : ''}`}
                >
                  <span className="text-sm text-zinc-800 truncate">{entry.titulo}</span>
                  <ChevronRight className={`w-4 h-4 shrink-0 ${isSel ? 'text-[#0B57D0]' : 'text-zinc-400'}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Detalhe direita — card centrado como na mensagem anterior */}
        <div className="hidden sm:flex flex-1 bg-[#F8F9FA] flex-col min-h-0 overflow-auto p-6 items-center">
          {editing ? (
            <div className="w-full max-w-[560px] bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-zinc-900">{form.id ? 'Editar acesso' : 'Novo acesso'}</h3>
                <button onClick={cancelEdit} className="p-2 rounded-full hover:bg-zinc-100"><X className="w-5 h-5 text-zinc-600" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Título *</label>
                  <input value={form.titulo||''} onChange={e=>setForm({...form, titulo:e.target.value})} placeholder="ex: Portal das Finanças" className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 bg-white text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <select value={form.categoria as string} onChange={e=>setForm({...form, categoria:e.target.value as any})} className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 bg-white text-sm"><option value="AT">AT</option><option value="SS">SS</option><option value="BANCO">Banco</option><option value="EMAIL">Email</option><option value="EFATURA">E-fatura</option><option value="OUTRO">Outro</option></select>
                  <select value={(form.clienteId as string)||''} onChange={e=>setForm({...form, clienteId:e.target.value||undefined})} className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 bg-white text-sm"><option value="">Sem cliente</option>{clientes.map(c=> <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
                </div>
                <div><label className="block text-xs font-semibold text-zinc-700 mb-1">Utilizador</label><input value={form.username||''} onChange={e=>setForm({...form, username:e.target.value})} placeholder="NIF ou utilizador" className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 bg-white text-sm" /></div>
                <div><label className="block text-xs font-semibold text-zinc-700 mb-1">Site / URL</label><input value={form.url||''} onChange={e=>setForm({...form, url:e.target.value})} placeholder="https://..." className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 bg-white text-sm" /></div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Password *</label>
                  <div className="relative">
                    <input value={(form as any).secretPlain||''} onChange={e=>setForm({...form, secretPlain:e.target.value} as any)} placeholder="••••••••" type={showSecret ? 'text' : 'password'} className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-zinc-300 bg-white text-sm font-mono" />
                    <button type="button" onClick={()=>setShowSecret(v=>!v)} className="absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded-md hover:bg-zinc-100 text-zinc-500">{showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </div>
                <div><label className="block text-xs font-semibold text-zinc-700 mb-1">Nota</label><textarea value={form.notas||''} onChange={e=>setForm({...form, notas:e.target.value})} placeholder="Notas (opcional)" rows={3} className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 bg-white text-sm" /></div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={cancelEdit} className="px-5 py-2.5 rounded-full border border-zinc-300 bg-white text-sm font-medium">Cancelar</button>
                  <button onClick={handleSave} className="px-6 py-2.5 rounded-full bg-[#0B57D0] text-white text-sm font-medium">Guardar</button>
                </div>
              </div>
            </div>
          ) : !selected ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-white border border-zinc-200 flex items-center justify-center"><Lock className="w-7 h-7 text-zinc-400" /></div>
              <p className="mt-3 text-sm font-medium text-zinc-900">Selecione uma password</p>
              <p className="mt-1 text-sm text-zinc-500">Escolha na lista à esquerda.</p>
            </div>
          ) : (
            <div className="w-full max-w-[640px] bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 p-5">
                <div>
                  <div className="text-[11px] font-semibold text-zinc-500 mb-1.5">Nome de utilizador</div>
                  <div className="bg-[#ECEEF1] rounded-full px-4 py-2.5 flex items-center justify-between gap-2">
                    <span className="text-sm truncate">{selected.username || selected.titulo}</span>
                    {selected.username && <button onClick={()=>handleCopy(selected.username!)} className="shrink-0 p-1 hover:bg-black/5 rounded-full"><Copy className="w-4 h-4 text-zinc-600" /></button>}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-zinc-500 mb-1.5">Site</div>
                  {selected.url ? <a href={selected.url} target="_blank" rel="noreferrer" className="text-sm text-[#0B57D0] break-all block px-4 py-2.5 bg-[#ECEEF1] rounded-full truncate hover:underline" title={selected.url}>{selected.titulo}</a> : <div className="text-sm text-[#0F172A] break-all block px-4 py-2.5 bg-[#ECEEF1] rounded-full truncate">{selected.titulo}</div>}
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-zinc-500 mb-1.5">Palavra-passe</div>
                  <div className="bg-[#ECEEF1] rounded-full px-4 py-2.5 flex items-center justify-between gap-2">
                    <span className="text-sm font-mono tracking-widest truncate">{plain ? plain : '••••••••••••'}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      <button onClick={handleReveal} className="p-1 hover:bg-black/5 rounded-full">{plain ? <EyeOff className="w-4 h-4 text-zinc-600" /> : <Eye className="w-4 h-4 text-zinc-600" />}</button>
                      {plain && <button onClick={()=>handleCopy(plain)} className="p-1 hover:bg-black/5 rounded-full"><Copy className="w-4 h-4 text-zinc-600" /></button>}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-zinc-500 mb-1.5">Nota</div>
                  <div className={`rounded-full px-4 py-2.5 text-sm truncate ${selected.notas ? 'bg-[#ECEEF1]' : 'bg-[#ECEEF1] text-zinc-400 italic'}`}>{selected.notas || 'Nenhuma nota adicionada'}</div>
                </div>
              </div>
              {selected.clienteNome && <div className="px-5 pb-2 text-[11px] text-zinc-500">{selected.clienteNome} • {selected.categoria}</div>}
              <div className="border-t border-zinc-100 px-4 py-3 flex items-center justify-between">
                <div className="flex gap-2">
                  <button onClick={startEdit} className="px-5 py-2 rounded-full border border-zinc-300 text-sm font-semibold text-[#1A73E8] hover:bg-zinc-50">Editar</button>
                  <button onClick={()=>handleDelete(selected.id)} className="px-5 py-2 rounded-full border border-zinc-300 text-sm font-semibold text-[#1A73E8] hover:bg-zinc-50">Eliminar</button>
                </div>
                <button onClick={handleShare} className="px-5 py-2 rounded-full border border-zinc-300 text-sm font-semibold text-[#1A73E8] hover:bg-zinc-50 flex items-center gap-1.5"><Share2 className="w-3.5 h-3.5" />Partilhar</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="sm:hidden border-t border-zinc-200 bg-white p-4">
        {editing ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between"><h3 className="font-semibold">{form.id ? 'Editar' : 'Novo'}</h3><button onClick={cancelEdit} className="p-2"><X className="w-5 h-5" /></button></div>
            <input value={form.titulo||''} onChange={e=>setForm({...form, titulo:e.target.value})} placeholder="Título *" className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 text-sm" />
            <input value={form.username||''} onChange={e=>setForm({...form, username:e.target.value})} placeholder="Utilizador" className="w-full px-3 py-2.5 rounded-xl border border-zinc-300 text-sm" />
            <div className="relative"><input value={(form as any).secretPlain||''} onChange={e=>setForm({...form, secretPlain:e.target.value} as any)} placeholder="Password *" type={showSecret?'text':'password'} className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-zinc-300 text-sm font-mono" /><button onClick={()=>setShowSecret(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5">{showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button></div>
            <div className="flex gap-2"><button onClick={cancelEdit} className="flex-1 py-2.5 rounded-full border border-zinc-300">Cancelar</button><button onClick={handleSave} className="flex-1 py-2.5 rounded-full bg-[#0B57D0] text-white">Guardar</button></div>
          </div>
        ) : selected ? (
          <div className="space-y-3">
            <div className="font-semibold">{selected.titulo}</div>
            <div className="text-sm text-zinc-600">{selected.username || '—'}</div>
            <div className="flex gap-2"><button onClick={startEdit} className="flex-1 py-2 rounded-full bg-[#0B57D0] text-white text-sm">Editar</button><button onClick={()=>handleDelete(selected.id)} className="px-4 py-2 rounded-full border text-sm">Eliminar</button></div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
