import React, { useMemo, useState } from 'react';
import { Search, Plus, Users, CheckSquare, Calendar, Lock, Building2, Trash2, Eye, EyeOff, Copy, Shield, AlertTriangle, ArrowRight, Sparkles, ChevronLeft, ChevronRight, Clock, Briefcase, MessageSquare, X, Mail, FileText, BarChart3, Send, Archive } from 'lucide-react';
import { useGabineteClientes, useGabineteTarefas, useGabineteObrigacoes, useGabineteCofre, useGabineteConversas, useGabineteModelos, useGabineteEnvios, useGabineteTempos, useGabineteActas } from './lib/useGabinete';
import {
  upsertCliente, deleteCliente, newClienteId, gerarObrigacoesParaCliente, migrarEmpresasParaGabinete,
  upsertTarefa, deleteTarefa, marcarTarefaFeita, newTarefaId,
  upsertObrigacao,
  upsertCofre, deleteCofre, registarVistaCofre, newCofreId,
  upsertConversa, deleteConversa, newConversaId,
  upsertModelo, deleteModelo, newModeloId, upsertEnvio, newEnvioId,
  upsertTempo, deleteTempo, newTempoId,
  upsertActa, deleteActa, newActaId,
  type GabineteCliente, type Tarefa, type Obrigacao, type CofreEntrada, type Conversa, type ModeloComunicacao, type EnvioComunicacao, type Tempo, type Acta,
} from './lib/gabinete';
import { listEmpresas } from './lib/empresas';
import { encryptSecret, decryptSecret, setCofrePassphrase, getCofrePassphrase, cofreIsUnlocked } from './lib/cofreCrypto';
import GuiaSugestao from './components/GuiaSugestao';
import type { ViewKey } from './lib/guias';
import { GabineteGallery, GabineteIntro, GABINET_FUNCTIONS, type GabTab, type GabineteTab } from './GabineteHub';

// Guia por tab interna do Gabinete (a sugestão muda conforme a tab ativa)
const GAB_TAB_GUIA: Record<GabTab, ViewKey> = {
  dashboard: 'gabinete',
  agenda: 'gab-agenda',
  clientes: 'gab-clientes',
  tarefas: 'gab-tarefas',
  obrigacoes: 'gab-obrigacoes',
  comunicacao: 'gab-comunicacao',
  rentabilidade: 'gab-rentabilidade',
  actas: 'gab-actas',
  cofre: 'gab-cofre',
};

// ─── Layout ─────────────────────────────────────────────────────────────────

