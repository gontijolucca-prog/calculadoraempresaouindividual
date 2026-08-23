import { useEffect, useState } from 'react';
import { Lightbulb, X, Check } from 'lucide-react';
import { GUIAS, guiaDesativado, marcarGuiaDesativado, type ViewKey } from '../lib/guias';

/**
 * Sugestão de guia por página — substitui a oferta automática do AI Contabilista.
 *
 * O bot fica quieto; quem sugere é a própria página, discretamente:
 *   • pill fixa no canto superior direito ("Aprender esta página" + título);
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
    <div className="no-print fixed top-4 right-4 z-[70] flex items-start">
      <div className={`flex items-center gap-1 rounded-full bg-white/95 backdrop-blur border shadow-sm transition-all ${menu ? 'border-[#0677FF]/40 ring-2 ring-[#0677FF]/15' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'}`}>
        <button
          type="button"
          onClick={() => { setMenu(false); onStart(view); }}
          className="flex items-center gap-2 pl-3 pr-2 py-2 text-[12px] font-[700] text-[#0B1D2D] hover:text-[#0677FF] rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0677FF]"
          title={`Aprender a usar: ${g.titulo}`}
        >
          <Lightbulb className="w-4 h-4 text-[#0677FF]" />
          <span className="hidden sm:inline">Aprender esta página</span>
          <span className="sm:hidden">Guia</span>
        </button>
        <button
          type="button"
          onClick={() => setMenu(v => !v)}
          aria-label="Opções do guia"
          aria-expanded={menu}
          className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0677FF]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {menu && (
        <>
          <div className="fixed inset-0 z-[69]" onClick={() => setMenu(false)} aria-hidden="true" />
          <div className="absolute top-full right-0 mt-2 w-[320px] rounded-2xl bg-white border border-slate-200 shadow-2xl p-4 z-[71]">
            <div className="text-[10.5px] font-[800] uppercase tracking-[0.5px] text-slate-400">Sugestão de guia</div>
            <h4 className="mt-1 text-[14px] font-[800] text-slate-900">Aprender a usar {g.titulo}</h4>
            <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">{g.intro}</p>
            <div className="mt-3 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => { setMenu(false); onStart(view); }}
                className="flex items-center justify-center gap-1.5 rounded-[10px] bg-[#0677FF] text-white text-[12.5px] font-[700] px-3 py-2 hover:bg-blue-600 transition-colors"
              >
                Ver guia agora ({g.passos.length + 1} passos)
              </button>
              <button
                type="button"
                onClick={() => { marcarGuiaDesativado(view); setMenu(false); setSessaoOculta(true); }}
                className="flex items-center justify-center gap-1.5 rounded-[10px] border border-slate-200 text-slate-600 text-[12px] font-[700] px-3 py-2 hover:bg-slate-50 transition-colors"
                title="Esta página deixa de sugerir o guia. Podes voltar a ativar tudo no AI Contabilista (&quot;ativa os guias&quot;)."
              >
                <Check className="w-3.5 h-3.5" /> Não mostrar novamente
              </button>
              <button
                type="button"
                onClick={() => setMenu(false)}
                className="text-[11.5px] font-[600] text-slate-400 hover:text-slate-600 py-1 transition-colors"
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