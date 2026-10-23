import { useMemo, useState } from 'react';
import { Copy, ExternalLink, Presentation, X } from 'lucide-react';
import { buildGamaPrompt, GAMA_URL } from '../lib/gamaPrompt';
import type { OfficeSettings } from '../lib/officeSettings';
import type { HonorariosConfig } from '../lib/honorarios';
import type { DeckCliente } from '../lib/deck/build';

/**
 * Botão "Copiar para o Gamma" — traz de volta a cópia da proposta (estrutura
 * Ativiwise) que se usava antes do editor próprio. Só texto: sem API, sem
 * chave. O preço vem de `pricingFor()`, igual ao deck.
 */
export default function GamaCopyButton({
  office, honorarios, cliente,
}: {
  office: OfficeSettings;
  honorarios: HonorariosConfig;
  cliente: DeckCliente | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [equipa, setEquipa] = useState(true);
  const [valores, setValores] = useState(true);
  const [beneficios, setBeneficios] = useState(true);
  const [obs, setObs] = useState('');
  const [copiado, setCopiado] = useState(false);

  const prompt = useMemo(
    () => buildGamaPrompt(office, honorarios, cliente, {
      equipa, valores, beneficios, observacoes: obs,
    }),
    [office, honorarios, cliente, equipa, valores, beneficios, obs],
  );

  const copiar = () => {
    // Abrir a tab no próprio clique (evita bloqueio de popup).
    window.open(GAMA_URL, '_blank', 'noopener,noreferrer');
    const marcar = () => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(prompt).then(marcar).catch(() => copiarFallback(prompt, marcar));
    } else {
      copiarFallback(prompt, marcar);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto(v => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[12px] font-[700] text-[#334155] hover:border-[#0677FF]"
        title="Gerar o texto da proposta para colar no Gamma"
      >
        <Presentation className="w-4 h-4" /> Gamma
      </button>

      {aberto && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[340px] rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11.5px] leading-snug text-[#64748B]">
              Copia o texto e abre o Gamma em “Paste text”. Base fixa: Sobre nós, Digital, Âmbito, Investimento, Fecho.
            </p>
            <button type="button" onClick={() => setAberto(false)} className="p-1 rounded hover:bg-[#F5F7FA] text-[#94A3B8]" aria-label="Fechar">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-3 text-[12px] font-[600] text-[#334155]">
            <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={equipa} onChange={e => setEquipa(e.target.checked)} /> Equipa</label>
            <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={valores} onChange={e => setValores(e.target.checked)} /> Valores</label>
            <label className="inline-flex items-center gap-1.5"><input type="checkbox" checked={beneficios} onChange={e => setBeneficios(e.target.checked)} /> Benefícios</label>
          </div>

          <textarea
            value={obs}
            onChange={e => setObs(e.target.value)}
            rows={2}
            placeholder="Observações livres (opcional)"
            className="mt-2 w-full rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[12px]"
          />

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={copiar}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0677FF] px-3 py-1.5 text-[12px] font-[800] text-white hover:bg-[#0059c9]"
            >
              <Copy className="w-3.5 h-3.5" /> {copiado ? 'Copiado ✓' : 'Copiar + abrir Gamma'}
            </button>
            <a href={GAMA_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11.5px] font-[700] text-[#0677FF]">
              Abrir Gamma <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <details className="mt-2">
            <summary className="cursor-pointer text-[11.5px] font-[700] text-[#64748B]">Ver texto ({prompt.length} caracteres)</summary>
            <pre className="mt-1.5 max-h-[220px] overflow-auto whitespace-pre-wrap rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-2 text-[10.5px] leading-snug text-[#334155]">{prompt}</pre>
          </details>
        </div>
      )}
    </div>
  );
}

/** Copiar sem clipboard API (browsers antigos / contexto não seguro). */
function copiarFallback(texto: string, done: () => void): void {
  try {
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    done();
  } catch {
    /* sem cópia automática: o texto está visível em "Ver texto" */
  }
}
