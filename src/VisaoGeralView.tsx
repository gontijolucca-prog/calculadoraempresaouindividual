import React, { useMemo, useState } from 'react';
import {
  Building2, AlertTriangle, Calendar, FileText, Users, Lock, Phone, Mail, MessageCircle, Clock, Plus, Trash2, X, CheckSquare
} from 'lucide-react';
import {
  upsertCliente,
  getCatalogo, addCatalogoDef, gerarObrigacoesParaCliente, getObrigacoesAtivas, setObrigacoesAtivas,
  upsertContactoGabinete, deleteContactoGabinete, newContactoGabineteId,
  upsertAlertaGabinete, deleteAlertaGabinete, newAlertaGabineteId,
  upsertOcorrencia, deleteOcorrencia, newOcorrenciaId,
  upsertDocumentoGeral, deleteDocumentoGeral, newDocumentoGeralId,
  upsertTarefa, deleteTarefa, marcarTarefaFeita, newTarefaId,
  upsertObrigacao,
} from './lib/gabinete';
import { mergePrazos } from './lib/gabineteSelectors';
import { toast } from './lib/toast';
import { RelatorioPdf } from './lib/reportPdf';
import { loadOfficeSettings } from './lib/officeSettings';
import { can } from './lib/permissions';
import type { GabineteRole } from './lib/gabinetes';
import type { GabineteCliente, Tarefa, Obrigacao, ObrigacaoDef, CofreEntrada, GabineteDocumento, ContactoGabinete, AlertaGabinete, OcorrenciaGabinete, Colaborador } from './lib/gabinete';

