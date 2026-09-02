import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckSquare,
  FileText,
  LayoutDashboard,
  Lock,
  Mail,
  Play,
  Users,
} from 'lucide-react';

/** Tabs funcionais do Gabinete. `gallery` é apenas a porta de entrada visual. */
export type GabTab =
  | 'dashboard'
  | 'agenda'
  | 'clientes'
  | 'tarefas'
  | 'obrigacoes'
  | 'comunicacao'
  | 'rentabilidade'
  | 'actas'
  | 'cofre';

export type GabineteTab = GabTab | 'gallery';

export interface GabineteFunction {
  id: GabTab;
  label: string;
  icon: React.ElementType;
  desc: string;
}

export interface GabineteIntroDef {
  titulo: string;
  Icon: React.ElementType;
  resumo: string;
  dados: string[];
  resultado: string;
}

/** Ordem e texto partilhados pela galeria, pelo header e pela navegação. */
export const GABINET_FUNCTIONS: GabineteFunction[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, desc: 'Visão geral do escritório' },
  { id: 'agenda', label: 'Agenda', icon: Calendar, desc: 'Calendário de tarefas e obrigações' },
  { id: 'clientes', label: 'Clientes 360', icon: Users, desc: 'Ficha centralizada dos clientes' },
  { id: 'tarefas', label: 'Tarefas', icon: CheckSquare, desc: 'Kanban e lista de trabalho' },
  { id: 'obrigacoes', label: 'Obrigações', icon: Calendar, desc: 'Calendário fiscal' },
  { id: 'comunicacao', label: 'Comunicação', icon: Mail, desc: 'Modelos, email e SMS' },
  { id: 'rentabilidade', label: 'Rentabilidade', icon: BarChart3, desc: 'Tempos, custo e avença' },
  { id: 'actas', label: 'Actas', icon: FileText, desc: 'Livro de actas' },
  { id: 'cofre', label: 'Cofre', icon: Lock, desc: 'Acessos protegidos' },
];

/**
 * Informação mostrada antes de entrar em cada função — o equivalente do
 * `SIM_INTROS` dos simuladores. Mantém o Gabinete explicável para quem entra
 * pela primeira vez, em vez de aterrar diretamente num ecrã vazio.
 */
export const GABINET_INTROS: Record<GabTab, GabineteIntroDef> = {
  dashboard: {
    titulo: 'Dashboard do Escritório',
    Icon: LayoutDashboard,
    resumo: 'Vê num só lugar o estado do escritório: tarefas para hoje, atrasos, obrigações vencidas, clientes em risco e os próximos 7 dias.',
    dados: ['Clientes e tarefas guardados', 'Datas de vencimento', 'Obrigações fiscais'],
    resultado: 'Uma visão rápida do que precisa de atenção primeiro, com atalhos para criar clientes, tarefas e acessos.',
  },
  agenda: {
    titulo: 'Agenda',
    Icon: Calendar,
    resumo: 'Organiza o trabalho do escritório num calendário único, com tarefas e obrigações fiscais associadas a cada dia.',
    dados: ['Tarefas com vencimento', 'Obrigações fiscais', 'Clientes associados'],
    resultado: 'Calendário mensal com o trabalho diário e a lista do dia selecionado, sem perder prazos importantes.',
  },
  clientes: {
    titulo: 'Clientes 360',
    Icon: Users,
    resumo: 'Mantém a ficha operacional de cada cliente num único lugar: contactos, regime fiscal, responsável, alertas e notas.',
    dados: ['Nome e NIF do cliente', 'Contactos e responsável', 'Regimes e alertas'],
    resultado: 'Uma carteira centralizada e pesquisável, pronta para alimentar tarefas, obrigações e comunicação.',
  },
  tarefas: {
    titulo: 'Tarefas',
    Icon: CheckSquare,
    resumo: 'Transforma o trabalho do escritório numa lista clara: cria tarefas, atribui responsáveis, define prazos e acompanha o estado.',
    dados: ['Descrição e cliente', 'Prazo e prioridade', 'Responsável e categoria'],
    resultado: 'Kanban operacional com tarefas por fazer, em curso, concluídas ou atrasadas.',
  },
  obrigacoes: {
    titulo: 'Obrigações Fiscais',
    Icon: Calendar,
    resumo: 'Consulta os prazos fiscais dos clientes e acompanha o estado de cada obrigação para reduzir esquecimentos e atrasos.',
    dados: ['Clientes ativos', 'Regimes de IVA', 'Mês e ano de trabalho'],
    resultado: 'Tabela de vencimentos com obrigação, cliente, tipo e estado, atualizada a partir da carteira.',
  },
  comunicacao: {
    titulo: 'Comunicação',
    Icon: Mail,
    resumo: 'Cria modelos reutilizáveis e prepara comunicações para os clientes, com variáveis automáticas para nome e NIF.',
    dados: ['Modelos de mensagem', 'Destinatário e assunto', 'Corpo do email ou SMS'],
    resultado: 'Biblioteca de modelos, pré-visualização e histórico dos envios realizados.',
  },
  rentabilidade: {
    titulo: 'Rentabilidade',
    Icon: BarChart3,
    resumo: 'Percebe quanto tempo e custo cada cliente consome e compara esse esforço com a avença ou receita prevista.',
    dados: ['Tempo dedicado', 'Cliente e colaborador', 'Avença ou receita mensal'],
    resultado: 'Resumo de horas, custo interno, receita e margem estimada por cliente.',
  },
  actas: {
    titulo: 'Livro de Actas',
    Icon: FileText,
    resumo: 'Regista e organiza as actas do escritório e dos clientes, mantendo o histórico documental acessível e pesquisável.',
    dados: ['Cliente e tipo de acta', 'Data e título', 'Texto e participantes'],
    resultado: 'Livro de actas digital com consulta, edição e eliminação controlada dos registos.',
  },
  cofre: {
    titulo: 'Cofre de Acessos',
    Icon: Lock,
    resumo: 'Guarda referências de acessos do cliente com proteção local e registo de quem consultou cada entrada.',
    dados: ['Serviço ou entidade', 'Utilizador e segredo', 'Cliente associado'],
    resultado: 'Cofre protegido, com desbloqueio por palavra-passe e auditoria de visualizações.',
  },
};

