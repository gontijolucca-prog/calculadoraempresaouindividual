import React, { useMemo, useState } from 'react';
import {
  Building2, AlertTriangle, ShieldAlert, Calendar, FileText, Users, Lock,
  Info, Phone, Mail, MessageCircle, Clock, ChevronRight, ExternalLink,
  Pencil, MoreHorizontal, CheckCircle2, AlertCircle, Eye
} from 'lucide-react';
import type { GabineteCliente, Tarefa, Obrigacao, CofreEntrada, GabineteDocumento, ContactoGabinete, AssuntoGabinete, AlertaGabinete, OcorrenciaGabinete } from './lib/gabinete';

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
  onEditCliente?: () => void;
  onGo?: (tab: string) => void;
  onOpenCofre?: () => void;
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
function fmtDate(d?: number): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('pt-PT'); } catch { return '—'; }
}
function fmtDateTime(d: number): string {
  return new Date(d).toLocaleDateString('pt-PT');
}

const estadoBadge: Record<string, { label: string; cls: string }> = {
  em_curso: { label: 'Em curso', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  aguard_cliente: { label: 'Aguard. cliente', cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  pendente: { label: 'Pendente', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
  concluido: { label: 'Concluído', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

export default function VisaoGeralView({ cliente, contactos, assuntos, alertas, ocorrencias, tarefas, obrigacoes, cofre, documentos, onEditCliente, onGo, onOpenCofre }: Props) {
  const [tabSec, setTabSec] = useState('visao');

  const displayNome = cliente?.nome || 'Empresa sem nome';
  const displayNif = cliente?.nif || '—';
  const caeLabel = cliente?.caes || cliente?.caeDescricao ? (cliente?.caes || cliente?.caeDescricao || '—') : '—';
  const caeDesc = cliente?.caeDescricao || '';
  const tipoSoc = cliente?.tipoSociedade || (cliente?.tipoEntidade === 'LDA' ? 'Sociedade por quotas' : cliente?.tipoEntidade || '—');
  const regimeIvaLabel = cliente?.regimeIva === 'trimestral' ? 'Trimestral' : cliente?.regimeIva === 'mensal' ? 'Mensal' : cliente?.regimeIva === 'isencao53' ? 'Isenção Art. 53' : cliente?.regimeIva || '—';
  const regimeIrcLabel = cliente?.regimeIrc ? (cliente.regimeIrc === 'geral' ? 'Regime Geral' : cliente.regimeIrc) : 'Regime Geral';
  const nrTrab = cliente?.nrTrabalhadores ?? '—';
  const inicioAtiv = cliente?.inicioAtividade;
  const gerentes = cliente?.gerentes || [];
  const responsavel = cliente?.responsavelInterno;
  const apoio = cliente?.apoioAdministrativo;
  const supervisor = cliente?.supervisor;
  const orientacoes = cliente?.orientacoes || 'Todas as faturas devem ser digitalizadas e inseridas no TOCOnline no momento da receção.\nCliente prefere comunicação por WhatsApp.\nConfirmar sempre a afetação de despesas (pessoal vs. empresa).\nValidar dedutibilidade de despesas com viatura, combustível e portagens.\nAntes de fechar o mês, confirmar se existem documentos em falta.';

  // Derivações
  const situacaoItems = useMemo(() => {
    // Se houver tarefas/obrigacões reais, poderia calcular, mas para MVP usa fixo do mockup (cores iguais)
    return [
      { dot: 'bg-red-500', text: 'Documentação de julho e agosto em falta' },
      { dot: 'bg-emerald-500', text: 'IVA tratado até julho' },
      { dot: 'bg-emerald-500', text: 'Contabilidade em dia' },
      { dot: 'bg-amber-500', text: 'Processo de compensação Segurança Social pendente' },
      { dot: 'bg-emerald-500', text: 'Salários atualizados' },
    ];
  }, []);

  const proximosPrazos = useMemo(() => {
    const fromObr = obrigacoes
      .filter(o => o.vencimento >= Date.now() && o.vencimento <= Date.now() + 90 * 86400000)
      .sort((a, b) => a.vencimento - b.vencimento)
      .slice(0, 5)
      .map(o => ({ label: new Date(o.vencimento).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }).replace('.', ''), title: o.titulo }));
    if (fromObr.length >= 3) return fromObr;
    return [
      { label: '10 set', title: 'Envio IVA (2.º trimestre)' },
      { label: '15 set', title: 'Submissão DMR' },
      { label: '20 set', title: 'Pagamento TSU' },
      { label: '30 set', title: 'Resposta SS – compensação' },
      { label: '15 out', title: 'Modelo 22 (se aplicável)' },
    ];
  }, [obrigacoes]);

  const assuntosExibir = assuntos.length > 0 ? assuntos.slice(0, 3) : [
    { id: 'mock1', clienteId: cliente?.id || 'mock', titulo: 'Duplicação de contribuições Segurança Social', estado: 'em_curso' as const, updatedAt: Date.now() - 86400000, descricao: 'Atualizado: 16/09/2026' },
    { id: 'mock2', clienteId: cliente?.id || 'mock', titulo: 'Viatura da empresa', estado: 'aguard_cliente' as const, updatedAt: Date.now() - 9 * 86400000, descricao: 'Atualizado: 08/09/2026' },
    { id: 'mock3', clienteId: cliente?.id || 'mock', titulo: 'Documentação em falta (Jul-Ago)', estado: 'pendente' as const, updatedAt: Date.now() - 86400000, descricao: 'Atualizado: 16/09/2026' },
  ];

  const alertasExibir = alertas.length > 0 ? alertas.slice(0, 4) : [
    { id: 'a1', clienteId: cliente?.id || 'mock', texto: 'Cliente tem dificuldade em reunir documentação.', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'a2', clienteId: cliente?.id || 'mock', texto: 'Todas as faturas devem ser enviadas por WhatsApp assim que são recebidas.', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'a3', clienteId: cliente?.id || 'mock', texto: 'Atenção à dedutibilidade de despesas com viatura.', createdAt: Date.now(), updatedAt: Date.now() },
  ];

  const contactosExibir = contactos.length > 0 ? contactos.slice(0, 3) : ([
    { id: 'c1', clienteId: cliente?.id || 'mock', nome: gerentes[0] || 'Gerente 1', cargo: 'Gerente', telefone: '+351 9XX XXX XXX', email: '', initials: gerentes[0] ? initialsOf(gerentes[0]) : 'G1', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'c2', clienteId: cliente?.id || 'mock', nome: gerentes[1] || 'Gerente 2', cargo: 'Gerente', telefone: '+351 9XX XXX XXX', email: '', initials: gerentes[1] ? initialsOf(gerentes[1]) : 'G2', createdAt: Date.now(), updatedAt: Date.now() },
  ] as ContactoGabinete[]);

  const docsExibir = documentos.length > 0 ? documentos.slice(0, 5) : [
    { id: 'd1', clienteId: cliente?.id || 'mock', nome: 'Contrato de constituição.pdf', tipo: 'OUTRO' as const, dataUpload: new Date('2025-12-12').getTime() },
    { id: 'd2', clienteId: cliente?.id || 'mock', nome: 'Certidão permanente.pdf', tipo: 'OUTRO' as const, dataUpload: new Date('2025-12-12').getTime() },
    { id: 'd3', clienteId: cliente?.id || 'mock', nome: 'Contrato de arrendamento.pdf', tipo: 'OUTRO' as const, dataUpload: new Date('2026-01-03').getTime() },
    { id: 'd4', clienteId: cliente?.id || 'mock', nome: 'Financiamento viatura.pdf', tipo: 'OUTRO' as const, dataUpload: new Date('2026-02-15').getTime() },
    { id: 'd5', clienteId: cliente?.id || 'mock', nome: 'Parecer OCC – viatura.pdf', tipo: 'OUTRO' as const, dataUpload: new Date('2026-08-27').getTime() },
  ] as GabineteDocumento[];

  const cofreExibir = cofre.filter(c => !cliente || c.clienteId === cliente.id).slice(0, 4);
  const cofreFallback = cofreExibir.length > 0 ? cofreExibir.map(c => ({ label: c.categoria, title: c.titulo, id: c.id })) : [
    { label: 'AT', title: 'Portal das Finanças' },
    { label: 'SS', title: 'Segurança Social Direta' },
    { label: 'TOC', title: 'TOConline' },
    { label: 'BPI', title: 'Homebanking' },
  ];

  const ocorrExibir = ocorrencias.length > 0 ? ocorrencias.slice(0, 5) : [
    { id: 'o1', clienteId: cliente?.id || 'mock', data: new Date('2026-09-16').getTime(), autorNome: responsavel?.nome || 'Equipa', autorInitials: responsavel?.initials || 'EQ', descricao: 'Atualização: sem resposta da Segurança Social.', createdAt: Date.now() },
    { id: 'o2', clienteId: cliente?.id || 'mock', data: new Date('2026-09-08').getTime(), autorNome: responsavel?.nome || 'Equipa', autorInitials: responsavel?.initials || 'EQ', descricao: 'Envio do pedido de compensação SS.', createdAt: Date.now() },
    { id: 'o3', clienteId: cliente?.id || 'mock', data: new Date('2026-09-07').getTime(), autorNome: responsavel?.nome || 'Equipa', autorInitials: responsavel?.initials || 'EQ', descricao: 'Pagamento duplicado de €445,18.', createdAt: Date.now() },
    { id: 'o4', clienteId: cliente?.id || 'mock', data: new Date('2026-09-05').getTime(), autorNome: responsavel?.nome || 'Equipa', autorInitials: responsavel?.initials || 'EQ', descricao: 'Pagamento duplicado de €445,18.', createdAt: Date.now() },
    { id: 'o5', clienteId: cliente?.id || 'mock', data: new Date('2025-12-15').getTime(), autorNome: responsavel?.nome || 'Equipa', autorInitials: responsavel?.initials || 'EQ', descricao: 'Constituição da sociedade.', createdAt: Date.now() },
  ];

  const avatarInitials = initialsOf(displayNome).slice(0, 2);

  return (
    <div className="space-y-4">
      {/* Header empresa */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-[#E8EDF3] text-[#334155] flex items-center justify-center text-[16px] font-[800] shrink-0">{avatarInitials}</div>
            <div className="min-w-0">
              <h1 className="text-[20px] font-[800] leading-tight text-[#0B1D2D] truncate">{displayNome}</h1>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-zinc-600">
                <span>NIF <span className="font-semibold text-zinc-800">{displayNif}</span></span>
                {caeLabel !== '—' && <span>CAE <span className="font-medium">{caeLabel}{caeDesc ? ` – ${caeDesc}` : ''}</span></span>}
                <span>{tipoSoc}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700"><CheckCircle2 className="w-3 h-3" /> Ativo</span>
                <span className="px-2.5 py-1 rounded-full bg-white border border-zinc-200 text-[11px] font-medium">IVA {regimeIvaLabel}</span>
                <span className="px-2.5 py-1 rounded-full bg-white border border-zinc-200 text-[11px] font-medium">IRC ({regimeIrcLabel})</span>
                <span className="px-2.5 py-1 rounded-full bg-white border border-zinc-200 text-[11px] font-medium">Contabilidade + Salários</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button className="px-4 py-2 rounded-xl bg-white border border-zinc-200 text-sm font-medium flex items-center gap-1.5">Ações <ChevronRight className="w-4 h-4 rotate-90" /></button>
            <button onClick={onEditCliente} className="px-4 py-2 rounded-xl bg-[#0F172A] text-white text-sm font-medium flex items-center gap-1.5"><Pencil className="w-3.5 h-3.5" /> Editar</button>
          </div>
        </div>

        {/* Secondary tabs */}
        <div className="mt-4 -mb-5 border-t border-zinc-100">
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {[
              { id: 'visao', label: 'Visão geral' },
              { id: 'tarefas', label: `Tarefas (${tarefas.length})`, go: 'tarefas' },
              { id: 'assuntos', label: `Assuntos (${assuntos.length || 3})` },
              { id: 'docs', label: 'Documentos' },
              { id: 'contatos', label: 'Contatos' },
              { id: 'acessos', label: 'Acessos' },
              { id: 'obrig', label: 'Obrigações', go: 'obrigacoes' },
              { id: 'hist', label: 'Histórico' },
              { id: 'equipa', label: 'Equipa' },
              { id: 'notas', label: 'Notas' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => t.go ? onGo?.(t.go) : setTabSec(t.id)}
                className={`whitespace-nowrap px-3 py-2.5 text-sm font-medium border-b-2 ${tabSec === t.id ? 'border-[#0F172A] text-[#0B1D2D]' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 1: 3 cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Resumo */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold flex items-center gap-2"><Building2 className="w-4 h-4 text-[#0F172A]" /> Resumo da empresa</h3>
            <button onClick={onEditCliente} className="text-xs text-[#1A73E8] font-medium">Editar</button>
          </div>
          <dl className="space-y-1.5 text-sm">
            {[
              ['Nome', displayNome],
              ['NIF', displayNif],
              ['CAE principal', caeLabel !== '—' ? `${caeLabel}${caeDesc ? ` – ${caeDesc}` : ''}` : '—'],
              ['Regime IVA', regimeIvaLabel],
              ['IRC', regimeIrcLabel],
              ['Gerentes', gerentes.length ? gerentes.join(', ') : '—'],
              ['N.º trabalhadores', String(nrTrab)],
              ['Início de atividade', inicioAtiv ? fmtDate(inicioAtiv) : '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <dt className="w-[140px] shrink-0 text-xs text-zinc-500">{k}</dt>
                <dd className="flex-1 text-sm font-medium text-zinc-800 truncate">{v}</dd>
              </div>
            ))}
            <div className="pt-2 mt-2 border-t border-zinc-100 space-y-2">
              {[
                ['Responsável interno', responsavel],
                ['Apoio administrativo', apoio],
                ['Supervisor', supervisor],
              ].map(([label, person]) => {
                const p = person as { nome: string; initials: string } | undefined;
                return (
                  <div key={label as string} className="flex items-center gap-3">
                    <dt className="w-[140px] text-xs text-zinc-500">{label as string}</dt>
                    <dd className="flex items-center gap-2 text-sm">
                      {p ? (
                        <>
                          <span className="w-6 h-6 rounded-full bg-[#E0E7FF] text-[#3730A3] flex items-center justify-center text-[11px] font-bold">{p.initials}</span>
                          <span className="font-medium">{p.nome}</span>
                        </>
                      ) : <span className="text-zinc-400">—</span>}
                    </dd>
                  </div>
                );
              })}
            </div>
          </dl>
        </div>

        {/* Situação atual */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-amber-600" /> Situação atual</h3>
            <button onClick={onEditCliente} className="text-xs text-[#1A73E8] font-medium">Editar</button>
          </div>
          <ul className="space-y-2.5">
            {situacaoItems.map((it, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${it.dot}`} />
                <span className="text-zinc-700 leading-tight">{it.text}</span>
              </li>
            ))}
          </ul>
          {/* Assuntos dentro de situação? No mockup assuntos é verde separado, mas aqui já temos. Vamos incluir Assuntos principais dentro deste card? Para fidelidade, vamos deixar separado abaixo. */}
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Assuntos principais</h4>
              <button onClick={() => onGo?.('tarefas')} className="text-[11px] text-[#1A73E8] font-medium">Ver todos ({assuntosExibir.length})</button>
            </div>
            <div className="space-y-2">
              {assuntosExibir.map(a => {
                const b = estadoBadge[a.estado] || estadoBadge.pendente;
                return (
                  <div key={a.id} className="bg-white rounded-xl border border-zinc-200 p-2.5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium leading-tight truncate flex items-center gap-1.5"><span className="w-0 h-0 border-l-[5px] border-l-emerald-500 border-y-[4px] border-y-transparent" /> {a.titulo}</div>
                      <div className="text-[11px] text-zinc-500">Atualizado: {fmtDate(a.updatedAt)}</div>
                    </div>
                    <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full border font-medium ${b.cls}`}>{b.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Alertas + Próximos prazos stacked */}
        <div className="space-y-4">
          <div className="bg-red-50/60 border border-red-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-red-800"><AlertTriangle className="w-4 h-4" /> Alertas</h3>
              <button className="text-xs text-[#1A73E8] font-medium">+ Adicionar</button>
            </div>
            <ul className="space-y-2.5">
              {alertasExibir.map(a => (
                <li key={a.id} className="flex gap-2.5 text-sm">
                  <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                  <span className="text-zinc-700 leading-tight">{a.texto}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-blue-50/30 border border-blue-100 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2 text-[#0F172A]"><Calendar className="w-4 h-4 text-[#0677FF]" /> Próximos prazos</h3>
              <button onClick={() => onGo?.('obrigacoes')} className="text-xs text-[#1A73E8] font-medium">Ver todos</button>
            </div>
            <ul className="space-y-2">
              {proximosPrazos.map((p, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="w-[50px] shrink-0 text-xs font-bold text-zinc-700">{p.label}</span>
                  <span className="flex-1 text-zinc-700 truncate">{p.title}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Orientações */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold flex items-center gap-2 text-amber-900"><Info className="w-4 h-4" /> Orientações à equipa</h3>
          <button onClick={onEditCliente} className="text-xs text-[#1A73E8] font-medium">Editar</button>
        </div>
        <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-700">
          {orientacoes.split('\n').filter(Boolean).map((line, i) => (
            <li key={i}>{line.replace(/^•\s*/, '')}</li>
          ))}
        </ul>
      </div>

      {/* Docs / Contactos / Acessos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold flex items-center gap-2 text-[#0F172A]"><FileText className="w-4 h-4 text-[#0677FF]" /> Documentos importantes</h3>
            <button className="text-xs text-[#1A73E8]">Ver todos</button>
          </div>
          <ul className="space-y-2">
            {docsExibir.map(d => (
              <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 truncate"><FileText className="w-3.5 h-3.5 text-red-500 shrink-0" /> <span className="truncate">{d.nome}</span></span>
                <span className="text-xs text-zinc-500 shrink-0">{fmtDate(d.dataUpload)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold flex items-center gap-2 text-[#0F172A]"><Users className="w-4 h-4 text-[#0677FF]" /> Contactos</h3>
            <button className="text-xs text-[#1A73E8]">Ver todos</button>
          </div>
          <ul className="space-y-3">
            {contactosExibir.map(c => (
              <li key={c.id} className="flex items-start justify-between gap-3">
                <div className="flex gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-full bg-[#4F46E5] text-white flex items-center justify-center text-xs font-bold shrink-0" style={{ background: c.id === 'c1' ? '#4F46E5' : c.id === 'c2' ? '#7C3AED' : '#334155' }}>{c.initials || initialsOf(c.nome)}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{c.nome}</div>
                    <div className="text-xs text-zinc-500">{c.cargo || '—'}</div>
                    <div className="text-xs text-zinc-600">{c.telefone || ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <a href={c.telefone ? `tel:${c.telefone}` : undefined} className="p-1 rounded hover:bg-zinc-100 text-[#0677FF]"><Phone className="w-3.5 h-3.5" /></a>
                  <a href={c.email ? `mailto:${c.email}` : undefined} className="p-1 rounded hover:bg-zinc-100 text-zinc-600"><Mail className="w-3.5 h-3.5" /></a>
                  <span className="p-1 text-emerald-600"><MessageCircle className="w-3.5 h-3.5" /></span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold flex items-center gap-2 text-[#0F172A]"><Lock className="w-4 h-4 text-[#0677FF]" /> Acessos</h3>
            <button onClick={onOpenCofre} className="text-xs text-[#1A73E8] flex items-center gap-1"><Eye className="w-3 h-3" /> Abrir cofre</button>
          </div>
          <ul className="space-y-2">
            {cofreFallback.map((a, i) => (
              <li key={i} className="flex items-center justify-between text-sm py-1">
                <span className="flex items-center gap-2"><span className="w-10 text-[11px] font-bold px-1.5 py-1 rounded bg-zinc-100 border text-zinc-700 text-center">{a.label}</span> <span>{a.title}</span></span>
                <button onClick={onOpenCofre} className="text-xs text-[#1A73E8]">ver no cofre</button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Histórico */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold flex items-center gap-2 text-[#0F172A]"><Clock className="w-4 h-4 text-[#0677FF]" /> Histórico / Últimas ocorrências</h3>
          <button className="text-xs text-[#1A73E8]">Ver todo o histórico</button>
        </div>
        <ul className="space-y-2">
          {ocorrExibir.map(o => (
            <li key={o.id} className="flex items-start gap-3 text-sm">
              <span className="w-[85px] shrink-0 text-xs text-zinc-600">{fmtDate(o.data)}</span>
              <span className="w-6 h-6 rounded-full bg-[#1E293B] text-white flex items-center justify-center text-[10px] font-bold shrink-0">{o.autorInitials}</span>
              <span className="w-[110px] shrink-0 text-xs font-medium text-zinc-700 truncate">{o.autorNome}</span>
              <span className="flex-1 text-zinc-700 truncate">{o.descricao}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
