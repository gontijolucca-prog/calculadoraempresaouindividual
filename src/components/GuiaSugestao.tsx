import { useEffect, useState } from 'react';
import { Lightbulb, X, Check, GraduationCap } from 'lucide-react';
import { GUIAS, guiaDesativado, marcarGuiaDesativado, type ViewKey } from '../lib/guias';

/**
 * Sugestão de guia por página — substitui a oferta automática do AI Contabilista.
 *
 * O bot fica quieto; quem sugere é a própria página, discretamente mas com presença:
 *   • pill fixa no CANTO INFERIOR ESQUERDO (o canto direito é do AI Contabilista e
 *     do toggle de fluxo — aqui não tapa nada);
 *   • clique → inicia a visita guiada (onStart);
 *   • "✕" → esconde a sugestão durante a sessão (volta ao entrar na página);
 *   • "Não mostrar novamente" → desativa o guia desta página para sempre
 *     (reativável no AI Contabilista: "ativa os guias").
 * Se o guia já estiver desativado (localStorage estudo360:guias:off:<view>),
 * a sugestão não aparece de todo.
 */
export default function GuiaSugestao({
  view,
  onStart,
}: {
  view: ViewKey;
  /** Inicia a visita guiada desta página. */
  onStart: (v: ViewKey) => void;
}) {
  const [sessaoOculta, setSessaoOculta] = useState(false);
  const [menu, setMenu] = useState(false);

  const g = GUIAS[view];
  // Reinicia a ocultação da sessão ao mudar de página
  useEffect(() => { setSessaoOculta(false); setMenu(false); }, [view]);

  if (!g || guiaDesativado(view) || sessaoOculta) return null;

  return (
    <div className="no-print fixed bottom-5 left-5 md:left-[272px] z-[75]">
      {/* Botão principal — chamativo mas só ocupa o canto vazio */}
      <div className={`flex items-center rounded-full shadow-[0_10px_30px_-6px_rgba(6,119,255,0.45)] transition-all ${menu ? '' : 'hover:scale-[1.04] hover:shadow-[0_14px_36px_-6px_rgba(6,119,255,0.55)]'}`}>
        <button
          type="button"
          onClick={() => { setMenu(false); onStart(view); }}
          className="group flex items-center gap-2.5 pl-4 pr-3.5 py-3 rounded-full text-white font-[800] text-[13.5px] tracking-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          style={{ background: 'linear-gradient(135deg, #0B1D2D 0%, #0677FF 115%)' }}
          title={`Aprender a usar: ${g.titulo}`}
        >
          <span className="relative flex items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-amber-300/40 blur-[6px] animate-pulse" aria-hidden="true" />
            <GraduationCap className="w-5 h-5 text-amber-300 relative" />
          </span>
          <span className="hidden sm:inline">Aprender esta página</span>
          <span className="sm:hidden">Guia</span>
          <span className="hidden md:inline-flex items-center gap-1 ml-1 rounded-full bg-white/15 border border-white/25 px-2 py-0.5 text-[9.5px] mono uppercase tracking-[1.5px] text-amber-200 font-[800]">
            Guia
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMenu(v => !v)}
          aria-label="Opções do guia"
          aria-expanded={menu}
          className="self-stretch px-2.5 rounded-r-full text-white/70 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          style={{ background: 'linear-gradient(135deg, #0B1D2D 0%, #0677FF 115%)' }}
        >
          <X className={`w-4 h-4 transition-transform ${menu ? 'rotate-90' : ''}`} />
        </button>
      </div>

      {menu && (
        <>
          <div className="fixed inset-0 z-[74]" onClick={() => setMenu(false)} aria-hidden="true" />
          <div className="absolute bottom-full left-0 mb-3 w-[340px] max-w-[calc(100vw-32px)] rounded-2xl bg-white border border-slate-200 shadow-2xl p-5 z-[76]">
            <div className="text-[11px] font-[800] uppercase tracking-[0.5px] text-slate-400">Sugestão de guia</div>
            <h4 className="mt-1.5 text-[17px] font-[800] text-slate-900 leading-snug">Aprender a usar {g.titulo}</h4>
            <p className="mt-1.5 text-[14px] leading-[1.6] text-slate-600">{g.intro}</p>
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
                onClick={() => { marcarGuiaDesativado(view); setMenu(false); setSessaoOculta(true); }}
                className="flex items-center justify-center gap-1.5 rounded-[12px] border border-slate-200 text-slate-600 text-[13px] font-[700] px-4 py-2.5 hover:bg-slate-50 transition-colors"
                title="Esta página deixa de sugerir o guia. Podes voltar a ativar tudo no AI Contabilista (&quot;ativa os guias&quot;)."
              >
                <Check className="w-4 h-4" /> Não mostrar novamente
              </button>
              <button
                type="button"
                onClick={() => setMenu(false)}
                className="text-[12.5px] font-[600] text-slate-400 hover:text-slate-600 py-1 transition-colors"
              >
                Esconder por agora
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}