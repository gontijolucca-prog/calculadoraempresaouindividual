import React, { useState, useRef, useEffect } from 'react';
import {
  UserCircle, Calculator, Car, Ticket, User, BarChart2, Home, Building, Banknote, Info,
  ClipboardList, Upload, LogOut, Receipt,
  ChevronDown, TrendingUp, Settings, UserPlus, Building2,
  Menu, X, Clock, Briefcase, ListOrdered, Package,
} from 'lucide-react';
import FloatingFlowToggle from './FloatingFlowToggle';
import { cn } from './lib/utils';
import type { AppMode } from './ModeSelector';

type ViewType =
  | 'profile' | 'tax' | 'vehicle' | 'ticket' | 'selfss'
  | 'diagnostico' | 'imoveis' | 'imt' | 'salario' | 'irs' | 'legal' | 'updates'
  | 'previsa' | 'office-settings' | 'empresas';

export interface LayoutProps {
  view: ViewType;
  setView: (v: ViewType) => void;
  prevView: ViewType;
  openLegal: () => void;
  openUpdates: () => void;
  onSAFTUpload?: (file: File) => void;
  onLogout?: () => void;
  hasSaftData?: boolean;
  onOpenSaftViewer?: () => void;
  mode: AppMode;
  onBackToModeSelection: () => void;
  onSelectMode: (m: AppMode) => void;
  children: React.ReactNode;
}

// Which simulator views are reachable from each mode (besides legal/updates which are always open).
const VIEWS_BY_MODE: Record<AppMode, ViewType[]> = {
  'novo-cliente': ['profile'],
  empresa: ['empresas', 'profile', 'tax', 'vehicle', 'ticket', 'selfss', 'imoveis', 'imt', 'salario', 'irs', 'diagnostico', 'previsa'],
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
  { id: 'previsa'    as ViewType, label: 'PreviSa',      Icon: TrendingUp,     group: 'sim' },
] as const;

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
  previsa: 'Simulador PreviSa — previsão de IRC (Modelo 22): apuramento Q07, matéria coletável Q09, tributações autónomas, PEC/PC e liquidação.',
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

