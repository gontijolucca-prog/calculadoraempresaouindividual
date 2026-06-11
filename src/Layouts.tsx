import React, { useState, useRef, useEffect } from 'react';
import {
  UserCircle, Calculator, Car, Ticket, User, BarChart2, Home, Building, Banknote, Info,
  ClipboardList, Upload, LogOut, Receipt,
  ChevronDown, ChevronRight, TrendingUp, Settings, UserPlus, Building2,
  Menu, X, Clock, Briefcase, ListOrdered, Package, History, FileDown,
} from 'lucide-react';
import FloatingFlowToggle from './FloatingFlowToggle';
import { requestOpenPackage, requestFlowToggle } from './lib/profileIntent';
import { cn } from './lib/utils';
import type { AppMode } from './ModeSelector';

type ViewType =
  | 'profile' | 'tax' | 'vehicle' | 'ticket' | 'selfss'
  | 'diagnostico' | 'imoveis' | 'imt' | 'salario' | 'irs' | 'legal'
  | 'previsa' | 'office-settings' | 'empresas' | 'historico' | 'exportar';

export interface LayoutProps {
  view: ViewType;
  setView: (v: ViewType) => void;
  prevView: ViewType;
  openLegal: () => void;
  onSAFTUpload?: (file: File) => void;
  onLogout?: () => void;
  hasSaftData?: boolean;
  onOpenSaftViewer?: () => void;
  mode: AppMode;
  onBackToModeSelection: () => void;
  onSelectMode: (m: AppMode) => void;
  /** Nome do cliente ativo — mostrado no indicador "A trabalhar em". */
  activeClientName?: string;
  /** Id do cliente ativo + navegação por cliente (a mesma função dos cartões).
   *  Permite mostrar o menu do cliente (Perfil, Pacote, Histórico, simuladores)
   *  por baixo do indicador "A trabalhar em". */
  currentEmpresaId?: string | null;
  onNavigateClient?: (empId: string, view: ViewType, opts?: NavOpts) => void;
  /** Abre a vista Relatórios com um documento pré-selecionado. */
  onOpenRelatorios?: (docId: string) => void;
  children: React.ReactNode;
}

// Which simulator views are reachable from each mode (besides legal which is always open).
const VIEWS_BY_MODE: Record<AppMode, ViewType[]> = {
  'novo-cliente': ['profile'],
  empresa: ['empresas', 'profile', 'historico', 'tax', 'vehicle', 'ticket', 'selfss', 'imoveis', 'imt', 'salario', 'irs', 'diagnostico', 'previsa'],
};

const MODE_META: Record<AppMode, { label: string; Icon: typeof Building2; color: string; soft: string }> = {
  'novo-cliente': { label: 'Novo Cliente', Icon: UserPlus, color: '#B45309', soft: '#FEF3C7' },
  empresa:       { label: 'Empresas',      Icon: Building2, color: '#0B1D2D', soft: '#E2E8F0' },
};

// Ordem dos modos no seletor da sidebar.
const MODE_ORDER: AppMode[] = ['novo-cliente', 'empresa'];

const NAV_ITEMS = [
  { id: 'empresas'   as ViewType, label: 'Lista de Empresas', Icon: Briefcase,  group: 'carteira' },
  { id: 'profile'    as ViewType, label: 'Perfil',      Icon: UserCircle, group: 'profile' },
  { id: 'tax'        as ViewType, label: 'Fiscal',       Icon: Calculator, group: 'sim'     },
  { id: 'vehicle'    as ViewType, label: 'Viaturas',     Icon: Car,        group: 'sim'     },
  { id: 'ticket'     as ViewType, label: 'Tickets',      Icon: Ticket,     group: 'sim'     },
  { id: 'selfss'     as ViewType, label: 'SS Indep.',    Icon: User,       group: 'sim'     },
  { id: 'diagnostico'as ViewType, label: 'Diagnóstico',  Icon: BarChart2,  group: 'sim'     },
  { id: 'imoveis'    as ViewType, label: 'Imóveis',      Icon: Home,       group: 'sim'     },
  { id: 'imt'        as ViewType, label: 'IMT',          Icon: Building,   group: 'sim'     },
  { id: 'salario'    as ViewType, label: 'Salário',      Icon: Banknote,   group: 'sim'     },
  { id: 'irs'        as ViewType, label: 'IRS',          Icon: Receipt,    group: 'sim'     },
  { id: 'previsa'    as ViewType, label: 'Previsa',      Icon: TrendingUp,     group: 'sim' },
] as const;

