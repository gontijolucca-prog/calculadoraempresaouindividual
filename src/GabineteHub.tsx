import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckSquare,
  LayoutDashboard,
  Lock,
  Play,
  Users,
  Table2,
  FileSpreadsheet,
} from 'lucide-react';

/** Tabs funcionais do Gabinete. `gallery` é apenas a porta de entrada visual. */
export type GabTab = 'dashboard' | 'mapa-controlo' | 'mapa-rh' | 'visao-geral' | 'equipa' | 'tarefas' | 'cofre';

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
  { id: 'dashboard', label: 'Quadro resumo obrigações', icon: Calendar, desc: 'JAN-DEZ por cliente: v Concluído · * Não concluído' },
  { id: 'mapa-controlo', label: 'Mapa de controlo', icon: Table2, desc: '7 fases · JAN-DEZ colorido - Doc. Falta -> Balancete' },
  { id: 'mapa-rh', label: 'Mapa RH', icon: Users, desc: '6 colunas RH - Salários, Ticket, IRS, DMR-AT/SS, Encargos' },
  { id: 'visao-geral', label: 'Visão geral', icon: LayoutDashboard, desc: 'Ficha 360' },
  { id: 'equipa', label: 'Equipa', icon: Users, desc: 'Funcionários' },
  { id: 'tarefas', label: 'Tarefas', icon: CheckSquare, desc: 'Lista por urgência e estado' },
  { id: 'cofre', label: 'Cofre', icon: Lock, desc: 'Acessos protegidos' },
];

/**
 * Informação mostrada antes de entrar em cada função — o equivalente do
 * `SIM_INTROS` dos simuladores. Mantém o Gabinete explicável para quem entra
 * pela primeira vez, em vez de aterrar diretamente num ecrã vazio.
 */
export const GABINET_INTROS: Record<GabTab, GabineteIntroDef> = {
  'mapa-rh': {
    titulo: 'Mapa RH',
    Icon: Users,
    resumo: '6 colunas de RH por mês: Salários, Ticket, Guia IRS/Retenções, DMR-AT, DMR-SS e Pagamentos Encargos (SS+Retenções). v/✕ com fundos verde/vermelho.',
    dados: ['Cliente + NIF', 'Mês e ano', '6 tipos RH com 2 estados (v/✕)'],
    resultado: 'Controlo mensal RH com filtros e exportação - por gabinete.',
  },
  'mapa-controlo': {
    titulo: 'Mapa de controlo contabilidade',
    Icon: Table2,
    resumo: '7 fases da contabilidade por cliente e por mês/trimestre: Gestão Doc., Vendas/Receb., Compras/Pagam., Salários, AFT, Rec. Bancária e Balancete. Cores vivas por fase; clica para alternar estado.',
    dados: ['Cliente + NIF', 'Ano e trimestre', '7 fases com 4 estados (v ✕)'],
    resultado: 'Controlo mensal/trim. com filtros, exportação e cores por fase - sincronizado por gabinete.',
  },
  dashboard: {
    titulo: 'Quadro resumo obrigações',
    Icon: Calendar,
    resumo: 'Quadro cliente × mês (JAN-DEZ): clica na célula para alternar v Concluído / ✕ Não concluído com fundo verde/vermelho. Filtra por cliente, gestor, ano e obrigação; expande/colapsa e exporta para Excel.',
    dados: ['Cliente + tipo de obrigação', 'Mês e ano', 'Estado (v/✕)'],
    resultado: 'Visão completa do cumprimento por cliente e mês, com filtros e exportação - guarda automaticamente em Firestore.',
  },
  'visao-geral': {
    titulo: 'Visão geral do cliente',
    Icon: LayoutDashboard,
    resumo: 'Ficha completa do cliente: dados, situação, alertas, assuntos, documentos, contactos e histórico.',
    dados: ['NIF e CAE', 'Gerentes e trabalhadores', 'Contactos e acessos'],
    resultado: 'Painel 360 com tudo o que precisas para trabalhar o cliente.',
  },
  equipa: {
    titulo: 'Equipa do gabinete',
    Icon: Users,
    resumo: 'Gere quem trabalha no gabinete: adiciona por email, define cargo e vê quem já tem acesso.',
    dados: ['Nome e email', 'Cargo', 'Estado do convite'],
    resultado: 'Equipa organizada pronta a associar a clientes.',
  },
  tarefas: {
    titulo: 'Tarefas',
    Icon: CheckSquare,
    resumo: 'Transforma o trabalho do escritório numa lista clara: cria tarefas, atribui responsáveis, define prazos e acompanha o estado.',
    dados: ['Título e cliente associado', 'Estado (por fazer/em curso/feito/concluído)', 'Prioridade (baixa/normal/alta/urgente)'],
    resultado: 'Lista operacional filtrável - sem Kanban, direta e sincronizada.',
  },
  cofre: {
    titulo: 'Cofre de Acessos',
    Icon: Lock,
    resumo: 'Guarda referências de acessos do cliente com proteção local e registo de quem consultou cada entrada.',
    dados: ['Serviço ou entidade', 'Utilizador e segredo', 'Cliente associado'],
    resultado: 'Cofre protegido com desbloqueio por palavra-passe e auditoria de visualizações.',
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
  const def = GABINET_INTROS[tab] ?? GABINET_INTROS.dashboard;
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
