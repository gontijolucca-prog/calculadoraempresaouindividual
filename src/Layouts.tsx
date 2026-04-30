import React, { useState } from 'react';
import {
  /* Layout 0 — Sidebar Pro (maroon) */
  UserCircle, Calculator, Car, Ticket, User, BarChart2, Home, Building, Banknote,
  /* Layout 1 — Top Bar Agency (navy/blue) */
  CircleUser, Percent, Truck, Tag, UserCheck, TrendingUp, Warehouse, Store, Wallet,
  /* Layout 2 — Studio Rail (emerald) */
  Contact, Hash, Gauge, Receipt, Activity, Landmark, Hotel, CreditCard,
  /* Layout 3 — App Bottom Bar (black/white) */
  UserRound, Divide, Fuel, BadgePercent, LineChart, Building2, School, Coins,
  /* Layout 4 — Overlay Zen (gold) */
  Crown, Globe, Target, PiggyBank, AreaChart,
  /* Shared */
  Info, Menu, X, ChevronRight
} from 'lucide-react';
import { cn } from './lib/utils';

type ViewType =
  | 'profile' | 'tax' | 'vehicle' | 'ticket' | 'selfss'
  | 'diagnostico' | 'imoveis' | 'imt' | 'salario' | 'legal';

export interface LayoutProps {
  view: ViewType;
  setView: (v: ViewType) => void;
  prevView: ViewType;
  openLegal: () => void;
  children: React.ReactNode;
}

/* ── Shared NAV metadata (labels only, icons per layout) ── */
const NAV_LABELS: { id: ViewType; label: string; short: string; group: 'profile' | 'sim' | 'tool' }[] = [
  { id: 'profile',     label: 'Perfil Cliente',           short: 'Perfil',      group: 'profile' },
  { id: 'tax',         label: 'Enquadramento Fiscal',     short: 'Fiscal',      group: 'sim' },
  { id: 'vehicle',     label: 'Viaturas Ligeiras',        short: 'Viaturas',    group: 'sim' },
  { id: 'ticket',      label: 'Ticket (Benefícios)',      short: 'Tickets',     group: 'sim' },
  { id: 'selfss',      label: 'Seg. Social Independente', short: 'SS Indep.',   group: 'sim' },
  { id: 'diagnostico', label: 'Diagnóstico de Autonomia', short: 'Diagnóstico', group: 'tool' },
  { id: 'imoveis',     label: 'Imóveis na Empresa',       short: 'Imóveis',     group: 'tool' },
  { id: 'imt',         label: 'Simulador IMT',            short: 'IMT',         group: 'tool' },
  { id: 'salario',     label: 'Salário Líquido',          short: 'Salário',     group: 'tool' },
];

/* ── 5 distinct icon sets (one per layout) ── */
type IconSet = Record<ViewType, React.ComponentType<{ className?: string }>>;
const ICON_SETS: IconSet[] = [
  /* 0 — Sidebar Pro */
  { profile: UserCircle, tax: Calculator, vehicle: Car, ticket: Ticket, selfss: User, diagnostico: BarChart2, imoveis: Home, imt: Building, salario: Banknote, legal: Info },
  /* 1 — Top Bar Agency */
  { profile: CircleUser, tax: Percent, vehicle: Truck, ticket: Tag, selfss: UserCheck, diagnostico: TrendingUp, imoveis: Warehouse, imt: Store, salario: Wallet, legal: Info },
  /* 2 — Studio Rail */
  { profile: Contact, tax: Hash, vehicle: Gauge, ticket: Receipt, selfss: Activity, diagnostico: AreaChart, imoveis: Landmark, imt: Hotel, salario: CreditCard, legal: Info },
  /* 3 — App Bottom Bar */
  { profile: UserRound, tax: Divide, vehicle: Fuel, ticket: BadgePercent, selfss: LineChart, diagnostico: Target, imoveis: Building2, imt: School, salario: Coins, legal: Info },
  /* 4 — Overlay Zen */
  { profile: Crown, tax: Globe, vehicle: Car, ticket: Ticket, selfss: UserCheck, diagnostico: TrendingUp, imoveis: Home, imt: Building, salario: PiggyBank, legal: Info },
];

