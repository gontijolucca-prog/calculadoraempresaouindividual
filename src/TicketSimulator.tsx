import React, { useMemo } from 'react';
import { calcTicketSavings } from './lib/pt2026';
import { Ticket, Euro, ShieldCheck, Calculator, AlertTriangle } from 'lucide-react';
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

  // Limite legal por setor — DL 133/2024
  const limiteSetor = (profile.setorTicket === 'hotelaria' || profile.setorTicket === 'construcao') ? 7 : 5;
  const excedeNorma = ticketValue > limiteSetor;

  // Valor dentro do limite (dedutível e isento de SS/IRS)
  const ticketValueDentroLimite = Math.min(ticketValue, limiteSetor);
  const ticketValueExcedente = Math.max(0, ticketValue - limiteSetor);

  const result = useMemo(() => {
    if (employees > 0 && ticketValue > 0 && daysPerMonth > 0 && months > 0) {
      // Calcula com o valor total e com o valor dentro do limite
      const total = calcTicketSavings(employees, ticketValue, daysPerMonth, months);
      const dentroLimite = calcTicketSavings(employees, ticketValueDentroLimite, daysPerMonth, months);
      return { total, dentroLimite };
    }
    return null;
  }, [employees, ticketValue, ticketValueDentroLimite, daysPerMonth, months]);

  const inputClass = "w-full pl-[16px] pr-[16px] py-[12px] bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[8px] text-[15px] font-[600] text-[#0F172A] focus:border-[#0F172A] transition-all outline-none";
  const labelClass = "block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[8px]";

  const ptEur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);
  const setorNome = { normal: 'Geral', construcao: 'Construção', hotelaria: 'Hotelaria/Restauração', outros: 'Outros' }[profile.setorTicket] || 'Geral';

  return (
    <div className="h-full flex flex-col md:grid md:grid-cols-[400px_1fr] bg-[#F8FAFC] text-[#1E293B]">
      {/* Left Pane - Form */}
      <div className="bg-white border-r border-[#E2E8F0] overflow-y-auto p-6 md:p-[40px] flex flex-col gap-[32px] h-full">
        <div>
          <h2 className="text-[24px] font-[800] tracking-[-0.5px] text-[#0F172A]">Simulador Ticket / Vales</h2>
          <p className="text-[14px] text-[#64748B] font-[500] mt-[4px]">Benefícios fiscais com tickets de refeição (DL 133/2024).</p>
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
                className={cn(inputClass, "pl-[40px]", excedeNorma && "border-amber-400 bg-amber-50/30")}
              />
            </div>
            {/* Limite legal chip */}
            <div className={cn(
              "mt-2 flex items-center gap-2 text-[12px] font-[600] px-3 py-1.5 rounded-[8px]",
              excedeNorma
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            )}>
              {excedeNorma
                ? <AlertTriangle size={13} />
                : <ShieldCheck size={13} />
              }
              Limite legal setor "{setorNome}": {ptEur(limiteSetor)}/dia
              {excedeNorma && ` — excedente de ${ptEur(ticketValueExcedente)} é tributável`}
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
            <h3 className="text-[12px] font-[800] text-[#0F172A] mb-4">REGRAS 2026 (DL 133/2024 + CIRC Art. 43.º)</h3>
            <ul className="text-[13px] text-[#64748B] font-[500] leading-relaxed space-y-2">
              <li>• Limite diário: <strong>€5,00</strong> (setor geral)</li>
              <li>• Limite diário: <strong>€7,00</strong> (hotelaria/construção)</li>
              <li>• Empresa deduz <strong>60%</strong> do custo total</li>
              <li>• Sem SS patronal sobre tickets (até ao limite)</li>
              <li>• Trabalhador: sem IRS nem SS até ao limite</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Right Pane - Results */}
      <div className="p-6 md:p-[40px] overflow-y-auto h-full max-w-7xl mx-auto w-full flex flex-col gap-[32px]">
        <div>
          <h1 className="text-[32px] md:text-[40px] font-[800] leading-[1] md:tracking-[-1.5px] mb-[8px] text-[#0F172A]">Resultados Apurados</h1>
          <p className="text-[16px] text-[#64748B] mb-[8px]">Economia fiscal com tickets de refeição — setor: <strong>{setorNome}</strong>.</p>
        </div>

        {/* Aviso excesso */}
        {excedeNorma && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-[20px] p-5 flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-[14px] font-[800] text-amber-900 mb-1">Valor acima do limite legal</h4>
              <p className="text-[13px] text-amber-800 font-[500] leading-relaxed">
                O valor diário de <strong>{ptEur(ticketValue)}</strong> excede o limite de <strong>{ptEur(limiteSetor)}/dia</strong> para o setor "{setorNome}".
                O excedente de <strong>{ptEur(ticketValueExcedente)}/dia</strong> fica sujeito a SS e IRS para o trabalhador e não é dedutível como benefício.
                Os cálculos abaixo mostram os resultados para o valor total e para o valor dentro do limite.
              </p>
            </div>
          </div>
        )}

        {result && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-[24px]">
            {/* Savings Card — valor total */}
            <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-[24px] md:p-[32px] flex flex-col shadow-sm">
              <div className="flex items-center gap-[16px] mb-[24px]">
                <div className="bg-[#ECFDF5] text-[#10B981] p-[12px] rounded-[16px]">
                  <ShieldCheck className="w-[24px] h-[24px]" />
                </div>
                <div>
                  <h3 className="text-[18px] font-[700] text-[#0F172A]">Poupança SS Anual</h3>
                  {excedeNorma && <span className="text-[11px] text-amber-600 font-[600]">Valor total (incl. excedente)</span>}
                </div>
              </div>

              <div className="text-[48px] md:text-[56px] font-[800] text-[#10B981] tracking-[-2px] mb-[32px]">
                {ptEur(result.total.savings)}
              </div>

              <div className="flex-1 space-y-0">
                <div className="flex justify-between py-[16px] border-b border-[#F1F5F9] text-[14px] items-center">
                  <span className="text-[#64748B] font-[600]">Custo Total dos Tickets</span>
                  <span className="font-[700] font-mono text-[#0F172A]">{ptEur(result.total.ticketCost)}</span>
                </div>
                <div className="flex justify-between py-[16px] border-b border-[#F1F5F9] text-[14px] items-center">
                  <span className="text-[#64748B] font-[600]">Equivalente em Salário (c/ SS)</span>
                  <span className="font-[700] font-mono text-[#0F172A]">{ptEur(result.total.salaryCost)}</span>
                </div>
                <div className="flex justify-between py-[16px] border-b border-[#F1F5F9] text-[14px] items-center">
                  <span className="text-[#64748B] font-[600]">Custo Dedutível Empresa (60%)</span>
                  <span className="font-[700] font-mono text-emerald-600">{ptEur(result.total.custoDedutivelEmpresa)}</span>
                </div>
              </div>

              <div className="mt-[24px] p-[16px] bg-[#F8FAFC] rounded-[12px] text-[12px] text-[#64748B] font-[500] leading-relaxed">
                A empresa poupa a SS patronal (23,75%) ao dar tickets em vez de aumento salarial equivalente.
              </div>
            </div>

            {/* Details Card */}
            <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-[24px] md:p-[32px] flex flex-col shadow-sm">
              <div className="flex items-center gap-[16px] mb-[24px]">
                <div className="bg-[#EFF6FF] text-[#3B82F6] p-[12px] rounded-[16px]">
                  <Calculator className="w-[24px] h-[24px]" />
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
                  <span className="text-[#64748B] font-[600]">Valor/Dia (total)</span>
                  <span className={cn("font-[700] font-mono", excedeNorma ? "text-amber-600" : "text-[#0F172A]")}>{ptEur(ticketValue)}</span>
                </div>
                <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                  <span className="text-[#64748B] font-[600]">Limite Legal (setor)</span>
                  <span className="font-[700] font-mono text-[#0F172A]">{ptEur(limiteSetor)}/dia</span>
                </div>
                {excedeNorma && (
                  <>
                    <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                      <span className="text-[#64748B] font-[600]">Poupança dentro do limite</span>
                      <span className="font-[700] font-mono text-emerald-600">{ptEur(result.dentroLimite.savings)}</span>
                    </div>
                    <div className="flex justify-between py-[14px] text-[14px] items-center">
                      <span className="text-[#64748B] font-[600]">Custo dedutível (60%, no limite)</span>
                      <span className="font-[700] font-mono text-emerald-600">{ptEur(result.dentroLimite.custoDedutivelEmpresa)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-[24px] p-[16px] bg-[#FEF3C7] rounded-[12px] text-[12px] text-[#92400E] font-[500] leading-relaxed">
                <strong>Benefício para o trabalhador:</strong> Tickets até ao limite legal não entram no rendimento tributável (IRS) nem na base de incidência da SS. O trabalhador recebe o valor integral sem desconto.
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
