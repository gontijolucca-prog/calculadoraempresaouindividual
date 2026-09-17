import React, { useMemo, useState } from 'react';
import { Search, Plus, Users, CheckSquare, Calendar, Lock, Building2, Trash2, Eye, EyeOff, Copy, Shield, AlertTriangle, ArrowRight, Sparkles, ChevronLeft, ChevronRight, Clock, Briefcase, MessageSquare, X, Send, Archive, Share2 } from 'lucide-react';
import { useGabineteClientes, useGabineteTarefas, useGabineteObrigacoes, useGabineteCofre, useGabineteContactosGeral, useGabineteAssuntos, useGabineteAlertas, useGabineteOcorrencias, useGabineteDocumentos, useGabineteColaboradores } from './lib/useGabinete';
import { seedMykolaVasylDemo, ensureAllClientesDefaults, linkColaboradorPorEmail } from './lib/gabinete';
import {
  upsertTarefa, deleteTarefa, marcarTarefaFeita, newTarefaId,
  upsertObrigacao,
  upsertCofre, deleteCofre, registarVistaCofre, newCofreId,
  type GabineteCliente, type Tarefa, type Obrigacao, type CofreEntrada,
} from './lib/gabinete';
import { listEmpresas } from './lib/empresas';
import { encryptSecret, decryptSecret, setCofrePassphrase, getCofrePassphrase, cofreIsUnlocked } from './lib/cofreCrypto';
import GuiaSugestao from './components/GuiaSugestao';
import type { ViewKey } from './lib/guias';
import { GabineteGallery, GabineteIntro, GABINET_FUNCTIONS, type GabTab, type GabineteTab } from './GabineteHub';
import VisaoGeralView from './VisaoGeralView';
import GabineteEquipa from './GabineteEquipa';

// Guia por tab interna do Gabinete (a sugestão muda conforme a tab ativa)
const GAB_TAB_GUIA: Record<GabTab, ViewKey> = {
  dashboard: 'gabinete',
  'visao-geral': 'gab-visao-geral',
  equipa: 'gab-equipa',
  agenda: 'gab-agenda',
  tarefas: 'gab-tarefas',
  obrigacoes: 'gab-obrigacoes',
  cofre: 'gab-cofre',
};

// ─── Layout ─────────────────────────────────────────────────────────────────

