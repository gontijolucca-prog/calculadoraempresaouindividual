import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { TOAST_EVENT, type ToastKind, type ToastPayload } from '../lib/toast';

interface Item { id: number; msg: string; kind: ToastKind }

/** Mostra os toasts globais (canto inferior direito, 3 no máximo). */
export function ToastHost() {
  const [items, setItems] = useState<Item[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    const onToast = (e: Event) => {
      const d = (e as CustomEvent<ToastPayload>).detail;
      if (!d?.msg) return;
      const id = ++seq.current;
      setItems(prev => [...prev.slice(-2), { id, msg: d.msg, kind: d.kind || 'ok' }]);
      window.setTimeout(() => setItems(prev => prev.filter(x => x.id !== id)), 2600);
    };
    window.addEventListener(TOAST_EVENT, onToast as EventListener);
    return () => window.removeEventListener(TOAST_EVENT, onToast as EventListener);
  }, []);

  if (items.length === 0) return null;

  return (
    <div aria-live="polite" aria-atomic="false" className="fixed bottom-4 right-4 z-[90] flex flex-col gap-2 pointer-events-none">
      {items.map(it => (
        <div
          key={it.id}
          role="status"
          className={`pointer-events-auto inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-[600] shadow-lg border animate-in slide-in-from-bottom-2 duration-200 ${
            it.kind === 'erro' ? 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]'
              : it.kind === 'info' ? 'bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]'
                : 'bg-[#0F172A] text-white border-[#0F172A]'
          }`}
        >
          {it.kind === 'erro' ? <AlertTriangle className="w-4 h-4 shrink-0" />
            : it.kind === 'info' ? <Info className="w-4 h-4 shrink-0" />
              : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span className="max-w-[420px]">{it.msg}</span>
        </div>
      ))}
    </div>
  );
}

export default ToastHost;
