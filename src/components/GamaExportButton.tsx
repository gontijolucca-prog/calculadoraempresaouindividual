import React, { useState } from 'react';
import { ExternalLink, Loader2, Presentation, Settings as SettingsIcon } from 'lucide-react';
import { buildGamaPrompt, createGamaPresentation, pollGamaGeneration, resolveGamaUrl, isGamaConfigured } from '../lib/gama';
import type { OfficeSettings } from '../lib/officeSettings';
import type { HonorariosConfig } from '../lib/honorarios';

type Status = 'idle' | 'loading' | 'done' | 'error';

interface Props {
  office: OfficeSettings;
  honorarios?: HonorariosConfig;
  cliente?: { nome?: string; nif?: string };
  className?: string;
  onGoToSettings?: () => void;
}

export default function GamaExportButton({ office, honorarios, cliente, className, onGoToSettings }: Props) {
  const [status, setStatus] = useState<Status>('idle');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const configured = isGamaConfigured((office as unknown as { gammaApiKey?: string }).gammaApiKey);

  const handleClick = async () => {
    if (!configured) return;
    setStatus('loading');
    setError(null);
    setUrl(null);
    try {
      const prompt = buildGamaPrompt(office as unknown as Record<string, string>, honorarios as unknown as Record<string, unknown> | undefined, cliente);
      const apiKey = (office as unknown as { gammaApiKey?: string }).gammaApiKey;
      const { generationId } = await createGamaPresentation(prompt, apiKey);
      const final = await pollGamaGeneration(generationId, apiKey);
      const resolved = resolveGamaUrl(final);
      if (!resolved) throw new Error('Gama não devolveu URL da apresentação. Abre o Gama manualmente.');
      setUrl(resolved);
      setStatus('done');
      window.open(resolved, '_blank', 'noopener,noreferrer');
      try { await navigator.clipboard.writeText(resolved); } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  };

  if (!configured) {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className || ''}`}>
        <button
          type="button"
          onClick={() => onGoToSettings?.()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] border border-amber-200 bg-amber-50 text-amber-900 text-[12px] font-[700] hover:bg-amber-100 transition-colors"
          title="Configura a API key do Gama em Definições do Escritório"
        >
          <SettingsIcon className="w-3.5 h-3.5" />
          Configurar Gama API
        </button>
        <span className="text-[11px] text-[#64748B] max-w-[260px] leading-snug">
          Define a <code className="px-1 py-0.5 bg-slate-100 rounded text-[10px]">Gama API Key</code> em Definições do Escritório ou <code className="px-1 py-0.5 bg-slate-100 rounded text-[10px]">VITE_GAMMA_API_KEY</code>.
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className || ''}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={status === 'loading'}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[#0F172A] text-white text-[13px] font-[700] hover:bg-black disabled:opacity-60 disabled:cursor-wait transition-colors"
      >
        {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Presentation className="w-4 h-4" />}
        {status === 'loading' ? 'A gerar no Gama…' : status === 'done' ? 'Abrir no Gama' : 'Gerar apresentação no Gama'}
        {status === 'done' && url && <ExternalLink className="w-3.5 h-3.5 opacity-80" />}
      </button>
      {status === 'done' && url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[12px] font-[600] text-[#0677FF] hover:underline inline-flex items-center gap-1">
          Ver apresentação <ExternalLink className="w-3 h-3" />
        </a>
      )}
      {status === 'error' && error && (
        <span className="text-[11px] font-[600] text-red-600 max-w-[320px] leading-snug" title={error}>
          {error.slice(0, 180)}
        </span>
      )}
      <span className="text-[11px] text-[#94A3B8] hidden sm:inline">8–10 slides · editável no Gama</span>
    </div>
  );
}
