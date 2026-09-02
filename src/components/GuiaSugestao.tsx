import { useEffect, useState } from 'react';
import { X, Check, GraduationCap } from 'lucide-react';
import { GUIAS, type ViewKey } from '../lib/guias';
import { useHideOnScroll } from '../lib/useHideOnScroll';

/**
 * Sugestão de guia por página — sempre visível.
 *
 * O guia "Aprender esta página" fica sempre no canto inferior esquerdo
 * (gradiente #0B1D2D) e nunca desaparece — a cruz serve só para abrir/fechar
 * o menu de opções, nunca para esconder a pill.
 */
export default function GuiaSugestao({
  view,
  onStart,
  lift,
}: {
  view: ViewKey;
  /** Inicia a visita guiada desta página. */
  onStart: (v: ViewKey) => void;
  /** True quando a barra "Guardar cliente" está visível — levanta a pill
   *  para não a tapar (a barra é fixed no fundo no modo Novo Cliente). */
  lift?: boolean;
}) {
  const [menu, setMenu] = useState(false);
  // Esconde a pill durante o scroll ativo — deixa de tapar inputs/botões
  // enquanto se lê/navega; reaparece 700ms depois de parar.
  const scrollHidden = useHideOnScroll();

  const g = GUIAS[view];
  useEffect(() => { setMenu(false); }, [view]);

  if (!g) return null;

  return (
    // Abaixo de lg: CÍRCULO só-com-ícone, encaixado ao lado do botão do AI
    // Contabilista (cluster no canto inferior direito) — antes era uma pill
    // larga a bottom-20/right-[110px] que tapava inputs, botões e cartões
    // em ecrãs pequenos. Em lg+: pill completa como antes.
    // UMA classe bottom por breakpoint (evita conflito Tailwind):
    <div className={
      'no-print fixed z-[75] right-[84px] lg:right-[220px] transition-all duration-200 ' +
      (scrollHidden ? 'opacity-0 translate-y-3 pointer-events-none ' : '') +
      (lift
        ? 'bottom-40 sm:bottom-24'   // acima da barra "Guardar cliente"
        : 'bottom-5 lg:bottom-4')           // cluster normal no canto
    }>
      {/* Pill única ao lado do AI Contabilista — sem cruz, sempre visível.
          Abaixo de lg é um círculo compacto só com o ícone. */}
      <button
        type="button"
        onClick={() => setMenu(v => !v)}
        className="group flex items-center justify-center gap-2.5 w-11 h-11 lg:w-auto lg:h-auto lg:pl-4 lg:pr-3.5 lg:py-3 rounded-full text-white font-[800] text-[13.5px] tracking-tight shadow-[0_10px_30px_-6px_rgba(6,119,255,0.45)] hover:scale-[1.04] hover:shadow-[0_14px_36px_-6px_rgba(6,119,255,0.55)] transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        style={{ background: 'linear-gradient(135deg, #0B1D2D 0%, #0677FF 115%)' }}
        title={`Aprender a usar: ${g.titulo}`}
        aria-expanded={menu}
        aria-label="Aprender esta página — guia"
      >
        <span className="relative flex items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-amber-300/40 blur-[6px] animate-pulse" aria-hidden="true" />
          <GraduationCap className="w-5 h-5 text-amber-300 relative" />
        </span>
        <span className="hidden lg:inline">Aprender esta página</span>
        <span className="hidden md:inline-flex items-center gap-1 ml-1 rounded-full bg-white/15 border border-white/25 px-2 py-0.5 text-[9.5px] mono uppercase tracking-[1.5px] text-amber-200 font-[800]">
          Guia
        </span>
      </button>

      {menu && (
        <>
          <div className="fixed inset-0 z-[74]" onClick={() => setMenu(false)} aria-hidden="true" />
          <div className="absolute bottom-full right-0 mb-3 w-[340px] max-w-[calc(100vw-32px)] rounded-2xl bg-white border border-slate-200 shadow-2xl p-5 z-[76]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-[800] uppercase tracking-[0.5px] text-slate-400">Sugestão de guia</div>
                <h4 className="mt-1.5 text-[18px] font-[800] text-slate-900 leading-snug">Aprender a usar {g.titulo}</h4>
              </div>
              <button
                type="button"
                onClick={() => setMenu(false)}
                aria-label="Fechar"
                className="shrink-0 w-8 h-8 rounded-full border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-1.5 text-[14.5px] leading-[1.65] text-slate-600">{g.intro}</p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => { setMenu(false); onStart(view); }}
                className="flex items-center justify-center gap-2 rounded-[12px] bg-[#0677FF] text-white text-[13.5px] font-[800] px-4 py-2.5 hover:bg-blue-600 transition-colors"
              >
                <GraduationCap className="w-4 h-4" /> Ver guia agora ({g.passos.length + 1} passos)
              </button>
              <button
                type="button"
                onClick={() => setMenu(false)}
                className="flex items-center justify-center gap-1.5 rounded-[12px] border border-slate-200 text-slate-600 text-[13px] font-[700] px-4 py-2.5 hover:bg-slate-50 transition-colors"
              >
                <Check className="w-4 h-4" /> Fechar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}