export function SidebarLayout({ view, setView, prevView, openLegal, openUpdates, onSAFTUpload, onLogout, hasSaftData, onOpenSaftViewer, mode, onSelectMode, children }: LayoutProps) {
  const active = view === 'legal' || view === 'updates' ? prevView : view;
  const saftInputRef = useRef<HTMLInputElement>(null);
  const allowedViews = VIEWS_BY_MODE[mode];
  const simItems = NAV_ITEMS.filter(n => n.group === 'sim' && allowedViews.includes(n.id)) as unknown as typeof NAV_ITEMS[number][];
  const profileVisible = allowedViews.includes('profile');
  const isSimActive = simItems.some(s => s.id === active);

  // Gaveta no telemóvel + secção "Simuladores" colapsável (auto-abre no sim activo).
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [simOpen, setSimOpen] = useState<boolean>(isSimActive);
  useEffect(() => { if (isSimActive) setSimOpen(true); }, [isSimActive]);

  // Acções do Perfil migradas para a sidebar: a sidebar dispara custom events e
  // o ClientProfile responde. O flowMode actual chega aqui via bus global
  // "flowmode:change" para alternar o label "Vista simplificada" ↔ "Vista detalhada".
  const [profileFlowMode, setProfileFlowMode] = useState(true);
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ active: boolean }>).detail;
      setProfileFlowMode(!!detail?.active);
    };
    window.addEventListener('flowmode:change', onChange);
    return () => window.removeEventListener('flowmode:change', onChange);
  }, []);
  // Se a sidebar disparar a acção fora do Perfil, navegamos primeiro e damos
  // tempo ao ClientProfile montar antes do dispatch — senão o listener ainda
  // não existe e o evento perde-se.
  const fireProfileEvent = (name: string) => {
    const dispatch = () => window.dispatchEvent(new CustomEvent(name));
    if (active !== 'profile') {
      setView('profile');
      window.setTimeout(dispatch, 80);
    } else {
      dispatch();
    }
    setDrawerOpen(false);
  };
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
        {/* Selector de modo — directamente na sidebar */}
        <div className="mt-3 grid grid-cols-2 gap-1 p-1 rounded-[10px] bg-slate-100" role="group" aria-label="Modo de trabalho">
          {MODE_ORDER.map((m) => {
            const meta = MODE_META[m];
            const MIcon = meta.Icon;
            const on = m === mode;
            return (
              <button
                key={m}
                type="button"
                onClick={() => onSelectMode(m)}
                aria-pressed={on}
                className={cn(
                  'flex items-center justify-center gap-1.5 px-2 py-2 rounded-[8px] text-[11px] font-[700] whitespace-nowrap transition-colors',
                  on ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
                style={on ? { color: meta.color } : undefined}
              >
                <MIcon className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} /> {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <nav aria-label="Navegacao principal" className="flex-1 overflow-y-auto px-2 py-1">
        {mode === 'empresa' && (
          <>
            <SectionLabel>Carteira</SectionLabel>
            <NavItem label="Lista de Empresas" Icon={Briefcase} onClick={() => go('empresas')} current={active === 'empresas'} title="Carteira de empresas guardadas." />
          </>
        )}

        {profileVisible && (
          <>
            <SectionLabel>Cliente</SectionLabel>
            <NavItem label="Perfil do Cliente" Icon={UserCircle} onClick={() => go('profile')} current={active === 'profile'} title={NAV_TIPS.profile} />
            <div className="pl-3 mt-1 mb-2 space-y-0.5 border-l-2 border-slate-100">
              <NavItem
                label={profileFlowMode ? 'Vista detalhada' : 'Vista simplificada'}
                Icon={ListOrdered}
                onClick={() => fireProfileEvent('flowmode:toggle')}
                title={profileFlowMode ? 'Sair do flow guiado e ver todas as secções.' : 'Entrar no flow guiado em 6 passos.'}
              />
              <NavItem
                label="Exportar documentos"
                Icon={Package}
                onClick={() => fireProfileEvent('profile:openPackage')}
                title="Gerar pacote de documentos PDF (proposta + simulação) do cliente."
              />
            </div>
          </>
        )}

        {simItems.length > 0 && (
          <>
            <button type="button" onClick={() => setSimOpen(o => !o)} aria-expanded={simOpen} className="w-full flex items-center justify-between px-3 pt-4 pb-1.5 text-[10px] font-[800] uppercase tracking-[1.5px] text-slate-400 hover:text-slate-600 transition-colors">
              <span>Simuladores</span>
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', simOpen ? '' : '-rotate-90')} />
            </button>
            {simOpen && (
              <div className="space-y-0.5">
                {simItems.map(({ id, label, Icon }) => (
                  <React.Fragment key={id}>
                    <NavItem label={label} Icon={Icon} onClick={() => go(id)} current={active === id} title={NAV_TIPS[id]} />
                  </React.Fragment>
                ))}
              </div>
            )}
          </>
        )}

        <SectionLabel>Ferramentas</SectionLabel>
        <NavItem label="Atualizacoes" Icon={ClipboardList} onClick={() => runAction(openUpdates)} current={view === 'updates'} />
        {onSAFTUpload && (
          <NavItem label="Ler SAF-T" Icon={Upload} onClick={() => { saftInputRef.current?.click(); }} title="Importar ficheiro SAF-T" />
        )}
        {hasSaftData && onOpenSaftViewer && (
          <NavItem label="Ver dados SAF-T" Icon={Clock} onClick={() => runAction(onOpenSaftViewer)} />
        )}
        <NavItem label="Base Legal" Icon={Info} onClick={() => runAction(openLegal)} current={view === 'legal'} />
      </nav>

      <div className="border-t border-slate-100 px-2 py-2 space-y-0.5">
        <NavItem label="Definicoes do Escritorio" Icon={Settings} onClick={() => go('office-settings')} current={view === 'office-settings'} />
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