type Props = {
  cliente: GabineteCliente | null;
  contactos: ContactoGabinete[];
  alertas: AlertaGabinete[];
  ocorrencias: OcorrenciaGabinete[];
  tarefas: Tarefa[];
  obrigacoes: Obrigacao[];
  cofre: CofreEntrada[];
  documentos: GabineteDocumento[];
  colaboradores?: Colaborador[];
  role?: GabineteRole | null;
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

function fmtData(ms?: number): string {
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('pt-PT');
}

const tarefaBadgeCls: Record<string, string> = {
  todo: 'bg-[#FFF7ED] text-amber-700 border-amber-200',
  doing: 'bg-blue-50 text-blue-700 border-blue-200',
  atrasada: 'bg-[#FFF1F2] text-rose-700 border-rose-200',
  done: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
const tarefaLabel: Record<string, string> = {
  todo: 'Por fazer',
  doing: 'Em curso',
  atrasada: 'Atrasada',
  done: 'Concluída',
};

export default function VisaoGeralView({ cliente, contactos, alertas, ocorrencias, tarefas, obrigacoes, cofre, documentos, colaboradores, role, onGo, onOpenCofre }: Props) {
  const canDelete = can(role, 'apagar');
  const canEditFicha = can(role, 'editar-clientes');
  const canGerirObrigacoes = can(role, 'gerir-obrigacoes');
  const canVerCofre = can(role, 'ver-cofre');

  const displayNome = cliente?.nome || '—';
  const displayNif = cliente?.nif || '—';
  const caeLabel = cliente?.caes || '—';
  const caeDesc = cliente?.caeDescricao || '—';
  const tipoSoc = cliente?.tipoSociedade || cliente?.tipoEntidade || '—';
  const regimeIvaLabel = cliente?.regimeIva === 'mensal' ? 'Mensal' : cliente?.regimeIva === 'isencao53' ? 'Isenção Art. 53' : cliente?.regimeIva === 'trimestral' ? 'Trimestral' : '—';
  const regimeIrcLabel = cliente?.regimeIrc === 'simplificado' ? 'Simplificado' : cliente?.regimeIrc === 'transparencia' ? 'Transparência' : cliente?.regimeIrc === 'geral' ? 'Regime Geral' : '—';
  const nrTrab = cliente?.nrTrabalhadores != null ? String(cliente.nrTrabalhadores) : '—';
  const inicioAtiv = cliente?.inicioAtividade ? new Date(cliente.inicioAtividade).toLocaleDateString('pt-PT') : '—';
  const gerentes = (cliente?.gerentes || []).join(', ') || '—';
  const responsavel = cliente?.responsavelInterno || null;
  const apoio = cliente?.apoioAdministrativo || null;
  const supervisor = cliente?.supervisor || null;
  const orientacoes = (cliente?.orientacoes || '').trim();

  const situacaoItems = useMemo(() => {
    const dotMap: Record<string, string> = { red: 'bg-[#EF4444]', green: 'bg-[#10B981]', orange: 'bg-[#F59E0B]' };
    return (cliente?.situacaoAtual || []).map(s => ({ dot: dotMap[s.cor] || 'bg-zinc-400', text: s.texto }));
  }, [cliente?.situacaoAtual]);

  const prazos = useMemo(
    () => mergePrazos(obrigacoes, alertas, { limit: 5 }),
    [obrigacoes, alertas],
  );

  const tarefasCliente = useMemo(
    () => tarefas.filter(t => t.clienteId === cliente?.id && !t.arquivada).slice(0, 3),
    [tarefas, cliente?.id],
  );
  const tarefasClienteTotal = useMemo(
    () => tarefas.filter(t => t.clienteId === cliente?.id && !t.arquivada).length,
    [tarefas, cliente?.id],
  );

  const alertasAbertos = useMemo(
    () => alertas.filter(a => (a.estado ?? 'aberto') === 'aberto'),
    [alertas],
  );
  const alertasExibir: AlertaGabinete[] = alertasAbertos.slice(0, 5);
  const contactosExibir: ContactoGabinete[] = contactos.slice(0, 5);
  const docsExibir: GabineteDocumento[] = documentos.slice(0, 5);
  const ocorrExibir: OcorrenciaGabinete[] = ocorrencias.slice(0, 7);
  const cofreItems = useMemo(
    () => cofre.filter(c => !cliente || c.clienteId === cliente.id).slice(0, 4),
    [cofre, cliente],
  );

  const avatarInitials = displayNome === '—' ? '—' : initialsOf(displayNome).slice(0, 2);

  // ——— Modais funcionais ———
  const [catalogoObr, setCatalogoObr] = useState<ObrigacaoDef[]>(() => getCatalogo());
  React.useEffect(() => {
    const h = () => setCatalogoObr(getCatalogo());
    window.addEventListener('estudo360:catalogo-updated', h);
    return () => window.removeEventListener('estudo360:catalogo-updated', h);
  }, []);
  // Backfill: gera as obrigações/prazos em falta deste cliente ao abrir a ficha.
  React.useEffect(() => {
    if (!cliente || !canGerirObrigacoes) return;
    try { gerarObrigacoesParaCliente(cliente); } catch {}
  }, [cliente?.id, canGerirObrigacoes]);
  const [showEditCliente, setShowEditCliente] = useState(false);
  const [formCliente, setFormCliente] = useState<Partial<GabineteCliente>>({});
  const [showAddAlerta, setShowAddAlerta] = useState(false);
  const [alertaTexto, setAlertaTexto] = useState('');
  const [alertaVenc, setAlertaVenc] = useState('');
  const [showAddTarefa, setShowAddTarefa] = useState(false);
  const [tarefaTitulo, setTarefaTitulo] = useState('');
  const [tarefaEstado, setTarefaEstado] = useState<Tarefa['estado']>('todo');
  const [tarefaPrazo, setTarefaPrazo] = useState('');
  const [showAddContacto, setShowAddContacto] = useState(false);
  const [contactoForm, setContactoForm] = useState<Partial<ContactoGabinete>>({});
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [docNome, setDocNome] = useState('');
  const [showAddOcorr, setShowAddOcorr] = useState(false);
  const [ocorrDesc, setOcorrDesc] = useState('');
  const [showEditSituacao, setShowEditSituacao] = useState(false);
  const [situacaoEdit, setSituacaoEdit] = useState<Array<{ texto: string; cor: 'red' | 'green' | 'orange' }>>([]);
  const [showEditOrient, setShowEditOrient] = useState(false);
  const [orientEdit, setOrientEdit] = useState(orientacoes);

  const handleExportFichaPdf = () => {
    if (!cliente) return;
    const office = loadOfficeSettings();
    const fmt = (ms?: number) => (ms ? new Intl.DateTimeFormat('pt-PT').format(new Date(ms)) : '—');
    const pdf = new RelatorioPdf({
      titulo: 'Ficha do cliente',
      subtitulo: 'Visão 360 · resumo operacional do gabinete',
      cliente: cliente.nome,
      nif: cliente.nif,
      escritorio: { nome: office.nome, corPrimaria: office.corPrimaria, logoDataUrl: office.logoDataUrl },
      nomeFicheiro: `Ficha-${cliente.nome}`,
    });
    pdf.seccao('Identificação').tabela([
      { label: 'Nome', valor: cliente.nome },
      { label: 'NIF', valor: cliente.nif || '—' },
      { label: 'CAE', valor: cliente.caes ? `${cliente.caes}${cliente.caeDescricao ? ` – ${cliente.caeDescricao}` : ''}` : '—' },
      { label: 'Regime de IVA', valor: cliente.regimeIva || '—' },
      { label: 'IRC', valor: cliente.regimeIrc || '—' },
      { label: 'Tipo de sociedade', valor: cliente.tipoSociedade || '—' },
      { label: 'Início de atividade', valor: fmt(cliente.inicioAtividade) },
      { label: 'N.º trabalhadores', valor: cliente.nrTrabalhadores != null ? String(cliente.nrTrabalhadores) : '—' },
      { label: 'Gerentes', valor: Array.isArray(cliente.gerentes) ? cliente.gerentes.join(', ') : '—' },
      { label: 'Responsável interno', valor: cliente.responsavelInterno?.nome || '—' },
      { label: 'Supervisor', valor: cliente.supervisor?.nome || '—' },
      { label: 'Apoio administrativo', valor: cliente.apoioAdministrativo?.nome || '—' },
    ]);
    const obrs = obrigacoes.filter(o => o.clienteId === cliente.id && !o.deletedAt).sort((a, b) => a.vencimento - b.vencimento);
    pdf.seccao('Obrigações').tabela(obrs.slice(0, 40).map(o => ({
      label: `${fmt(o.vencimento)} · ${o.titulo}`,
      valor: o.estado === 'entregue' ? 'Entregue' : o.estado === 'atrasada' ? 'Atrasada' : o.estado === 'dispensada' ? 'Dispensada' : 'Pendente',
    })));
    const al = alertas.filter(a => a.clienteId === cliente.id && (a.estado ?? 'aberto') === 'aberto');
    pdf.seccao('Alertas abertos').tabela(al.map(a => ({ label: a.texto, valor: a.vencimento ? fmt(a.vencimento) : 'sem prazo' })));
    pdf.seccao('Contactos').tabela(contactos.filter(c => c.clienteId === cliente.id).map(c => ({
      label: `${c.nome}${c.cargo ? ` · ${c.cargo}` : ''}`,
      valor: [c.telefone, c.email].filter(Boolean).join(' · ') || '—',
    })));
    const tf = tarefas.filter(t => t.clienteId === cliente.id && t.estado !== 'done');
    pdf.seccao('Tarefas em aberto').tabela(tf.map(t => ({ label: t.titulo, valor: t.dataVencimento ? fmt(t.dataVencimento) : t.estado })));
    if (cliente.situacaoAtual?.length) {
      pdf.seccao('Situação atual').tabela(cliente.situacaoAtual.map(s => ({ label: s.texto, valor: '' })));
    }
    if (cliente.orientacoes?.trim()) pdf.seccao('Orientações à equipa').paragrafo(cliente.orientacoes);
    pdf.nota('Documento interno do gabinete. Dados pessoais e fiscais — trate conforme o RGPD.');
    pdf.save();
  };

  const handleEditClienteOpen = () => {
    if (!cliente) return;
    setFormCliente({ nome: cliente.nome, nif: cliente.nif, caes: cliente.caes, caeDescricao: cliente.caeDescricao, tipoSociedade: cliente.tipoSociedade, gerentes: cliente.gerentes, nrTrabalhadores: cliente.nrTrabalhadores, inicioAtividade: cliente.inicioAtividade, responsavelId: cliente.responsavelId, responsavelInterno: cliente.responsavelInterno, apoioId: cliente.apoioId, apoioAdministrativo: cliente.apoioAdministrativo, supervisorId: cliente.supervisorId, supervisor: cliente.supervisor, obrigacoesAtivas: getObrigacoesAtivas(cliente) });
    setShowEditCliente(true);
  };
  const handleSaveCliente = async () => {
    if (!cliente) return;
    const upd: GabineteCliente = { ...cliente, ...formCliente, gerentes: typeof formCliente.gerentes === 'string' ? (formCliente.gerentes as unknown as string).split(',').map(s=>s.trim()).filter(Boolean) : formCliente.gerentes, updatedAt: Date.now() };
    await upsertCliente(upd);
    try { gerarObrigacoesParaCliente(upd); } catch {}
    toast(`✓ ${upd.nome}: ficha gravada`);
    await upsertOcorrencia({ id: newOcorrenciaId(), clienteId: cliente.id, clienteNome: upd.nome, data: Date.now(), autorNome: upd.responsavelInterno?.nome || 'Equipa', autorInitials: upd.responsavelInterno?.initials || 'EQ', descricao: 'Ficha atualizada', createdAt: Date.now() });
    setShowEditCliente(false);
  };
  const handleAddAlerta = async () => {
    if (!cliente || !alertaTexto.trim()) return;
    await upsertAlertaGabinete({
      id: newAlertaGabineteId(), clienteId: cliente.id, clienteNome: cliente.nome,
      texto: alertaTexto.trim(),
      vencimento: alertaVenc ? new Date(`${alertaVenc}T12:00:00`).getTime() : undefined,
      estado: 'aberto',
      createdAt: Date.now(), updatedAt: Date.now(),
    });
    setAlertaTexto(''); setAlertaVenc(''); setShowAddAlerta(false);
    toast('✓ Alerta gravado');
  };
  const handleAddTarefa = async () => {
    if (!cliente || !tarefaTitulo.trim()) return;
    const now = Date.now();
    await upsertTarefa({
      id: newTarefaId(), titulo: tarefaTitulo.trim(), tipo: 'tarefa', origem: 'manual',
      estado: tarefaEstado, prioridade: 'media', clienteId: cliente.id, clienteNome: cliente.nome,
      dataVencimento: tarefaPrazo ? new Date(`${tarefaPrazo}T12:00:00`).getTime() : undefined,
      createdAt: now, updatedAt: now,
    });
    setTarefaTitulo(''); setTarefaEstado('todo'); setTarefaPrazo(''); setShowAddTarefa(false);
    toast('✓ Tarefa gravada');
  };
  const handleAddContacto = async () => {
    if (!cliente || !contactoForm.nome?.trim()) return;
    await upsertContactoGabinete({ id: newContactoGabineteId(), clienteId: cliente.id, clienteNome: cliente.nome, nome: contactoForm.nome!.trim(), cargo: contactoForm.cargo?.trim(), telefone: contactoForm.telefone?.trim(), email: contactoForm.email?.trim(), initials: initialsOf(contactoForm.nome!.trim()), createdAt: Date.now(), updatedAt: Date.now() });
    setContactoForm({}); setShowAddContacto(false);
    toast('✓ Contacto gravado');
  };
  const handleAddDoc = async () => {
    if (!cliente || !docNome.trim()) return;
    await upsertDocumentoGeral({ id: newDocumentoGeralId(), clienteId: cliente.id, clienteNome: cliente.nome, nome: docNome.trim().endsWith('.pdf') ? docNome.trim() : docNome.trim()+'.pdf', tipo: 'OUTRO', dataUpload: Date.now() });
    setDocNome(''); setShowAddDoc(false);
    toast('✓ Documento gravado');
  };
  const handleAddOcorr = async () => {
    if (!cliente || !ocorrDesc.trim()) return;
    await upsertOcorrencia({ id: newOcorrenciaId(), clienteId: cliente.id, clienteNome: cliente.nome, data: Date.now(), autorNome: cliente.responsavelInterno?.nome || 'Equipa', autorInitials: cliente.responsavelInterno?.initials || 'EQ', descricao: ocorrDesc.trim(), createdAt: Date.now() });
    setOcorrDesc(''); setShowAddOcorr(false);
    toast('✓ Ocorrência gravada');
  };
  const resolverObrigacao = async (id: string, estado: 'entregue' | 'dispensada') => {
    const o = obrigacoes.find(x => x.id === id);
    if (o) {
      await upsertObrigacao({ ...o, estado });
      toast(`✓ ${estado === 'entregue' ? 'Marcada como entregue' : 'Dispensada'}: ${o.titulo}`);
    }
  };
  const resolverAlerta = async (id: string) => {
    const a = alertas.find(x => x.id === id);
    if (a) {
      await upsertAlertaGabinete({ ...a, estado: 'resolvido', resolvidoEm: Date.now() });
      toast('✓ Alerta resolvido');
    }
  };

  const tabs = [
    { id: 'visao', label: 'Visão geral', active: true as const, scroll: 'top' },
    { id: 'tarefas', label: `Tarefas (${tarefasClienteTotal})`, go: 'tarefas' },
    { id: 'docs', label: 'Documentos', scroll: 'sec-docs' },
    { id: 'contatos', label: 'Contactos', scroll: 'sec-contactos' },
    ...(canVerCofre ? [{ id: 'acessos', label: 'Acessos', go: 'cofre' }] : []),
    { id: 'obrig', label: 'Obrigações', go: 'obrigacoes' },
    { id: 'hist', label: 'Histórico', scroll: 'sec-historico' },
    { id: 'equipa', label: 'Equipa', go: 'equipa' },
    { id: 'notas', label: 'Notas', scroll: 'sec-orientacoes' },
  ] as Array<{ id: string; label: string; active?: boolean; go?: string; scroll?: string }>;

  return (
    <div className="space-y-3">
      {/* Header empresa */}
      <div id="top" className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3.5 min-w-0">
            <div className="w-[52px] h-[52px] rounded-xl bg-[#DDE6F3] text-[#5B6B8A] flex items-center justify-center text-[15px] font-[800] tracking-[0.5px] shrink-0">{avatarInitials}</div>
            <div className="min-w-0">
              <h1 className="text-[19px] font-[800] leading-none tracking-[-0.3px] text-[#0B1D2D]">{displayNome}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-[#64748B]">
                <span>NIF <span className="font-[600] text-[#334155]">{displayNif}</span></span>
                <span className="text-[#CBD5E1]">|</span>
                <span>CAE <span className="font-[600] text-[#334155]">{caeLabel}{caeDesc !== '—' ? ` – ${caeDesc}` : ''}</span></span>
                <span className="text-[#CBD5E1]">|</span>
                <span>{tipoSoc}</span>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {cliente?.estado !== 'arquivado' && <span className="inline-flex items-center gap-1 rounded-full bg-[#DCFCE7] border border-[#86EFAC] px-2.5 py-1 text-[11px] font-[700] text-[#166534]"><span className="w-3.5 h-3.5 rounded-full bg-[#16A34A] text-white flex items-center justify-center text-[9px]">✓</span> {cliente ? 'Ativo' : 'Sem cliente'}</span>}
                <span className="rounded-full bg-white border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-[500] text-[#475569]">IVA {regimeIvaLabel}</span>
                <span className="rounded-full bg-white border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-[500] text-[#475569]">IRC ({regimeIrcLabel})</span>
              </div>
            </div>
          </div>
          {canEditFicha && (
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <button onClick={handleExportFichaPdf} className="px-3.5 py-1.5 rounded-lg border border-[#0F172A] bg-white text-[#0F172A] text-[13px] font-[600] flex items-center gap-1.5">⤓ PDF</button>
              <button onClick={handleEditClienteOpen} className="px-3.5 py-1.5 rounded-lg bg-[#0F172A] text-white text-[13px] font-[600] flex items-center gap-1.5">✎ Editar</button>
            </div>
          )}
        </div>

        {/* Tabs secundárias */}
        <div className="mt-4 -mb-4 border-t border-[#F1F5F9] -mx-4 px-4">
          <div className="flex gap-5 overflow-x-auto scrollbar-none text-[13px]">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => t.go ? onGo?.(t.go) : t.scroll ? document.getElementById(t.scroll)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : undefined}
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
            {canEditFicha && <button onClick={handleEditClienteOpen} className="text-[12px] font-[500] text-[#2563EB]">Editar</button>}
          </div>
          <div className="space-y-2">
            {[
              ['Nome', displayNome],
              ['NIF', displayNif],
              ['CAE principal', caeDesc !== '—' ? `${caeLabel} – ${caeDesc}` : caeLabel],
              ['Regime IVA', regimeIvaLabel],
              ['IRC', regimeIrcLabel],
              ['Gerentes', gerentes],
              ['N.º trabalhadores', nrTrab],
              ['Início de atividade', inicioAtiv],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2 text-[12.5px] leading-[18px]">
                <span className="w-[125px] shrink-0 text-[#64748B]">{k}</span>
                <span className="flex-1 font-[500] text-[#0F172A] truncate">{v}</span>
              </div>
            ))}
            <div className="pt-3 mt-3 border-t border-[#F1F5F9] space-y-2.5">
              {responsavel ? (
                <div className="flex items-center gap-2 text-[12.5px]">
                  <span className="w-[125px] shrink-0 text-[#64748B]">Responsável interno</span>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-[700] shrink-0 bg-[#E0E7FF] text-[#4338CA]">{responsavel.initials}</span>
                  <span className="font-[500] text-[#0F172A]">{responsavel.nome}</span>
                </div>
              ) : null}
              {apoio ? (
                <div className="flex items-center gap-2 text-[12.5px]">
                  <span className="w-[125px] shrink-0 text-[#64748B]">Apoio administrativo</span>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-[700] shrink-0 bg-[#F3E8FF] text-[#7C3AED]">{apoio.initials}</span>
                  <span className="font-[500] text-[#0F172A]">{apoio.nome}</span>
                </div>
              ) : null}
              {supervisor ? (
                <div className="flex items-center gap-2 text-[12.5px]">
                  <span className="w-[125px] shrink-0 text-[#64748B]">Supervisor</span>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-[700] shrink-0 bg-[#1E293B] text-white">{supervisor.initials}</span>
                  <span className="font-[500] text-[#0F172A]">{supervisor.nome}</span>
                </div>
              ) : null}
              {!responsavel && !apoio && !supervisor && (
                <div className="text-[12px] text-[#94A3B8]">{canEditFicha ? 'Sem equipa atribuída — edita a ficha para associar.' : 'Sem equipa atribuída.'}</div>
              )}
            </div>
          </div>
        </div>

        {/* Coluna do meio: Obrigações + Situação + Tarefas */}
        <div className="space-y-3">
          {cliente && <ObrigacoesCard cliente={cliente} catalogo={catalogoObr} readOnly={!canEditFicha} />}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-[700] flex items-center gap-2 text-[#0B1D2D]"><span className="w-5 h-5 rounded-full bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-center text-[11px]">◉</span> Situação atual</h3>
              {canEditFicha && (
                <button onClick={() => { setSituacaoEdit([...(cliente?.situacaoAtual || [])]); setShowEditSituacao(true); }} className="text-[12px] font-[500] text-[#2563EB]">Editar</button>
              )}
            </div>
            {situacaoItems.length === 0 ? (
              <div className="text-[12px] text-[#94A3B8] border-2 border-dashed rounded-lg p-3 text-center">Sem situação registada{canEditFicha ? ' — usa Editar para adicionar.' : '.'}</div>
            ) : (
              <ul className="space-y-2">
                {situacaoItems.map((it, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-[12.5px] leading-tight">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${it.dot}`} />
                    <span className="text-[#334155]">{it.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div id="sec-tarefas" className="bg-[#F0FDF4] rounded-xl border border-[#BBF7D0] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-[700] flex items-center gap-2 text-[#065F46]"><CheckSquare className="w-4 h-4" /> Tarefas principais</h3>
              <div className="flex items-center gap-2">
                <button onClick={()=>setShowAddTarefa(true)} className="text-[11px] font-[600] px-2 py-1 rounded-full bg-white border border-[#BBF7D0] text-[#065F46] hover:bg-emerald-50">+ Nova</button>
                <button onClick={() => onGo?.('tarefas')} className="text-[12px] font-[500] text-[#2563EB]">Ver todas ({tarefasClienteTotal})</button>
              </div>
            </div>
            <div className="space-y-2">
              {tarefasCliente.length===0 ? <div className="text-[12px] text-[#64748B] border-2 border-dashed rounded-lg p-3 text-center bg-white/60">Sem tarefas deste cliente</div> : tarefasCliente.map(t => {
                const cls = tarefaBadgeCls[t.estado] || tarefaBadgeCls.todo;
                const label = tarefaLabel[t.estado] || t.estado;
                return (
                  <div key={t.id} className="bg-white rounded-lg border border-[#E2E8F0] px-3 py-2.5 flex items-start justify-between gap-2 group hover:border-[#10B981]/30">
                    <button onClick={()=>onGo?.('tarefas')} className="min-w-0 text-left flex-1">
                      <div className="text-[12.5px] font-[600] text-[#0F172A] leading-tight truncate">{t.titulo}</div>
                      <div className="text-[11px] text-[#94A3B8] mt-0.5">
                        {t.dataVencimento ? `Prazo: ${fmtData(t.dataVencimento)}` : 'Sem prazo'}
                        {t.responsavelNome ? ` · ${t.responsavelNome}` : ''}
                      </div>
                    </button>
                    <span className={`shrink-0 text-[11px] font-[600] px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>
                    {t.estado !== 'done' && (
                      <button onClick={()=>marcarTarefaFeita(t.id, true)} title="Concluir" className="opacity-0 group-hover:opacity-100 p-1 hover:bg-emerald-50 rounded text-emerald-600"><CheckSquare className="w-3 h-3" /></button>
                    )}
                    {canDelete && (
                      <button onClick={async()=>{ if(confirm('Mover tarefa para a lixeira?')) await deleteTarefa(t.id); }} title="Apagar" className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-100 rounded"><Trash2 className="w-3 h-3 text-zinc-500" /></button>
                    )}
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
              {alertasExibir.length===0 ? <li className="text-[12px] text-[#94A3B8] border-2 border-dashed border-[#FECACA] rounded-lg p-3 text-center">Sem alertas abertos</li> : alertasExibir.map(a => (
                <li key={a.id} className="flex gap-2 text-[12.5px] leading-[17px] group items-start">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#DC2626] shrink-0" />
                  <span className="flex-1 text-[#7F1D1D]">
                    {a.texto}
                    {a.vencimento ? <span className="text-[11px] text-[#B91C1C]"> · até {fmtData(a.vencimento)}</span> : null}
                  </span>
                  <button onClick={()=>resolverAlerta(a.id)} className="opacity-0 group-hover:opacity-100 text-[11px] font-[600] text-emerald-700 hover:bg-white rounded px-1 shrink-0">Resolver</button>
                  {canDelete && (
                    <button onClick={async()=>{ if(confirm('Mover alerta para a lixeira?')) await deleteAlertaGabinete(a.id); }} className="opacity-0 group-hover:opacity-100 text-[#DC2626] hover:bg-white rounded px-1 shrink-0"><Trash2 className="w-3 h-3" /></button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[#EFF6FF] rounded-xl border border-[#BFDBFE] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-[13px] font-[700] flex items-center gap-2 text-[#1E40AF] whitespace-nowrap"><Calendar className="w-4 h-4 shrink-0" /> Próximos prazos</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => onGo?.('obrigacoes')} className="text-[12px] font-[500] text-[#2563EB]">Ver todos</button>
                <button onClick={() => setShowAddAlerta(true)} className="text-[11px] font-[600] px-2 py-1 rounded-full bg-white border border-[#BFDBFE] text-[#1E40AF] hover:bg-blue-50">+ Alerta</button>
              </div>
            </div>
            {prazos.length === 0 ? (
              <div className="text-[12px] text-[#64748B] border-2 border-dashed border-[#BFDBFE] rounded-lg p-3 text-center bg-white/60">
                Sem prazos com data{canGerirObrigacoes ? ' — adiciona uma obrigação ou um alerta com vencimento.' : '.'}
              </div>
            ) : (
              <ul className="space-y-2">
                {prazos.map(p => (
                  <li key={`${p.kind}-${p.id}`} className="flex items-center gap-2.5 text-[12.5px] group">
                    <span className={`shrink-0 whitespace-nowrap font-[700] tabular-nums ${p.atrasado ? 'text-[#B91C1C]' : 'text-[#334155]'}`}>{fmtData(p.vencimento)}</span>
                    <span className={`min-w-0 flex-1 truncate ${p.atrasado ? 'text-[#B91C1C] font-[600]' : 'text-[#475569]'}`} title={p.titulo || 'Obrigação sem descrição'}>
                      {p.kind === 'alerta' ? '⏰ ' : ''}{(p.titulo || '').trim() || 'Obrigação sem descrição'}
                    </span>
                    {p.kind === 'alerta' && (
                      <button onClick={()=>resolverAlerta(p.id)} className="opacity-0 group-hover:opacity-100 text-[11px] font-[600] text-emerald-700 hover:bg-white rounded px-1 shrink-0">Resolver</button>
                    )}
                    {p.kind === 'obrigacao' && canGerirObrigacoes && p.estado !== 'entregue' && (
                      <button onClick={()=>resolverObrigacao(p.id, 'entregue')} className="opacity-0 group-hover:opacity-100 text-[11px] font-[600] text-emerald-700 hover:bg-white rounded px-1 shrink-0">Entregue</button>
                    )}
                    {p.kind === 'obrigacao' && canGerirObrigacoes && p.estado !== 'dispensada' && (
                      <button onClick={()=>resolverObrigacao(p.id, 'dispensada')} className="opacity-0 group-hover:opacity-100 text-[11px] font-[500] text-[#64748B] hover:bg-white rounded px-1 shrink-0">Dispensar</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Orientações */}
      <div id="sec-orientacoes" className="bg-[#FFFBEB] rounded-xl border border-[#FDE68A] p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[13px] font-[700] text-[#78350F]">Orientações à equipa</h3>
          {canEditFicha && <button onClick={()=>{ setOrientEdit(orientacoes); setShowEditOrient(true); }} className="text-[12px] font-[500] text-[#2563EB]">Editar</button>}
        </div>
        {orientacoes ? (
          <ul className="list-disc pl-5 space-y-1 text-[12.5px] leading-[18px] text-[#78350F]">
            {orientacoes.split('\n').filter(Boolean).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : (
          <div className="text-[12px] text-[#A16207]">{canEditFicha ? 'Sem orientações — usa Editar para escrever as indicações para a equipa.' : 'Sem orientações definidas.'}</div>
        )}
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
                  {canDelete && <button onClick={async()=>{ if(confirm('Mover documento para a lixeira?')) await deleteDocumentoGeral(d.id); }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-100 rounded"><Trash2 className="w-3 h-3 text-zinc-500" /></button>}
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
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-[700] text-white shrink-0 bg-[#334155]">{c.initials || initialsOf(c.nome)}</span>
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
                  {canDelete && <button onClick={async()=>{ if(confirm('Mover contacto para a lixeira?')) await deleteContactoGabinete(c.id); }} className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full bg-white border border-[#E2E8F0] flex items-center justify-center text-zinc-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="w-3 h-3" /></button>}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {canVerCofre && (
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-[700] flex items-center gap-2 text-[#0B1D2D]"><Lock className="w-4 h-4 text-[#2563EB]" /> Acessos</h3>
              <button onClick={onOpenCofre} className="text-[12px] font-[500] text-[#2563EB] flex items-center gap-1">◎ Abrir cofre</button>
            </div>
            <ul className="space-y-2.5">
              {cofreItems.length === 0 ? <li className="text-[12px] text-[#94A3B8] border-2 border-dashed rounded-lg p-3 text-center">Sem acessos guardados</li> : cofreItems.map(c => (
                <li key={c.id} className="flex items-center justify-between text-[12.5px] py-1">
                  <span className="flex items-center gap-2 min-w-0"><span className="w-9 text-center text-[10px] font-[700] px-1 py-1 rounded bg-[#F1F5F9] border border-[#E2E8F0] text-[#475569] shrink-0">{c.categoria || '—'}</span> <span className="text-[#334155] truncate">{c.titulo}</span></span>
                  <button onClick={onOpenCofre} className="text-[11px] font-[500] text-[#2563EB] shrink-0">ver no cofre</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Histórico */}
      <div id="sec-historico" className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-[700] flex items-center gap-2 text-[#0B1D2D]"><Clock className="w-4 h-4 text-[#2563EB]" /> Histórico / Últimas ocorrências</h3>
          <button onClick={()=>setShowAddOcorr(true)} className="text-[11px] font-[600] px-2 py-1 rounded-full bg-white border border-[#E2E8F0] text-[#2563EB]">+ Ocorrência</button>
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
                {canDelete && <button onClick={async()=>{ if(confirm('Mover ocorrência para a lixeira?')) await deleteOcorrencia(o.id); }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-100 rounded"><Trash2 className="w-3 h-3 text-zinc-500" /></button>}
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
              <input value={formCliente.nrTrabalhadores != null ? String(formCliente.nrTrabalhadores) : ''} onChange={e=>setFormCliente({...formCliente, nrTrabalhadores: e.target.value === '' ? undefined : parseInt(e.target.value, 10) || 0})} placeholder="N. trabalhadores" className="px-3 py-2 rounded-xl border text-sm" />
              <select value={formCliente.regimeIva||''} onChange={e=>setFormCliente({...formCliente, regimeIva:e.target.value as GabineteCliente['regimeIva']})} className="px-3 py-2 rounded-xl border text-sm bg-white">
                <option value="">Regime IVA…</option>
                <option value="mensal">Mensal</option>
                <option value="trimestral">Trimestral</option>
                <option value="isencao53">Isenção Art. 53</option>
              </select>
              <select value={formCliente.regimeIrc||''} onChange={e=>setFormCliente({...formCliente, regimeIrc:e.target.value as GabineteCliente['regimeIrc']})} className="px-3 py-2 rounded-xl border text-sm bg-white">
                <option value="">IRC…</option>
                <option value="geral">Regime Geral</option>
                <option value="simplificado">Simplificado</option>
                <option value="transparencia">Transparência</option>
              </select>
              <select value={formCliente.tipoSociedade||''} onChange={e=>setFormCliente({...formCliente, tipoSociedade:e.target.value})} className="px-3 py-2 rounded-xl border text-sm bg-white">
                <option value="">Tipo de sociedade…</option>
                <option value="Sociedade por quotas">Sociedade por quotas</option>
                <option value="Sociedade unipessoal">Sociedade unipessoal</option>
                <option value="Empresário individual">Empresário individual</option>
              </select>
              <input type="date" value={formCliente.inicioAtividade ? new Date(formCliente.inicioAtividade).toISOString().slice(0,10) : ''} onChange={e=>setFormCliente({...formCliente, inicioAtividade: e.target.value ? new Date(`${e.target.value}T12:00:00`).getTime() : undefined})} className="px-3 py-2 rounded-xl border text-sm" />
            </div>
            <div className="space-y-2">
              <div className="text-[12px] font-[600] text-zinc-600">Obrigações ativas (aparecem no Quadro e nos mapas)</div>
              <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto">
                {catalogoObr.map(def => {
                  const cur = (formCliente.obrigacoesAtivas as string[] | undefined) ?? getObrigacoesAtivas(cliente);
                  const on = cur.includes(def.id);
                  return (
                    <label key={def.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[12px] cursor-pointer transition-all ${on ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-zinc-50 border-zinc-200 text-zinc-400'}`}>
                      <input type="checkbox" checked={on} onChange={()=>{
                        const next = on ? cur.filter(x=>x!==def.id) : [...cur, def.id];
                        if (next.length === 0) { alert('O cliente tem de ter pelo menos uma obrigação.'); return; }
                        setFormCliente({...formCliente, obrigacoesAtivas: next});
                      }} className="w-3.5 h-3.5 accent-emerald-600" />
                      {def.label}
                    </label>
                  );
                })}
              </div>
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
            <label className="block text-[12px] text-zinc-600">Vencimento (opcional — entra nos próximos prazos)
              <input type="date" value={alertaVenc} onChange={e=>setAlertaVenc(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-xl border text-sm" />
            </label>
            <div className="flex justify-end gap-2"><button onClick={()=>setShowAddAlerta(false)} className="px-4 py-2 rounded-xl border text-sm">Cancelar</button><button onClick={handleAddAlerta} className="px-4 py-2 rounded-xl bg-[#0F172A] text-white text-sm">Adicionar</button></div>
          </div>
        </div>
      )}
      {showAddTarefa && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" onClick={()=>setShowAddTarefa(false)}>
          <div className="w-full max-w-[480px] bg-white rounded-2xl p-6 border shadow-xl space-y-3" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-semibold">Nova tarefa</h3><button onClick={()=>setShowAddTarefa(false)} className="p-1 hover:bg-zinc-100 rounded"><X className="w-4 h-4" /></button></div>
            <input value={tarefaTitulo} onChange={e=>setTarefaTitulo(e.target.value)} placeholder="Título da tarefa" className="w-full px-3 py-2 rounded-xl border text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <select value={tarefaEstado} onChange={e=>setTarefaEstado(e.target.value as Tarefa['estado'])} className="px-3 py-2 rounded-xl border bg-white text-sm">
                <option value="todo">Por fazer</option>
                <option value="doing">Em curso</option>
                <option value="atrasada">Atrasada</option>
                <option value="done">Concluída</option>
              </select>
              <input type="date" value={tarefaPrazo} onChange={e=>setTarefaPrazo(e.target.value)} className="px-3 py-2 rounded-xl border text-sm" />
            </div>
            <div className="flex justify-end gap-2"><button onClick={()=>setShowAddTarefa(false)} className="px-4 py-2 rounded-xl border text-sm">Cancelar</button><button onClick={handleAddTarefa} className="px-4 py-2 rounded-xl bg-[#0F172A] text-white text-sm">Criar tarefa</button></div>
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
              {situacaoEdit.map((s, i)=>(
                <div key={i} className="flex gap-2">
                  <select value={s.cor} onChange={e=>{ const arr=[...situacaoEdit]; arr[i]={...arr[i], cor:e.target.value as 'red'|'green'|'orange'}; setSituacaoEdit(arr); }} className="px-2 py-2 rounded-lg border text-xs"><option value="green">Verde</option><option value="orange">Laranja</option><option value="red">Vermelho</option></select>
                  <input value={s.texto} onChange={e=>{ const arr=[...situacaoEdit]; arr[i]={...arr[i], texto:e.target.value}; setSituacaoEdit(arr); }} className="flex-1 px-3 py-2 rounded-xl border text-sm" />
                  <button onClick={()=>setSituacaoEdit(situacaoEdit.filter((_, j)=>j!==i))} className="p-2 hover:bg-rose-50 rounded text-rose-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={()=>setSituacaoEdit([...situacaoEdit, {texto:'', cor:'green'}])} className="text-sm text-[#2563EB] flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar linha</button>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setShowEditSituacao(false)} className="px-4 py-2 rounded-xl border text-sm">Cancelar</button>
              <button onClick={async()=>{ await upsertCliente({...cliente, situacaoAtual: situacaoEdit.filter(s=>s.texto.trim()), updatedAt: Date.now()}); setShowEditSituacao(false); }} className="px-4 py-2 rounded-xl bg-[#0F172A] text-white text-sm">Guardar</button>
            </div>
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

// ─── Obrigações do cliente — checkboxes sincronizadas com o Quadro ──────────
function ObrigacoesCard({ cliente, catalogo, readOnly }: { cliente: GabineteCliente; catalogo: ObrigacaoDef[]; readOnly?: boolean }) {
  const [saving, setSaving] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [novoLabel, setNovoLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const ativas = getObrigacoesAtivas(cliente);
  const gerar = (cli: GabineteCliente) => { try { gerarObrigacoesParaCliente(cli); } catch {} };
  const toggle = async (id: string) => {
    const next = ativas.includes(id) ? ativas.filter(x => x !== id) : [...ativas, id];
    if (next.length === 0) { alert('O cliente tem de ter pelo menos uma obrigação.'); return; }
    setSaving(id);
    try {
      await setObrigacoesAtivas(cliente, next);
      if (!ativas.includes(id)) gerar({ ...cliente, obrigacoesAtivas: next });
      const label = catalogo.find(c => c.id === id)?.label || id;
      toast(`✓ ${label} ${ativas.includes(id) ? 'desligada' : 'ligada'} em ${cliente.nome} — gravado`);
    } finally { setSaving(null); }
  };
  const handleAdd = async () => {
    const label = novoLabel.trim();
    if (!label) return;
    setAdding(true);
    try {
      const def = await addCatalogoDef(label);
      const next = [...new Set([...ativas, def.id])];
      await setObrigacoesAtivas(cliente, next);
      toast(`✓ “${label}” criada e ligada a ${cliente.nome} — gravado`);
      setNovoLabel(''); setShowAdd(false);
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setAdding(false); }
  };
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[13px] font-[700] flex items-center gap-2 text-[#0B1D2D]"><Calendar className="w-4 h-4 text-[#64748B]" /> Obrigações</h3>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#64748B]">{ativas.length}/{catalogo.length} ativas</span>
          {!readOnly && <button onClick={()=>setShowAdd(v=>!v)} className="text-[11px] font-[600] px-2 py-0.5 rounded-full bg-white border border-[#E2E8F0] text-[#2563EB] hover:bg-zinc-50">+ Nova</button>}
        </div>
      </div>
      <p className="text-[11px] text-[#94A3B8] mb-2.5">{readOnly ? 'O que está marcado aparece no Quadro e nos mapas.' : 'O que está marcado aparece no Quadro e nos mapas.'}</p>
      {showAdd && !readOnly && (
        <div className="flex gap-1.5 mb-2.5">
          <input value={novoLabel} onChange={e=>setNovoLabel(e.target.value)} placeholder="Nova obrigação (ex: Modelo 30)" className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[12px]" onKeyDown={e=>{ if (e.key==='Enter') handleAdd(); }} />
          <button onClick={handleAdd} disabled={adding || !novoLabel.trim()} className="px-3 py-1.5 rounded-lg bg-[#0677FF] text-white text-[11px] font-[600] disabled:opacity-50">Adicionar</button>
          <button onClick={()=>{ setShowAdd(false); setNovoLabel(''); }} className="px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] text-[11px] font-[500] text-[#64748B]">Cancelar</button>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {catalogo.map(def => {
          const on = ativas.includes(def.id);
          return (
            <label key={def.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[12px] font-[500] ${readOnly ? 'cursor-default' : 'cursor-pointer'} transition-all duration-200 ${on ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-zinc-50 border-zinc-200 text-zinc-400'}`}>
              <input type="checkbox" checked={on} disabled={readOnly || saving === def.id} onChange={() => toggle(def.id)} className="w-3.5 h-3.5 accent-emerald-600" />
              {def.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
