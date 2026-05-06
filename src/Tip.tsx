import React, { useState, useRef, useCallback, useEffect, useId } from 'react';

interface TipProps {
  children: string;
}

/**
 * Tip is rendered inside parent <button> elements (nav items) — so it cannot itself
 * be a <button> (nested buttons are invalid HTML). It uses span+role=button with
 * tabIndex and keyboard handlers, and stops click propagation so the parent button
 * is not triggered when interacting with the tooltip.
 */
export function Tip({ children }: TipProps) {
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const [locked, setLocked] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();
  const TIP_W = 224; // w-56

  const compute = useCallback(() => {
    if (!triggerRef.current) return null;
    const r = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const above = r.top > 90;
    const top = above ? r.top - 8 : r.bottom + 8;
    let left = r.left + r.width / 2 - TIP_W / 2;
    left = Math.max(8, Math.min(left, vw - TIP_W - 8));
    return { top, left, above };
  }, []);

  const show = useCallback(() => {
    const p = compute();
    if (p) setPos(p);
  }, [compute]);

  const hide = useCallback(() => {
    if (!locked) setPos(null);
  }, [locked]);

  // Close on outside click and Escape when locked
  useEffect(() => {
    if (!locked) return;
    const dismiss = () => { setLocked(false); setPos(null); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismiss();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('click', dismiss);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', dismiss);
      document.removeEventListener('keydown', onKey);
    };
  }, [locked]);

  const toggle = useCallback(() => {
    if (locked) {
      setLocked(false);
      setPos(null);
    } else {
      const p = compute();
      if (p) { setPos(p); setLocked(true); }
    }
  }, [locked, compute]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toggle();
  }, [toggle]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.stopPropagation();
      e.preventDefault();
      toggle();
    }
  }, [toggle]);

  return (
    <>
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        onMouseEnter={() => { if (!locked) show(); }}
        onMouseLeave={() => { if (!locked) hide(); }}
        onFocus={() => { if (!locked) show(); }}
        onBlur={() => { if (!locked) hide(); }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label="Mais informação"
        aria-expanded={locked}
        aria-describedby={pos ? tipId : undefined}
        className="inline-flex items-center justify-center w-[15px] h-[15px] rounded-full bg-slate-200 text-slate-500 text-[9px] font-[800] cursor-help hover:bg-[#781D1D] hover:text-white transition-colors select-none ml-1.5 align-middle"
      >?</span>

      {pos && (
        <span
          id={tipId}
          role="tooltip"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: TIP_W, zIndex: 9999, pointerEvents: 'none',
            transform: pos.above ? 'translateY(-100%)' : 'translateY(0)' }}
        >
          <span className="block bg-[#0F172A] text-white text-[11px] font-[500] leading-relaxed rounded-[10px] px-3 py-2.5 shadow-2xl">
            {children}
          </span>
          <span className={`flex ${pos.above ? 'justify-start' : 'flex-col-reverse'}`}
            style={{ paddingLeft: Math.min(Math.max(0,
              (pos.left - (triggerRef.current?.getBoundingClientRect().left ?? 0) + (triggerRef.current?.getBoundingClientRect().width ?? 0) / 2 - 6)), TIP_W - 16) }}>
            {pos.above
              ? <span className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#0F172A]" />
              : <span className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-[#0F172A]" />
            }
          </span>
        </span>
      )}
    </>
  );
}
