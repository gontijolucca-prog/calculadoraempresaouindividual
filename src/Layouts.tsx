import React from 'react';
import {
  UserCircle, Calculator, Car, Ticket, User, BarChart2, Home, Building, Banknote, Info,
} from 'lucide-react';
import { cn } from './lib/utils';

type ViewType =
  | 'profile' | 'tax' | 'vehicle' | 'ticket' | 'selfss'
  | 'diagnostico' | 'imoveis' | 'imt' | 'salario' | 'legal' | 'updates';

export interface LayoutProps {
  view: ViewType;
  setView: (v: ViewType) => void;
  prevView: ViewType;
  openLegal: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { id: 'profile'    as ViewType, label: 'Perfil',      Icon: UserCircle, group: 'profile' },
  { id: 'tax'        as ViewType, label: 'Fiscal',       Icon: Calculator, group: 'sim'     },
  { id: 'vehicle'    as ViewType, label: 'Viaturas',     Icon: Car,        group: 'sim'     },
  { id: 'ticket'     as ViewType, label: 'Tickets',      Icon: Ticket,     group: 'sim'     },
  { id: 'selfss'     as ViewType, label: 'SS Indep.',    Icon: User,       group: 'sim'     },
  { id: 'diagnostico'as ViewType, label: 'Diagnóstico',  Icon: BarChart2,  group: 'tool'    },
  { id: 'imoveis'    as ViewType, label: 'Imóveis',      Icon: Home,       group: 'tool'    },
  { id: 'imt'        as ViewType, label: 'IMT',          Icon: Building,   group: 'tool'    },
  { id: 'salario'    as ViewType, label: 'Salário',      Icon: Banknote,   group: 'tool'    },
] as const;

function Logo({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 80" className={className} fill="none">
      <path d="M 45 10 A 30 30 0 0 0 45 70" stroke="#333333" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 30 45 L 42 58 L 65 25" stroke="#781D1D" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SidebarLayout({ view, setView, prevView, openLegal, children }: LayoutProps) {
  const active = view === 'legal' || view === 'updates' ? prevView : view;

  return (
    <div className="h-full w-full flex flex-col bg-[#F8FAFC] overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 shrink-0 flex items-center h-[52px] px-4 gap-0 overflow-x-auto shadow-sm">

        {/* Brand */}
        <div className="flex items-center gap-2.5 mr-3 shrink-0">
          <Logo />
          <div className="hidden sm:block">
            <div className="text-[14px] font-[800] text-[#1E293B] tracking-[-0.3px] leading-none">RECOFATIMA</div>
            <div className="text-[9px] font-[600] text-[#781D1D] uppercase tracking-[0.5px] leading-none mt-[2px]">Contabilidade</div>
          </div>
        </div>

        <div className="h-5 w-px bg-slate-200 mx-2 shrink-0" />

        {/* Profile button */}
        {NAV_ITEMS.filter(n => n.group === 'profile').map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[12px] font-[600] transition-colors shrink-0",
              active === id
                ? "bg-[#0F172A] text-white shadow-sm"
                : "text-slate-500 hover:text-[#0F172A] hover:bg-slate-100"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}

        <div className="h-5 w-px bg-slate-200 mx-2.5 shrink-0" />
        <span className="text-[9px] font-[800] uppercase tracking-[2px] text-slate-400 mr-2 shrink-0 hidden md:block">Simuladores</span>

        {/* Sim buttons */}
        {NAV_ITEMS.filter(n => n.group === 'sim').map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[12px] font-[600] transition-colors mr-1 shrink-0",
              active === id
                ? "bg-[#781D1D] text-white shadow-sm shadow-[#781D1D]/20"
                : "text-slate-500 hover:text-[#781D1D] hover:bg-[#781D1D]/8"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">{label}</span>
          </button>
        ))}

        <div className="h-5 w-px bg-slate-200 mx-2.5 shrink-0" />
        <span className="text-[9px] font-[800] uppercase tracking-[2px] text-slate-400 mr-2 shrink-0 hidden md:block">Análise</span>

        {/* Tool buttons */}
        {NAV_ITEMS.filter(n => n.group === 'tool').map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[12px] font-[600] transition-colors mr-1 shrink-0",
              active === id
                ? "bg-[#781D1D] text-white shadow-sm shadow-[#781D1D]/20"
                : "text-slate-500 hover:text-[#781D1D] hover:bg-[#781D1D]/8"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">{label}</span>
          </button>
        ))}

        {/* Info / Legal button */}
        {view !== 'legal' && view !== 'updates' && (
          <button
            onClick={openLegal}
            className="ml-auto shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[12px] font-[600] text-slate-500 hover:text-[#781D1D] hover:bg-[#781D1D]/8 transition-colors border border-slate-200"
          >
            <Info className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Legal</span>
          </button>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}

export const LAYOUTS = [
  { id: 'sidebar', name: 'Top Bar Maroon', component: SidebarLayout },
] as const;
