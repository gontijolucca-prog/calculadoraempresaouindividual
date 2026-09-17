import React, { useMemo, useState } from 'react';
import {
  Building2, AlertTriangle, Calendar, FileText, Users, Lock, Info, Phone, Mail, MessageCircle, Clock
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

export default function VisaoGeralView({ cliente, contactos, assuntos, alertas, ocorrencias, tarefas, obrigacoes, cofre, documentos, onEditCliente, onGo, onOpenCofre }: Props) {
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

  const situacaoItems = useMemo(() => [
    { dot: 'bg-[#EF4444]', text: 'Documentação de julho e agosto em falta' },
    { dot: 'bg-[#10B981]', text: 'IVA tratado até julho' },
    { dot: 'bg-[#10B981]', text: 'Contabilidade em dia' },
    { dot: 'bg-[#F59E0B]', text: 'Processo de compensação Segurança Social pendente' },
    { dot: 'bg-[#10B981]', text: 'Salários atualizados' },
  ], []);

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

  const assuntosExibir: AssuntoGabinete[] = assuntos.length > 0 ? assuntos.slice(0, 3) : [
    { id: 'mock1', clienteId: cliente?.id || 'mock', titulo: 'Duplicação de contribuições Segurança Social', estado: 'em_curso', updatedAt: new Date('2026-09-16').getTime(), createdAt: Date.now() },
    { id: 'mock2', clienteId: cliente?.id || 'mock', titulo: 'Viatura da empresa', estado: 'aguard_cliente', updatedAt: new Date('2026-09-08').getTime(), createdAt: Date.now() },
    { id: 'mock3', clienteId: cliente?.id || 'mock', titulo: 'Documentação em falta (Jul-Ago)', estado: 'pendente', updatedAt: new Date('2026-09-16').getTime(), createdAt: Date.now() },
  ];

  const alertasExibir: AlertaGabinete[] = alertas.length > 0 ? alertas.slice(0, 3) : [
    { id: 'a1', clienteId: cliente?.id || 'mock', texto: 'Cliente tem dificuldade em reunir documentação.', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'a2', clienteId: cliente?.id || 'mock', texto: 'Todas as faturas devem ser enviadas por WhatsApp assim que são recebidas.', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'a3', clienteId: cliente?.id || 'mock', texto: 'Atenção à dedutibilidade de despesas com viatura.', createdAt: Date.now(), updatedAt: Date.now() },
  ];

  const contactosExibir: ContactoGabinete[] = contactos.length > 0 ? contactos.slice(0, 3) : [
    { id: 'c1', clienteId: cliente?.id || 'mock', nome: 'Mykola Ivanenko', cargo: 'Gerente', telefone: '+351 9XX XXX XXX', email: '', initials: 'MI', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'c2', clienteId: cliente?.id || 'mock', nome: 'Vasyl Petrenko', cargo: 'Gerente', telefone: '+351 9XX XXX XXX', email: '', initials: 'VP', createdAt: Date.now(), updatedAt: Date.now() },
    { id: 'c3', clienteId: cliente?.id || 'mock', nome: 'Iryna (Administrativa)', cargo: 'Envio de faturas', telefone: '+351 9XX XXX XXX', email: '', initials: 'IA', createdAt: Date.now(), updatedAt: Date.now() },
  ];

  const docsExibir: GabineteDocumento[] = documentos.length > 0 ? documentos.slice(0, 5) : [
    { id: 'd1', clienteId: cliente?.id || 'mock', nome: 'Contrato de constituição.pdf', tipo: 'OUTRO', dataUpload: new Date('2025-12-12').getTime() },
    { id: 'd2', clienteId: cliente?.id || 'mock', nome: 'Certidão permanente.pdf', tipo: 'OUTRO', dataUpload: new Date('2025-12-12').getTime() },
    { id: 'd3', clienteId: cliente?.id || 'mock', nome: 'Contrato de arrendamento.pdf', tipo: 'OUTRO', dataUpload: new Date('2026-01-03').getTime() },
    { id: 'd4', clienteId: cliente?.id || 'mock', nome: 'Financiamento viatura.pdf', tipo: 'OUTRO', dataUpload: new Date('2026-02-15').getTime() },
    { id: 'd5', clienteId: cliente?.id || 'mock', nome: 'Parecer OCC – viatura.pdf', tipo: 'OUTRO', dataUpload: new Date('2026-08-27').getTime() },
  ];

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

  const ocorrExibir: OcorrenciaGabinete[] = ocorrencias.length > 0 ? ocorrencias.slice(0, 5) : [
    { id: 'o1', clienteId: cliente?.id || 'mock', data: new Date('2026-09-16').getTime(), autorNome: 'Sandrine Reis', autorInitials: 'SR', descricao: 'Atualização: sem resposta da Segurança Social.', createdAt: Date.now() },
    { id: 'o2', clienteId: cliente?.id || 'mock', data: new Date('2026-09-08').getTime(), autorNome: 'Ana Margarida', autorInitials: 'AM', descricao: 'Envio do pedido de compensação SS.', createdAt: Date.now() },
    { id: 'o3', clienteId: cliente?.id || 'mock', data: new Date('2026-09-07').getTime(), autorNome: 'Ana Margarida', autorInitials: 'AM', descricao: 'Pagamento duplicado de €445,18.', createdAt: Date.now() },
    { id: 'o4', clienteId: cliente?.id || 'mock', data: new Date('2026-05-05').getTime(), autorNome: 'Ana Margarida', autorInitials: 'AM', descricao: 'Pagamento duplicado de €445,18.', createdAt: Date.now() },
    { id: 'o5', clienteId: cliente?.id || 'mock', data: new Date('2025-12-15').getTime(), autorNome: 'Sandrine Reis', autorInitials: 'SR', descricao: 'Constituição da sociedade.', createdAt: Date.now() },
  ];

  const avatarInitials = initialsOf(displayNome).slice(0, 2);

  return (
    <div className="space-y-3">
      {/* Header empresa - exatamente como print */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
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
            <button className="px-3.5 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-[13px] font-[500] text-[#334155] flex items-center gap-1">Ações <span className="text-[10px]">▾</span></button>
            <button onClick={onEditCliente} className="px-3.5 py-1.5 rounded-lg bg-[#0F172A] text-white text-[13px] font-[600] flex items-center gap-1.5">✎ Editar</button>
          </div>
        </div>

        {/* Tabs secundárias */}
        <div className="mt-4 -mb-4 border-t border-[#F1F5F9] -mx-4 px-4">
          <div className="flex gap-5 overflow-x-auto scrollbar-none text-[13px]">
            {[
              { id: 'visao', label: 'Visão geral', active: true },
              { id: 'tarefas', label: `Tarefas (${tarefas.length || 4})`, go: 'tarefas' },
              { id: 'assuntos', label: `Assuntos (${assuntos.length || 3})` },
              { id: 'docs', label: 'Documentos' },
              { id: 'contatos', label: 'Contatos' },
              { id: 'acessos', label: 'Acessos', go: 'cofre' },
              { id: 'obrig', label: 'Obrigações', go: 'obrigacoes' },
              { id: 'hist', label: 'Histórico' },
              { id: 'equipa', label: 'Equipa' },
              { id: 'notas', label: 'Notas' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => t.go && onGo?.(t.go)}
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
            <button onClick={onEditCliente} className="text-[12px] font-[500] text-[#2563EB]">Editar</button>
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
              <button onClick={onEditCliente} className="text-[12px] font-[500] text-[#2563EB]">Editar</button>
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

          <div className="bg-[#F0FDF4] rounded-xl border border-[#BBF7D0] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-[700] flex items-center gap-2 text-[#065F46]"><span className="w-5 h-5 rounded bg-white border border-[#BBF7D0] flex items-center justify-center">▭</span> Assuntos principais</h3>
              <button onClick={() => onGo?.('tarefas')} className="text-[12px] font-[500] text-[#2563EB]">Ver todos ({assuntosExibir.length})</button>
            </div>
            <div className="space-y-2">
              {assuntosExibir.map(a => {
                const cls = estadoBadgeCls[a.estado] || estadoBadgeCls.pendente;
                const label = estadoLabel[a.estado] || a.estado;
                return (
                  <div key={a.id} className="bg-white rounded-lg border border-[#E2E8F0] px-3 py-2.5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-[600] text-[#0F172A] leading-tight flex items-center gap-1.5"><span className="text-[#10B981] text-[10px]">▶</span> <span className="truncate">{a.titulo}</span></div>
                      <div className="text-[11px] text-[#94A3B8] mt-0.5">Atualizado: {new Date(a.updatedAt).toLocaleDateString('pt-PT')}</div>
                    </div>
                    <span className={`shrink-0 text-[11px] font-[600] px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>
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
              <button className="text-[12px] font-[500] text-[#2563EB]">+ Adicionar</button>
            </div>
            <ul className="space-y-2.5">
              {alertasExibir.map(a => (
                <li key={a.id} className="flex gap-2.5 text-[12.5px] leading-[17px]">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#DC2626] shrink-0" />
                  <span className="text-[#7F1D1D]">{a.texto}</span>
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
      <div className="bg-[#FFFBEB] rounded-xl border border-[#FDE68A] p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[13px] font-[700] flex items-center gap-2 text-[#92400E]"><Info className="w-4 h-4 text-[#D97706]" /> Orientações à equipa</h3>
          <button onClick={onEditCliente} className="text-[12px] font-[500] text-[#2563EB]">Editar</button>
        </div>
        <ul className="list-disc pl-5 space-y-1 text-[12.5px] leading-[18px] text-[#78350F]">
          {orientacoes.split('\n').filter(Boolean).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>

      {/* Bottom 3 cols */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-[700] flex items-center gap-2 text-[#0B1D2D]"><FileText className="w-4 h-4 text-[#2563EB]" /> Documentos importantes</h3>
            <button className="text-[12px] font-[500] text-[#2563EB]">Ver todos</button>
          </div>
          <ul className="space-y-2">
            {docsExibir.map(d => (
              <li key={d.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                <span className="flex items-center gap-1.5 truncate"><span className="w-3 h-3 rounded-[2px] bg-[#FEE2E2] border border-[#FECACA] flex items-center justify-center text-[7px] text-[#DC2626]">⧉</span> <span className="truncate text-[#334155]">{d.nome}</span></span>
                <span className="text-[11px] text-[#94A3B8] shrink-0">{new Date(d.dataUpload).toLocaleDateString('pt-PT')}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-[700] flex items-center gap-2 text-[#0B1D2D]"><Users className="w-4 h-4 text-[#2563EB]" /> Contactos</h3>
            <button className="text-[12px] font-[500] text-[#2563EB]">Ver todos</button>
          </div>
          <ul className="space-y-3">
            {contactosExibir.map(c => (
              <li key={c.id} className="flex items-start justify-between gap-2">
                <div className="flex gap-2.5 min-w-0">
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-[700] text-white shrink-0" style={{ background: c.initials === 'MI' ? '#6366F1' : c.initials === 'VP' ? '#7C3AED' : '#334155' }}>{c.initials || initialsOf(c.nome)}</span>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-[700] text-[#0F172A] leading-none truncate">{c.nome}</div>
                    <div className="text-[11px] text-[#64748B]">{c.cargo || '—'}</div>
                    <div className="text-[11px] text-[#64748B]">{c.telefone || ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="w-6 h-6 rounded-full bg-white border border-[#E2E8F0] flex items-center justify-center text-[#2563EB]"><Phone className="w-3 h-3" /></span>
                  <span className="w-6 h-6 rounded-full bg-white border border-[#E2E8F0] flex items-center justify-center text-[#64748B]"><Mail className="w-3 h-3" /></span>
                  <span className="w-6 h-6 rounded-full bg-[#DCFCE7] border border-[#BBF7D0] flex items-center justify-center text-[#16A34A]"><MessageCircle className="w-3 h-3" /></span>
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
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-[700] flex items-center gap-2 text-[#0B1D2D]"><Clock className="w-4 h-4 text-[#2563EB]" /> Histórico / Últimas ocorrências</h3>
          <button className="text-[12px] font-[500] text-[#2563EB]">Ver todo o histórico</button>
        </div>
        <div className="relative">
          <div className="absolute left-[42px] top-2 bottom-2 w-px bg-[#E2E8F0] hidden sm:block" />
          <ul className="space-y-2">
            {ocorrExibir.map(o => (
              <li key={o.id} className="flex items-center gap-3 text-[12.5px]">
                <span className="w-[78px] shrink-0 text-[12px] text-[#64748B]">{new Date(o.data).toLocaleDateString('pt-PT')}</span>
                <span className="relative w-2 h-2 rounded-full bg-[#334155] shrink-0 hidden sm:block" />
                <span className="w-6 h-6 rounded-full bg-[#1E293B] text-white flex items-center justify-center text-[9px] font-[700] shrink-0">{o.autorInitials}</span>
                <span className="w-[105px] shrink-0 text-[12px] font-[600] text-[#334155] truncate">{o.autorNome}</span>
                <span className="flex-1 text-[#475569] truncate">{o.descricao}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
