import React, { useMemo, useState } from 'react';
import { Search, Plus, Users, CheckSquare, Calendar, Lock, LayoutDashboard, Building2, Trash2, Eye, EyeOff, Copy, Shield, AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';
import { useGabineteClientes, useGabineteTarefas, useGabineteObrigacoes, useGabineteCofre } from './lib/useGabinete';
import {
  upsertCliente, deleteCliente, newClienteId, gerarObrigacoesParaCliente, migrarEmpresasParaGabinete,
  upsertTarefa, deleteTarefa, marcarTarefaFeita, newTarefaId,
  upsertObrigacao,
  upsertCofre, deleteCofre, registarVistaCofre, newCofreId,
  type GabineteCliente, type Tarefa, type Obrigacao, type CofreEntrada,
} from './lib/gabinete';
import { listEmpresas } from './lib/empresas';
import { encryptSecret, decryptSecret, setCofrePassphrase, getCofrePassphrase, cofreIsUnlocked } from './lib/cofreCrypto';
import GuiaSugestao from './components/GuiaSugestao';
import type { ViewKey } from './lib/guias';

// Guia por tab interna do Gabinete (a sugestão muda conforme a tab ativa)
const GAB_TAB_GUIA: Record<GabTab, ViewKey> = {
  dashboard: 'gabinete',
  clientes: 'gab-clientes',
  tarefas: 'gab-tarefas',
  obrigacoes: 'gab-obrigacoes',
  cofre: 'gab-cofre',
};

// ─── Layout ─────────────────────────────────────────────────────────────────
type GabTab = 'dashboard' | 'clientes' | 'tarefas' | 'obrigacoes' | 'cofre';
const TABS: { id: GabTab; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, desc: 'Visão do dia' },
  { id: 'clientes', label: 'Clientes 360', icon: Users, desc: 'Ficha centralizada' },
  { id: 'tarefas', label: 'Tarefas', icon: CheckSquare, desc: 'Kanban + lista' },
  { id: 'obrigacoes', label: 'Obrigações', icon: Calendar, desc: 'Calendário fiscal' },
  { id: 'cofre', label: 'Cofre', icon: Lock, desc: 'Zero-knowledge' },
];

