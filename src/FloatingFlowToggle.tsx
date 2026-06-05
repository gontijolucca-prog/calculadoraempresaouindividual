import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ListOrdered, LayoutGrid } from 'lucide-react';

interface Props {
  /** Views onde o toggle deve aparecer. Outras views: invisível. */
  visibleViews: readonly string[];
  /** View atual da app. */
  currentView: string;
}

/**
 * Botão flutuante topo-direito que alterna Vista simplificada ↔ Vista detalhada
 * em qualquer simulador que use `useFlowMode`. Comunica via bus global de eventos
 * (`flowmode:change` / `flowmode:toggle`) — não precisa de prop-drilling.
 */
export default function FloatingFlowToggle({ visibleViews, currentView }: Props) {
  // Default alinhado com useFlowMode: vista detalhada (false).
  const [flowMode, setFlowMode] = useState(false);

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ active: boolean }>).detail;
      setFlowMode(!!detail?.active);
    };
    window.addEventListener('flowmode:change', onChange);
    return () => window.removeEventListener('flowmode:change', onChange);
  }, []);

  const show = visibleViews.includes(currentView);
  const Icon = flowMode ? LayoutGrid : ListOrdered;
  const label = flowMode ? 'Vista detalhada' : 'Vista simplificada';

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('flowmode:toggle'))}
          title={flowMode ? 'Sair do flow guiado e ver todas as secções.' : 'Entrar no flow guiado em 6 passos.'}
          aria-label={label}
          initial={{ opacity: 0, scale: 0.85, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: -8 }}
          transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="fixed z-[60] flex items-center gap-2 px-4 py-2.5 text-[13px] font-[800] tracking-[-0.2px] text-white rounded-full shadow-[0_8px_28px_-6px_#0677FFAA,0_0_0_1px_#0677FF33]"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
            right: 'calc(env(safe-area-inset-right, 0px) + 16px)',
            background: 'linear-gradient(135deg, #0677FF 0%, #044BB6 100%)',
            boxShadow: '0 0 0 1px rgba(6,119,255,0.35), 0 8px 24px -6px rgba(6,119,255,0.55), 0 0 32px rgba(6,119,255,0.45)',
          }}
        >
          <span
            aria-hidden
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' }}
          />
          <Icon className="w-4 h-4" strokeWidth={2.5} />
          <span>{label}</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
