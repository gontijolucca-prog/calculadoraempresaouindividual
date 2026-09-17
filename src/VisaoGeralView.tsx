import React, { useMemo, useState } from 'react';
import {
  Building2, AlertTriangle, Calendar, FileText, Users, Lock, Info, Phone, Mail, MessageCircle, Clock, Plus, Trash2, X, Pencil
} from 'lucide-react';
import {
  upsertCliente,
  upsertContactoGabinete, deleteContactoGabinete, newContactoGabineteId,
  upsertAssuntoGabinete, deleteAssuntoGabinete, newAssuntoGabineteId,
  upsertAlertaGabinete, deleteAlertaGabinete, newAlertaGabineteId,
  upsertOcorrencia, deleteOcorrencia, newOcorrenciaId,
  upsertDocumentoGeral, deleteDocumentoGeral, newDocumentoGeralId,
  upsertTarefa, deleteTarefa, newTarefaId,
} from './lib/gabinete';
import type { GabineteCliente, Tarefa, Obrigacao, CofreEntrada, GabineteDocumento, ContactoGabinete, AssuntoGabinete, AlertaGabinete, OcorrenciaGabinete, Colaborador } from './lib/gabinete';

type Props = {
  cliente: GabineteCliente | null;
  contactos: ContactoGabinete[];
  assuntos: AssuntoGabinete[];
  alertas: AlertaGabinete[];
  ocorrencias: OcorrenciaGabinete[];
  tarefas: Tarefa[];
  obrigacoes: Obrigacao[];
  cofre: CofreEntrada[];
  documentos: GabineteDocumento[];
  colaboradores?: Colaborador[];
  onEditCliente?: () => void;
  onGo?: (tab: string) => void;
  onOpenCofre?: () => void;
};

function initialsOf(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '—';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[1][0]).toUpperCase();
}

