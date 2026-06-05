import { createContext, useContext, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Save, Check } from 'lucide-react';

/**
 * Guardar simulação (Funcionalidade D) — torna os simuladores "não descartáveis".
 *
 * O App fornece este contexto: sabe qual o simulador ativo (view), o seu estado
 * e a empresa selecionada, por isso `save()` consegue fotografar a simulação
 * atual e gravá-la no histórico do cliente sem que cada simulador precise de
 * conhecer o registry. Um simulador pode, opcionalmente, publicar um resumo mais
 * preciso (o resultado calculado) via useReportResumo().
 */
export interface SimSaveCtx {
  /** Há empresa selecionada E estamos numa view de simulador. */
  enabled: boolean;
  /** Feedback transitório após guardar. */
  justSaved: boolean;
  /** Fotografa e grava a simulação atual no histórico do cliente. */
  save: () => void;
  /** Um simulador publica aqui o seu resumo-resultado (identidade estável). */
  reportResumo: (resumo: string) => void;
}

const Ctx = createContext<SimSaveCtx | null>(null);
export const SimulacaoSaveProvider = Ctx.Provider;
export function useSimulacaoSave(): SimSaveCtx | null {
  return useContext(Ctx);
}

/**
 * Hook para um simulador publicar o seu resumo-resultado (ex.: "Lda poupa
 * 4.200 €/ano"). Quando publicado, tem prioridade sobre o resumo derivado do
 * estado em summarizeSimulacao(). `reportResumo` tem identidade estável, por
 * isso o efeito só corre quando o resumo muda.
 */
export function useReportResumo(resumo: string): void {
  const ctx = useContext(Ctx);
  const report = ctx?.reportResumo;
  useEffect(() => {
    report?.(resumo);
  }, [report, resumo]);
}

/**
 * Botão flutuante (canto inferior direito) que guarda a simulação atual no
 * histórico do cliente ativo. Só aparece num simulador com empresa
 * selecionada — fica fora do caminho do FloatingFlowToggle (canto superior).
 */
export function SaveSimulacaoFab() {
  const ctx = useContext(Ctx);
  const show = !!ctx?.enabled;
  const saved = !!ctx?.justSaved;

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          onClick={() => ctx?.save()}
          title="Guardar esta simulação no histórico do cliente"
          aria-label="Guardar simulação"
          initial={{ opacity: 0, scale: 0.85, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 8 }}
          transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="fixed z-[60] flex items-center gap-2 px-4 py-2.5 text-[13px] font-[800] tracking-[-0.2px] text-white rounded-full"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)',
            right: 'calc(env(safe-area-inset-right, 0px) + 16px)',
            background: saved
              ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
              : 'linear-gradient(135deg, #0677FF 0%, #044BB6 100%)',
            boxShadow: saved
              ? '0 0 0 1px rgba(5,150,105,0.35), 0 8px 24px -6px rgba(5,150,105,0.55), 0 0 32px rgba(5,150,105,0.40)'
              : '0 0 0 1px rgba(6,119,255,0.35), 0 8px 24px -6px rgba(6,119,255,0.55), 0 0 32px rgba(6,119,255,0.45)',
          }}
        >
          <span
            aria-hidden
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' }}
          />
          {saved ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <Save className="w-4 h-4" strokeWidth={2.5} />}
          <span>{saved ? 'Guardada' : 'Guardar simulação'}</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
