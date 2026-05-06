import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import {
  UserCircle, Calculator, Car, Ticket, User, BarChart2, Home, Building, Banknote, Info,
  ClipboardCheck, ClipboardList, Upload,
  ChevronDown,
} from 'lucide-react';
import { cn } from './lib/utils';
import { Tip } from './Tip';

type ViewType =
  | 'profile' | 'tax' | 'vehicle' | 'ticket' | 'selfss'
  | 'diagnostico' | 'imoveis' | 'imt' | 'salario' | 'ficha' | 'legal' | 'updates';

export interface LayoutProps {
  view: ViewType;
  setView: (v: ViewType) => void;
  prevView: ViewType;
  openLegal: () => void;
  openUpdates: () => void;
  onSAFTUpload?: (file: File) => void;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { id: 'profile'    as ViewType, label: 'Perfil',      Icon: UserCircle, group: 'profile' },
  { id: 'tax'        as ViewType, label: 'Fiscal',       Icon: Calculator, group: 'sim'     },
  { id: 'vehicle'    as ViewType, label: 'Viaturas',     Icon: Car,        group: 'sim'     },
  { id: 'ticket'     as ViewType, label: 'Tickets',      Icon: Ticket,     group: 'sim'     },
  { id: 'selfss'     as ViewType, label: 'SS Indep.',    Icon: User,       group: 'sim'     },
  { id: 'diagnostico'as ViewType, label: 'Diagnóstico',  Icon: BarChart2,  group: 'sim'     },
  { id: 'imoveis'    as ViewType, label: 'Imóveis',      Icon: Home,       group: 'sim'     },
  { id: 'imt'        as ViewType, label: 'IMT',          Icon: Building,   group: 'sim'     },
  { id: 'salario'    as ViewType, label: 'Salário',      Icon: Banknote,   group: 'sim'     },
  { id: 'ficha'      as ViewType, label: 'Ficha',        Icon: ClipboardCheck, group: 'sim' },
] as const;

const NAV_TIPS: Record<string, string> = {
  profile: 'Dados do cliente: situação fiscal, idade, faturação. Alimenta automaticamente todos os simuladores.',
  tax: 'Simulador fiscal: compara a carga de IRS/IRC entre ENI (recibos verdes) e Lda para a sua situação.',
  vehicle: 'Calcula o IVA recuperável na compra/manutenção de viaturas e a Tributação Autónoma sobre encargos.',
  ticket: 'Subsídio de alimentação em vales: isento de IRS e SS até ao limite legal. Calcula a poupança anual.',
  selfss: 'Segurança Social de Independente — contribuições à SS para trabalhadores a recibos verdes ou ENI.',
  diagnostico: 'Avalia a solidez da empresa em 5 pilares: autonomia financeira, tesouraria, rentabilidade, dependência e maturidade operacional.',
  imoveis: 'Guia de decisão: arrendar o imóvel à empresa vs. transferi-lo como entrada em espécie.',
  imt: 'Imposto Municipal sobre Transmissões: calcula o IMT e o Imposto de Selo na compra de imóveis.',
  salario: 'Calcula o salário líquido mensal de um trabalhador e o custo total para a empresa.',
  ficha: 'Ficha de Diagnóstico Fiscal e Empresarial: levantamento estruturado de 16 secções (identificação, atividade, IVA, custos, RH, SS, viaturas, sociedade, dívidas, objetivos) com referências cruzadas à Base Legal.',
};

