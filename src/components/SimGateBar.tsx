import React from 'react';
import { AlertTriangle, Calculator } from 'lucide-react';
import { getMissingFields } from '../lib/simRequired';
import type { SimView } from '../lib/simSummary';

interface Props {
  view: SimView;
  state: unknown;
  simulated: boolean;
  onSimulate: () => void;
}

export function RequiredMark() {
  return <span className="text-red-500 ml-1" aria-hidden="true">*</span>;
}

export function SimGateBar({ view, state, simulated, onSimulate }: Props) {
  const missing = getMissingFields(view, state);
  const ready = missing.length === 0;
  return (
    <div className="space-y-3">
      {!ready && (
        <div className="flex items-start gap-2 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-[12px] font-[600] leading-snug">
            Em falta: {missing.join(' · ')}
            <span className="block text-[11px] font-[500] text-amber-800 mt-0.5">Preenche os campos assinalados com <span className="text-red-500">*</span> para simular.</span>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={onSimulate}
        disabled={!ready}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-[10px] px-4 py-3 text-[14px] font-[800] transition-colors ${ready ? 'bg-[#0F172A] text-white hover:bg-black' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
      >
        <Calculator className="h-4 w-4" />
        {simulated && ready ? 'Atualizar simulação' : 'Simular'}
      </button>
      {!simulated && ready && (
        <p className="text-center text-[11px] font-[600] text-slate-500">Carrega em Simular para ver os resultados.</p>
      )}
    </div>
  );
}

export function SimGatePlaceholder({ view, state, simulated }: { view: SimView; state: unknown; simulated: boolean }) {
  const missing = getMissingFields(view, state);
  const ready = missing.length === 0;
  if (!simulated) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[16px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-8 text-center">
        <div className="rounded-full bg-white p-4 shadow-sm mb-3"><Calculator className="h-6 w-6 text-slate-400" /></div>
        <p className="text-[14px] font-[700] text-slate-700">Preenche os dados e carrega em Simular</p>
        <p className="mt-1 text-[12px] font-[500] text-slate-500">Os resultados e o PDF ficam disponíveis após a simulação.</p>
        {!ready && <p className="mt-2 text-[11px] font-[600] text-amber-700">Em falta: {missing.join(' · ')}</p>}
      </div>
    );
  }
  if (!ready) {
    return (
      <div className="flex items-start gap-2 rounded-[12px] border border-amber-200 bg-amber-50 p-4 text-amber-900">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
        <p className="text-[13px] font-[600]">Completa os campos obrigatórios (<span className="text-red-500">*</span>) e volta a simular.</p>
      </div>
    );
  }
  return null;
}