export function GabineteGallery({ onOpen }: { onOpen: (tab: GabTab) => void }) {
  const dashboard = GABINET_INTROS.dashboard;
  const DashboardIcon = dashboard.Icon;
  const functions = GABINET_FUNCTIONS.filter((item) => item.id !== 'dashboard');

  return (
    <div className="min-h-[calc(100vh-140px)] overflow-y-auto bg-[#F8FAFC] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <p className="text-[10px] font-[800] uppercase tracking-[2px] text-[#0677FF]">Centro de operação</p>
          <h1 className="mt-1 text-[28px] font-[800] tracking-[-0.6px] text-[#0B1D2D] sm:text-[34px]">Gabinete</h1>
          <p className="mt-1.5 max-w-2xl text-[13.5px] font-[500] leading-relaxed text-slate-500">
            Escolhe por onde começar — cada função ajuda a organizar o escritório e fica sincronizada para toda a equipa.
          </p>
        </motion.div>

        {/* Função principal, no mesmo formato destacado do Perfil do Cliente. */}
        <motion.button
          type="button"
          onClick={() => onOpen('dashboard')}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="group mt-7 flex w-full items-center gap-4 rounded-[18px] border border-[#E2E8F0] bg-white p-5 text-left shadow-sm transition-all hover:border-[#0677FF]/50 hover:shadow-md sm:p-6"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#0677FF]/10">
            <DashboardIcon className="h-6 w-6 text-[#0677FF]" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-[800] leading-tight text-[#0B1D2D]">{dashboard.titulo}</h2>
            <p className="mt-0.5 text-[12.5px] font-[500] leading-relaxed text-slate-500">{dashboard.resumo}</p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-[#0677FF]" />
        </motion.button>

        <p className="mb-3 mt-8 text-[11px] font-[800] uppercase tracking-[1.5px] text-slate-400">Funções do Gabinete</p>
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {functions.map((item, i) => {
            const Icon = item.icon;
            const def = GABINET_INTROS[item.id];
            return (
              <motion.button
                key={item.id}
                type="button"
                onClick={() => onOpen(item.id)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.08 + i * 0.03 }}
                className="group flex flex-col rounded-[16px] border border-[#E2E8F0] bg-white p-[18px] text-left shadow-sm transition-all hover:border-[#0677FF]/50 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#0677FF]/10">
                    <Icon className="h-5 w-5 text-[#0677FF]" />
                  </div>
                  <h3 className="min-w-0 flex-1 break-words text-[14px] font-[800] leading-tight text-[#0B1D2D]">{def.titulo}</h3>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-[#0677FF]" />
                </div>
                <p className="mt-2.5 line-clamp-3 text-[12px] font-[500] leading-relaxed text-slate-500">{def.resumo}</p>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function GabineteIntro({ tab, onOpen, onBack }: { tab: GabTab; onOpen: () => void; onBack: () => void }) {
  const def = GABINET_INTROS[tab];
  const Icon = def.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex min-h-[calc(100vh-180px)] items-start justify-center overflow-y-auto bg-[#F8FAFC] px-4 py-8 sm:items-center sm:px-6"
    >
      <div className="w-full max-w-xl rounded-[24px] border border-[#E2E8F0] bg-white p-7 shadow-sm sm:p-9">
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-[#0677FF]/10">
            <Icon className="h-7 w-7 text-[#0677FF]" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-[800] uppercase tracking-[2px] text-[#6B7280]">Gabinete</p>
            <h1 className="text-[24px] font-[800] leading-tight tracking-[-0.5px] text-[#0B1D2D]">{def.titulo}</h1>
          </div>
        </div>

        <p className="mb-6 text-[14.5px] font-[500] leading-relaxed text-[#334155]">{def.resumo}</p>

        <div className="mb-7 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[14px] bg-[#F5F7FA] p-4">
            <h2 className="mb-2 text-[11px] font-[800] uppercase tracking-[1px] text-[#0677FF]">Vais precisar de</h2>
            <ul className="space-y-1.5">
              {def.dados.map((item) => (
                <li key={item} className="flex gap-2 text-[13px] font-[500] text-[#475569]">
                  <span className="font-[800] text-[#0677FF]">·</span>{item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[14px] bg-[#F5F7FA] p-4">
            <h2 className="mb-2 text-[11px] font-[800] uppercase tracking-[1px] text-[#0677FF]">No fim encontras</h2>
            <p className="text-[13px] font-[500] leading-relaxed text-[#475569]">{def.resultado}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpen}
            autoFocus
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-[12px] bg-[#0677FF] px-5 py-3.5 text-[15px] font-[800] text-white shadow-md shadow-[#0677FF]/25 transition-all hover:bg-[#0556CC] active:scale-[0.98]"
          >
            <Play className="h-4 w-4" strokeWidth={2.6} /> Abrir função
          </button>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-[12px] border border-[#E2E8F0] bg-white px-4 py-3.5 text-[13px] font-[700] text-[#64748B] transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Galeria
          </button>
        </div>
      </div>
    </motion.div>
  );
}