function Logo({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 80" className={className} fill="none" aria-hidden="true" focusable="false">
      <path d="M 45 10 A 30 30 0 0 0 45 70" stroke="#333333" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 30 45 L 42 58 L 65 25" stroke="#781D1D" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Accessible menu dropdown. Trigger has aria-haspopup/aria-expanded; menu items
 * use role="menuitem"; ↑/↓ navigate between items, Home/End jump to ends,
 * Escape closes and returns focus to the trigger.
 */
function NavMenu({
  label,
  shortLabel,
  items,
  active,
  setView,
}: {
  label: string;
  shortLabel: string;
  items: typeof NAV_ITEMS[number][];
  active: ViewType;
  setView: (v: ViewType) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  const close = useCallback(() => setOpen(false), []);

  const openMenu = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
    setOpen(true);
  }, []);

  // Close on Escape, outside click; focus first item on open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    // Focus first item on next tick
    const t = window.setTimeout(() => itemRefs.current[0]?.focus(), 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
      window.clearTimeout(t);
    };
  }, [open, close]);

  const handleMenuKey = (e: React.KeyboardEvent, idx: number) => {
    const last = items.length - 1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      itemRefs.current[Math.min(idx + 1, last)]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      itemRefs.current[Math.max(idx - 1, 0)]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      itemRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      itemRefs.current[last]?.focus();
    } else if (e.key === 'Tab') {
      // Tab closes the menu naturally
      close();
    }
  };

  const handleTriggerKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMenu();
    }
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={handleTriggerKey}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-[8px] text-[12px] font-[600] transition-colors text-slate-500 hover:text-[#781D1D] hover:bg-[#781D1D]/8 border border-slate-200"
      >
        <span className="hidden md:block">{label}</span>
        <span className="hidden sm:block md:hidden">{shortLabel}</span>
        <ChevronDown className={`w-3 h-3 ml-1 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          className="fixed z-50 w-56 bg-white border border-slate-200 rounded-md shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          {items.map(({ id, label: itemLabel, Icon }, idx) => (
            <button
              key={id}
              ref={el => { itemRefs.current[idx] = el; }}
              type="button"
              role="menuitem"
              onClick={() => { setView(id); close(); }}
              onKeyDown={e => handleMenuKey(e, idx)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-left w-full text-[12px] font-[600] transition-colors",
                active === id
                  ? "bg-[#781D1D] text-white"
                  : "text-slate-500 hover:bg-[#781D1D]/8 hover:text-[#781D1D]"
              )}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span className="ml-3">{itemLabel} <Tip>{NAV_TIPS[id]}</Tip></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SidebarLayout({ view, setView, prevView, openLegal, openUpdates, onSAFTUpload, children }: LayoutProps) {
  const active = view === 'legal' || view === 'updates' ? prevView : view;
  const saftInputRef = useRef<HTMLInputElement>(null);

  const handleSAFTInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onSAFTUpload) onSAFTUpload(file);
    // Reset so the same file can be re-uploaded if needed
    e.target.value = '';
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#F8FAFC]">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 shrink-0 flex items-center min-h-[52px] px-3 gap-0 overflow-x-auto shadow-sm scrollbar-none" role="banner">
        <nav aria-label="Navegação principal" className="contents">

          {/* Brand — click navigates to Perfil */}
          <button
            type="button"
            onClick={() => setView('profile')}
            aria-label="Ir para o Perfil de Cliente"
            className="flex items-center gap-2 mr-2 shrink-0 rounded-[8px] hover:bg-slate-50 px-1 py-0.5 transition-colors"
          >
            <Logo />
            <div className="hidden sm:block text-left">
              <div className="text-[13px] font-[800] text-[#1E293B] tracking-[-0.3px] leading-none">RECOFATIMA</div>
              <div className="text-[9px] font-[600] text-[#781D1D] uppercase tracking-[0.5px] leading-none mt-[2px]">Contabilidade</div>
            </div>
          </button>

          <div className="h-5 w-px bg-slate-200 mx-2 shrink-0" aria-hidden="true" />

          {/* Profile button */}
          {NAV_ITEMS.filter(n => n.group === 'profile').map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-current={active === id ? 'page' : undefined}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-2 rounded-[8px] text-[12px] font-[600] transition-colors shrink-0",
                active === id
                  ? "bg-[#0F172A] text-white shadow-sm"
                  : "text-slate-500 hover:text-[#0F172A] hover:bg-slate-100"
              )}
            >
              <Icon className="w-4 h-4 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{label} <Tip>{NAV_TIPS[id]}</Tip></span>
            </button>
          ))}

          <div className="h-5 w-px bg-slate-200 mx-2 shrink-0" aria-hidden="true" />

          <NavMenu
            label="Simuladores"
            shortLabel="Sim"
            items={NAV_ITEMS.filter(n => n.group === 'sim') as unknown as typeof NAV_ITEMS[number][]}
            active={active}
            setView={setView}
          />

          {/* Action buttons: checklist + SAFT upload + Legal */}
          <div className="ml-auto shrink-0 flex items-center gap-1.5">
            {/* Checklist de Atualizações quick-access button */}
            <button
              type="button"
              onClick={openUpdates}
              aria-current={view === 'updates' ? 'page' : undefined}
              aria-label="Checklist de Atualizações"
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-2 rounded-[8px] text-[12px] font-[600] transition-colors border border-slate-200",
                view === 'updates'
                  ? "bg-[#781D1D] text-white border-[#781D1D]"
                  : "text-slate-500 hover:text-[#781D1D] hover:bg-[#781D1D]/8"
              )}
            >
              <ClipboardList className="w-4 h-4 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Atualizações</span>
            </button>

            {/* Hidden file input for SAFT */}
            <input
              ref={saftInputRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
              onChange={handleSAFTInputChange}
            />

            {onSAFTUpload && (
              <button
                type="button"
                onClick={() => saftInputRef.current?.click()}
                aria-label="Importar ficheiro SAF-T"
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-[8px] text-[12px] font-[600] text-slate-500 hover:text-[#781D1D] hover:bg-[#781D1D]/8 transition-colors border border-slate-200"
              >
                <Upload className="w-4 h-4 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Ler SAFT</span>
              </button>
            )}

            {view !== 'legal' && view !== 'updates' && (
              <button
                type="button"
                onClick={openLegal}
                aria-label="Abrir base legal"
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-[8px] text-[12px] font-[600] text-slate-500 hover:text-[#781D1D] hover:bg-[#781D1D]/8 transition-colors border border-slate-200"
              >
                <Info className="w-4 h-4 sm:w-3.5 sm:h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Legal</span>
              </button>
            )}
          </div>
        </nav>
      </header>

      {/* Main content (target of the skip link) */}
      <main id="main-content" tabIndex={-1} className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}

export const LAYOUTS = [
  { id: 'sidebar', name: 'Top Bar Maroon', component: SidebarLayout },
] as const;
