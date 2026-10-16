import React, { useMemo, useState } from 'react';
import { ArrowRight, Presentation } from 'lucide-react';
import GamaExportButton from './components/GamaExportButton';
import type { OfficeSettings } from './lib/officeSettings';
import type { HonorariosConfig } from './lib/honorarios';
import { listEmpresas } from './lib/empresas';

interface Props {
  office: OfficeSettings;
  honorarios: HonorariosConfig;
  onGoToOfficeSettings?: () => void;
}

/**
 * Vista dedicada "Proposta Gamma" — a versão de escritório do fluxo que já
 * existe no pacote do cliente: escolhe-se o cliente (ou nenhum), o prompt é
 * construído a partir das Definições do Escritório + honorários e leva-se
 * para o gamma.app (copiar + abrir).
 */
export default function PropostaGamaView({ office, honorarios, onGoToOfficeSettings }: Props) {
  const empresas = useMemo(() => listEmpresas(), []);
  const [clienteId, setClienteId] = useState('');
  const cliente = empresas.find((e) => e.id === clienteId);
  const semDadosEscritorio = !office.nome?.trim();

  return (
    <div className="h-full overflow-y-auto bg-[#F5F7FA]">
      <div className="max-w-3xl mx-auto p-6 md:p-10 pb-32">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#0677FF]/10">
            <Presentation className="h-5 w-5 text-[#0677FF]" />
          </div>
          <div>
            <h1 className="text-[28px] md:text-[32px] font-[800] tracking-[-1px] text-[#0F172A] leading-tight">Proposta Gamma</h1>
            <p className="text-[13.5px] text-[#64748B] font-[500]">Gera a proposta do escritório e leva-a para o gamma.app — fica uma apresentação pronta a editar e enviar ao cliente.</p>
          </div>
        </div>

        {semDadosEscritorio && (
          <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-[10px] mb-5">
            <p className="text-[12px] text-amber-900 font-[600]">O escritório ainda não tem nome nas Definições — a proposta sai genérica.</p>
            {onGoToOfficeSettings && (
              <button type="button" onClick={onGoToOfficeSettings} className="inline-flex items-center gap-1 text-[12px] font-[700] text-[#0677FF] hover:underline">
                Preencher Definições do Escritório <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        <div className="bg-white rounded-[14px] border border-[#E2E8F0] p-5 md:p-6 space-y-5">
          <div>
            <label className="block text-[12px] font-[800] uppercase tracking-[1px] text-[#94A3B8] mb-1.5">Cliente (opcional)</label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full md:w-[380px] px-3 py-2 rounded-[10px] border border-[#CBD5E1] bg-white text-[13.5px] text-[#0F172A]"
            >
              <option value="">Sem cliente — proposta geral do escritório</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
            <p className="text-[12px] text-[#64748B] mt-1.5">Com cliente escolhido, a proposta fica com o nome e NIF dele; sem cliente, sai a versão geral do escritório.</p>
          </div>

          <div className="border-t border-[#E2E8F0] pt-4">
            <GamaExportButton
              office={office}
              honorarios={honorarios}
              cliente={cliente ? { nome: cliente.nome, nif: cliente.nif } : undefined}
            />
          </div>
        </div>

        <p className="mt-4 text-[12px] text-[#94A3B8] leading-relaxed">
          O texto é construído com os dados de Definições do Escritório (história, equipa, valores) e a tabela de honorários.
          No Gama, escolhe “Paste text”, cola e gera a apresentação — dá para editar tudo lá.
        </p>
      </div>
    </div>
  );
}