function Logo({ strokeColor = '#333', accentColor = '#781D1D', className = 'w-8 h-8' }: {
  strokeColor?: string; accentColor?: string; className?: string;
}) {
  return (
    <svg viewBox="0 0 100 80" className={className} fill="none">
      <path d="M 45 10 A 30 30 0 0 0 45 70" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 30 45 L 42 58 L 65 25" stroke={accentColor} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LAYOUT 1 — SIDEBAR PRO  (classic hover-expand sidebar, maroon)
   ═══════════════════════════════════════════════════════════════════ */
export function SidebarLayout({ view, setView, prevView, openLegal, children }: LayoutProps) {
  const active = view === 'legal' ? prevView : view;
  const icons = ICON_SETS[0];

  return (
    <div className="h-full w-full flex bg-[#F8FAFC] text-slate-900 relative overflow-hidden">
      <div className="group absolute top-0 left-0 h-full z-50 flex shadow-2xl">
        <nav className="w-[64px] group-hover:w-[290px] h-full bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden">
          <div className="h-20 flex items-center px-4 w-[290px] shrink-0 border-b border-slate-100">
            <div className="w-8 h-8 flex items-center justify-center shrink-0 mr-4">
              <Logo accentColor="#781D1D" strokeColor="#333" />
            </div>
            <div className="flex-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
              <h1 className="text-[17px] font-[800] tracking-[-0.5px] text-[#333333]">RECOFATIMA</h1>
              <p className="text-[11px] tracking-[0.5px] text-[#781D1D] mt-[-2px] font-[600] capitalize">Contabilidade</p>
            </div>
          </div>

          <div className="flex flex-col gap-1 p-3 w-[290px] pt-4 flex-1 overflow-y-auto overflow-x-hidden">
            {(() => { const Icon = icons['profile']; return (
              <button onClick={() => setView('profile')}
                className={cn("flex items-center gap-3 px-3 py-3 rounded-[12px] transition-colors shrink-0",
                  active === 'profile' ? "bg-[#0F172A] text-white shadow-md" : "text-[#475569] hover:text-[#0F172A] hover:bg-[#0F172A]/10")}>
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span className="text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Perfil Cliente</span>
              </button>
            ); })()}

            <div className="border-t border-slate-200 my-2" />
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 px-1 pb-1">
              <span className="text-[9px] font-[800] uppercase tracking-[2px] text-slate-400">Simuladores</span>
            </div>

            {NAV_LABELS.filter(n => n.group === 'sim').map(({ id, label }) => {
              const Icon = icons[id];
              return (
                <button key={id} onClick={() => setView(id)}
                  className={cn("flex items-center gap-3 px-3 py-3 rounded-[12px] transition-colors shrink-0",
                    active === id ? "bg-[#781D1D] text-white shadow-md shadow-[#781D1D]/20" : "text-[#475569] hover:text-[#781D1D] hover:bg-[#781D1D]/10")}>
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  <span className="text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">{label}</span>
                </button>
              );
            })}

            <div className="border-t border-slate-200 my-2" />
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 px-1 pb-1">
              <span className="text-[9px] font-[800] uppercase tracking-[2px] text-slate-400">Ferramentas de Análise</span>
            </div>

            {NAV_LABELS.filter(n => n.group === 'tool').map(({ id, label }) => {
              const Icon = icons[id];
              return (
                <button key={id} onClick={() => setView(id)}
                  className={cn("flex items-center gap-3 px-3 py-3 rounded-[12px] transition-colors shrink-0",
                    active === id ? "bg-[#781D1D] text-white shadow-md shadow-[#781D1D]/20" : "text-[#475569] hover:text-[#781D1D] hover:bg-[#781D1D]/10")}>
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  <span className="text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">{label}</span>
                </button>
              );
            })}
          </div>

          <div className="p-4 w-[290px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 shrink-0">
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-[10px] text-slate-500 font-medium leading-relaxed">
              Dados atualizados conforme <strong>OE 2026</strong> aprovado • Abril 2026
            </div>
          </div>
        </nav>
      </div>

      <main className="flex-1 h-full ml-[64px] flex flex-col overflow-hidden relative">
        {view !== 'legal' && (
          <button onClick={openLegal} title="Base legal"
            className="absolute top-4 right-4 z-40 w-9 h-9 rounded-full bg-[#781D1D] text-white flex items-center justify-center shadow-lg hover:bg-[#5A1313] transition-colors">
            <Info size={16} />
          </button>
        )}
        {children}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LAYOUT 2 — TOP BAR AGENCY  (horizontal nav, dark navy, blue accent)
   ═══════════════════════════════════════════════════════════════════ */
export function TopBarLayout({ view, setView, prevView, openLegal, children }: LayoutProps) {
  const active = view === 'legal' ? prevView : view;
  const icons = ICON_SETS[1];

  return (
    <div className="h-full w-full flex flex-col bg-[#F0F4F8] text-slate-900 overflow-hidden">
      <header className="bg-[#111827] border-b border-[#1F2937] shrink-0 flex items-center px-4 gap-0 h-[52px] overflow-x-auto">
        <div className="flex items-center gap-2 mr-4 shrink-0">
          <Logo strokeColor="white" accentColor="#3B82F6" className="w-7 h-7" />
          <span className="text-[14px] font-[800] text-white tracking-[-0.3px]">RECOFATIMA</span>
        </div>

        <div className="h-5 w-px bg-[#374151] mx-3 shrink-0" />

        {(() => { const Icon = icons['profile']; return (
          <button onClick={() => setView('profile')}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-[600] transition-colors shrink-0",
              active === 'profile' ? "bg-white text-[#111827]" : "text-slate-400 hover:text-white hover:bg-[#1F2937]")}>
            <Icon className="w-4 h-4" />Perfil
          </button>
        ); })()}

        <div className="h-5 w-px bg-[#374151] mx-2 shrink-0" />
        <span className="text-[9px] font-[800] uppercase tracking-[2px] text-slate-500 mr-2 shrink-0">Sim.</span>

        {NAV_LABELS.filter(n => n.group === 'sim').map(({ id, short }) => {
          const Icon = icons[id];
          return (
            <button key={id} onClick={() => setView(id)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-[600] transition-colors mr-1 shrink-0",
                active === id ? "bg-[#3B82F6] text-white" : "text-slate-400 hover:text-white hover:bg-[#1F2937]")}>
              <Icon className="w-4 h-4" />{short}
            </button>
          );
        })}

        <div className="h-5 w-px bg-[#374151] mx-2 shrink-0" />
        <span className="text-[9px] font-[800] uppercase tracking-[2px] text-slate-500 mr-2 shrink-0">Análise</span>

        {NAV_LABELS.filter(n => n.group === 'tool').map(({ id, short }) => {
          const Icon = icons[id];
          return (
            <button key={id} onClick={() => setView(id)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-[600] transition-colors mr-1 shrink-0",
                active === id ? "bg-[#3B82F6] text-white" : "text-slate-400 hover:text-white hover:bg-[#1F2937]")}>
              <Icon className="w-4 h-4" />{short}
            </button>
          );
        })}

        <button onClick={openLegal} title="Base legal"
          className="ml-auto shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-[700] text-slate-400 hover:text-white hover:bg-[#1F2937] transition-colors border border-[#374151]">
          <Info className="w-4 h-4" />Legal
        </button>
      </header>

      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LAYOUT 3 — STUDIO RAIL  (permanent 72px left rail, emerald)
   ═══════════════════════════════════════════════════════════════════ */
export function RailLayout({ view, setView, prevView, openLegal, children }: LayoutProps) {
  const active = view === 'legal' ? prevView : view;
  const icons = ICON_SETS[2];

  return (
    <div className="h-full w-full flex bg-[#F0FDF4] text-slate-900 overflow-hidden">
      <nav className="w-[72px] h-full bg-[#064E3B] flex flex-col items-center shrink-0 overflow-y-auto py-3 gap-1">
        <div className="w-10 h-10 flex items-center justify-center mb-3 shrink-0">
          <Logo strokeColor="white" accentColor="#10B981" className="w-9 h-9" />
        </div>

        {(() => { const Icon = icons['profile']; return (
          <button onClick={() => setView('profile')}
            className={cn("relative w-full flex flex-col items-center py-2 transition-colors group/btn",
              active === 'profile' ? "text-white" : "text-emerald-300 hover:text-white")}>
            {active === 'profile' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-[#10B981] rounded-r-full" />}
            <div className={cn("w-10 h-10 rounded-[12px] flex items-center justify-center transition-colors",
              active === 'profile' ? "bg-[#065F46]" : "hover:bg-[#065F46]/60")}>
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-[700] mt-1 leading-none text-center px-1">Perfil</span>
          </button>
        ); })()}

        <div className="w-8 h-px bg-[#065F46] my-2 shrink-0" />

        {NAV_LABELS.filter(n => n.group === 'sim').map(({ id, short }) => {
          const Icon = icons[id];
          return (
            <button key={id} onClick={() => setView(id)}
              className={cn("relative w-full flex flex-col items-center py-2 transition-colors",
                active === id ? "text-white" : "text-emerald-300 hover:text-white")}>
              {active === id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-[#10B981] rounded-r-full" />}
              <div className={cn("w-10 h-10 rounded-[12px] flex items-center justify-center transition-colors",
                active === id ? "bg-[#10B981]" : "hover:bg-[#065F46]/60")}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-[700] mt-1 leading-none text-center px-1">{short}</span>
            </button>
          );
        })}

        <div className="w-8 h-px bg-[#065F46] my-2 shrink-0" />

        {NAV_LABELS.filter(n => n.group === 'tool').map(({ id, short }) => {
          const Icon = icons[id];
          return (
            <button key={id} onClick={() => setView(id)}
              className={cn("relative w-full flex flex-col items-center py-2 transition-colors",
                active === id ? "text-white" : "text-emerald-300 hover:text-white")}>
              {active === id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-[#10B981] rounded-r-full" />}
              <div className={cn("w-10 h-10 rounded-[12px] flex items-center justify-center transition-colors",
                active === id ? "bg-[#10B981]" : "hover:bg-[#065F46]/60")}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-[700] mt-1 leading-none text-center px-1">{short}</span>
            </button>
          );
        })}

        <button onClick={openLegal}
          className="mt-auto w-full flex flex-col items-center py-2 text-emerald-400 hover:text-white transition-colors shrink-0">
          <div className="w-10 h-10 rounded-[12px] flex items-center justify-center hover:bg-[#065F46]/60">
            <Info className="w-5 h-5" />
          </div>
          <span className="text-[9px] font-[700] mt-1">Legal</span>
        </button>
      </nav>

      <main className="flex-1 h-full overflow-hidden">
        {children}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LAYOUT 4 — BOTTOM APP BAR  (mobile-inspired, black + white)
   ═══════════════════════════════════════════════════════════════════ */
export function BottomBarLayout({ view, setView, prevView, openLegal, children }: LayoutProps) {
  const active = view === 'legal' ? prevView : view;
  const icons = ICON_SETS[3];
  const currentItem = NAV_LABELS.find(n => n.id === active);

  return (
    <div className="h-full w-full flex flex-col bg-white overflow-hidden">
      <header className="h-[44px] bg-white border-b border-slate-100 flex items-center px-5 shrink-0 gap-3">
        <Logo strokeColor="#111" accentColor="#111" className="w-6 h-6" />
        <span className="text-[13px] font-[800] text-black tracking-[-0.3px]">RECOFATIMA</span>
        {currentItem && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-[13px] font-[600] text-slate-500">{currentItem.label}</span>
          </>
        )}
        {view !== 'legal' && (
          <button onClick={openLegal}
            className="ml-auto w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:border-slate-400 hover:text-black transition-colors">
            <Info size={13} />
          </button>
        )}
      </header>

      <main className="flex-1 overflow-hidden">
        {children}
      </main>

      <nav className="h-[58px] bg-black border-t border-slate-800 flex items-center shrink-0 px-2 overflow-x-auto gap-0">
        {NAV_LABELS.map(({ id, short, group }) => {
          const Icon = icons[id];
          return (
            <React.Fragment key={id}>
              {group === 'tool' && id === 'diagnostico' && (
                <div className="h-5 w-px bg-slate-700 mx-1 shrink-0" />
              )}
              <button onClick={() => setView(id)}
                className={cn("flex flex-col items-center justify-center min-w-[56px] h-[46px] rounded-[10px] transition-colors mx-0.5 px-1 shrink-0",
                  active === id ? "bg-white" : "text-slate-400 hover:text-white hover:bg-slate-800")}>
                <Icon className={cn("w-4 h-4", active === id ? "text-black" : "")} />
                <span className={cn("text-[9px] font-[700] mt-0.5", active === id ? "text-black" : "")}>{short}</span>
              </button>
            </React.Fragment>
          );
        })}
      </nav>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LAYOUT 5 — OVERLAY ZEN  (hamburger + full-screen overlay, gold)
   ═══════════════════════════════════════════════════════════════════ */
export function OverlayLayout({ view, setView, prevView, openLegal, children }: LayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const active = view === 'legal' ? prevView : view;
  const icons = ICON_SETS[4];

  const navigate = (id: ViewType) => {
    setView(id);
    setMenuOpen(false);
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#F5F5F4] overflow-hidden relative">
      <header className="h-[52px] bg-[#1C1917] flex items-center px-5 shrink-0">
        <Logo strokeColor="#F5F5F4" accentColor="#D97706" className="w-7 h-7" />
        <span className="ml-3 text-[14px] font-[800] text-[#F5F5F4] tracking-[-0.3px]">RECOFATIMA</span>
        <span className="ml-3 text-[11px] font-[500] text-stone-400 uppercase tracking-[1px] hidden sm:block">Contabilidade</span>

        {view !== 'legal' && (
          <button onClick={openLegal}
            className="ml-auto mr-3 text-stone-400 hover:text-[#D97706] transition-colors flex items-center gap-1 text-[12px] font-[600]">
            <Info size={15} />
            <span className="hidden sm:inline">Legal</span>
          </button>
        )}

        <button onClick={() => setMenuOpen(o => !o)}
          className="w-9 h-9 flex items-center justify-center text-stone-300 hover:text-[#D97706] transition-colors">
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      <main className="flex-1 overflow-hidden">
        {children}
      </main>

      {menuOpen && (
        <div className="absolute inset-0 top-[52px] z-50 bg-[#1C1917] flex flex-col overflow-y-auto">
          <div className="max-w-2xl w-full mx-auto px-8 py-10 flex flex-col gap-2">

            {(() => { const Icon = icons['profile']; return (
              <button onClick={() => navigate('profile')}
                className={cn("flex items-center gap-4 py-4 px-5 rounded-[16px] text-left transition-colors group",
                  active === 'profile' ? "bg-[#D97706] text-white" : "text-stone-300 hover:bg-[#292524] hover:text-white")}>
                <Icon className="w-6 h-6 shrink-0" />
                <div>
                  <div className="text-[16px] font-[800]">Perfil Cliente</div>
                  <div className={cn("text-[12px] font-[400]", active === 'profile' ? "text-amber-100" : "text-stone-500")}>Dados do cliente e estimativas</div>
                </div>
              </button>
            ); })()}

            <div className="text-[10px] font-[800] uppercase tracking-[3px] text-stone-600 mt-4 mb-1 px-1">Simuladores</div>

            {NAV_LABELS.filter(n => n.group === 'sim').map(({ id, label }) => {
              const Icon = icons[id];
              return (
                <button key={id} onClick={() => navigate(id)}
                  className={cn("flex items-center gap-4 py-4 px-5 rounded-[16px] text-left transition-colors",
                    active === id ? "bg-[#D97706] text-white" : "text-stone-300 hover:bg-[#292524] hover:text-white")}>
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="text-[15px] font-[700]">{label}</span>
                </button>
              );
            })}

            <div className="text-[10px] font-[800] uppercase tracking-[3px] text-stone-600 mt-4 mb-1 px-1">Ferramentas de Análise</div>

            {NAV_LABELS.filter(n => n.group === 'tool').map(({ id, label }) => {
              const Icon = icons[id];
              return (
                <button key={id} onClick={() => navigate(id)}
                  className={cn("flex items-center gap-4 py-4 px-5 rounded-[16px] text-left transition-colors",
                    active === id ? "bg-[#D97706] text-white" : "text-stone-300 hover:bg-[#292524] hover:text-white")}>
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="text-[15px] font-[700]">{label}</span>
                </button>
              );
            })}

            <div className="text-[10px] text-stone-600 font-[500] mt-6 px-1">
              Dados atualizados conforme OE 2026 aprovado • Abril 2026
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LAYOUT INDEX
   ═══════════════════════════════════════════════════════════════════ */
export const LAYOUTS = [
  { id: 'sidebar',  name: 'Sidebar Pro',     component: SidebarLayout },
  { id: 'topbar',   name: 'Top Bar Agency',  component: TopBarLayout },
  { id: 'rail',     name: 'Studio Rail',     component: RailLayout },
  { id: 'bottom',   name: 'App Bottom Bar',  component: BottomBarLayout },
  { id: 'overlay',  name: 'Overlay Zen',     component: OverlayLayout },
] as const;