const estadoBadgeCls: Record<string, string> = {
  em_curso: 'bg-[#FFF7ED] text-amber-700 border-amber-200',
  aguard_cliente: 'bg-[#FFFBEB] text-amber-700 border-amber-200',
  pendente: 'bg-[#FFF1F2] text-rose-700 border-rose-200',
  concluido: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
const estadoLabel: Record<string, string> = {
  em_curso: 'Em curso',
  aguard_cliente: 'Aguard. cliente',
  pendente: 'Pendente',
  concluido: 'Concluído',
};

export default function VisaoGeralView({ cliente, contactos, assuntos, alertas, ocorrencias, tarefas, obrigacoes, cofre, documentos, colaboradores, onEditCliente, onGo, onOpenCofre }: Props) {
  const displayNome = cliente?.nome || 'Mykola & Vasyl, Lda';
  const displayNif = cliente?.nif || '518 123 456';
  const caeLabel = cliente?.caes || cliente?.caeDescricao || '43210';
  const caeDesc = cliente?.caeDescricao || 'Instalações elétricas';
  const tipoSoc = cliente?.tipoSociedade || (cliente?.tipoEntidade === 'LDA' ? 'Sociedade por quotas' : cliente?.tipoEntidade || 'Sociedade por quotas');
  const regimeIvaLabel = cliente?.regimeIva === 'mensal' ? 'Mensal' : cliente?.regimeIva === 'isencao53' ? 'Isenção Art. 53' : 'Trimestral';
  const regimeIrcLabel = cliente?.regimeIrc === 'simplificado' ? 'Simplificado' : cliente?.regimeIrc === 'transparencia' ? 'Transparência' : 'Regime Geral';
  const nrTrab = cliente?.nrTrabalhadores ?? 3;
  const inicioAtiv = cliente?.inicioAtividade ? new Date(cliente.inicioAtividade).toLocaleDateString('pt-PT') : '15/12/2025';
  const gerentes = cliente?.gerentes && cliente.gerentes.length > 0 ? cliente.gerentes : ['Mykola Ivanenko', 'Vasyl Petrenko'];
  const responsavel = cliente?.responsavelInterno || { nome: 'Ana Margarida', initials: 'AM' };
  const apoio = cliente?.apoioAdministrativo || { nome: 'Vilma', initials: 'VI' };
  const supervisor = cliente?.supervisor || { nome: 'Sandrine Reis', initials: 'SR' };
  const orientacoes = (cliente?.orientacoes || '').trim() || [
    'Todas as faturas devem ser digitalizadas e inseridas no TOCOnline no momento da receção.',
    'Cliente prefere comunicação por WhatsApp.',
    'Confirmar sempre a afetação de despesas (pessoal vs. empresa).',
    'Validar dedutibilidade de despesas com viatura, combustível e portagens.',
    'Antes de fechar o mês, confirmar se existem documentos em falta.',
  ].join('\n');

  const situacaoItems = useMemo(() => {
    if (cliente?.situacaoAtual && cliente.situacaoAtual.length > 0) {
      const dotMap: Record<string, string> = { red: 'bg-[#EF4444]', green: 'bg-[#10B981]', orange: 'bg-[#F59E0B]' };
      return cliente.situacaoAtual.map(s => ({ dot: dotMap[s.cor] || 'bg-zinc-400', text: s.texto }));
    }
    return [
      { dot: 'bg-[#EF4444]', text: 'Documentação de julho e agosto em falta' },
      { dot: 'bg-[#10B981]', text: 'IVA tratado até julho' },
      { dot: 'bg-[#10B981]', text: 'Contabilidade em dia' },
      { dot: 'bg-[#F59E0B]', text: 'Processo de compensação Segurança Social pendente' },
      { dot: 'bg-[#10B981]', text: 'Salários atualizados' },
    ];
  }, [cliente?.situacaoAtual]);

  const proximosPrazos = useMemo(() => {
    const fromObr = obrigacoes
      .filter(o => o.vencimento >= Date.now())
      .sort((a, b) => a.vencimento - b.vencimento)
      .slice(0, 5)
      .map(o => ({ label: new Date(o.vencimento).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }).replace('.', '').replace(' ', ' '), title: o.titulo }));
    if (fromObr.length >= 3) return fromObr;
    return [
      { label: '10 set', title: 'Envio IVA (2.º trimestre)' },
      { label: '15 set', title: 'Submissão DMR' },
      { label: '20 set', title: 'Pagamento TSU' },
      { label: '30 set', title: 'Resposta SS – compensação' },
      { label: '15 out', title: 'Modelo 22 (se aplicável)' },
    ];
  }, [obrigacoes]);

  const assuntosExibir: AssuntoGabinete[] = assuntos.slice(0, 3);

  const alertasExibir: AlertaGabinete[] = alertas.slice(0, 5);

  const contactosExibir: ContactoGabinete[] = contactos.slice(0, 5);

  const docsExibir: GabineteDocumento[] = documentos.slice(0, 5);

  const cofreFallback = (() => {
    const fromCofre = cofre.filter(c => !cliente || c.clienteId === cliente.id).slice(0, 4);
    if (fromCofre.length > 0) return fromCofre.map(c => ({ label: c.categoria, title: c.titulo }));
    return [
      { label: 'AT', title: 'Portal das Finanças' },
      { label: 'SS', title: 'Segurança Social Direta' },
      { label: 'TOC', title: 'TOConline' },
      { label: 'BPI', title: 'Homebanking' },
    ];
  })();

  const ocorrExibir: OcorrenciaGabinete[] = ocorrencias.slice(0, 7);

  const avatarInitials = initialsOf(displayNome).slice(0, 2);

  // ——— Modais funcionais ———
  const [showEditCliente, setShowEditCliente] = useState(false);
  const [formCliente, setFormCliente] = useState<Partial<GabineteCliente>>({});
  const [showAddAlerta, setShowAddAlerta] = useState(false);
  const [alertaTexto, setAlertaTexto] = useState('');
  const [showAddAssunto, setShowAddAssunto] = useState(false);
  const [assuntoTitulo, setAssuntoTitulo] = useState('');
  const [assuntoEstado, setAssuntoEstado] = useState<AssuntoGabinete['estado']>('em_curso');
  const [showAddContacto, setShowAddContacto] = useState(false);
  const [contactoForm, setContactoForm] = useState<Partial<ContactoGabinete>>({});
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [docNome, setDocNome] = useState('');
  const [showAddOcorr, setShowAddOcorr] = useState(false);
  const [ocorrDesc, setOcorrDesc] = useState('');
  const [showEditSituacao, setShowEditSituacao] = useState(false);
  const [showEditOrient, setShowEditOrient] = useState(false);
  const [orientEdit, setOrientEdit] = useState(orientacoes);

  const handleEditClienteOpen = () => {
    if (!cliente) return;
    setFormCliente({ nome: cliente.nome, nif: cliente.nif, caes: cliente.caes, caeDescricao: cliente.caeDescricao, tipoSociedade: cliente.tipoSociedade, gerentes: cliente.gerentes, nrTrabalhadores: cliente.nrTrabalhadores, inicioAtividade: cliente.inicioAtividade, responsavelId: cliente.responsavelId, responsavelInterno: cliente.responsavelInterno, apoioId: cliente.apoioId, apoioAdministrativo: cliente.apoioAdministrativo, supervisorId: cliente.supervisorId, supervisor: cliente.supervisor });
    setShowEditCliente(true);
  };
  const handleSaveCliente = async () => {
    if (!cliente) return;
    const upd: GabineteCliente = { ...cliente, ...formCliente, gerentes: typeof formCliente.gerentes === 'string' ? (formCliente.gerentes as unknown as string).split(',').map(s=>s.trim()).filter(Boolean) : formCliente.gerentes, updatedAt: Date.now() };
    // Ensure proper types for gerentes string case: form is string input
    await upsertCliente(upd);
    await upsertOcorrencia({ id: newOcorrenciaId(), clienteId: cliente.id, clienteNome: upd.nome, data: Date.now(), autorNome: upd.responsavelInterno?.nome || 'Equipa', autorInitials: upd.responsavelInterno?.initials || 'EQ', descricao: 'Ficha atualizada', createdAt: Date.now() });
    setShowEditCliente(false);
  };
  const handleAddAlerta = async () => {
    if (!cliente || !alertaTexto.trim()) return;
    await upsertAlertaGabinete({ id: newAlertaGabineteId(), clienteId: cliente.id, clienteNome: cliente.nome, texto: alertaTexto.trim(), createdAt: Date.now(), updatedAt: Date.now() });
    setAlertaTexto(''); setShowAddAlerta(false);
  };
  const handleAddAssunto = async () => {
    if (!cliente || !assuntoTitulo.trim()) return;
    const now = Date.now();
    await upsertAssuntoGabinete({ id: newAssuntoGabineteId(), clienteId: cliente.id, clienteNome: cliente.nome, titulo: assuntoTitulo.trim(), estado: assuntoEstado, updatedAt: now, createdAt: now });
    // Tarefa espelho — funcional: assuntos são tarefas
    await upsertTarefa({ id: newTarefaId(), titulo: assuntoTitulo.trim(), tipo: 'tarefa', origem: 'manual', estado: assuntoEstado==='pendente'?'todo':assuntoEstado==='aguard_cliente'?'todo':'doing', prioridade: 'media', clienteId: cliente.id, clienteNome: cliente.nome, createdAt: now, updatedAt: now });
    setAssuntoTitulo(''); setShowAddAssunto(false);
  };
  const handleAddContacto = async () => {
    if (!cliente || !contactoForm.nome?.trim()) return;
    await upsertContactoGabinete({ id: newContactoGabineteId(), clienteId: cliente.id, clienteNome: cliente.nome, nome: contactoForm.nome!.trim(), cargo: contactoForm.cargo?.trim(), telefone: contactoForm.telefone?.trim(), email: contactoForm.email?.trim(), initials: initialsOf(contactoForm.nome!.trim()), createdAt: Date.now(), updatedAt: Date.now() });
    setContactoForm({}); setShowAddContacto(false);
  };
  const handleAddDoc = async () => {
    if (!cliente || !docNome.trim()) return;
    await upsertDocumentoGeral({ id: newDocumentoGeralId(), clienteId: cliente.id, clienteNome: cliente.nome, nome: docNome.trim().endsWith('.pdf') ? docNome.trim() : docNome.trim()+'.pdf', tipo: 'OUTRO', dataUpload: Date.now() });
    setDocNome(''); setShowAddDoc(false);
  };
  const handleAddOcorr = async () => {
    if (!cliente || !ocorrDesc.trim()) return;
    await upsertOcorrencia({ id: newOcorrenciaId(), clienteId: cliente.id, clienteNome: cliente.nome, data: Date.now(), autorNome: cliente.responsavelInterno?.nome || 'Equipa', autorInitials: cliente.responsavelInterno?.initials || 'EQ', descricao: ocorrDesc.trim(), createdAt: Date.now() });
    setOcorrDesc(''); setShowAddOcorr(false);
  };

  return (
    <div className="space-y-3">
      {/* Header empresa - exatamente como print */}
      <div id="top" className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3.5 min-w-0">
            <div className="w-[52px] h-[52px] rounded-xl bg-[#DDE6F3] text-[#5B6B8A] flex items-center justify-center text-[15px] font-[800] tracking-[0.5px] shrink-0">{avatarInitials}</div>
            <div className="min-w-0">
              <h1 className="text-[19px] font-[800] leading-none tracking-[-0.3px] text-[#0B1D2D]">{displayNome}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-[#64748B]">
                <span>NIF <span className="font-[600] text-[#334155]">{displayNif}</span></span>
                <span className="text-[#CBD5E1]">|</span>
                <span>CAE <span className="font-[600] text-[#334155]">{caeLabel} – {caeDesc}</span></span>
                <span className="text-[#CBD5E1]">|</span>
                <span>{tipoSoc}</span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-[#DCFCE7] border border-[#86EFAC] px-2.5 py-1 text-[11px] font-[700] text-[#166534]"><span className="w-3.5 h-3.5 rounded-full bg-[#16A34A] text-white flex items-center justify-center text-[9px]">✓</span> Ativo</span>
                <span className="rounded-full bg-white border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-[500] text-[#475569]">IVA {regimeIvaLabel}</span>
                <span className="rounded-full bg-white border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-[500] text-[#475569]">IRC ({regimeIrcLabel})</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-[500] text-[#475569]"><span className="w-3 h-3 rounded bg-[#E0E7FF] flex items-center justify-center text-[7px]">◈</span> Contabilidade + Salários</span>
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <button onClick={handleEditClienteOpen} className="px-3.5 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-[13px] font-[500] text-[#334155] flex items-center gap-1">Ações <span className="text-[10px]">▾</span></button>
            <button onClick={handleEditClienteOpen} className="px-3.5 py-1.5 rounded-lg bg-[#0F172A] text-white text-[13px] font-[600] flex items-center gap-1.5">✎ Editar</button>
          </div>
        </div>

        {/* Tabs secundárias */}
        <div className="mt-4 -mb-4 border-t border-[#F1F5F9] -mx-4 px-4">
          <div className="flex gap-5 overflow-x-auto scrollbar-none text-[13px]">
            {[
              { id: 'visao', label: 'Visão geral', active: true, scroll: 'top' },
              { id: 'tarefas', label: `Tarefas (${tarefas.length || 4})`, go: 'tarefas' },
              { id: 'assuntos', label: `Assuntos (${assuntos.length || 3})`, scroll: 'sec-assuntos' },
              { id: 'docs', label: 'Documentos', scroll: 'sec-docs' },
              { id: 'contatos', label: 'Contactos', scroll: 'sec-contactos' },
              { id: 'acessos', label: 'Acessos', go: 'cofre' },
              { id: 'obrig', label: 'Obrigações', go: 'obrigacoes' },
              { id: 'hist', label: 'Histórico', scroll: 'sec-historico' },
              { id: 'equipa', label: 'Equipa', go: 'equipa' },
              { id: 'notas', label: 'Notas', scroll: 'sec-orientacoes' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => t.go ? onGo?.(t.go) : t.scroll ? document.getElementById(t.scroll as string)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : undefined}
                className={`whitespace-nowrap py-3 border-b-2 font-[600] ${t.active ? 'border-[#0F172A] text-[#0F172A]' : 'border-transparent text-[#64748B] hover:text-[#334155] font-[500]'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid principal 3 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Resumo da empresa */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-[700] flex items-center gap-2 text-[#0B1D2D]"><Building2 className="w-4 h-4 text-[#64748B]" /> Resumo da empresa</h3>
            <button onClick={handleEditClienteOpen} className="text-[12px] font-[500] text-[#2563EB]">Editar</button>
          </div>
          <div className="space-y-2">
            {[
              ['Nome', displayNome],
              ['NIF', displayNif],
              ['CAE principal', `${caeLabel} – ${caeDesc}`],
              ['Regime IVA', regimeIvaLabel],
              ['IRC', regimeIrcLabel],
              ['Gerentes', gerentes.join(', ')],
              ['N.º trabalhadores', String(nrTrab)],
              ['Início de atividade', inicioAtiv],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2 text-[12.5px] leading-[18px]">
                <span className="w-[125px] shrink-0 text-[#64748B]">{k}</span>
                <span className="flex-1 font-[500] text-[#0F172A] truncate">{v}</span>
              </div>
            ))}
            <div className="pt-3 mt-3 border-t border-[#F1F5F9] space-y-2.5">
              {[
                { label: 'Responsável interno', person: responsavel, bg: 'bg-[#E0E7FF] text-[#4338CA]' },
                { label: 'Apoio administrativo', person: apoio, bg: 'bg-[#F3E8FF] text-[#7C3AED]' },
                { label: 'Supervisor', person: supervisor, bg: 'bg-[#1E293B] text-white' },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-2 text-[12.5px]">
                  <span className="w-[125px] shrink-0 text-[#64748B]">{row.label}</span>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-[700] shrink-0 ${row.bg}`}>{row.person.initials}</span>
                  <span className="font-[500] text-[#0F172A]">{row.person.nome}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna do meio: Situação + Assuntos empilhados */}
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-[700] flex items-center gap-2 text-[#0B1D2D]"><span className="w-5 h-5 rounded-full bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-center text-[11px]">◉</span> Situação atual</h3>
              <button onClick={()=>setShowEditSituacao(true)} className="text-[12px] font-[500] text-[#2563EB]">Editar</button>
            </div>
            <ul className="space-y-2">
              {situacaoItems.map((it, i) => (
                <li key={i} className="flex items-center gap-2.5 text-[12.5px] leading-tight">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${it.dot}`} />
                  <span className="text-[#334155]">{it.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div id="sec-assuntos" className="bg-[#F0FDF4] rounded-xl border border-[#BBF7D0] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-[700] flex items-center gap-2 text-[#065F46]"><span className="w-5 h-5 rounded bg-white border border-[#BBF7D0] flex items-center justify-center">▭</span> Assuntos principais</h3>
              <div className="flex items-center gap-2">
                <button onClick={()=>setShowAddAssunto(true)} className="text-[11px] font-[600] px-2 py-1 rounded-full bg-white border border-[#BBF7D0] text-[#065F46] hover:bg-emerald-50">+ Novo</button>
                <button onClick={() => onGo?.('tarefas')} className="text-[12px] font-[500] text-[#2563EB]">Ver todos ({assuntos.length})</button>
              </div>
            </div>
            <div className="space-y-2">
              {assuntosExibir.length===0 ? <div className="text-[12px] text-[#64748B] border-2 border-dashed rounded-lg p-3 text-center bg-white/60">Sem assuntos</div> : assuntosExibir.map(a => {
                const cls = estadoBadgeCls[a.estado] || estadoBadgeCls.pendente;
                const label = estadoLabel[a.estado] || a.estado;
                return (
                  <div key={a.id} className="bg-white rounded-lg border border-[#E2E8F0] px-3 py-2.5 flex items-start justify-between gap-2 group hover:border-[#10B981]/30">
                    <button onClick={()=>onGo?.('tarefas')} className="min-w-0 text-left flex-1">
                      <div className="text-[12.5px] font-[600] text-[#0F172A] leading-tight flex items-center gap-1.5"><span className="text-[#10B981] text-[10px]">▶</span> <span className="truncate">{a.titulo}</span></div>
                      <div className="text-[11px] text-[#94A3B8] mt-0.5">Atualizado: {new Date(a.updatedAt).toLocaleDateString('pt-PT')}</div>
                    </button>
                    <span className={`shrink-0 text-[11px] font-[600] px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>
                    <button onClick={async()=>{ if(confirm('Remover assunto e tarefa associada?')){ await deleteAssuntoGabinete(a.id); const tsk = tarefas.find(tt=>tt.titulo===a.titulo && tt.clienteId===cliente?.id); if(tsk) await deleteTarefa(tsk.id); } }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-100 rounded"><Trash2 className="w-3 h-3 text-zinc-500" /></button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Coluna direita: Alertas + Próximos prazos */}
        <div className="space-y-3">
          <div className="bg-[#FFF1F2] rounded-xl border border-[#FECACA] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-[700] flex items-center gap-2 text-[#991B1B]"><AlertTriangle className="w-4 h-4 text-[#DC2626]" /> Alertas</h3>
              <button onClick={()=>setShowAddAlerta(true)} className="text-[12px] font-[500] text-[#2563EB]">+ Adicionar</button>
            </div>
            <ul className="space-y-2">
              {alertasExibir.length===0 ? <li className="text-[12px] text-[#94A3B8] border-2 border-dashed border-[#FECACA] rounded-lg p-3 text-center">Sem alertas</li> : alertasExibir.map(a => (
                <li key={a.id} className="flex gap-2 text-[12.5px] leading-[17px] group">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#DC2626] shrink-0" />
                  <span className="flex-1 text-[#7F1D1D]">{a.texto}</span>
                  <button onClick={async()=>{ if(confirm('Remover alerta?')) await deleteAlertaGabinete(a.id); }} className="opacity-0 group-hover:opacity-100 text-[#DC2626] hover:bg-white rounded px-1"><Trash2 className="w-3 h-3" /></button>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[#EFF6FF] rounded-xl border border-[#BFDBFE] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-[700] flex items-center gap-2 text-[#1E40AF]"><Calendar className="w-4 h-4" /> Próximos prazos</h3>
              <button onClick={() => onGo?.('obrigacoes')} className="text-[12px] font-[500] text-[#2563EB]">Ver todos</button>
            </div>
            <ul className="space-y-2">
              {proximosPrazos.map((p, i) => (
                <li key={i} className="flex gap-3 text-[12.5px]">
                  <span className="w-[48px] shrink-0 font-[700] text-[#334155]">{p.label}</span>
                  <span className="flex-1 text-[#475569] truncate">{p.title}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Orientações */}
      <div id="sec-orientacoes" className="bg-[#FFFBEB] rounded-xl border border-[#FDE68A] p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[13px] font-[700] flex items-center gap-2 text-[#92400E]"><Info className="w-4 h-4 text-[#D97706]" /> Orientações à equipa</h3>
          <button onClick={()=>{ setOrientEdit(orientacoes); setShowEditOrient(true); }} className="text-[12px] font-[500] text-[#2563EB]">Editar</button>
        </div>
        <ul className="list-disc pl-5 space-y-1 text-[12.5px] leading-[18px] text-[#78350F]">
          {orientacoes.split('\n').filter(Boolean).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>

      {/* Bottom 3 cols */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div id="sec-docs" className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-[700] flex items-center gap-2 text-[#0B1D2D]"><FileText className="w-4 h-4 text-[#2563EB]" /> Documentos importantes</h3>
            <button onClick={()=>setShowAddDoc(true)} className="text-[11px] font-[600] px-2 py-1 rounded-full bg-white border border-[#E2E8F0] text-[#2563EB] hover:bg-zinc-50">+ Adicionar</button>
          </div>
          <ul className="space-y-1.5">
            {docsExibir.length===0 ? <li className="text-[12px] text-[#94A3B8] border-2 border-dashed rounded-lg p-3 text-center">Sem documentos</li> : docsExibir.map(d => (
              <li key={d.id} className="flex items-center justify-between gap-2 text-[12.5px] group py-1">
                <span className="flex items-center gap-1.5 truncate"><span className="w-3 h-3 rounded-[2px] bg-[#FEE2E2] border border-[#FECACA] flex items-center justify-center text-[7px] text-[#DC2626]">⧉</span> <span className="truncate text-[#334155]">{d.nome}</span></span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-[#94A3B8]">{new Date(d.dataUpload).toLocaleDateString('pt-PT')}</span>
                  <button onClick={async()=>{ if(confirm('Remover documento?')) await deleteDocumentoGeral(d.id); }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-100 rounded"><Trash2 className="w-3 h-3 text-zinc-500" /></button>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div id="sec-contactos" className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-[700] flex items-center gap-2 text-[#0B1D2D]"><Users className="w-4 h-4 text-[#2563EB]" /> Contactos</h3>
            <button onClick={()=>setShowAddContacto(true)} className="text-[11px] font-[600] px-2 py-1 rounded-full bg-white border border-[#E2E8F0] text-[#2563EB] hover:bg-zinc-50">+ Adicionar</button>
          </div>
          <ul className="space-y-3">
            {contactosExibir.length===0 ? <li className="text-[12px] text-[#94A3B8] border-2 border-dashed rounded-lg p-3 text-center">Sem contactos</li> : contactosExibir.map(c => (
              <li key={c.id} className="flex items-start justify-between gap-2 group">
                <div className="flex gap-2.5 min-w-0">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-[700] text-white shrink-0" style={{ background: c.initials === 'MI' ? '#6366F1' : c.initials === 'VP' ? '#7C3AED' : '#334155' }}>{c.initials || initialsOf(c.nome)}</span>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-[700] text-[#0F172A] leading-none truncate">{c.nome}</div>
                    <div className="text-[11px] text-[#64748B]">{c.cargo || '—'}</div>
                    <div className="text-[11px] text-[#64748B]">{c.telefone || ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {c.telefone && <a href={`tel:${c.telefone}`} className="w-6 h-6 rounded-full bg-white border border-[#E2E8F0] flex items-center justify-center text-[#2563EB] hover:bg-zinc-50"><Phone className="w-3 h-3" /></a>}
                  {c.email && <a href={`mailto:${c.email}`} className="w-6 h-6 rounded-full bg-white border border-[#E2E8F0] flex items-center justify-center text-[#64748B] hover:bg-zinc-50"><Mail className="w-3 h-3" /></a>}
                  {!c.email && <span className="w-6 h-6 rounded-full bg-white border border-[#E2E8F0] flex items-center justify-center text-zinc-300"><Mail className="w-3 h-3" /></span>}
                  <span className="w-6 h-6 rounded-full bg-[#DCFCE7] border border-[#BBF7D0] flex items-center justify-center text-[#16A34A]"><MessageCircle className="w-3 h-3" /></span>
                  <button onClick={async()=>{ if(confirm('Remover contacto?')) await deleteContactoGabinete(c.id); }} className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full bg-white border border-[#E2E8F0] flex items-center justify-center text-zinc-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="w-3 h-3" /></button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-[700] flex items-center gap-2 text-[#0B1D2D]"><Lock className="w-4 h-4 text-[#2563EB]" /> Acessos</h3>
            <button onClick={onOpenCofre} className="text-[12px] font-[500] text-[#2563EB] flex items-center gap-1">◎ Abrir cofre</button>
          </div>
          <ul className="space-y-2.5">
            {cofreFallback.map((a, i) => (
              <li key={i} className="flex items-center justify-between text-[12.5px] py-1">
                <span className="flex items-center gap-2"><span className="w-9 text-center text-[10px] font-[700] px-1 py-1 rounded bg-[#F1F5F9] border border-[#E2E8F0] text-[#475569]">{a.label}</span> <span className="text-[#334155]">{a.title}</span></span>
                <button onClick={onOpenCofre} className="text-[11px] font-[500] text-[#2563EB]">ver no cofre</button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Histórico */}
      <div id="sec-historico" className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-[700] flex items-center gap-2 text-[#0B1D2D]"><Clock className="w-4 h-4 text-[#2563EB]" /> Histórico / Últimas ocorrências</h3>
          <div className="flex items-center gap-2"><button onClick={()=>setShowAddOcorr(true)} className="text-[11px] font-[600] px-2 py-1 rounded-full bg-white border border-[#E2E8F0] text-[#2563EB]">+ Ocorrência</button><button className="text-[12px] font-[500] text-[#2563EB]">Ver todo o histórico</button></div>
        </div>
        <div className="relative">
          <div className="absolute left-[42px] top-2 bottom-2 w-px bg-[#E2E8F0] hidden sm:block" />
          <ul className="space-y-2">
            {ocorrExibir.length===0 ? <li className="text-[12px] text-[#94A3B8] p-3 text-center">Sem ocorrências</li> : ocorrExibir.map(o => (
              <li key={o.id} className="flex items-center gap-3 text-[12.5px] group">
                <span className="w-[78px] shrink-0 text-[12px] text-[#64748B]">{new Date(o.data).toLocaleDateString('pt-PT')}</span>
                <span className="relative w-2 h-2 rounded-full bg-[#334155] shrink-0 hidden sm:block" />
                <span className="w-6 h-6 rounded-full bg-[#1E293B] text-white flex items-center justify-center text-[9px] font-[700] shrink-0">{o.autorInitials}</span>
                <span className="w-[105px] shrink-0 text-[12px] font-[600] text-[#334155] truncate">{o.autorNome}</span>
                <span className="flex-1 text-[#475569] truncate">{o.descricao}</span>
                <button onClick={async()=>{ if(confirm('Remover ocorrência?')) await deleteOcorrencia(o.id); }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-100 rounded"><Trash2 className="w-3 h-3 text-zinc-500" /></button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {/* ——— Modais funcionais ——— */}
      {showEditCliente && cliente && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setShowEditCliente(false)}>
          <div className="w-full max-w-[560px] bg-white rounded-2xl p-6 border shadow-xl space-y-3" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-semibold">Editar cliente</h3><button onClick={()=>setShowEditCliente(false)} className="p-1 hover:bg-zinc-100 rounded"><X className="w-4 h-4" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <input value={formCliente.nome||''} onChange={e=>setFormCliente({...formCliente, nome:e.target.value})} placeholder="Nome" className="col-span-2 px-3 py-2 rounded-xl border text-sm" />
              <input value={formCliente.nif||''} onChange={e=>setFormCliente({...formCliente, nif:e.target.value.replace(/\D/g,'')})} placeholder="NIF" className="px-3 py-2 rounded-xl border text-sm" />
              <input value={formCliente.caes||''} onChange={e=>setFormCliente({...formCliente, caes:e.target.value})} placeholder="CAE" className="px-3 py-2 rounded-xl border text-sm" />
              <input value={formCliente.caeDescricao||''} onChange={e=>setFormCliente({...formCliente, caeDescricao:e.target.value})} placeholder="CAE descricao" className="col-span-2 px-3 py-2 rounded-xl border text-sm" />
              <input value={Array.isArray(formCliente.gerentes) ? formCliente.gerentes.join(', ') : (formCliente.gerentes as unknown as string) || ''} onChange={e=>setFormCliente({...formCliente, gerentes: e.target.value.split(',').map(s=>s.trim()).filter(Boolean) as unknown as string[]})} placeholder="Gerentes (virgula)" className="col-span-2 px-3 py-2 rounded-xl border text-sm" />
              <input type="number" value={formCliente.nrTrabalhadores ?? ''} onChange={e=>setFormCliente({...formCliente, nrTrabalhadores: e.target.value? Number(e.target.value): undefined})} placeholder="N trabalhadores" className="px-3 py-2 rounded-xl border text-sm" />
              <input type="date" value={formCliente.inicioAtividade ? new Date(formCliente.inicioAtividade).toISOString().slice(0,10) : ''} onChange={e=>setFormCliente({...formCliente, inicioAtividade: e.target.value? new Date(e.target.value).getTime(): undefined})} className="px-3 py-2 rounded-xl border text-sm" />
              <select value={formCliente.responsavelId||''} onChange={e=>{ const col=(colaboradores||[]).find(c=>c.id===e.target.value); setFormCliente({...formCliente, responsavelId: e.target.value||undefined, responsavelInterno: col? {nome:col.nome, initials:col.initials||col.nome.slice(0,2).toUpperCase()}: undefined}); }} className="col-span-2 px-3 py-2 rounded-xl border bg-white text-sm"><option value="">Responsável interno — nenhum</option>{(colaboradores||[]).map(c=><option key={c.id} value={c.id}>{c.nome} ({c.role})</option>)}</select>
              <select value={formCliente.apoioId||''} onChange={e=>{ const col=(colaboradores||[]).find(c=>c.id===e.target.value); setFormCliente({...formCliente, apoioId: e.target.value||undefined, apoioAdministrativo: col? {nome:col.nome, initials:col.initials||col.nome.slice(0,2).toUpperCase()}: undefined}); }} className="col-span-2 px-3 py-2 rounded-xl border bg-white text-sm"><option value="">Apoio administrativo — nenhum</option>{(colaboradores||[]).map(c=><option key={c.id} value={c.id}>{c.nome} ({c.role})</option>)}</select>
              <select value={formCliente.supervisorId||''} onChange={e=>{ const col=(colaboradores||[]).find(c=>c.id===e.target.value); setFormCliente({...formCliente, supervisorId: e.target.value||undefined, supervisor: col? {nome:col.nome, initials:col.initials||col.nome.slice(0,2).toUpperCase()}: undefined}); }} className="col-span-2 px-3 py-2 rounded-xl border bg-white text-sm"><option value="">Supervisor — nenhum</option>{(colaboradores||[]).map(c=><option key={c.id} value={c.id}>{c.nome} ({c.role})</option>)}</select>
            </div>
            <div className="flex justify-end gap-2"><button onClick={()=>setShowEditCliente(false)} className="px-4 py-2 rounded-xl border text-sm">Cancelar</button><button onClick={handleSaveCliente} className="px-4 py-2 rounded-xl bg-[#0F172A] text-white text-sm">Guardar</button></div>
          </div>
        </div>
      )}
      {showAddAlerta && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={()=>setShowAddAlerta(false)}>
          <div className="w-full max-w-[480px] bg-white rounded-2xl p-6 border shadow-xl space-y-3" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-semibold">Novo alerta</h3><button onClick={()=>setShowAddAlerta(false)} className="p-1 hover:bg-zinc-100 rounded"><X className="w-4 h-4" /></button></div>
            <textarea value={alertaTexto} onChange={e=>setAlertaTexto(e.target.value)} placeholder="Texto do alerta..." rows={3} className="w-full px-3 py-2 rounded-xl border text-sm" />
            <div className="flex justify-end gap-2"><button onClick={()=>setShowAddAlerta(false)} className="px-4 py-2 rounded-xl border text-sm">Cancelar</button><button onClick={handleAddAlerta} className="px-4 py-2 rounded-xl bg-[#0F172A] text-white text-sm">Adicionar</button></div>
          </div>
        </div>
      )}
      {showAddAssunto && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={()=>setShowAddAssunto(false)}>
          <div className="w-full max-w-[480px] bg-white rounded-2xl p-6 border shadow-xl space-y-3" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-semibold">Novo assunto</h3><button onClick={()=>setShowAddAssunto(false)} className="p-1 hover:bg-zinc-100 rounded"><X className="w-4 h-4" /></button></div>
            <input value={assuntoTitulo} onChange={e=>setAssuntoTitulo(e.target.value)} placeholder="Titulo do assunto" className="w-full px-3 py-2 rounded-xl border text-sm" />
            <select value={assuntoEstado} onChange={e=>setAssuntoEstado(e.target.value as AssuntoGabinete['estado'])} className="w-full px-3 py-2 rounded-xl border bg-white text-sm"><option value="em_curso">Em curso</option><option value="aguard_cliente">Aguard. cliente</option><option value="pendente">Pendente</option><option value="concluido">Concluido</option></select>
            <div className="flex justify-end gap-2"><button onClick={()=>setShowAddAssunto(false)} className="px-4 py-2 rounded-xl border text-sm">Cancelar</button><button onClick={handleAddAssunto} className="px-4 py-2 rounded-xl bg-[#0F172A] text-white text-sm">Criar (vai para Tarefas)</button></div>
          </div>
        </div>
      )}
      {showAddContacto && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={()=>setShowAddContacto(false)}>
          <div className="w-full max-w-[480px] bg-white rounded-2xl p-6 border shadow-xl space-y-3" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-semibold">Novo contacto</h3><button onClick={()=>setShowAddContacto(false)} className="p-1 hover:bg-zinc-100 rounded"><X className="w-4 h-4" /></button></div>
            <input value={contactoForm.nome||''} onChange={e=>setContactoForm({...contactoForm, nome:e.target.value})} placeholder="Nome" className="w-full px-3 py-2 rounded-xl border text-sm" />
            <div className="grid grid-cols-2 gap-3"><input value={contactoForm.cargo||''} onChange={e=>setContactoForm({...contactoForm, cargo:e.target.value})} placeholder="Cargo" className="px-3 py-2 rounded-xl border text-sm" /><input value={contactoForm.telefone||''} onChange={e=>setContactoForm({...contactoForm, telefone:e.target.value})} placeholder="Telefone" className="px-3 py-2 rounded-xl border text-sm" /></div>
            <input value={contactoForm.email||''} onChange={e=>setContactoForm({...contactoForm, email:e.target.value})} placeholder="Email" className="w-full px-3 py-2 rounded-xl border text-sm" />
            <div className="flex justify-end gap-2"><button onClick={()=>setShowAddContacto(false)} className="px-4 py-2 rounded-xl border text-sm">Cancelar</button><button onClick={handleAddContacto} className="px-4 py-2 rounded-xl bg-[#0F172A] text-white text-sm">Adicionar</button></div>
          </div>
        </div>
      )}
      {showAddDoc && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={()=>setShowAddDoc(false)}>
          <div className="w-full max-w-[480px] bg-white rounded-2xl p-6 border shadow-xl space-y-3" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-semibold">Novo documento</h3><button onClick={()=>setShowAddDoc(false)} className="p-1 hover:bg-zinc-100 rounded"><X className="w-4 h-4" /></button></div>
            <input value={docNome} onChange={e=>setDocNome(e.target.value)} placeholder="Nome do ficheiro (ex: Contrato.pdf)" className="w-full px-3 py-2 rounded-xl border text-sm" />
            <div className="flex justify-end gap-2"><button onClick={()=>setShowAddDoc(false)} className="px-4 py-2 rounded-xl border text-sm">Cancelar</button><button onClick={handleAddDoc} className="px-4 py-2 rounded-xl bg-[#0F172A] text-white text-sm">Adicionar</button></div>
          </div>
        </div>
      )}
      {showAddOcorr && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={()=>setShowAddOcorr(false)}>
          <div className="w-full max-w-[480px] bg-white rounded-2xl p-6 border shadow-xl space-y-3" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-semibold">Nova ocorrencia</h3><button onClick={()=>setShowAddOcorr(false)} className="p-1 hover:bg-zinc-100 rounded"><X className="w-4 h-4" /></button></div>
            <textarea value={ocorrDesc} onChange={e=>setOcorrDesc(e.target.value)} placeholder="Descricao..." rows={3} className="w-full px-3 py-2 rounded-xl border text-sm" />
            <div className="flex justify-end gap-2"><button onClick={()=>setShowAddOcorr(false)} className="px-4 py-2 rounded-xl border text-sm">Cancelar</button><button onClick={handleAddOcorr} className="px-4 py-2 rounded-xl bg-[#0F172A] text-white text-sm">Adicionar</button></div>
          </div>
        </div>
      )}
      {showEditSituacao && cliente && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={()=>setShowEditSituacao(false)}>
          <div className="w-full max-w-[520px] bg-white rounded-2xl p-6 border shadow-xl space-y-3" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-semibold">Editar situacao</h3><button onClick={()=>setShowEditSituacao(false)} className="p-1 hover:bg-zinc-100 rounded"><X className="w-4 h-4" /></button></div>
            <div className="space-y-2">
              {(cliente.situacaoAtual||[]).map((s, i)=>(
                <div key={i} className="flex gap-2">
                  <select value={s.cor} onChange={e=>{ const arr=[...(cliente.situacaoAtual||[])]; arr[i]={...arr[i], cor:e.target.value as 'red'|'green'|'orange'}; upsertCliente({...cliente, situacaoAtual:arr, updatedAt: Date.now()}); }} className="px-2 py-2 rounded-lg border text-xs"><option value="green">Verde</option><option value="orange">Laranja</option><option value="red">Vermelho</option></select>
                  <input value={s.texto} onChange={e=>{ const arr=[...(cliente.situacaoAtual||[])]; arr[i]={...arr[i], texto:e.target.value}; upsertCliente({...cliente, situacaoAtual:arr, updatedAt: Date.now()}); }} className="flex-1 px-3 py-2 rounded-xl border text-sm" />
                  <button onClick={async()=>{ const arr=[...(cliente.situacaoAtual||[])]; arr.splice(i,1); await upsertCliente({...cliente, situacaoAtual:arr, updatedAt: Date.now()}); }} className="p-2 hover:bg-rose-50 rounded text-rose-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={async()=>{ const arr=[...(cliente.situacaoAtual||[]), {texto:'Novo item', cor:'green' as const}]; await upsertCliente({...cliente, situacaoAtual:arr, updatedAt: Date.now()}); }} className="text-sm text-[#2563EB] flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar linha</button>
            </div>
            <div className="flex justify-end"><button onClick={()=>setShowEditSituacao(false)} className="px-4 py-2 rounded-xl bg-[#0F172A] text-white text-sm">Fechar</button></div>
          </div>
        </div>
      )}
      {showEditOrient && cliente && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={()=>setShowEditOrient(false)}>
          <div className="w-full max-w-[520px] bg-white rounded-2xl p-6 border shadow-xl space-y-3" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-semibold">Orientacoes a equipa</h3><button onClick={()=>setShowEditOrient(false)} className="p-1 hover:bg-zinc-100 rounded"><X className="w-4 h-4" /></button></div>
            <textarea value={orientEdit} onChange={e=>setOrientEdit(e.target.value)} rows={6} className="w-full px-3 py-2 rounded-xl border text-sm" />
            <div className="flex justify-end gap-2"><button onClick={()=>setShowEditOrient(false)} className="px-4 py-2 rounded-xl border text-sm">Cancelar</button><button onClick={async()=>{ await upsertCliente({...cliente, orientacoes: orientEdit, updatedAt: Date.now()}); setShowEditOrient(false); }} className="px-4 py-2 rounded-xl bg-[#0F172A] text-white text-sm">Guardar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
