import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Ban } from 'lucide-react';
import { GUIAS, marcarGuiaDesativado, ViewKey } from '../lib/guias';

/**
 * Motor de visitas guiadas do Estudo 360 — controlado pelo AI Contabilista.
 *
 * Qualidade (alinhada com melhores práticas 2026 + WCAG 2.1 AA):
 * - role="dialog" + aria-modal + aria-labelledby/describedby no passo (SC 4.1.2)
 * - foco move-se para o tooltip ao abrir/cada passo e volta ao gatilho ao fechar (SC 2.4.3)
 * - foco preso dentro do tooltip (Tab/Shift+Tab) com Esc sempre a sair (SC 2.1.2/1.4.13)
 * - aria-live="polite" anuncia cada passo (SC 4.1.3)
 * - setas ←/→ navegam passos (teclado)
 * - prefers-reduced-motion respeitado (scroll sem animação)
 * - termina com "próxima ação" (guia.acao) — nunca acaba em beco
 * - contraste ≥4.5:1 nos textos do tooltip
 */

interface Rect { top: number; left: number; width: number; height: number; right: number; bottom: number }

function resolveTarget(alvo: { sel?: string; texto?: string }): HTMLElement | null {
  if (alvo.sel) return document.querySelector<HTMLElement>(alvo.sel);
  if (alvo.texto) {
    const t = alvo.texto.trim().toLowerCase();
    let best: HTMLElement | null = null;
    let bestLen = Infinity;
    document.querySelectorAll<HTMLElement>('*').forEach((el) => {
      if (el.closest('[data-guia-ignore]')) return;
      const tag = el.tagName.toLowerCase();
      if (['script', 'style', 'svg', 'path'].includes(tag)) return;
      const txt = el.textContent?.trim().toLowerCase() ?? '';
      const ph = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
        ? (el.placeholder ?? '').toLowerCase() : '';
      if ((txt.length > 0 && txt.includes(t)) || (ph.length > 0 && ph.includes(t))) {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        const len = txt.length || ph.length;
        if (len < bestLen) { best = el; bestLen = len; }
      }
    });
    return best;
  }
  return null;
}

function measure(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
}

const TIP_W = 340;

function tipPos(rect: Rect, vw: number, vh: number) {
  let x = rect.left + rect.width / 2 - TIP_W / 2;
  let y = rect.bottom + 14;
  if (y + 210 > vh) y = rect.top - 210 - 14;
  x = Math.max(12, Math.min(x, vw - TIP_W - 12));
  y = Math.max(12, Math.min(y, vh - 220));
  return { x, y };
}

const FOCUSABLE = 'button:not([disabled]):not([tabindex="-1"]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled])';

