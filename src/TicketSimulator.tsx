import React, { useMemo } from 'react';
import { calcTicketSavings } from './lib/pt2026';
import { Ticket, Euro, ShieldCheck, Calculator } from 'lucide-react';
import { cn } from './lib/utils';
import type { ClientProfile } from './ClientProfile';

interface TicketSimulatorState {
  employees: number;
  ticketValue: number;
  daysPerMonth: number;
  months: number;
}

interface Props {
  initialState: TicketSimulatorState;
  onStateChange: (state: TicketSimulatorState) => void;
  profile: ClientProfile;
}

export default function TicketSimulator({ initialState, onStateChange, profile }: Props) {
  const { employees, ticketValue, daysPerMonth, months } = initialState;

  const setState = (updates: Partial<TicketSimulatorState>) => {
    onStateChange({ ...initialState, ...updates });
  };

  const result = useMemo(() => {
    if (employees > 0 && ticketValue > 0 && daysPerMonth > 0 && months > 0) {
      return calcTicketSavings(employees, ticketValue, daysPerMonth, months);
    }
    return null;
  }, [employees, ticketValue, daysPerMonth, months]);

  const inputClass = "w-full pl-[16px] pr-[16px] py-[12px] bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[8px] text-[15px] font-[600] text-[#0F172A] focus:border-[#0F172A] transition-all outline-none";
  const labelClass = "block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[8px]";

  const ptEur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);

  return (
    <div className="h-full flex flex-col md:grid md:grid-cols-[400px_1fr] bg-[#F8FAFC] text-[#1E293B]">
      {/* Left Pane - Form */}
      <div className="bg-white border-r border-[#E2E8F0] overflow-y-auto p-6 md:p-[40px] flex flex-col gap-[32px] h-full">
        <div>
          <h2 className="text-[24px] font-[800] tracking-[-0.5px] text-[#0F172A]">Simulador Ticket</h2>
          <p className="text-[14px] text-[#64748B] font-[500] mt-[4px]">Cálculo de benefícios fiscais com tickets de refeição.</p>
        </div>

        <div className="space-y-[24px]">
          <div>
            <label className={labelClass}>Número de Empregados</label>
            <input
              type="number"
              min="0"
              value={employees}
              onChange={e => setState({ employees: parseInt(e.target.value) || 0 })}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Valor Diário do Ticket (€)</label>
            <div className="relative">
              <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={ticketValue}
                onChange={e => setState({ ticketValue: parseFloat(e.target.value) || 0 })}
                className={cn(inputClass, "pl-[40px]")}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Dias Úteis por Mês</label>
            <input
              type="number"
              min="0"
              max="31"
              value={daysPerMonth}
              onChange={e => setState({ daysPerMonth: parseInt(e.target.value) || 0 })}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Meses por Ano</label>
            <input
              type="number"
              min="1"
              max="12"
              value={months}
              onChange={e => setState({ months: parseInt(e.target.value) || 12 })}
              className={inputClass}
            />
          </div>

          <div className="p-5 border-2 border-[#E2E8F0] rounded-[16px] bg-[#F8FAFC]">
            <h3 className="text-[12px] font-[800] text-[#0F172A] mb-4">INFORMAÇÃO</h3>
            <p className="text-[13px] text-[#64748B] font-[500] leading-relaxed">
              Os tickets de refeição têm um limite de dedução de 60% para a empresa, com um máximo de 5€ por dia útil (ou 7€ em certos setores como hotelaria e construção).
            </p>
          </div>
        </div>
      </div>

      {/* Right Pane - Results */}
      <div className="p-6 md:p-[40px] overflow-y-auto h-full max-w-7xl mx-auto w-full flex flex-col gap-[32px]">
        <div>
          <h1 className="text-[32px] md:text-[40px] font-[800] leading-[1] md:tracking-[-1.5px] mb-[8px] text-[#0F172A]">Resultados Apurados</h1>
          <p className="text-[16px] text-[#64748B] mb-[8px]">Economia fiscal com tickets de refeição.</p>
        </div>

        {result && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-[24px]">
            {/* Savings Card */}
            <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-[24px] md:p-[32px] flex flex-col shadow-sm">
              <div className="flex items-center gap-[16px] mb-[24px]">
                <div className="bg-[#ECFDF5] text-[#10B981] p-[12px] rounded-[16px]">
                  <ShieldCheck className="w-[24px] h-[24px]" />
                </div>
                <h3 className="text-[18px] font-[700] text-[#0F172A]">Economia Fiscal Anual</h3>
              </div>

              <div className="text-[48px] md:text-[56px] font-[800] text-[#10B981] tracking-[-2px] mb-[32px]">
                {ptEur(result.savings)}
              </div>

              <div className="flex-1 space-y-0">
                <div className="flex justify-between py-[16px] border-b border-[#F1F5F9] text-[14px] items-center">
                  <span className="text-[#64748B] font-[600]">Custo Total dos Tickets</span>
                  <span className="font-[700] font-mono text-[#0F172A]">{ptEur(result.ticketCost)}</span>
                </div>
                <div className="flex justify-between py-[16px] border-b border-[#F1F5F9] text-[14px] items-center">
                  <span className="text-[#64748B] font-[600]">Custo Empresa (c/ SS)</span>
                  <span className="font-[700] font-mono text-[#0F172A]">{ptEur(result.salaryCost)}</span>
                </div>
              </div>

              <div className="mt-[32px] p-[16px] bg-[#F8FAFC] rounded-[12px] text-[12px] text-[#64748B] font-[500] leading-relaxed">
                Nota: Os tickets de refeição são um benefício dedutível para a empresa até ao limite legal, reduzindo o custo real com Segurança Social.
              </div>
            </div>

            {/* Details Card */}
            <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-[24px] md:p-[32px] flex flex-col shadow-sm">
              <div className="flex items-center gap-[16px] mb-[24px]">
                <div className="bg-[#EFF6FF] text-[#3B82F6] p-[12px] rounded-[16px]">
                  <Ticket className="w-[24px] h-[24px]" />
                </div>
                <h3 className="text-[18px] font-[700] text-[#0F172A]">Detalhes do Cálculo</h3>
              </div>

              <div className="flex-1 space-y-0">
                <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                  <span className="text-[#64748B] font-[600]">Empregados</span>
                  <span className="font-[700] font-mono text-[#0F172A]">{employees}</span>
                </div>
                <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                  <span className="text-[#64748B] font-[600]">Dias por Mês</span>
                  <span className="font-[700] font-mono text-[#0F172A]">{daysPerMonth}</span>
                </div>
                <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                  <span className="text-[#64748B] font-[600]">Meses</span>
                  <span className="font-[700] font-mono text-[#0F172A]">{months}</span>
                </div>
                <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                  <span className="text-[#64748B] font-[600]">Valor Dia</span>
                  <span className="font-[700] font-mono text-[#0F172A]">{ptEur(ticketValue)}</span>
                </div>
              </div>

              <div className="mt-[32px] p-[16px] bg-[#FEF3C7] rounded-[12px] text-[12px] text-[#92400E] font-[500] leading-relaxed">
                <strong>Informação:</strong> A Segurança Social da empresa sobre os tickets é calculada sobre o valor nominal à taxa de 23.75%.
              </div>
            </div>
          </div>
        )}

        {!result && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="bg-[#F1F5F9] p-6 rounded-full inline-block mb-4">
                <Ticket className="w-12 h-12 text-[#64748B]" />
              </div>
              <p className="text-[#64748B] text-[16px]">Preencha os dados para calcular a economia fiscal.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}