const VALID_GAB_TABS_SET = new Set<GabineteTab>(['dashboard','visao-geral','equipa','agenda','tarefas','obrigacoes','cofre','gallery']);
export default function Gabinete({ tab: controlledTab, onTabChange, onStartTour, activeEmpresaId, activeEmpresaNome, onGoEmpresas }: { tab?: GabineteTab; onTabChange?: (t: GabineteTab) => void; onStartTour?: (v: ViewKey) => void; activeEmpresaId?: string | null; activeEmpresaNome?: string | null; onGoEmpresas?: () => void }) {
  const [internalTab, setInternalTab] = useState<GabTab>('dashboard');
  const rawTab: GabineteTab = controlledTab ?? internalTab;
  const tab: GabineteTab = VALID_GAB_TABS_SET.has(rawTab) ? rawTab : 'gallery';
  const setTab = (onTabChange ?? setInternalTab) as (t: GabineteTab) => void;
  // Cada função abre primeiro o card informativo. O botão "Abrir função"
  // marca apenas a função atual como vista e mostra o ecrã funcional.
  const [introDismissedFor, setIntroDismissedFor] = useState<GabTab | null>(null);
  const showIntro = tab !== 'gallery' && introDismissedFor !== tab;
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
  const guideView = tab === 'gallery' ? null : GAB_TAB_GUIA[tab];
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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0677FF] text-sm font-bold text-white">E3</div>
            <div>
              <div className="font-semibold leading-none">Gabinete</div>
              <div className="hidden text-xs text-zinc-500 sm:block">{functionLabel} · {functionDesc}</div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-right text-xs text-zinc-500">
            <span>{clientes.length} clientes</span>
            <span className="opacity-30">•</span>
            <span>{tarefas.filter(t=>t.estado!=='done').length} tarefas abertas</span>
            <span className="opacity-30">•</span>
            <span>{cofre.length} acessos</span>
          </div>
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
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const em7dias = hoje.getTime() + 7*86400000;
  const tarefasHoje = tarefas.filter(t=> t.dataVencimento && t.dataVencimento >= hoje.getTime() && t.dataVencimento < hoje.getTime()+86400000 && t.estado!=='done').length;
  const atrasadas = tarefas.filter(t=> t.estado==='atrasada' || (t.dataVencimento && t.dataVencimento < hoje.getTime() && t.estado!=='done')).length;
  // O catálogo nacional é referência de calendário, não uma obrigação de um
  // cliente concreto: não deve inflacionar o KPI de atrasos do escritório.
  const vencidasObr = obrigacoes.filter(o=> o.origem !== 'calendario_fiscal' && o.vencimento < Date.now() && o.estado!=='entregue' && o.estado!=='dispensada').length;
  const semTarefa30d = clientes.filter(c=> !tarefas.some(t=> t.clienteId===c.id && t.createdAt > Date.now()-30*86400000)).length;
  const proximos = [...tarefas, ...obrigacoes.map(o=> ({ id:o.id, titulo:o.titulo, dataVencimento:o.vencimento, estado:o.estado, tipo:'obrigacao' as const } as unknown as Tarefa))]
    .filter(x=> x.dataVencimento && x.dataVencimento >= hoje.getTime() && x.dataVencimento <= em7dias)
    .sort((a,b)=> (a.dataVencimento! - b.dataVencimento!)).slice(0,7);
  const alertas = useMemo(()=> {
    const out: { cliente: GabineteCliente; tipo: string; venc: number; dias: number }[] = [];
    const now = Date.now();
    clientes.forEach(c=> {
      if(!c.alertas) return;
      (['iuc','imi','seguros','certidaoPermanente'] as const).forEach(k=> {
        const v = (c.alertas as unknown as Record<string, unknown>)[k] as number | undefined;
        if(!v) return;
        const dias = Math.ceil((v - now)/86400000);
        if(dias <= 30) out.push({ cliente: c, tipo: k, venc: v, dias });
      });
    });
    return out.sort((a,b)=> a.venc - b.venc).slice(0,8);
  }, [clientes]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Tarefas hoje" value={tarefasHoje} sub="vencem hoje" icon={CheckSquare} tone="blue" />
        <Kpi label="Atrasadas" value={atrasadas} sub="precisam atenção" icon={AlertTriangle} tone={atrasadas? 'rose':'emerald'} />
        <Kpi label="Obrigações vencidas" value={vencidasObr} sub="IVA/PPC/IES" icon={Calendar} tone={vencidasObr? 'amber':'zinc'} />
        <Kpi label="Clientes sem tarefa 30d" value={semTarefa30d} sub="risco de esquecimento" icon={Users} tone="zinc" />
      </div>
      {alertas.length>0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <h3 className="font-semibold flex items-center gap-2 text-amber-900"><AlertTriangle className="w-4 h-4" /> Alertas IUC / IMI / Seguros / Certidão (30 dias)</h3>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {alertas.map((a,i)=> (
              <div key={i} className="p-3 rounded-xl bg-white border border-amber-200">
                <div className="text-sm font-medium truncate">{a.cliente.nome}</div>
                <div className="text-xs text-zinc-600">{a.tipo.toUpperCase()} • {new Date(a.venc).toLocaleDateString('pt-PT')} • {a.dias<=0 ? `${Math.abs(a.dias)} dias em atraso` : `${a.dias} dias`}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Próximos 7 dias</h3>
            <button onClick={()=>onGo('tarefas')} className="text-sm text-[#0677FF] hover:underline flex items-center gap-1">Ver tudo <ArrowRight className="w-4 h-4" /></button>
          </div>
          {proximos.length===0 ? (
            <div className="py-12 text-center text-zinc-500 text-sm border-2 border-dashed border-zinc-200 rounded-xl">Nada nos próximos 7 dias. Cria a primeira tarefa.</div>
          ) : (
            <div className="space-y-2">
              {proximos.map(p=> (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{p.titulo}</div>
                    <div className="text-xs text-zinc-500">{p.dataVencimento ? new Date(p.dataVencimento).toLocaleDateString('pt-PT') : '—'} • {p.estado}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border ${p.estado==='atrasada' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-zinc-50 text-zinc-600 border-zinc-200'}`}>{p.estado}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-zinc-200 p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#0677FF]" /> Atalhos</h3>
            <div className="grid grid-cols-1 gap-2">
              <button onClick={()=>onGo('tarefas')} className="w-full text-left p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Plus className="w-4 h-4" /></div>
                <div><div className="text-sm font-medium">Novo cliente</div><div className="text-xs text-zinc-500">Cria ficha 360</div></div>
              </button>
              <button onClick={()=>onGo('tarefas')} className="w-full text-left p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><CheckSquare className="w-4 h-4" /></div>
                <div><div className="text-sm font-medium">Nova tarefa</div><div className="text-xs text-zinc-500">Atribui a colaboradora</div></div>
              </button>
              <button onClick={()=>onGo('cofre')} className="w-full text-left p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><Lock className="w-4 h-4" /></div>
                <div><div className="text-sm font-medium">Guardar acesso</div><div className="text-xs text-zinc-500">AT / SS / Banco</div></div>
              </button>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-zinc-200 p-5">
            <h3 className="font-semibold mb-2">Memória reliable</h3>
            <ul className="text-sm text-zinc-600 space-y-1.5 list-disc pl-5">
              <li><b>Firestore live</b> + <b>IndexedDB offline</b> — tudo fica guardado, mesmo sem net</li>
              <li><b>onSnapshot</b> — outra colaboradora vê a tarefa assim que crias</li>
              <li><b>Cofre zero-knowledge</b> — AES-GCM no browser, nunca em plain na cloud</li>
              <li><b>Audit</b> — quem viu que senha e quando</li>
            </ul>
          </div>
        </div>
      </div>
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
      dataVencimento: form.dataVencimento ? new Date(form.dataVencimento as unknown as string).getTime() : undefined,
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

// ─── Cofre ───────────────────────────────────────────────────────────────────
function CofreCard({ entry, onEdit, onDelete }: { entry: CofreEntrada; onEdit: (e: CofreEntrada)=>void; onDelete: (id:string)=>void; key?: string | number }) {
  const [plain, setPlain] = useState<string|null>(null);
  const passphrase = getCofrePassphrase() || '';
  const username = entry.username || entry.titulo;
  const site = entry.url || '';
  const nota = entry.notas || '';
  const handleCopy = async (text: string) => { try { await navigator.clipboard.writeText(text); } catch {} };
  const handleReveal = async () => {
    if (plain) { setPlain(null); return; }
    if (!passphrase) { alert('Define a passphrase do cofre no topo'); return; }
    try { const p = await decryptSecret(entry.cipher, passphrase); setPlain(p); registarVistaCofre(entry.id).catch(()=>{}); } catch { alert('Passphrase errada'); }
  };
  const handleShare = async () => {
    const text = `${username}\n${site || '—'}\n${nota || 'Nenhuma nota adicionada'}`;
    try {
      const nav = navigator as unknown as { share?: (d: { title: string; text: string }) => Promise<void> };
      if (nav.share) await nav.share({ title: entry.titulo, text });
      else await navigator.clipboard.writeText(text);
    } catch {}
  };
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden max-w-[640px]">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 p-5">
        <div>
          <div className="text-[12px] font-semibold text-zinc-500 mb-1.5">Nome de utilizador</div>
          <div className="bg-[#ECEEF1] rounded-full px-4 py-2.5 flex items-center justify-between gap-2">
            <span className="text-sm truncate">{username}</span>
            <button onClick={()=>handleCopy(username)} className="shrink-0 p-1 hover:bg-black/5 rounded-full" title="Copiar"><Copy className="w-4 h-4 text-zinc-600" /></button>
          </div>
        </div>
        <div>
          <div className="text-[12px] font-semibold text-zinc-500 mb-1.5">Sites</div>
          {site ? <a href={site.startsWith('http') ? site : `https://${site}`} target="_blank" rel="noreferrer" className="text-sm text-[#1A73E8] underline break-all block px-4 py-2.5">{site}</a> : <div className="text-sm text-zinc-400 px-4 py-2.5">—</div>}
        </div>
        <div>
          <div className="text-[12px] font-semibold text-zinc-500 mb-1.5">Palavra-passe</div>
          <div className="bg-[#ECEEF1] rounded-full px-4 py-2.5 flex items-center justify-between gap-2">
            <span className="text-sm font-mono tracking-widest truncate">{plain ? plain : '••••••••••••'}</span>
            <span className="flex items-center gap-1 shrink-0">
              <button onClick={handleReveal} className="p-1 hover:bg-black/5 rounded-full" title={plain ? 'Ocultar' : 'Revelar'}>{plain ? <EyeOff className="w-4 h-4 text-zinc-600" /> : <Eye className="w-4 h-4 text-zinc-600" />}</button>
              {plain && <button onClick={()=>handleCopy(plain)} className="p-1 hover:bg-black/5 rounded-full" title="Copiar"><Copy className="w-4 h-4 text-zinc-600" /></button>}
            </span>
          </div>
        </div>
        <div>
          <div className="text-[12px] font-semibold text-zinc-500 mb-1.5">Nota</div>
          <div className={`rounded-full px-4 py-2.5 text-sm truncate ${nota ? 'bg-[#ECEEF1]' : 'bg-[#ECEEF1] text-zinc-400 italic'}`}>{nota || 'Nenhuma nota adicionada'}</div>
        </div>
      </div>
      {entry.clienteNome && <div className="px-5 pb-2 text-[11px] text-zinc-500">{entry.clienteNome} • {entry.categoria}</div>}
      <div className="border-t border-zinc-100 px-4 py-3 flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={()=>onEdit(entry)} className="px-5 py-2 rounded-full border border-zinc-300 text-sm font-semibold text-[#1A73E8] hover:bg-zinc-50">Editar</button>
          <button onClick={()=>onDelete(entry.id)} className="px-5 py-2 rounded-full border border-zinc-300 text-sm font-semibold text-[#1A73E8] hover:bg-zinc-50">Eliminar</button>
        </div>
        <button onClick={handleShare} className="px-5 py-2 rounded-full border border-zinc-300 text-sm font-semibold text-[#1A73E8] hover:bg-zinc-50 flex items-center gap-1.5"><Share2 className="w-3.5 h-3.5" />Partilhar</button>
      </div>
    </div>
  );
}

function CofreView({ cofre, clientes }: { cofre:CofreEntrada[]; clientes:GabineteCliente[] }) {
  const [q, setQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<Partial<CofreEntrada & { secretPlain?: string }>>({ categoria:'AT' });
  const [passphrase, setPassphrase] = useState(()=> getCofrePassphrase() || '');
  const [showPass, setShowPass] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const filtered = useMemo(()=> {
    const s=q.toLowerCase();
    if (!s) return cofre;
    return cofre.filter(c=> [c.titulo,c.username,c.clienteNome,c.categoria].join(' ').toLowerCase().includes(s));
  }, [cofre,q]);
  const handleSave = async () => {
    if (!form.titulo?.trim() || !form.secretPlain?.trim()) return alert('Título e segredo obrigatórios');
    if (!passphrase || passphrase.length<6) return alert('Define uma passphrase do cofre (min 6) no topo');
    setCofrePassphrase(passphrase);
    const cipher = await encryptSecret(form.secretPlain!, passphrase);
    const entry: CofreEntrada = {
      id: (form.id as string) || newCofreId(),
      titulo: form.titulo!.trim(),
      categoria: (form.categoria as CofreEntrada['categoria']) || 'OUTRO',
      clienteId: form.clienteId,
      clienteNome: clientes.find(c=>c.id===form.clienteId)?.nome,
      username: form.username?.trim(),
      url: form.url?.trim(),
      notas: form.notas?.trim(),
      cipher,
      createdAt: (form.createdAt as number) || Date.now(),
      updatedAt: Date.now(),
      createdBy: 'local',
    };
    await upsertCofre(entry);
    setShowNew(false); setForm({ categoria:'AT' });
  };
  const handleEdit = (e: CofreEntrada) => {
    setForm({ ...e, secretPlain: '' } as unknown as Partial<CofreEntrada & { secretPlain?: string }>);
    setShowNew(true);
  };
  const handleDelete = async (id: string) => { if (confirm('Apagar entrada do cofre?')) await deleteCofre(id); };
  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
        <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-medium text-amber-900">Cofre zero-knowledge</div>
          <div className="text-xs text-amber-800">A passphrase NUNCA sai do browser. No Firestore só vai cifrado (AES-GCM).</div>
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[220px] max-w-[380px]">
              <input type={showPass ? 'text' : 'password'} value={passphrase} onChange={e=>{ setPassphrase(e.target.value); setCofrePassphrase(e.target.value || null); }} placeholder="Passphrase do cofre" className="w-full pr-9 pl-3 py-2 rounded-xl border border-amber-300 bg-white text-sm" />
              <button onClick={()=>setShowPass(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-zinc-100">{showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full border ${cofreIsUnlocked() ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-zinc-600 border-zinc-200'}`}>{cofreIsUnlocked() ? 'Desbloqueado' : 'Bloqueado'}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Pesquisar AT, SS, cliente..." className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm" />
        </div>
        <button onClick={()=>{ setForm({ categoria:'AT' }); setShowNew(true); }} className="px-4 py-2.5 rounded-xl bg-[#0677FF] text-white text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" /> Guardar acesso</button>
      </div>
      <div className="space-y-4">
        {filtered.length===0 ? <div className="py-12 text-center text-zinc-500 border-2 border-dashed border-zinc-200 rounded-2xl">Cofre vazio. Guarda o primeiro acesso (AT/SS/Banco).</div> :
        filtered.map(e=> <CofreCard key={e.id} entry={e} onEdit={handleEdit} onDelete={handleDelete} />)}
      </div>
      {showNew && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setShowNew(false)}>
          <div className="w-full max-w-[560px] bg-white rounded-2xl p-6 border border-zinc-200 shadow-xl" onClick={e=>e.stopPropagation()}>
            <h3 className="font-semibold">Guardar no cofre</h3>
            <p className="text-sm text-zinc-500">Cifrado no browser antes de ir para Firestore.</p>
            <div className="grid grid-cols-1 gap-3 mt-4">
              <input value={form.titulo||''} onChange={e=>setForm({...form, titulo:e.target.value})} placeholder="Título — ex: AT - Recofatima" className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.categoria} onChange={e=>setForm({...form, categoria:e.target.value as never})} className="px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm"><option value="AT">AT</option><option value="SS">SS</option><option value="BANCO">Banco</option><option value="EMAIL">Email</option><option value="EFATURA">E-fatura</option><option value="OUTRO">Outro</option></select>
                <select value={form.clienteId||''} onChange={e=>setForm({...form, clienteId:e.target.value||undefined})} className="px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm"><option value="">Sem cliente (gabinete)</option>{clientes.map(c=> <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
              </div>
              <input value={form.username||''} onChange={e=>setForm({...form, username:e.target.value})} placeholder="Username / NIF" className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" />
              <input value={form.url||''} onChange={e=>setForm({...form, url:e.target.value})} placeholder="URL (https://...)" className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" />
              <div className="relative">
                <input value={(form as unknown as { secretPlain?: string }).secretPlain||''} onChange={e=>setForm({...form, secretPlain:e.target.value} as never)} placeholder="Segredo — senha / token" type={showSecret ? 'text' : 'password'} className="w-full pr-10 pl-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono" />
                <button type="button" onClick={()=>setShowSecret(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500">{showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
              <textarea value={form.notas||''} onChange={e=>setForm({...form, notas:e.target.value})} placeholder="Notas (opcional)" rows={2} className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" />
            </div>
            <div className="flex justify-end gap-2 mt-6"><button onClick={()=>setShowNew(false)} className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm">Cancelar</button><button onClick={handleSave} className="px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-medium">Cifrar e guardar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