export default function Gabinete({ tab: controlledTab, onTabChange, onStartTour }: { tab?: GabTab; onTabChange?: (t: GabTab) => void; onStartTour?: (v: ViewKey) => void }) {
  const [internalTab, setInternalTab] = useState<GabTab>('dashboard');
  const tab = controlledTab ?? internalTab;
  const setTab = (onTabChange ?? setInternalTab) as (t: GabTab) => void;
  const clientes = useGabineteClientes();
  const tarefas = useGabineteTarefas();
  const obrigacoes = useGabineteObrigacoes();
  const cofre = useGabineteCofre();

  // Por defeito, se o App não passar callback, navega para o dashboard (no-op)
  const startTour = (v: ViewKey) => onStartTour?.(v);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-zinc-900">
      <GuiaSugestao view={GAB_TAB_GUIA[tab]} onStart={startTour} />
      {/* Header — sem tabs no topo; navegação agora no dropdown da sidebar */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-zinc-200">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0677FF] flex items-center justify-center text-white font-bold text-sm">E3</div>
            <div>
              <div className="font-semibold leading-none">Gabinete</div>
              <div className="text-xs text-zinc-500 hidden sm:block">{TABS.find(t=>t.id===tab)?.label} · {TABS.find(t=>t.id===tab)?.desc}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>{clientes.length} clientes</span>
            <span className="opacity-30">•</span>
            <span>{tarefas.filter(t=>t.estado!=='done').length} tarefas abertas</span>
            <span className="opacity-30">•</span>
            <span>{cofre.length} acessos</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {tab === 'dashboard' && <Dashboard clientes={clientes} tarefas={tarefas} obrigacoes={obrigacoes} cofre={cofre} onGo={setTab} />}
        {tab === 'clientes' && <ClientesView clientes={clientes} />}
        {tab === 'tarefas' && <TarefasView tarefas={tarefas} clientes={clientes} />}
        {tab === 'obrigacoes' && <ObrigacoesView obrigacoes={obrigacoes} clientes={clientes} />}
        {tab === 'cofre' && <CofreView cofre={cofre} clientes={clientes} />}
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
  const vencidasObr = obrigacoes.filter(o=> o.vencimento < Date.now() && o.estado!=='entregue' && o.estado!=='dispensada').length;
  const semTarefa30d = clientes.filter(c=> !tarefas.some(t=> t.clienteId===c.id && t.createdAt > Date.now()-30*86400000)).length;
  const proximos = [...tarefas, ...obrigacoes.map(o=> ({ id:o.id, titulo:o.titulo, dataVencimento:o.vencimento, estado:o.estado, tipo:'obrigacao' as const } as unknown as Tarefa))]
    .filter(x=> x.dataVencimento && x.dataVencimento >= hoje.getTime() && x.dataVencimento <= em7dias)
    .sort((a,b)=> (a.dataVencimento! - b.dataVencimento!)).slice(0,7);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Tarefas hoje" value={tarefasHoje} sub="vencem hoje" icon={CheckSquare} tone="blue" />
        <Kpi label="Atrasadas" value={atrasadas} sub="precisam atenção" icon={AlertTriangle} tone={atrasadas? 'rose':'emerald'} />
        <Kpi label="Obrigações vencidas" value={vencidasObr} sub="IVA/PPC/IES" icon={Calendar} tone={vencidasObr? 'amber':'zinc'} />
        <Kpi label="Clientes sem tarefa 30d" value={semTarefa30d} sub="risco de esquecimento" icon={Users} tone="zinc" />
      </div>

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

// ─── Clientes 360 ─────────────────────────────────────────────────────────────
function ClientesView({ clientes }: { clientes: GabineteCliente[] }) {
  const [q, setQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<Partial<GabineteCliente>>({ tipoEntidade:'LDA', regimeIva:'trimestral', territorio:'continente', estado:'ativo' });
  const [filtroEstado, setFiltroEstado] = useState<'todos'|'ativo'|'arquivado'>('todos');

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
function TarefasView({ tarefas, clientes }: { tarefas:Tarefa[]; clientes:GabineteCliente[] }) {
  const [q, setQ] = useState('');
  const [filtroCli, setFiltroCli] = useState<string>('todos');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<Partial<Tarefa>>({ tipo:'tarefa', prioridade:'media', estado:'todo' });

  const filtered = useMemo(()=> {
    const s=q.toLowerCase();
    return tarefas.filter(t=> {
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
        <button onClick={()=>{ setForm({ tipo:'tarefa', prioridade:'media', estado:'todo' }); setShowNew(true); }} className="px-4 py-2.5 rounded-xl bg-[#0677FF] text-white text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" /> Nova tarefa</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {cols.map(col=> {
          const items = filtered.filter(t=> t.estado===col.id);
          return (
            <div key={col.id} className="bg-white rounded-2xl border border-zinc-200 p-3 min-h-[360px]">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm">{col.label}</h4>
                <span className="text-xs px-2 py-1 rounded-full bg-zinc-100 border border-zinc-200">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.length===0 ? <div className="py-8 text-center text-xs text-zinc-400 border-2 border-dashed border-zinc-200 rounded-xl">Vazio</div> :
                items.map(t=> (
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
                      <button onClick={()=>deleteTarefa(t.id)} className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-zinc-200"><Trash2 className="w-3.5 h-3.5 text-zinc-500" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showNew && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setShowNew(false)}>
          <div className="w-full max-w-[560px] bg-white rounded-2xl p-6 border border-zinc-200 shadow-xl" onClick={e=>e.stopPropagation()}>
            <h3 className="font-semibold">{form.id ? 'Editar tarefa' : 'Nova tarefa'}</h3>
            <div className="grid grid-cols-1 gap-3 mt-4">
              <input value={form.titulo||''} onChange={e=>setForm({...form, titulo:e.target.value})} placeholder="Ex: Entregar IVA Julho — Cliente X" className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" />
              <textarea value={form.descricao||''} onChange={e=>setForm({...form, descricao:e.target.value})} placeholder="Descrição (opcional)" rows={2} className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.clienteId||''} onChange={e=>setForm({...form, clienteId:e.target.value||undefined})} className="px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm">
                  <option value="">Sem cliente</option>{clientes.map(c=> <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <input type="date" value={form.dataVencimento ? new Date(form.dataVencimento).toISOString().slice(0,10) : ''} onChange={e=>setForm({...form, dataVencimento: e.target.value ? new Date(e.target.value).getTime() as never : undefined })} className="px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <select value={form.prioridade} onChange={e=>setForm({...form, prioridade:e.target.value as never})} className="px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm"><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select>
                <select value={form.tipo} onChange={e=>setForm({...form, tipo:e.target.value as never})} className="px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm"><option value="tarefa">Tarefa</option><option value="obrigacao">Obrigação</option><option value="lembrete">Lembrete</option></select>
                <select value={form.estado} onChange={e=>setForm({...form, estado:e.target.value as never})} className="px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm"><option value="todo">A fazer</option><option value="doing">Em curso</option><option value="done">Feito</option><option value="atrasada">Atrasada</option></select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6"><button onClick={()=>setShowNew(false)} className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm">Cancelar</button><button onClick={handleSave} className="px-4 py-2.5 rounded-xl bg-[#0677FF] text-white text-sm font-medium">Guardar (live)</button></div>
          </div>
        </div>
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
      if (filtroCli!=='todos' && o.clienteId!==filtroCli) return false;
      const ym = new Date(o.vencimento).toISOString().slice(0,7);
      return ym===mes;
    }).sort((a,b)=>a.vencimento-b.vencimento);
  }, [obrigacoes,mes,filtroCli]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <input type="month" value={mes} onChange={e=>setMes(e.target.value)} className="px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm" />
        <select value={filtroCli} onChange={e=>setFiltroCli(e.target.value)} className="px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm">
          <option value="todos">Todos clientes</option>{clientes.map(c=> <option key={c.id} value={c.id}>{c.nome}</option>)}
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
                      {o.estado!=='entregue' && <button onClick={()=>upsertObrigacao({...o, estado:'entregue'})} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs">Entregue</button>}
                      {o.estado!=='dispensada' && <button onClick={()=>upsertObrigacao({...o, estado:'dispensada'})} className="px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs">Dispensar</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-zinc-500">As obrigações são geradas automaticamente ao criar/editar cliente (IVA mensal/trimestral + PPC jul/set/dez + Modelo 22/IES). Ficam sempre guardadas em Firestore + IndexedDB e atualizadas live.</p>
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
              <input value={(form as unknown as { secretPlain?: string }).secretPlain||''} onChange={e=>setForm({...form, secretPlain:e.target.value} as never)} placeholder="Segredo — senha / token" type="password" className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm font-mono" />
              <textarea value={form.notas||''} onChange={e=>setForm({...form, notas:e.target.value})} placeholder="Notas (opcional)" rows={2} className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" />
            </div>
            <div className="flex justify-end gap-2 mt-6"><button onClick={()=>setShowNew(false)} className="px-4 py-2.5 rounded-xl border border-zinc-200 text-sm">Cancelar</button><button onClick={handleSave} className="px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-sm font-medium">Cifrar e guardar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