/** Opções de navegação por cliente — mesma semântica dos cartões da Lista. */
type NavOpts = { openPackage?: boolean; toggleFlow?: boolean };

/** Menu do cliente ativo, replicado na sidebar por baixo de "A trabalhar em".
 *  Reaproveita exatamente a navegação dos cartões (navigateClient) para não
 *  divergir do comportamento da Lista de Empresas. */
// O histórico de simulações vive agora no dropdown de cada cartão da Lista de
// Empresas — o botão da sidebar foi removido (a view 'historico' mantém-se
// alcançável programaticamente).
const CLIENT_MENU: { view: ViewType; label: string; Icon: React.ComponentType<{ className?: string }>; opts?: NavOpts }[] = [
  { view: 'profile',   label: 'Perfil do Cliente',       Icon: UserCircle },
];
const SIM_MENU_SIDEBAR = NAV_ITEMS.filter((i) => i.group === 'sim');

const NAV_TIPS: Record<string, string> = {
  profile: 'Perfil do cliente em 6 passos: identificação, dados empresariais, fiscais & família, custos & investimento, viaturas/sócios/dívidas, objetivos & documentos. Alimenta todos os simuladores.',
  tax: 'Simulador fiscal: compara a carga de IRS/IRC entre ENI (recibos verdes) e Lda para a sua situação.',
  vehicle: 'Calcula o IVA recuperável na compra/manutenção de viaturas e a Tributação Autónoma sobre encargos.',
  ticket: 'Subsídio de alimentação em vales: isento de IRS e SS até ao limite legal. Calcula a poupança anual.',
  selfss: 'Segurança Social de Independente — contribuições à SS para trabalhadores a recibos verdes ou ENI.',
  diagnostico: 'Avalia a solidez da empresa em 5 pilares: autonomia financeira, tesouraria, rentabilidade, dependência e maturidade operacional.',
  imoveis: 'Guia de decisão: arrendar o imóvel à empresa vs. transferi-lo como entrada em espécie.',
  imt: 'Imposto Municipal sobre Transmissões: calcula o IMT e o Imposto de Selo na compra de imóveis.',
  salario: 'Calcula o salário líquido mensal de um trabalhador e o custo total para a empresa.',
  irs: 'Simulador de IRS anual (Modelo 3): rendimento coletável, escalões, IRS Jovem, deduções à coleta e benefício municipal — estima reembolso ou imposto a pagar.',
  previsa: 'Simulador Previsa — previsão de IRC (Modelo 22): apuramento Q07, matéria coletável Q09, tributações autónomas, PEC/PC e liquidação.',
};

function Logo({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <img
      src="/logo.svg"
      alt=""
      className={`${className} object-contain select-none shrink-0`}
      draggable={false}
      aria-hidden="true"
    />
  );
}

