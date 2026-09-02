import { useEffect, useState } from 'react';

/**
 * True enquanto há scroll ativo — usado para ESCONDER temporariamente os
 * elementos flutuantes (AI Contabilista, pill do Guia) em vez de os deixar
 * tapar inputs/botões durante a leitura.
 *
 * O scroll relevante é o do contentor `#main-content` (a app usa layout de
 * painel com overflow interno, a janela não faz scroll). Reaparece ~700ms
 * depois de o scroll parar.
 */
export function useHideOnScroll(idleMs = 700): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let t: number | undefined;
    const onScroll = () => {
      setHidden(true);
      window.clearTimeout(t);
      t = window.setTimeout(() => setHidden(false), idleMs);
    };
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener('scroll', onScroll, opts);
    // O painel principal é que faz scroll (Layouts.tsx: main#main-content).
    const main = document.getElementById('main-content');
    main?.addEventListener('scroll', onScroll, opts);
    return () => {
      window.removeEventListener('scroll', onScroll, opts);
      main?.removeEventListener('scroll', onScroll, opts);
      window.clearTimeout(t);
    };
  }, [idleMs]);

  return hidden;
}
