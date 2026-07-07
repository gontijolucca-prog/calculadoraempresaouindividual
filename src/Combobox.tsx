import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from './lib/utils';

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; hint?: string }[];
  placeholder?: string;
  className?: string;
  id?: string;
}

export function Combobox({ value, onChange, options, placeholder = 'Pesquisar...', className, id }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find(o => o.value === value);

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter(o =>
      o.label.toLowerCase().includes(q) ||
      o.value.toLowerCase().includes(q) ||
      (o.hint && o.hint.toLowerCase().includes(q))
    );
  }, [query, options]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlightIdx(-1);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (highlightIdx >= 0 && listRef.current) {
      const el = listRef.current.children[highlightIdx] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx]);

  const select = (val: string) => {
    onChange(val);
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && highlightIdx >= 0) { e.preventDefault(); select(filtered[highlightIdx].value); }
  };

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-[14px] py-[11px] bg-[#F5F7FA] border-2 border-[#E2E8F0] rounded-[8px] text-[14px] font-[600] text-[#0F172A] hover:border-[#94A3B8] transition-colors text-left"
      >
        <span className="truncate">
          {selected ? selected.label : <span className="text-[#94A3B8]">{placeholder}</span>}
        </span>
        <ChevronDown className={cn('w-4 h-4 text-[#64748B] shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border-2 border-[#E2E8F0] rounded-[10px] shadow-lg overflow-hidden">
          <div className="p-2 border-b border-[#F1F5F9]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setHighlightIdx(-1); }}
                onKeyDown={handleKeyDown}
                placeholder="Filtrar..."
                className="w-full pl-8 pr-8 py-2 bg-[#F5F7FA] border border-[#E2E8F0] rounded-[6px] text-[13px] focus:border-[#0677FF] outline-none"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <ul ref={listRef} className="max-h-[200px] overflow-y-auto">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-[13px] text-[#94A3B8]">Sem resultados</li>
            )}
            {filtered.map((o, i) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => select(o.value)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-[13px] transition-colors',
                    o.value === value ? 'bg-[#0677FF]/10 text-[#0677FF] font-[600]' : 'hover:bg-[#F5F7FA]',
                    i === highlightIdx && 'bg-[#F1F5F9]'
                  )}
                >
                  <span className="font-[500]">{o.label}</span>
                  {o.hint && <span className="ml-2 text-[#94A3B8] font-[400]">{o.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
          <div className="p-2 border-t border-[#F1F5F9] flex justify-end">
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-1 text-[12px] font-[600] text-[#64748B] hover:text-[#0F172A] transition-colors">
              Fechar
            </button>
          </div>
        </div>
      )}

      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </div>
  );
}
