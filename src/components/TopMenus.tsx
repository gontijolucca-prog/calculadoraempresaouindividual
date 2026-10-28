/**
 * Menus da barra de topo com dropdown em hover (desktop).
 * Inspirado em literaciafinanceira.pt: navegação horizontal, painel que abre
 * ao passar o rato, fecha com pequeno atraso e também funciona por teclado.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

export interface TopMenuItem {
  label: string;
  desc?: string;
  Icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  current?: boolean;
}
export interface TopMenuGroup {
  id: string;
  label: string;
  items: TopMenuItem[];
  current?: boolean;
  /** Abre direto (sem dropdown). */
  onClick?: () => void;
  width?: string;
}

export default function TopMenus({ groups }: { groups: TopMenuGroup[] }) {
  const [aberto, setAberto] = useState<string | null>(null);
  const fecharTimer = useRef<number | null>(null);

  const cancelarFecho = () => {
    if (fecharTimer.current) { window.clearTimeout(fecharTimer.current); fecharTimer.current = null; }
  };
  const abrir = (id: string) => { cancelarFecho(); setAberto(id); };
  const agendarFecho = () => {
    cancelarFecho();
    fecharTimer.current = window.setTimeout(() => setAberto(null), 180);
  };
  useEffect(() => () => cancelarFecho(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <nav aria-label="Menu principal" className="relative flex items-center gap-0.5">
      {groups.map((g) => {
        const temFilhos = g.items.length > 0;
        const ativo = g.current || g.items.some((i) => i.current);
        const abertoAgora = aberto === g.id;
        return (
          <div
            key={g.id}
            className="relative"
            onMouseEnter={() => { if (temFilhos) abrir(g.id); }}
            onMouseLeave={agendarFecho}
          >
            <button
              type="button"
              aria-haspopup={temFilhos ? 'menu' : undefined}
              aria-expanded={temFilhos ? abertoAgora : undefined}
              onClick={() => {
                if (!temFilhos) { g.onClick?.(); return; }
                setAberto(abertoAgora ? null : g.id);
              }}
              onFocus={() => { if (temFilhos) abrir(g.id); }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-[700] transition-colors',
                ativo ? 'bg-[#0F172A] text-white' : 'text-slate-700 hover:bg-slate-100 hover:text-[#0F172A]',
              )}
            >
              {g.label}
              {temFilhos && <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', abertoAgora && 'rotate-180')} aria-hidden="true" />}
            </button>

            {temFilhos && abertoAgora && (
              <div
                role="menu"
                aria-label={g.label}
                onMouseEnter={cancelarFecho}
                onMouseLeave={agendarFecho}
                className={cn(
                  'absolute left-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.16)]',
                  g.width || 'w-[420px]',
                )}
              >
                <div className={cn('grid gap-1', g.items.length > 6 ? 'grid-cols-2' : 'grid-cols-1')}>
                  {g.items.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      role="menuitem"
                      onClick={() => { setAberto(null); item.onClick(); }}
                      className={cn(
                        'flex items-start gap-2.5 rounded-xl px-3 py-2 text-left transition-colors',
                        item.current ? 'bg-[#0677FF]/10' : 'hover:bg-slate-50',
                      )}
                    >
                      {item.Icon && (
                        <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', item.current ? 'bg-[#0677FF] text-white' : 'bg-slate-100 text-slate-600')}>
                          <item.Icon className="h-4 w-4" />
                        </span>
                      )}
                      <span className="min-w-0">
                        <span className={cn('block truncate text-[13px] font-[700]', item.current ? 'text-[#0677FF]' : 'text-[#0F172A]')}>{item.label}</span>
                        {item.desc && <span className="mt-0.5 block text-[11.5px] leading-snug text-slate-500">{item.desc}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
