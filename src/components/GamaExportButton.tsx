import React, { useState } from 'react';
import { Copy, ExternalLink, Loader2, Presentation, Sparkles } from 'lucide-react';
import { buildGamaPrompt, generateGamaPresentation, isGamaConfigured, resolveGamaUrl } from '../lib/gama';
import type { OfficeSettings } from '../lib/officeSettings';
import type { HonorariosConfig } from '../lib/honorarios';

type GerarEstado =
  | { fase: 'idle' }
  | { fase: 'loading' }
  | { fase: 'done'; url: string }
  | { fase: 'error'; msg: string };

export default function GamaExportButton({ office, honorarios, cliente, onGoToOfficeSettings }: { office: OfficeSettings; honorarios?: HonorariosConfig; cliente?: { nome?: string; nif?: string }; onGoToOfficeSettings?: () => void }) {
  const [open,setOpen]=useState(false);
  const [incluiEquipa,setIncluiEquipa]=useState(true);
  const [incluiValores,setIncluiValores]=useState(true);
  const [incluiBeneficios,setIncluiBeneficios]=useState(true);
  const [obs,setObs]=useState('');
  const [copiado,setCopiado]=useState(false);
  const [gerar,setGerar]=useState<GerarEstado>({ fase: 'idle' });
  const prompt = buildGamaPrompt(office as never, honorarios as never, cliente, { equipa: incluiEquipa, valores: incluiValores, beneficios: incluiBeneficios, observacoes: obs });
  const apiDisponivel = isGamaConfigured(office.gammaApiKey);
  const aGerar = gerar.fase === 'loading';
  const copiar = async () => {
    try { await navigator.clipboard.writeText(prompt); setCopiado(true); setTimeout(()=>setCopiado(false),1800); } catch { /* fallback */ }
    window.open('https://gamma.app/create','_blank','noopener,noreferrer');
  };
  const gerarNoGama = async () => {
    if (aGerar) return;
    setGerar({ fase: 'loading' });
    try {
      const st = await generateGamaPresentation(prompt, office.gammaApiKey, { timeoutMs: 240000 });
      const url = resolveGamaUrl(st);
      if (!url) throw new Error('Gama: resposta sem link da apresentação.');
      setGerar({ fase: 'done', url });
      // Best effort: alguns browsers bloqueiam popups fora do clique direto — o
      // link "Abrir no Gama" abaixo funciona sempre como fallback.
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 200);
      setGerar({ fase: 'error', msg });
    }
  };
  return (
    <div>
      <button type="button" onClick={()=>setOpen(v=>!v)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#0F172A] text-white text-[13px] font-[700] hover:bg-black transition-colors">
        <Presentation className="w-4 h-4"/> Levar para o Gama
      </button>
      {open && (
        <div className="mt-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
          <p className="text-[12px] text-slate-600">Base fixa: Sobre nós, Digital, Âmbito, Investimento, Fecho. Escolhe o resto:</p>
          <label className="flex gap-2 text-[13px] mt-2"><input type="checkbox" checked={incluiEquipa} onChange={e=>setIncluiEquipa(e.target.checked)}/> Equipa</label>
          <label className="flex gap-2 text-[13px]"><input type="checkbox" checked={incluiValores} onChange={e=>setIncluiValores(e.target.checked)}/> Valores</label>
          <label className="flex gap-2 text-[13px]"><input type="checkbox" checked={incluiBeneficios} onChange={e=>setIncluiBeneficios(e.target.checked)}/> Benefícios</label>
          <textarea value={obs} onChange={e=>setObs(e.target.value)} placeholder="Observações livres (opcional)" className="w-full mt-2 px-3 py-2 rounded-lg border text-[13px]" rows={2}/>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={copiar} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0677FF] text-white text-[13px] font-[700]">{copiado ? 'Copiado ✓' : <><Copy className="w-4 h-4"/> Copiar + abrir Gama</>}</button>
            <a href="https://gamma.app/create" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-2 text-[12px] font-[600] text-[#0677FF]">Abrir Gama <ExternalLink className="w-3 h-3"/></a>
            {apiDisponivel && (
              <button type="button" onClick={gerarNoGama} disabled={aGerar} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F172A] text-white text-[13px] font-[700] hover:bg-black transition-colors disabled:opacity-60 disabled:cursor-wait">
                {aGerar ? <><Loader2 className="w-4 h-4 animate-spin"/> A gerar apresentação…</> : <><Sparkles className="w-4 h-4"/> Gerar no Gama</>}
              </button>
            )}
          </div>
          {aGerar && <p className="text-[11px] text-slate-500 mt-2">A criar o deck no Gama (1–2 min)… podes deixar esta janela aberta.</p>}
          {gerar.fase === 'done' && (
            <p className="text-[12px] text-emerald-700 font-[600] mt-2">
              Apresentação criada — <a href={gerar.url} target="_blank" rel="noopener noreferrer" className="underline">Abrir no Gama <ExternalLink className="w-3 h-3 inline"/></a> (abre em nova tab).
            </p>
          )}
          {gerar.fase === 'error' && (
            <p className="text-[12px] text-red-600 font-[600] mt-2">Geração falhou: {gerar.msg} — podes usar “Copiar + abrir Gama” e gerar manualmente.</p>
          )}
          {apiDisponivel
            ? <p className="text-[11px] text-slate-500 mt-2">Com key configurada, “Gerar no Gama” cria o deck automaticamente; sem ela, colas em “Paste text”.</p>
            : <p className="text-[11px] text-slate-500 mt-2">
                Cola no Gama em “Paste text”. Geração automática: configura a Gama API Key em Definições do Escritório → Integrações
                {onGoToOfficeSettings && <> · <button type="button" onClick={onGoToOfficeSettings} className="text-[#0677FF] font-[600] underline">Abrir Definições</button></>}.
              </p>}
          <details className="mt-2"><summary className="text-[12px] cursor-pointer">Ver prompt</summary><pre className="mt-2 p-3 bg-white rounded border text-[11px] whitespace-pre-wrap">{prompt}</pre></details>
        </div>
      )}
    </div>
  );
}