export function SidebarLayout({ view, setView, prevView, openLegal, onSAFTUpload, onLogout, hasSaftData, onOpenSaftViewer, mode, onSelectMode, activeClientName, currentEmpresaId, onNavigateClient, children , onOpenRelatorios}: LayoutProps) {
  const active = view === 'legal' ? prevView : view;
  const saftInputRef = useRef<HTMLInputElement>(null);

  // Gaveta no telemóvel. (Os menus do Cliente/Simuladores migraram para os
  // dropdowns dos cartões na Lista de Empresas.)
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const handleSAFTInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onSAFTUpload) onSAFTUpload(file);
    e.target.value = '';
  };

  const go = (v: ViewType) => { setView(v); setDrawerOpen(false); };
  const runAction = (fn?: () => void) => { if (fn) fn(); setDrawerOpen(false); };

  // Menu do cliente ativo ("A trabalhar em") é um dropdown que INICIA FECHADO.
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  // Dropdown "Relatórios" — também inicia fechado.
  const [relatoriosOpen, setRelatoriosOpen] = useState(false);

  // Navega dentro do cliente ativo usando a MESMA função dos cartões da Lista
  // (seleciona empresa + dispara intenções pacote/vista + muda de vista), para
  // o menu da sidebar e o dropdown do cartão nunca divergirem.
  const goClient = (v: ViewType, opts?: NavOpts) => {
    if (currentEmpresaId && onNavigateClient) onNavigateClient(currentEmpresaId, v, opts);
    else go(v);
    setDrawerOpen(false);
  };

  // Item compacto do menu do cliente (mais denso que o NavItem principal — são
  // até 14 entradas aninhadas sob o indicador "A trabalhar em").
  const ClientNavItem: React.FC<{
    label: string; Icon: React.ComponentType<{ className?: string }>;
    onClick: () => void; current?: boolean; title?: string;
  }> = ({ label, Icon, onClick, current, title }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-[7px] rounded-[8px] text-[12.5px] font-[600] transition-colors text-left',
        current ? 'bg-[#0677FF]/12 text-[#0677FF]' : 'text-slate-500 hover:text-[#0F172A] hover:bg-slate-100'
      )}
    >
      <Icon className="w-[15px] h-[15px] shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );

  const NavItem = ({ label, Icon, onClick, current, tone = 'default', title }: {
    label: string; Icon: React.ComponentType<{ className?: string }>;
    onClick: () => void; current?: boolean; tone?: 'default' | 'danger'; title?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[14px] font-[600] transition-colors text-left',
        current
          ? 'bg-[#0F172A] text-white shadow-sm'
          : tone === 'danger'
            ? 'text-slate-600 hover:text-red-700 hover:bg-red-50'
            : 'text-slate-600 hover:text-[#0F172A] hover:bg-slate-100'
      )}
    >
      <Icon className="w-[18px] h-[18px] shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="px-3 pt-4 pb-1.5 text-[10px] font-[800] uppercase tracking-[1.5px] text-slate-400">{children}</div>
  );

  const sidebar = (
    <div className="h-full flex flex-col bg-white">
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => go('profile')} className="flex items-center gap-2.5 rounded-[8px] hover:bg-slate-50 px-1 py-1 -mx-1 transition-colors" aria-label="Ir para o Perfil">
            <Logo className="w-9 h-9" />
            <div className="text-left leading-none">
              <div className="text-[14px] font-[800] text-[#0B1D2D] tracking-[-0.2px]">ESTUDO<span className="text-[#0677FF]">360°</span></div>
              <div className="text-[9px] font-[600] text-[#6B7280] uppercase tracking-[2px] mt-[3px]">Análise · Estratégia · Decisão</div>
            </div>
          </button>
          <button type="button" onClick={() => setDrawerOpen(false)} className="md:hidden p-1.5 rounded-[8px] text-slate-400 hover:bg-slate-100" aria-label="Fechar menu">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-2 py-1">
        <SectionLabel>Carteira</SectionLabel>
            <NavItem label="Lista de Empresas" Icon={Briefcase} onClick={() => { onSelectMode('empresa'); setDrawerOpen(false); }} current={active === 'empresas'} title="Carteira de clientes — cada um abre o seu menu (perfil, simuladores, histórico). Aqui também adicionas novas empresas." />
            <NavItem label="Relatórios" Icon={FileDown} onClick={() => setRelatoriosOpen(v => !v)} current={active === 'exportar'} title="Demonstrações financeiras, documentos de encerramento de contas e pacote do cliente." />
            {relatoriosOpen && (
              <div className="mt-0.5 ml-2.5 pl-2 border-l-2 border-slate-200 space-y-0.5">
                <ClientNavItem label="Demonstrações financeiras" Icon={FileDown}
                  onClick={() => { onOpenRelatorios?.('balanco'); setDrawerOpen(false); }}
                  title="Balanço, Demonstração de Resultados, Alterações no CP, Fluxos de Caixa e pacote completo." />
                <ClientNavItem label="Encerramento de contas" Icon={FileDown}
                  onClick={() => { onOpenRelatorios?.('acta'); setDrawerOpen(false); }}
                  title="Ata de Assembleia Geral, Previsa (Modelo 22 em Excel) e Declaração de Responsabilidade." />
                <ClientNavItem label="Pacote cliente" Icon={FileDown}
                  onClick={() => { onOpenRelatorios?.('simulacao'); setDrawerOpen(false); }}
                  title="Simulação Fiscal, Proposta de Honorários e Minuta de Contrato." />
              </div>
            )}
            {/* "A trabalhar em": deixa sempre claro o cliente ativo. Por baixo,
                o menu específico desse cliente (perfil, pacote, histórico e os
                simuladores) — atalho directo sem ter de abrir a lista. */}
            {activeClientName && (
              <div className="mt-1.5">
                <button
                  type="button"
                  onClick={() => setClientMenuOpen((v) => !v)}
                  aria-expanded={clientMenuOpen}
                  title={clientMenuOpen ? 'Fechar o menu do cliente' : 'Abrir o menu do cliente (perfil e simuladores)'}
                  className="group w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-left transition-all hover:brightness-[0.98] focus-visible:outline-none"
                  style={{
                    background: 'linear-gradient(135deg, rgba(6,119,255,0.12), rgba(6,119,255,0.04))',
                    boxShadow: 'inset 0 0 0 1px rgba(6,119,255,0.28)',
                  }}
                >
                  <span className="w-2 h-2 rounded-full bg-[#0677FF] shrink-0 animate-pulse" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[9px] font-[800] uppercase tracking-[1px] text-[#0677FF]">A trabalhar em</span>
                    <span className="block text-[13px] font-[700] text-[#0B1D2D] truncate">{activeClientName}</span>
                  </span>
                  <ChevronRight className={cn('w-4 h-4 text-[#0677FF]/50 shrink-0 transition-transform', clientMenuOpen && 'rotate-90')} aria-hidden="true" />
                </button>

                {/* Menu do cliente ativo — dropdown fechado por defeito. */}
                {clientMenuOpen && (
                <div className="mt-1 ml-2.5 pl-2 border-l-2 border-[#0677FF]/20 space-y-0.5">
                  {CLIENT_MENU.map((it) => (
                    <ClientNavItem
                      key={it.label}
                      label={it.label}
                      Icon={it.Icon}
                      onClick={() => goClient(it.view, it.opts)}
                      current={!it.opts && active === it.view}
                    />
                  ))}
                  <div className="px-3 pt-2 pb-1 text-[9px] font-[800] uppercase tracking-[1px] text-[#0677FF]/70">Simuladores</div>
                  {SIM_MENU_SIDEBAR.map((s) => (
                    <ClientNavItem
                      key={s.id}
                      label={s.label}
                      Icon={s.Icon}
                      onClick={() => goClient(s.id)}
                      current={active === s.id}
                      title={NAV_TIPS[s.id]}
                    />
                  ))}
                </div>
                )}
              </div>
            )}

        <SectionLabel>Ferramentas</SectionLabel>
        {onSAFTUpload && (
          <NavItem label="Ler SAF-T" Icon={Upload} onClick={() => { saftInputRef.current?.click(); }} title="Importar ficheiro SAF-T" />
        )}
        {hasSaftData && onOpenSaftViewer && (
          <NavItem label="Ver dados SAF-T" Icon={Clock} onClick={() => runAction(onOpenSaftViewer)} />
        )}
        <NavItem label="Base Legal" Icon={Info} onClick={() => runAction(openLegal)} current={view === 'legal'} />
      </nav>

      <div className="border-t border-slate-100 px-2 py-2 space-y-0.5">
        <NavItem label="Definições do Escritório" Icon={Settings} onClick={() => go('office-settings')} current={view === 'office-settings'} />
        {onLogout && <NavItem label="Sair" Icon={LogOut} onClick={() => runAction(onLogout)} tone="danger" />}
      </div>

      <input ref={saftInputRef} type="file" accept=".xml,text/xml,application/xml" className="sr-only" aria-hidden="true" tabIndex={-1} onChange={handleSAFTInputChange} />
    </div>
  );

  return (
    <div className="h-full w-full flex bg-[#F5F7FA]">
      <aside className={cn(
        'z-40 w-64 shrink-0 transition-transform duration-200 md:static md:translate-x-0',
        'fixed inset-y-0 left-0',
        drawerOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      )}>
        {sidebar}
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="md:hidden flex items-center gap-2 bg-white border-b border-slate-200 px-3 min-h-[52px] shrink-0">
          <button type="button" onClick={() => setDrawerOpen(true)} className="p-2 -ml-1 rounded-[8px] text-slate-600 hover:bg-slate-100" aria-label="Abrir menu" aria-expanded={drawerOpen}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Logo className="w-7 h-7" />
            <span className="text-[13px] font-[800] text-[#0B1D2D]">ESTUDO<span className="text-[#0677FF]">360°</span></span>
          </div>
        </div>

        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      <FloatingFlowToggle currentView={active} visibleViews={FLOW_VIEWS} />
    </div>
  );
}

const FLOW_VIEWS = ['profile','diagnostico','imoveis','imt','vehicle','salario','selfss','ticket','previsa','tax'] as const;

export const LAYOUTS = [
  { id: 'sidebar', name: 'Top Bar Maroon', component: SidebarLayout },
] as const;