export default function GuiaSistema({
  view,
  iniciar,
  onEnd,
}: {
  view: ViewKey;
  iniciar?: { view: ViewKey; nonce: number } | null;
  /** Chamado quando o tour fecha (concluir/saltar/Esc). */
  onEnd?: (v: ViewKey) => void;
}) {
  const [tourView, setTourView] = useState<ViewKey | null>(null);
  const [passo, setPasso] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const [semAlvo, setSemAlvo] = useState(false); // passo sem alvo → tooltip centrado
  const timers = useRef<number[]>([]);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  const endedRef = useRef(false);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const reduzMovimento = typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Comando do bot: iniciar o tour
  useEffect(() => {
    if (!iniciar) return;
    clearTimers();
    prevFocus.current = document.activeElement as HTMLElement | null; // guardar o gatilho
    endedRef.current = false;
    setTourView(iniciar.view);
    setPasso(0);
  }, [iniciar?.nonce, clearTimers]); // eslint-disable-line react-hooks/exhaustive-deps

  const fechar = useCallback(() => {
    clearTimers();
    const v = tourView;
    setTourView(null);
    setPasso(0);
    // devolve o foco ao gatilho (SC 2.4.3) — uma única notificação
    if (v && !endedRef.current) {
      endedRef.current = true;
      onEnd?.(v);
    }
    const t = prevFocus.current;
    if (t && document.contains(t) && typeof (t as HTMLElement).focus === 'function') {
      (t as HTMLElement).focus();
    }
    prevFocus.current = null;
  }, [tourView, onEnd, clearTimers]);

  const guia = tourView ? GUIAS[tourView] : null;
  const passos = guia
    ? [{ titulo: guia.titulo, corpo: guia.intro, alvo: { sel: `[data-view="${tourView}"]` } }, ...guia.passos]
    : [];

  // Navegação do tour
  useEffect(() => {
    if (!guia || !tourView) return;
    clearTimers();
    setReady(false);
    setRect(null);
    setSemAlvo(false);

    const step = passos[passo];
    if (!step) { fechar(); return; }

    let tries = 0;
    const tryFind = () => {
      const el = resolveTarget(step.alvo);
      if (!el) {
        if (++tries < 6) { timers.current.push(window.setTimeout(tryFind, 180)); return; }
        // alvo não encontrado: no último passo fecha limpo (nunca fica preso invisível);
        // senão avança para o próximo sem bloquear
        if (passo >= passos.length - 1) {
          fechar();
          return;
        }
        // fallback de qualidade: mostra o passo com tooltip centrado (sem spotlight)
        setSemAlvo(true);
        setRect(null);
        setReady(true);
        timers.current.push(window.setTimeout(() => tooltipRef.current?.focus(), 60));
        return;
      }
      el.scrollIntoView({ block: 'center', behavior: reduzMovimento ? 'auto' : 'smooth' });
      timers.current.push(window.setTimeout(() => {
        setRect(measure(el));
        setReady(true);
        // foco para o tooltip (SC 2.4.3)
        timers.current.push(window.setTimeout(() => tooltipRef.current?.focus(), 60));
      }, 140));
    };
    timers.current.push(window.setTimeout(tryFind, 120));
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo, tourView]);

  // Reposiciona em scroll/resize
  useEffect(() => {
    if (!ready || !guia || !tourView) return;
    const onMove = () => {
      const step = passos[passo];
      if (!step) return;
      const el = resolveTarget(step.alvo);
      if (el) setRect(measure(el));
    };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [ready, passo, guia, tourView, passos]);

  // Teclado: Esc fecha · ←/→ navega · Tab preso no tooltip (foco em tooltip)
  useEffect(() => {
    if (!guia || !tourView) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const emInput = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
      if (e.key === 'Escape') { e.preventDefault(); fechar(); }
      else if (e.key === 'ArrowRight' && !emInput) { e.preventDefault(); setPasso((p) => Math.min(p + 1, passos.length - 1)); }
      else if (e.key === 'ArrowLeft' && !emInput) { e.preventDefault(); setPasso((p) => Math.max(0, p - 1)); }
      else if (e.key === 'Tab' && tooltipRef.current) {
        // focus trap (SC 2.1.2)
        const els = [...tooltipRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (els.length === 0) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [guia, tourView, passo, passos, fechar]);

  if (!guia || !tourView) return null;

  const total = passos.length;
  const step = passos[passo];
  const isLast = passo + 1 >= total;

  if (!step || !ready) return null;
  if (!rect && !semAlvo) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // quando semAlvo (fallback centrado), rect é null — nunca aceder a rect nestes casos
  const cx = rect ? rect.left + rect.width / 2 : vw / 2;
  const cy = rect ? rect.top + rect.height / 2 : vh / 2;
  const R = rect ? Math.max(rect.width, rect.height) / 2 + 30 : 0;
  const mask = semAlvo
    ? undefined
    : `radial-gradient(circle ${R}px at ${cx}px ${cy}px, transparent 0px, transparent ${R}px, black ${R + 70}px)`;
  const tip = semAlvo
    ? { x: Math.max(12, Math.min(vw / 2 - TIP_W / 2, vw - TIP_W - 12)), y: Math.max(12, Math.min(vh / 2 - 110, vh - 230)) }
    : tipPos(rect, vw, vh);

  return (
    <>
      {/* anúncio de passos para leitores de ecrã (SC 4.1.3) */}
      <div role="status" aria-live="polite" aria-atomic="true"
        className="sr-only">
        Passo {passo + 1} de {total}: {step.titulo}
      </div>

      <div className="fixed inset-0 z-[97] bg-slate-900/55"
        style={{ maskImage: mask, WebkitMaskImage: mask }} />
      {!semAlvo && rect && (
        <div className="fixed z-[98] pointer-events-none rounded-[14px] border-2 border-[#0677FF] shadow-[0_0_0_1px_rgba(2,60,120,.35),0_18px_50px_rgba(0,0,0,.35)]"
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} />
      )}
      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guia-titulo"
        aria-describedby="guia-corpo"
        tabIndex={-1}
        className="fixed z-[99] w-[340px] max-w-[calc(100vw-24px)] rounded-2xl bg-white border border-slate-200 shadow-2xl p-4 outline-none"
        style={{ left: tip.x, top: tip.y }}
      >
        <div className="flex items-center justify-between">
          <span id="guia-titulo" className="text-[10.5px] font-[800] uppercase tracking-[0.5px] text-[#0456C0]">Guia · {guia.titulo}</span>
          <span className="text-[11px] font-[700] text-slate-500" aria-label={`Passo ${passo + 1} de ${total}`}>
            Passo {passo + 1} de {total}
          </span>
        </div>
        <h3 className="mt-1 text-[15px] font-[800] text-slate-900">{step.titulo}</h3>
        <p id="guia-corpo" className="mt-1 text-[12.5px] leading-relaxed text-slate-700">{step.corpo}</p>
        {isLast && guia.acao && (
          <p className="mt-2 rounded-[10px] bg-[#0677FF]/8 border border-[#0677FF]/20 px-3 py-2 text-[12px] font-[700] text-[#0456C0]">
            → Agora experimenta: {guia.acao}
          </p>
        )}
        <div className="mt-3 flex items-center gap-1.5">
          <button type="button" onClick={() => setPasso((p) => Math.max(0, p - 1))} disabled={passo === 0}
            className="inline-flex items-center gap-1 rounded-[9px] border border-slate-200 text-slate-600 text-[12px] font-[700] px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0677FF] transition-all">
            <ChevronLeft className="w-3.5 h-3.5" /> Anterior
          </button>
          <div className="flex-1" />
          <button type="button"
            onClick={() => { if (tourView) marcarGuiaDesativado(tourView); fechar(); }}
            title="Deixar de sugerir este guia nesta página"
            className="inline-flex items-center gap-1 text-[12px] font-[700] text-slate-500 hover:text-red-600 px-2 py-1.5 rounded-[8px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0677FF]">
            <Ban className="w-3.5 h-3.5" /> Não mostrar novamente
          </button>
          <button type="button" onClick={fechar}
            className="text-[12px] font-[700] text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-[8px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0677FF]">
            Saltar
          </button>
          <button type="button"
            onClick={() => isLast ? fechar() : setPasso((p) => p + 1)}
            className="inline-flex items-center gap-1 rounded-[9px] bg-[#0677FF] text-white text-[12px] font-[700] px-3 py-1.5 hover:bg-blue-600 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0456C0] transition-all">
            {isLast ? 'Concluir' : 'Seguinte'} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}