export default function Gabinete({ tab: controlledTab, onTabChange, onStartTour }: { tab?: GabineteTab; onTabChange?: (t: GabineteTab) => void; onStartTour?: (v: ViewKey) => void }) {
  const [internalTab, setInternalTab] = useState<GabTab>('dashboard');
  const tab: GabineteTab = controlledTab ?? internalTab;
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
  const tarefas = useGabineteTarefas();
  const obrigacoes = useGabineteObrigacoes();
  const cofre = useGabineteCofre();

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
          <div className="flex items-center gap-2 text-right text-xs text-zinc-500">
            <span>{clientes.length} clientes</span>
            <span className="opacity-30">•</span>
            <span>{tarefas.filter(t=>t.estado!=='done').length} tarefas abertas</span>
            <span className="opacity-30">•</span>
            <span>{cofre.length} acessos</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        {tab === 'gallery' && <GabineteGallery onOpen={openFunction} />}
        {tab !== 'gallery' && showIntro && (
          <GabineteIntro tab={tab} onOpen={openCurrentFunction} onBack={backToGallery} />
        )}
        {tab !== 'gallery' && !showIntro && (
          <>
            {tab === 'dashboard' && <Dashboard clientes={clientes} tarefas={tarefas} obrigacoes={obrigacoes} cofre={cofre} onGo={goFunction} />}
            {tab === 'agenda' && <AgendaView tarefas={tarefas} obrigacoes={obrigacoes} clientes={clientes} />}
            {tab === 'clientes' && <ClientesView clientes={clientes} />}
            {tab === 'tarefas' && <TarefasView tarefas={tarefas} clientes={clientes} obrigacoes={obrigacoes} />}
            {tab === 'obrigacoes' && <ObrigacoesView obrigacoes={obrigacoes} clientes={clientes} />}
            {tab === 'comunicacao' && <ComunicacaoView clientes={clientes} />}
            {tab === 'rentabilidade' && <RentabilidadeView clientes={clientes} />}
            {tab === 'actas' && <ActasView clientes={clientes} />}
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
        const v = (c.alertas as any)[k] as number | undefined;
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
              <button onClick={()=>onGo('clientes')} className="w-full text-left p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50 flex items-center gap-3">
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

// ─── Clientes 360 ─────────────────────────────────────────────────────────────
function ClientesView({ clientes }: { clientes: GabineteCliente[] }) {
  const [q, setQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<Partial<GabineteCliente>>({ tipoEntidade:'LDA', regimeIva:'trimestral', territorio:'continente', estado:'ativo' });
  const [filtroEstado, setFiltroEstado] = useState<'todos'|'ativo'|'arquivado'>('todos');
  const conversas = useGabineteConversas();
  const [histCliente, setHistCliente] = useState<GabineteCliente | null>(null);
  const [novaConv, setNovaConv] = useState<Partial<Conversa>>({ tipo: 'nota' as const });

  const filtered = useMemo(()=> {
    const s = q.toLowerCase().trim();
    return clientes.filter(c=> {
      if (filtroEstado!=='todos' && c.estado!==filtroEstado) return false;
      if (!s) return true;
      return [c.nome,c.nif,c.email,c.municipio].join(' ').toLowerCase().includes(s);
    });
  }, [clientes,q,filtroEstado]);

  const handleSave = async () => {
    if (!form.nome?.trim() || !form.nif?.trim()) return alert('Nome e NIF obrigatórios');
    const cli: GabineteCliente = {
      id: (form.id as string) || newClienteId(),
      nome: form.nome!.trim(),
      nif: form.nif!.replace(/\D/g,''),
      email: form.email?.trim(),
      telefone: form.telefone?.trim(),
      tipoEntidade: (form.tipoEntidade as GabineteCliente['tipoEntidade']) || 'LDA',
      regimeIva: (form.regimeIva as GabineteCliente['regimeIva']) || 'trimestral',
      territorio: (form.territorio as GabineteCliente['territorio']) || 'continente',
      municipio: form.municipio?.trim(),
      estado: (form.estado as GabineteCliente['estado']) || 'ativo',
      contactos: (form.contactos as any)?.filter((c:any)=> c.nome?.trim()).map((c:any)=> ({...c, nome:c.nome.trim(), cargo:c.cargo?.trim(), email:c.email?.trim(), telefone:c.telefone?.trim()})) || undefined,
      alertas: form.alertas && Object.values(form.alertas).some(Boolean) ? form.alertas : undefined,
      avencaMensal: form.avencaMensal ? Number(form.avencaMensal) : undefined,
      avencaPeriodicidade: form.avencaPeriodicidade as any,
      createdAt: (form.createdAt as number) || Date.now(),
      updatedAt: Date.now(),
    };
    await upsertCliente(cli);
    // gera obrigações automaticamente
    gerarObrigacoesParaCliente(cli);
    setShowNew(false); setForm({ tipoEntidade:'LDA', regimeIva:'trimestral', territorio:'continente', estado:'ativo' });
  };

  const handleMigrar = async () => {
    const empresas = listEmpresas();
    if (!empresas.length) return alert('Sem empresas em EmpresasList para migrar');
    const n = await migrarEmpresasParaGabinete(empresas.map(e=>({id:e.id,nome:e.nome,nif:e.nif})));
    alert(n ? `Migrados ${n} clientes de EmpresasList` : 'Nada a migrar — já existem (por NIF)');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Pesquisar nome, NIF, email..." className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0677FF]/20 focus:border-[#0677FF]" />
        </div>
        <select value={filtroEstado} onChange={e=>setFiltroEstado(e.target.value as never)} className="px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm">
          <option value="todos">Todos</option><option value="ativo">Ativos</option><option value="arquivado">Arquivados</option>
        </select>
        <button onClick={handleMigrar} className="px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm hover:bg-zinc-50">Migrar de EmpresasList</button>
        <button onClick={()=>{ setForm({ tipoEntidade:'LDA', regimeIva:'trimestral', territorio:'continente', estado:'ativo' }); setShowNew(true); }} className="px-4 py-2.5 rounded-xl bg-[#0677FF] text-white text-sm font-medium hover:bg-[#055FCC] flex items-center gap-2"><Plus className="w-4 h-4" /> Novo cliente</button>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr><th className="text-left px-4 py-3 font-medium">Cliente</th><th className="text-left px-4 py-3 font-medium">NIF</th><th className="text-left px-4 py-3 font-medium">IVA</th><th className="text-left px-4 py-3 font-medium">Território</th><th className="text-left px-4 py-3 font-medium">Estado</th><th className="text-right px-4 py-3 font-medium">Ações</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {filtered.length===0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-zinc-500">Sem clientes. Cria o primeiro ou migra de EmpresasList.</td></tr>
              ) : filtered.map(c=> (
                <tr key={c.id} className="hover:bg-zinc-50/70">
                  <td className="px-4 py-3"><div className="font-medium">{c.nome}</div><div className="text-xs text-zinc-500">{c.email || '—'} • {c.municipio || '—'}</div></td>
                  <td className="px-4 py-3 font-mono text-xs">{c.nif}</td>
                  <td className="px-4 py-3"><span className="px-2 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-xs">{c.regimeIva}</span></td>
                  <td className="px-4 py-3 text-xs">{c.territorio}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs border ${c.estado==='ativo' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>{c.estado}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={()=>{ setForm(c); setShowNew(true); }} className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-zinc-200 text-zinc-600" title="Editar"><Building2 className="w-4 h-4" /></button>
                      <button onClick={()=> setHistCliente(c)} className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-zinc-200 text-zinc-600" title="Histórico de conversação"><MessageSquare className="w-4 h-4" /></button>
                      <button onClick={()=> gerarObrigacoesParaCliente(c)} className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-zinc-200 text-zinc-600" title="Gerar obrigações"><Calendar className="w-4 h-4" /></button>
                      <button onClick={()=> { if(confirm(`Arquivar ${c.nome}?`)) upsertCliente({...c, estado: c.estado==='ativo'?'arquivado':'ativo'}); }} className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-zinc-200 text-zinc-600" title="Arquivar/Ativar"><Eye className="w-4 h-4" /></button>
                      <button onClick={()=> { if(confirm(`Apagar ${c.nome}?`)) deleteCliente(c.id); }} className="p-2 rounded-lg hover:bg-rose-50 text-rose-600 border border-transparent hover:border-rose-200" title="Apagar"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {histCliente && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setHistCliente(null)}>
          <div className="w-full max-w-[640px] bg-white rounded-2xl border border-zinc-200 shadow-xl flex flex-col max-h-[85vh]" onClick={e=>e.stopPropagation()}>
            <div className="p-6 border-b border-zinc-200 flex items-center justify-between">
              <div><h3 className="font-semibold flex items-center gap-2"><MessageSquare className="w-5 h-5 text-[#0677FF]" /> Histórico — {histCliente.nome}</h3><p className="text-xs text-zinc-500">{histCliente.nif} • {conversas.filter(c=>c.clienteId===histCliente.id).length} registos</p></div>
              <button onClick={()=>setHistCliente(null)} className="p-2 rounded-full hover:bg-zinc-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {conversas.filter(c=>c.clienteId===histCliente.id).length===0 ? <div className="py-12 text-center text-sm text-zinc-500 border-2 border-dashed border-zinc-200 rounded-xl">Sem histórico. Regista a primeira conversa.</div> : conversas.filter(c=>c.clienteId===histCliente.id).sort((a,b)=>b.data-a.data).map(c=> (
                <div key={c.id} className="p-3 rounded-xl border border-zinc-200 bg-zinc-50/50">
                  <div className="flex items-start justify-between gap-2"><span className="text-xs px-2 py-1 rounded-full bg-white border border-zinc-200">{c.tipo}</span><span className="text-xs text-zinc-500">{new Date(c.data).toLocaleDateString('pt-PT')} • {c.autor||'—'}</span></div>
                  <div className="text-sm font-medium mt-1">{c.titulo}</div>
                  {c.conteudo && <div className="text-sm text-zinc-600 mt-1 whitespace-pre-wrap">{c.conteudo}</div>}
                  <button onClick={()=>{ if(confirm('Apagar registo?')) deleteConversa(c.id); }} className="mt-2 text-xs text-rose-600 hover:underline">Apagar</button>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-zinc-200 bg-zinc-50 rounded-b-2xl">
              <div className="text-xs font-bold mb-2">Novo registo</div>
              <div className="grid grid-cols-2 gap-2">
                <select value={novaConv.tipo} onChange={e=>setNovaConv({...novaConv, tipo:e.target.value as any})} className="px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm"><option value="nota">Nota</option><option value="chamada">Chamada</option><option value="reuniao">Reunião</option><option value="email">Email</option><option value="outro">Outro</option></select>
                <input type="date" value={novaConv.data ? new Date(novaConv.data).toISOString().slice(0,10) : new Date().toISOString().slice(0,10)} onChange={e=>setNovaConv({...novaConv, data: e.target.value ? new Date(e.target.value).getTime() : Date.now()})} className="px-3 py-2 rounded-xl border border-zinc-200 bg-white text-sm" />
              </div>
              <input value={novaConv.titulo||''} onChange={e=>setNovaConv({...novaConv, titulo:e.target.value})} placeholder="Título — ex: Chamada sobre IVA Julho" className="mt-2 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" />
              <textarea value={novaConv.conteudo||''} onChange={e=>setNovaConv({...novaConv, conteudo:e.target.value})} placeholder="Detalhes da conversa..." rows={2} className="mt-2 w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm" />
              <div className="flex justify-end gap-2 mt-3">
                <button onClick={()=>setHistCliente(null)} className="px-4 py-2 rounded-xl border border-zinc-200 bg-white text-sm">Fechar</button>
                <button onClick={async()=>{ if(!novaConv.titulo?.trim()) return alert('Título obrigatório'); const c: Conversa={ id: newConversaId(), clienteId: histCliente!.id, clienteNome: histCliente!.nome, tipo: (novaConv.tipo as any)||'nota', titulo: novaConv.titulo!.trim(), conteudo: novaConv.conteudo?.trim(), data: novaConv.data||Date.now(), autor: 'local', createdAt: Date.now(), updatedAt: Date.now() }; await upsertConversa(c); setNovaConv({ tipo: 'nota' as const }); }} className="px-4 py-2 rounded-xl bg-[#0677FF] text-white text-sm font-medium">Guardar no histórico (live)</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showNew && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setShowNew(false)}>
          <div className="w-full max-w-[560px] bg-white rounded-2xl border border-zinc-200 p-6 shadow-xl" onClick={e=>e.stopPropagation()}>
            <h3 className="font-semibold text-lg">{form.id ? 'Editar cliente' : 'Novo cliente'}</h3>
            <p className="text-sm text-zinc-500 mb-4">Ao guardar, as obrigações fiscais do ano são geradas automaticamente e tudo fica live.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="sm:col-span-2"><span className="text-xs font-medium">Nome *</span><input value={form.nome||''} onChange={e=>setForm({...form, nome:e.target.value})} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" placeholder="Recofatima Lda" /></label>
              <label><span className="text-xs font-medium">NIF *</span><input value={form.nif||''} onChange={e=>setForm({...form, nif:e.target.value})} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono" placeholder="500 000 000" /></label>
              <label><span className="text-xs font-medium">Email</span><input value={form.email||''} onChange={e=>setForm({...form, email:e.target.value})} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" /></label>
              <label><span className="text-xs font-medium">IVA</span>
                <select value={form.regimeIva} onChange={e=>setForm({...form, regimeIva:e.target.value as never})} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm bg-white">
                  <option value="isencao53">Isenção art. 53</option><option value="trimestral">Trimestral</option><option value="mensal">Mensal</option>
                </select>
              </label>
              <label><span className="text-xs font-medium">Entidade</span>
                <select value={form.tipoEntidade} onChange={e=>setForm({...form, tipoEntidade:e.target.value as never})} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm bg-white">
                  <option value="ENI">ENI</option><option value="LDA">LDA</option><option value="UNIPESSOAL">Unipessoal</option><option value="OUTRO">Outro</option>
                </select>
              </label>
              <label><span className="text-xs font-medium">Município</span><input value={form.municipio||''} onChange={e=>setForm({...form, municipio:e.target.value})} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" placeholder="Ourém" /></label>
              <label><span className="text-xs font-medium">Território</span>
                <select value={form.territorio} onChange={e=>setForm({...form, territorio:e.target.value as never})} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm bg-white">
                  <option value="continente">Continente</option><option value="madeira">Madeira</option><option value="acores">Açores</option>
                </select>
              </label>
            </div>
            {/* Alertas Fase 1 — IUC/IMI/Seguros/Certidão */}
            <div className="mt-5 p-4 rounded-xl bg-amber-50/50 border border-amber-200">
              <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Alertas do cliente (Fase 1)</div>
              <div className="text-[11px] text-amber-700 mt-1">Define os vencimentos para aparecerem na Agenda e no Dashboard. Deixa vazio se não aplicável.</div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <label><span className="text-[11px] font-medium">IUC</span><input type="date" value={form.alertas?.iuc ? new Date(form.alertas.iuc).toISOString().slice(0,10) : ''} onChange={e=>setForm({...form, alertas: {...(form.alertas||{}), iuc: e.target.value ? new Date(e.target.value).getTime() : undefined}})} className="mt-1 w-full px-2.5 py-2 rounded-lg border border-amber-200 bg-white text-sm" /></label>
                <label><span className="text-[11px] font-medium">IMI</span><input type="date" value={form.alertas?.imi ? new Date(form.alertas.imi).toISOString().slice(0,10) : ''} onChange={e=>setForm({...form, alertas: {...(form.alertas||{}), imi: e.target.value ? new Date(e.target.value).getTime() : undefined}})} className="mt-1 w-full px-2.5 py-2 rounded-lg border border-amber-200 bg-white text-sm" /></label>
                <label><span className="text-[11px] font-medium">Seguros</span><input type="date" value={form.alertas?.seguros ? new Date(form.alertas.seguros).toISOString().slice(0,10) : ''} onChange={e=>setForm({...form, alertas: {...(form.alertas||{}), seguros: e.target.value ? new Date(e.target.value).getTime() : undefined}})} className="mt-1 w-full px-2.5 py-2 rounded-lg border border-amber-200 bg-white text-sm" /></label>
                <label><span className="text-[11px] font-medium">Certidão Permanente</span><input type="date" value={form.alertas?.certidaoPermanente ? new Date(form.alertas.certidaoPermanente).toISOString().slice(0,10) : ''} onChange={e=>setForm({...form, alertas: {...(form.alertas||{}), certidaoPermanente: e.target.value ? new Date(e.target.value).getTime() : undefined}})} className="mt-1 w-full px-2.5 py-2 rounded-lg border border-amber-200 bg-white text-sm" /></label>
              </div>
            </div>
            {/* Avença — Fase 3 */}
            <div className="mt-4 p-4 rounded-xl bg-blue-50/50 border border-blue-200">
              <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Avença (Rentabilidade)</div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <label><span className="text-[11px] font-medium">Valor mensal (€)</span><input type="number" value={form.avencaMensal||''} onChange={e=>setForm({...form, avencaMensal: e.target.value? Number(e.target.value): undefined})} placeholder="ex: 150" className="mt-1 w-full px-2.5 py-2 rounded-lg border border-blue-200 bg-white text-sm" /></label>
                <label><span className="text-[11px] font-medium">Periodicidade</span><select value={form.avencaPeriodicidade||'mensal'} onChange={e=>setForm({...form, avencaPeriodicidade: e.target.value as any})} className="mt-1 w-full px-2.5 py-2 rounded-lg border border-blue-200 bg-white text-sm"><option value="mensal">Mensal</option><option value="trimestral">Trimestral</option><option value="anual">Anual</option></select></label>
              </div>
            </div>
            {/* Contactos de Quadros — Fase 1 */}
            <div className="mt-4 p-4 rounded-xl bg-white border border-zinc-200">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-zinc-700 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Contactos de Quadros</div>
                <button type="button" onClick={()=>{ const c={ id: newClienteId()+"_ct"+Date.now(), nome: '', cargo: '', email: '', telefone: '' } as any; setForm({...form, contactos: [...(form.contactos||[]), c]}); }} className="text-xs px-2.5 py-1 rounded-full bg-zinc-900 text-white hover:bg-black">+ Adicionar</button>
              </div>
              {(form.contactos||[]).length===0 ? <div className="text-xs text-zinc-500 mt-2">Sem contactos. Adiciona gerentes, TOC, administrativos.</div> : (
                <div className="space-y-2 mt-3">
                  {(form.contactos||[]).map((ct:any, idx:number)=> (
                    <div key={ct.id||idx} className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-zinc-50 border border-zinc-200">
                      <input value={ct.nome||''} onChange={e=>{ const n=[...(form.contactos||[])]; n[idx]={...n[idx], nome:e.target.value}; setForm({...form, contactos:n}); }} placeholder="Nome" className="px-2 py-1.5 rounded-lg border border-zinc-200 text-sm" />
                      <input value={ct.cargo||''} onChange={e=>{ const n=[...(form.contactos||[])]; n[idx]={...n[idx], cargo:e.target.value}; setForm({...form, contactos:n}); }} placeholder="Cargo" className="px-2 py-1.5 rounded-lg border border-zinc-200 text-sm" />
                      <input value={ct.email||''} onChange={e=>{ const n=[...(form.contactos||[])]; n[idx]={...n[idx], email:e.target.value}; setForm({...form, contactos:n}); }} placeholder="Email" className="px-2 py-1.5 rounded-lg border border-zinc-200 text-sm" />
                      <input value={ct.telefone||''} onChange={e=>{ const n=[...(form.contactos||[])]; n[idx]={...n[idx], telefone:e.target.value}; setForm({...form, contactos:n}); }} placeholder="Telefone" className="px-2 py-1.5 rounded-lg border border-zinc-200 text-sm" />
                      <button type="button" onClick={()=>{ const n=[...(form.contactos||[])]; n.splice(idx,1); setForm({...form, contactos:n}); }} className="col-span-2 text-xs text-rose-600 hover:underline text-left">Remover</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={()=>setShowNew(false)} className="px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm">Cancelar</button>
              <button onClick={handleSave} className="px-4 py-2.5 rounded-xl bg-[#0677FF] text-white text-sm font-medium">Guardar (live)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tarefas (Kanban) ─────────────────────────────────────────────────────────
function TarefasView({ tarefas, clientes, obrigacoes }: { tarefas:Tarefa[]; clientes:GabineteCliente[]; obrigacoes:Obrigacao[] }) {
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
      clienteId: form.clienteId,
      clienteNome: clientes.find(c=>c.id===form.clienteId)?.nome,
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
        <select value={filtroCli} onChange={e=>setFiltroCli(e.target.value)} className="px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm">
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
function ObrigacoesView({ obrigacoes, clientes }: { obrigacoes:Obrigacao[]; clientes:GabineteCliente[] }) {
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
        <select value={filtroCli} onChange={e=>setFiltroCli(e.target.value)} className="px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm">
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
function CofreView({ cofre, clientes }: { cofre:CofreEntrada[]; clientes:GabineteCliente[] }) {
  const [q, setQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<Partial<CofreEntrada & { secretPlain?: string }>>({ categoria:'AT' });
  const [passphrase, setPassphrase] = useState(()=> getCofrePassphrase() || '');
  const [revealed, setRevealed] = useState<Record<string,string>>({});
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

  const handleReveal = async (e: CofreEntrada) => {
    if (!passphrase) return alert('Introduz a passphrase do cofre no topo');
    try {
      const plain = await decryptSecret(e.cipher, passphrase);
      setRevealed(prev=> ({ ...prev, [e.id]: plain }));
      setCofrePassphrase(passphrase);
      await registarVistaCofre(e.id);
    } catch { alert('Passphrase errada ou dado corrompido'); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
        <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-medium text-amber-900">Cofre zero-knowledge</div>
          <div className="text-xs text-amber-800">A passphrase NUNCA sai do browser. No Firestore só vai cifrado (AES-GCM). Se perderes a passphrase, perdes o cofre — guarda-a no gestor de senhas do gabinete.</div>
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[220px] max-w-[380px]">
              <input type={showPass ? 'text' : 'password'} value={passphrase} onChange={e=>{ setPassphrase(e.target.value); setCofrePassphrase(e.target.value || null); }} placeholder="Passphrase do cofre (ex: frase longa do gabinete)" className="w-full pr-9 pl-3 py-2 rounded-xl border border-amber-300 bg-white text-sm" />
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.length===0 ? <div className="col-span-full py-12 text-center text-zinc-500 border-2 border-dashed border-zinc-200 rounded-2xl">Cofre vazio. Guarda o primeiro acesso (AT/SS/Banco).</div> :
        filtered.map(e=> (
          <div key={e.id} className="bg-white rounded-2xl border border-zinc-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{e.titulo}</div>
                <div className="text-xs text-zinc-500">{e.categoria} • {e.clienteNome || 'Geral'} • {e.username || '—'}</div>
                {e.url && <a href={e.url} target="_blank" rel="noreferrer" className="text-xs text-[#0677FF] hover:underline truncate block">{e.url}</a>}
              </div>
              <span className="text-[11px] px-2 py-1 rounded-full bg-zinc-100 border border-zinc-200 shrink-0">{e.categoria}</span>
            </div>
            {e.notas && <div className="mt-2 text-xs text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-xl p-2">{e.notas}</div>}
            <div className="mt-3">
              {revealed[e.id] ? (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                  <code className="flex-1 text-sm font-mono break-all">{revealed[e.id]}</code>
                  <button onClick={()=>{ navigator.clipboard.writeText(revealed[e.id]); }} className="p-2 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-50"><Copy className="w-4 h-4" /></button>
                  <button onClick={()=>setRevealed(prev=>{ const n={...prev}; delete n[e.id]; return n; })} className="p-2 rounded-lg bg-white border border-zinc-200"><EyeOff className="w-4 h-4" /></button>
                </div>
              ) : (
                <button onClick={()=>handleReveal(e)} className="w-full py-2 rounded-xl bg-zinc-900 text-white text-sm font-medium hover:bg-black flex items-center justify-center gap-2"><Eye className="w-4 h-4" /> Revelar (re-auth)</button>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
              <span>{e.viewCount ? `${e.viewCount} vistas` : 'Nunca visto'} {e.lastViewedAt ? `• ${new Date(e.lastViewedAt).toLocaleDateString('pt-PT')}` : ''}</span>
              <button onClick={()=>{ if(confirm('Apagar entrada do cofre?')) deleteCofre(e.id); }} className="p-1 rounded hover:bg-rose-50 text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      {showNew && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setShowNew(false)}>
          <div className="w-full max-w-[560px] bg-white rounded-2xl p-6 border border-zinc-200 shadow-xl" onClick={e=>e.stopPropagation()}>
            <h3 className="font-semibold">Guardar no cofre</h3>
            <p className="text-sm text-zinc-500">Cifrado no browser antes de ir para Firestore. Ninguém vê em plain.</p>
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
                <button type="button" onClick={()=>setShowSecret(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500" aria-label={showSecret ? 'Esconder segredo' : 'Mostrar segredo'}>{showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
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

// ─── Comunicação — Fase 2 ────────────────────────────────────────────────────
function ComunicacaoView({ clientes }: { clientes: GabineteCliente[] }) {
  const modelos = useGabineteModelos();
  const envios = useGabineteEnvios();
  const [showModelo, setShowModelo] = useState(false);
  const [mForm, setMForm] = useState<Partial<ModeloComunicacao>>({ tipo: 'email' as const });
  const [showEnvio, setShowEnvio] = useState(false);
  const [eForm, setEForm] = useState<Partial<EnvioComunicacao>>({ tipo: 'email' as const });
  const [previewId, setPreviewId] = useState<string | null>(null);
  const preview = modelos.find(m=> m.id===previewId);
  const handleSaveModelo = async () => {
    if (!mForm.titulo?.trim() || !mForm.corpo?.trim()) return alert('Título e corpo obrigatórios');
    const m: ModeloComunicacao = { id: (mForm.id as string) || newModeloId(), titulo: mForm.titulo!.trim(), tipo: (mForm.tipo as any)||'email', assunto: mForm.assunto?.trim(), corpo: mForm.corpo!.trim(), categoria: mForm.categoria?.trim(), createdAt: (mForm.createdAt as number)||Date.now(), updatedAt: Date.now() };
    await upsertModelo(m); setShowModelo(false); setMForm({ tipo: 'email' as const });
  };
  const handleEnvio = async () => {
    if (!eForm.clienteId || !eForm.destinatario?.trim() || !eForm.corpo?.trim()) return alert('Cliente, destinatário e corpo obrigatórios');
    const cli = clientes.find(c=> c.id===eForm.clienteId);
    const corpo = eForm.corpo!.replaceAll('{{cliente.nome}}', cli?.nome||'').replaceAll('{{nif}}', cli?.nif||'');
    const env: EnvioComunicacao = { id: newEnvioId(), clienteId: eForm.clienteId!, clienteNome: cli?.nome, modeloId: eForm.modeloId, tipo: (eForm.tipo as any)||'email', destinatario: eForm.destinatario!.trim(), assunto: eForm.assunto?.trim(), corpo, data: Date.now(), estado: 'enviado', autor: 'local', createdAt: Date.now() };
    await upsertEnvio(env); setShowEnvio(false); setEForm({ tipo: 'email' as const });
  };
  return (
    <div className="space-y-6">
      {/* flex-wrap: no mobile os botões passam para a linha de baixo em vez de
          saírem cortados fora do ecrã (right=388px num viewport de 375px). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold flex items-center gap-2"><Mail className="w-5 h-5 text-[#0677FF]" /> Comunicação</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={()=>{ setMForm({ tipo: 'email' as const }); setShowModelo(true); }} className="px-4 py-2 rounded-xl bg-white border border-zinc-200 text-sm hover:bg-zinc-50 flex items-center gap-2"><Plus className="w-4 h-4" /> Novo modelo</button>
          <button onClick={()=>{ setEForm({ tipo: 'email' as const }); setShowEnvio(true); }} className="px-4 py-2 rounded-xl bg-[#0677FF] text-white text-sm font-medium flex items-center gap-2"><Send className="w-4 h-4" /> Novo envio</button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <h3 className="font-semibold mb-3">Modelos ({modelos.length})</h3>
          <p className="text-xs text-zinc-500 mb-3">Usa variáveis {"{{cliente.nome}}"} e {"{{nif}}"} no corpo. Pré-visualiza antes de enviar.</p>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {modelos.length===0 ? <div className="py-12 text-center text-sm text-zinc-500 border-2 border-dashed rounded-xl">Sem modelos. Cria o primeiro.</div> : modelos.map(m=> (
              <div key={m.id} className="p-3 rounded-xl border border-zinc-200 hover:bg-zinc-50">
                <div className="flex items-start justify-between gap-2"><span className="text-xs px-2 py-1 rounded-full bg-zinc-100 border">{m.tipo}</span><button onClick={()=>deleteModelo(m.id)} className="text-rose-600 hover:underline text-xs">Apagar</button></div>
                <div className="text-sm font-medium mt-1">{m.titulo}</div>
                {m.assunto && <div className="text-xs text-zinc-600">Assunto: {m.assunto}</div>}
                <div className="text-xs text-zinc-500 mt-1 line-clamp-2">{m.corpo.slice(0,120)}</div>
                <div className="flex gap-1 mt-2">
                  <button onClick={()=>{ setMForm(m); setShowModelo(true); }} className="text-xs px-2 py-1 rounded-lg bg-white border">Editar</button>
                  <button onClick={()=>setPreviewId(m.id)} className="text-xs px-2 py-1 rounded-lg bg-[#0677FF] text-white">Pré-visualizar</button>
                </div>
                {previewId===m.id && preview && <div className="mt-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-sm whitespace-pre-wrap">{preview.corpo.replaceAll('{{cliente.nome}}','Empresa Exemplo').replaceAll('{{nif}}','500000000')}</div>}
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <h3 className="font-semibold mb-3">Histórico de envios ({envios.length})</h3>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {envios.length===0 ? <div className="py-12 text-center text-sm text-zinc-500 border-2 border-dashed rounded-xl">Sem envios ainda.</div> : envios.slice(0,20).map(e=> (
              <div key={e.id} className="p-3 rounded-xl border border-zinc-200">
                <div className="flex items-center gap-2 text-xs"><span className="px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200">{e.tipo}</span><span className="text-zinc-500">{new Date(e.data).toLocaleDateString('pt-PT')}</span><span className="text-zinc-500">• {e.clienteNome||'—'}</span></div>
                <div className="text-sm font-medium mt-1">{e.assunto || e.destinatario}</div>
                <div className="text-xs text-zinc-600 line-clamp-2">{e.corpo.slice(0,120)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {showModelo && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center p-4" onClick={()=>setShowModelo(false)}>
          <div className="w-full max-w-[560px] bg-white rounded-2xl p-6 border shadow-xl" onClick={e=>e.stopPropagation()}>
            <h3 className="font-semibold">{mForm.id ? 'Editar modelo' : 'Novo modelo'}</h3>
            <div className="space-y-3 mt-4">
              <input value={mForm.titulo||''} onChange={e=>setMForm({...mForm, titulo:e.target.value})} placeholder="Título — ex: Lembrete IVA" className="w-full px-3 py-2.5 rounded-xl border text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <select value={mForm.tipo} onChange={e=>setMForm({...mForm, tipo:e.target.value as any})} className="px-3 py-2.5 rounded-xl border bg-white text-sm"><option value="email">Email</option><option value="sms">SMS</option><option value="carta">Carta</option></select>
                <input value={mForm.assunto||''} onChange={e=>setMForm({...mForm, assunto:e.target.value})} placeholder="Assunto (email)" className="px-3 py-2.5 rounded-xl border text-sm" />
              </div>
              <textarea value={mForm.corpo||''} onChange={e=>setMForm({...mForm, corpo:e.target.value})} placeholder="Corpo com {{cliente.nome}} {{nif}}" rows={5} className="w-full px-3 py-2.5 rounded-xl border text-sm font-mono" />
              <div className="flex justify-end gap-2"><button onClick={()=>setShowModelo(false)} className="px-4 py-2 rounded-xl border text-sm">Cancelar</button><button onClick={handleSaveModelo} className="px-4 py-2 rounded-xl bg-[#0677FF] text-white text-sm">Guardar modelo (live)</button></div>
            </div>
          </div>
        </div>
      )}
      {showEnvio && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center p-4" onClick={()=>setShowEnvio(false)}>
          <div className="w-full max-w-[560px] bg-white rounded-2xl p-6 border shadow-xl" onClick={e=>e.stopPropagation()}>
            <h3 className="font-semibold">Novo envio</h3>
            <div className="space-y-3 mt-4">
              <select value={eForm.clienteId||''} onChange={e=>setEForm({...eForm, clienteId:e.target.value})} className="w-full px-3 py-2.5 rounded-xl border bg-white text-sm"><option value="">Escolhe cliente</option>{clientes.map(c=> <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
              <select value={eForm.modeloId||''} onChange={e=>{ const m=modelos.find(x=>x.id===e.target.value); setEForm({...eForm, modeloId:e.target.value, tipo: m?.tipo as any || eForm.tipo, assunto: m?.assunto || eForm.assunto, corpo: m?.corpo || eForm.corpo}); }} className="w-full px-3 py-2.5 rounded-xl border bg-white text-sm"><option value="">Sem modelo (manual)</option>{modelos.map(m=> <option key={m.id} value={m.id}>{m.titulo} — {m.tipo}</option>)}</select>
              <input value={eForm.destinatario||''} onChange={e=>setEForm({...eForm, destinatario:e.target.value})} placeholder="Destinatário — email ou telefone" className="w-full px-3 py-2.5 rounded-xl border text-sm" />
              <input value={eForm.assunto||''} onChange={e=>setEForm({...eForm, assunto:e.target.value})} placeholder="Assunto" className="w-full px-3 py-2.5 rounded-xl border text-sm" />
              <textarea value={eForm.corpo||''} onChange={e=>setEForm({...eForm, corpo:e.target.value})} placeholder="Corpo" rows={4} className="w-full px-3 py-2.5 rounded-xl border text-sm" />
              <div className="flex justify-end gap-2"><button onClick={()=>setShowEnvio(false)} className="px-4 py-2 rounded-xl border text-sm">Cancelar</button><button onClick={handleEnvio} className="px-4 py-2 rounded-xl bg-[#0677FF] text-white text-sm">Registar envio (live)</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Rentabilidade — Fase 3 ──────────────────────────────────────────────────
function RentabilidadeView({ clientes }: { clientes: GabineteCliente[] }) {
  const tempos = useGabineteTempos();
  const [filtroCli, setFiltroCli] = useState<string>('todos');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<Partial<Tempo>>({ faturavel: true });
  const filtered = useMemo(()=> filtroCli==='todos' ? tempos : tempos.filter(t=> t.clienteId===filtroCli), [tempos, filtroCli]);
  const totalMin = filtered.reduce((a,b)=> a+b.minutos, 0);
  const totalHoras = (totalMin/60).toFixed(1);
  const porCliente = useMemo(()=> {
    const map: Record<string, { nome: string; min: number; avenca?: number }> = {};
    filtered.forEach(t=> { if(!map[t.clienteId]) map[t.clienteId]={ nome: t.clienteNome||clientes.find(c=>c.id===t.clienteId)?.nome||t.clienteId, min:0, avenca: clientes.find(c=>c.id===t.clienteId)?.avencaMensal }; map[t.clienteId].min+=t.minutos; });
    return Object.entries(map).map(([id, v])=> ({ id, ...v, horas: (v.min/60).toFixed(1), custo: (v.min/60*50).toFixed(0), rent: v.avenca ? (v.avenca - v.min/60*50).toFixed(0) : '—' })).sort((a,b)=> b.min - a.min);
  }, [filtered, clientes]);
  const handleSave = async () => {
    if (!form.clienteId || !form.minutos) return alert('Cliente e minutos obrigatórios');
    const cli = clientes.find(c=>c.id===form.clienteId);
    const t: Tempo = { id: (form.id as string)||newTempoId(), clienteId: form.clienteId!, clienteNome: cli?.nome, colaboradorId: form.colaboradorId, colaboradorNome: form.colaboradorNome, data: form.data||Date.now(), minutos: Number(form.minutos), descricao: form.descricao?.trim(), faturavel: !!form.faturavel, valor: Number(form.minutos)/60*50, createdAt: (form.createdAt as number)||Date.now(), updatedAt: Date.now() };
    await upsertTempo(t); setShowNew(false); setForm({ faturavel: true });
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold flex items-center gap-2"><BarChart3 className="w-5 h-5 text-[#0677FF]" /> Rentabilidade</h2>
        <div className="flex gap-2">
          <select value={filtroCli} onChange={e=>setFiltroCli(e.target.value)} className="px-3 py-2.5 rounded-xl border bg-white text-sm"><option value="todos">Todos clientes</option>{clientes.map(c=> <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
          <button onClick={()=>{ setForm({ faturavel: true, data: Date.now() }); setShowNew(true); }} className="px-4 py-2.5 rounded-xl bg-[#0677FF] text-white text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" /> Novo registo</button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border p-4"><div className="text-xs font-bold text-zinc-500">Horas totais</div><div className="text-2xl font-bold">{totalHoras}h</div><div className="text-xs text-zinc-500">{filtered.length} registos</div></div>
        <div className="bg-white rounded-2xl border p-4"><div className="text-xs font-bold text-zinc-500">Custo (50€/h)</div><div className="text-2xl font-bold">{(totalMin/60*50).toFixed(0)}€</div><div className="text-xs text-zinc-500">estimado</div></div>
        <div className="bg-white rounded-2xl border p-4"><div className="text-xs font-bold text-zinc-500">Clientes com avença</div><div className="text-2xl font-bold">{clientes.filter(c=>c.avencaMensal).length}</div><div className="text-xs text-zinc-500">com avença definida</div></div>
      </div>
      <div className="bg-white rounded-2xl border overflow-hidden">
        <div className="p-4 font-semibold">Por cliente</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-600"><tr><th className="text-left px-4 py-2">Cliente</th><th className="text-left px-4 py-2">Horas</th><th className="text-left px-4 py-2">Custo</th><th className="text-left px-4 py-2">Avença</th><th className="text-left px-4 py-2">Margem</th></tr></thead>
            <tbody className="divide-y">
              {porCliente.length===0 ? <tr><td colSpan={5} className="px-4 py-12 text-center text-zinc-500">Sem tempos registados.</td></tr> : porCliente.map(r=> (
                <tr key={r.id} className="hover:bg-zinc-50"><td className="px-4 py-2 font-medium">{r.nome}</td><td className="px-4 py-2">{r.horas}h</td><td className="px-4 py-2">{r.custo}€</td><td className="px-4 py-2">{r.avenca? r.avenca+'€':'—'}</td><td className={`px-4 py-2 font-bold ${r.rent==='—' ? 'text-zinc-400' : Number(r.rent)>=0 ? 'text-emerald-600' : 'text-rose-600'}`}>{r.rent==='—' ? '—' : r.rent+'€'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-white rounded-2xl border p-4">
        <h3 className="font-semibold mb-3">Registos recentes</h3>
        <div className="space-y-2 max-h-[360px] overflow-y-auto">
          {filtered.slice(0,20).map(t=> (
            <div key={t.id} className="p-3 rounded-xl border flex items-center justify-between">
              <div><div className="text-sm font-medium">{t.clienteNome} • {t.minutos}min • {t.faturavel ? 'Faturável' : 'Não faturável'}</div><div className="text-xs text-zinc-500">{new Date(t.data).toLocaleDateString('pt-PT')} • {t.descricao||'—'}</div></div>
              <button onClick={()=>deleteTempo(t.id)} className="text-rose-600 text-xs hover:underline">Apagar</button>
            </div>
          ))}
        </div>
      </div>
      {showNew && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center p-4" onClick={()=>setShowNew(false)}>
          <div className="w-full max-w-[480px] bg-white rounded-2xl p-6 border shadow-xl" onClick={e=>e.stopPropagation()}>
            <h3 className="font-semibold">Novo tempo</h3>
            <div className="space-y-3 mt-4">
              <select value={form.clienteId||''} onChange={e=>setForm({...form, clienteId:e.target.value, clienteNome: clientes.find(c=>c.id===e.target.value)?.nome})} className="w-full px-3 py-2.5 rounded-xl border bg-white text-sm"><option value="">Cliente</option>{clientes.map(c=> <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" value={form.minutos||''} onChange={e=>setForm({...form, minutos: Number(e.target.value)})} placeholder="Minutos" className="px-3 py-2.5 rounded-xl border text-sm" />
                <input type="date" value={form.data ? new Date(form.data).toISOString().slice(0,10) : new Date().toISOString().slice(0,10)} onChange={e=>setForm({...form, data: e.target.value? new Date(e.target.value).getTime(): Date.now()})} className="px-3 py-2.5 rounded-xl border text-sm" />
              </div>
              <input value={form.descricao||''} onChange={e=>setForm({...form, descricao:e.target.value})} placeholder="Descrição" className="w-full px-3 py-2.5 rounded-xl border text-sm" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.faturavel} onChange={e=>setForm({...form, faturavel: e.target.checked})} /> Faturável</label>
              <div className="flex justify-end gap-2"><button onClick={()=>setShowNew(false)} className="px-4 py-2 rounded-xl border text-sm">Cancelar</button><button onClick={handleSave} className="px-4 py-2 rounded-xl bg-[#0677FF] text-white text-sm">Guardar (live)</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Actas — Fase 4 ──────────────────────────────────────────────────────────
function ActasView({ clientes }: { clientes: GabineteCliente[] }) {
  const actas = useGabineteActas();
  const [q, setQ] = useState('');
  const [filtroCli, setFiltroCli] = useState<string>('todos');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<Partial<Acta>>({ tipo: 'ordinaria' as const });
  const filtered = useMemo(()=> {
    const s=q.toLowerCase();
    return actas.filter(a=> {
      if(filtroCli!=='todos' && a.clienteId!==filtroCli) return false;
      if(!s) return true;
      return (a.titulo+' '+a.conteudo).toLowerCase().includes(s);
    }).sort((a,b)=> b.data - a.data);
  }, [actas, q, filtroCli]);
  const handleSave = async () => {
    if(!form.clienteId || !form.titulo?.trim() || !form.conteudo?.trim()) return alert('Cliente, título e conteúdo obrigatórios');
    const cli=clientes.find(c=>c.id===form.clienteId);
    const a: Acta = { id: (form.id as string)||newActaId(), clienteId: form.clienteId!, clienteNome: cli?.nome, data: form.data||Date.now(), tipo: (form.tipo as any)||'ordinaria', titulo: form.titulo!.trim(), conteudo: form.conteudo!.trim(), createdAt: (form.createdAt as number)||Date.now(), updatedAt: Date.now() };
    await upsertActa(a); setShowNew(false); setForm({ tipo: 'ordinaria' as const });
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-[#0677FF]" /> Livro de Actas</h2>
        <button onClick={()=>{ setForm({ tipo: 'ordinaria' as const, data: Date.now() }); setShowNew(true); }} className="px-4 py-2.5 rounded-xl bg-[#0677FF] text-white text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" /> Nova acta</button>
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Pesquisar actas..." className="w-full pl-9 pr-3 py-2.5 rounded-xl border bg-white text-sm" />
        </div>
        <select value={filtroCli} onChange={e=>setFiltroCli(e.target.value)} className="px-3 py-2.5 rounded-xl border bg-white text-sm"><option value="todos">Todos clientes</option>{clientes.map(c=> <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
      </div>
      <div className="space-y-2">
        {filtered.length===0 ? <div className="py-12 text-center text-sm text-zinc-500 border-2 border-dashed rounded-xl">Sem actas.</div> : filtered.map(a=> (
          <div key={a.id} className="bg-white rounded-2xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div><div className="text-sm font-semibold">{a.titulo}</div><div className="text-xs text-zinc-500">{a.clienteNome} • {new Date(a.data).toLocaleDateString('pt-PT')} • {a.tipo}</div></div>
              <button onClick={()=>deleteActa(a.id)} className="text-rose-600 text-xs hover:underline">Apagar</button>
            </div>
            <div className="text-sm text-zinc-700 mt-2 whitespace-pre-wrap bg-zinc-50 border rounded-xl p-3">{a.conteudo}</div>
          </div>
        ))}
      </div>
      {showNew && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-center justify-center p-4" onClick={()=>setShowNew(false)}>
          <div className="w-full max-w-[560px] bg-white rounded-2xl p-6 border shadow-xl" onClick={e=>e.stopPropagation()}>
            <h3 className="font-semibold">{form.id ? 'Editar acta' : 'Nova acta'}</h3>
            <div className="space-y-3 mt-4">
              <select value={form.clienteId||''} onChange={e=>setForm({...form, clienteId:e.target.value})} className="w-full px-3 py-2.5 rounded-xl border bg-white text-sm"><option value="">Cliente</option>{clientes.map(c=> <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={form.data ? new Date(form.data).toISOString().slice(0,10) : ''} onChange={e=>setForm({...form, data: e.target.value? new Date(e.target.value).getTime(): Date.now()})} className="px-3 py-2.5 rounded-xl border text-sm" />
                <select value={form.tipo} onChange={e=>setForm({...form, tipo:e.target.value as any})} className="px-3 py-2.5 rounded-xl border bg-white text-sm"><option value="ordinaria">Ordinária</option><option value="extraordinaria">Extraordinária</option><option value="outro">Outro</option></select>
              </div>
              <input value={form.titulo||''} onChange={e=>setForm({...form, titulo:e.target.value})} placeholder="Título" className="w-full px-3 py-2.5 rounded-xl border text-sm" />
              <textarea value={form.conteudo||''} onChange={e=>setForm({...form, conteudo:e.target.value})} placeholder="Conteúdo da acta..." rows={6} className="w-full px-3 py-2.5 rounded-xl border text-sm" />
              <div className="flex justify-end gap-2"><button onClick={()=>setShowNew(false)} className="px-4 py-2 rounded-xl border text-sm">Cancelar</button><button onClick={handleSave} className="px-4 py-2 rounded-xl bg-[#0677FF] text-white text-sm">Guardar acta (live)</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
