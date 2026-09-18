import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { SimGateBar } from './SimGateBar';
import { SimulatorPrintButton } from '../SimulatorPrint';
import type { SimView } from '../lib/simSummary';

interface Props {
  title: string;
  subtitle?: string;
  view: SimView;
  state: unknown;
  simulated: boolean;
  ready: boolean;
  onSimulate: () => void;
  onBack: () => void;
  inputs: React.ReactNode;
  results: React.ReactNode;
}

export function SimTwoStep({ title, subtitle, view, state, simulated, ready, onSimulate, onBack, inputs, results }: Props) {
  if (!simulated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        className="min-h-full bg-[#F5F7FA] py-8 px-4 sm:px-6"
      >
        <div className="max-w-[640px] mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-[28px] md:text-[32px] font-[800] tracking-tight text-[#0F172A]">{title}</h1>
            {subtitle && <p className="text-[14px] font-[500] text-[#64748B] mt-1.5 max-w-[520px] mx-auto leading-relaxed">{subtitle}</p>}
            <p className="text-[11px] font-[700] uppercase tracking-wide text-[#94A3B8] mt-3">
              Campos com <span className="text-red-500">*</span> são obrigatórios
            </p>
          </div>

          <div className="bg-white rounded-[24px] border border-[#E2E8F0] shadow-sm p-6 md:p-8">
            <div data-print="form" className="space-y-6">
              {inputs}
            </div>

            <div className="mt-8 pt-6 border-t border-[#F1F5F9]">
              <SimGateBar view={view} state={state} simulated={simulated} onSimulate={onSimulate} />
            </div>
          </div>

          <p className="text-center text-[11px] text-[#94A3B8] mt-4">
            Cálculos indicativos — confirma com o teu CC.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      className="min-h-full bg-[#F5F7FA] py-8 px-4 sm:px-6"
    >
      <div className="max-w-[760px] mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-[28px] md:text-[32px] font-[800] tracking-tight text-[#0F172A]">Resultados</h2>
          <p className="text-[14px] font-[500] text-[#64748B] mt-1">{title} — simulação concluída</p>
        </div>

        <div className="space-y-5">
          {results}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center justify-center gap-2 rounded-[12px] border-2 border-[#E2E8F0] bg-white px-6 py-3 text-[14px] font-[700] text-[#475569] hover:border-[#0F172A] hover:text-[#0F172A] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar aos dados
          </button>
          {ready && (
            <div className="inline-flex justify-center">
              <SimulatorPrintButton />
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-[#94A3B8] mt-4">
          Podes ajustar os dados e voltar a simular a qualquer momento.
        </p>
      </div>
    </motion.div>
  );
}
