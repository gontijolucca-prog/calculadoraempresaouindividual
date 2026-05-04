import React, { useMemo } from 'react';
import { calcTicketSavings } from './lib/pt2026';
import { Ticket, Euro, ShieldCheck, Calculator, AlertTriangle, BookOpen, Heart, Gift, Car, Utensils, Baby } from 'lucide-react';
import { cn } from './lib/utils';
import type { ClientProfile } from './ClientProfile';
import { useTheme } from './ThemeContext';
import { Tip } from './Tip';

type TicketType = 'alimentacao' | 'infancia' | 'ensino' | 'saude' | 'oferta' | 'car';

interface TicketSimulatorState {
  employees: number;
  ticketValue: number;
  daysPerMonth: number;
  months: number;
  ticketType: TicketType;
}

interface Props {
  initialState: TicketSimulatorState;
  onStateChange: (state: TicketSimulatorState) => void;
  profile: ClientProfile;
}

const TICKET_TYPES: { id: TicketType; label: string; Icon: React.ElementType; desc: string }[] = [
  { id: 'alimentacao', label: 'Alimentação', Icon: Utensils, desc: 'Subsídio de refeição em vales ou cartão. Isento de IRS e SS até ao limite legal.' },
  { id: 'infancia', label: 'Infância', Icon: Baby, desc: 'Vale infância para despesas de creche e pré-escolar (filhos até 7 anos). Benefício fiscal com isenção de IRS até ao limite.' },
  { id: 'ensino', label: 'Ensino', Icon: BookOpen, desc: 'Apoio à educação e formação dos colaboradores e seus dependentes. Benefício fiscal com regras específicas.' },
  { id: 'saude', label: 'Saúde', Icon: Heart, desc: 'Seguro de saúde e bem-estar. Benefício fiscal até ao limite legal.' },
  { id: 'oferta', label: 'Oferta', Icon: Gift, desc: 'Prendas e ofertas a colaboradores (ex.: Natal, aniversário). Sujeito a IRS e SS.' },
  { id: 'car', label: 'Car', Icon: Car, desc: 'Cartão combustível / mobilidade. Benefício fiscal com regras específicas.' },
];

const TICKET_RULES: Record<TicketType, {
  temLimiteDiario: boolean;
  limiteDiario: number;
  limiteMensal: number;
  dedutivelPercent: number;
  isentoIRS: boolean;
  isentoSS: boolean;
}> = {
  alimentacao: { temLimiteDiario: true, limiteDiario: 5, limiteMensal: 0, dedutivelPercent: 0.60, isentoIRS: true, isentoSS: true },
  infancia:    { temLimiteDiario: false, limiteDiario: 0, limiteMensal: 50, dedutivelPercent: 0.60, isentoIRS: true, isentoSS: false },
  ensino:      { temLimiteDiario: false, limiteDiario: 0, limiteMensal: 50, dedutivelPercent: 0.60, isentoIRS: true, isentoSS: false },
  saude:       { temLimiteDiario: false, limiteDiario: 0, limiteMensal: 100, dedutivelPercent: 0.60, isentoIRS: true, isentoSS: false },
  oferta:      { temLimiteDiario: false, limiteDiario: 0, limiteMensal: 0, dedutivelPercent: 0.40, isentoIRS: false, isentoSS: false },
  car:         { temLimiteDiario: false, limiteDiario: 0, limiteMensal: 75, dedutivelPercent: 0.50, isentoIRS: false, isentoSS: false },
};

export default function TicketSimulator({ initialState, onStateChange, profile }: Props) {
  const { employees, ticketValue, daysPerMonth, months, ticketType } = initialState;
  const setState = (updates: Partial<TicketSimulatorState>) => {
    onStateChange({ ...initialState, ...updates });
  };
  const { simMode } = useTheme();
  const outerCls = { split: "overflow-y-auto lg:overflow-hidden lg:h-full lg:grid lg:grid-cols-[400px_1fr] bg-[#F8FAFC] text-[#1E293B]", stacked: "h-full flex flex-col bg-[#F0F4F8] text-[#1E293B] overflow-y-auto", mosaic: "h-full bg-[#F0FDF4] text-[#1E293B] md:grid md:grid-cols-2 gap-4 p-4", compact: "h-full overflow-y-auto bg-white text-[#1E293B]", hero: "h-full flex md:flex-row-reverse overflow-hidden bg-[#F5F5F4] text-[#1E293B]" }[simMode];
  const leftCls = { split: "bg-white border-b border-[#E2E8F0] lg:border-b-0 lg:border-r lg:overflow-y-auto p-4 sm:p-6 lg:p-[40px] flex flex-col gap-5 lg:gap-[32px] lg:h-full", stacked: "bg-white border-b-2 border-[#E2E8F0] p-6 flex flex-col gap-6", mosaic: "bg-white rounded-[20px] border border-emerald-100 shadow-sm overflow-y-auto p-5 flex flex-col gap-5 h-full", compact: "max-w-xl mx-auto p-4 pb-0 w-full", hero: "md:w-[420px] shrink-0 bg-white border-l border-[#E2E8F0] overflow-y-auto p-6 flex flex-col gap-5 h-full" }[simMode];
  const rightCls = { split: "p-4 sm:p-6 lg:p-[40px] lg:overflow-y-auto lg:h-full max-w-7xl mx-auto w-full flex flex-col gap-5 lg:gap-[32px]", stacked: "p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full", mosaic: "bg-white rounded-[20px] border border-emerald-100 shadow-sm overflow-y-auto p-5 flex flex-col gap-5 h-full", compact: "max-w-xl mx-auto p-4 pt-2 w-full border-t border-slate-100", hero: "flex-1 p-6 md:p-[40px] overflow-y-auto flex flex-col gap-5" }[simMode];

  const rules = TICKET_RULES[ticketType];

  const limiteSetor = ticketType === 'alimentacao'
    ? (profile.setorTicket === 'hotelaria' || profile.setorTicket === 'construcao' ? 7 : 5)
    : 0;

  const limiteExibido = rules.temLimiteDiario ? limiteSetor : rules.limiteMensal;

  const excedeNorma = rules.temLimiteDiario
    ? ticketValue > limiteSetor
    : rules.limiteMensal > 0 && ticketValue > rules.limiteMensal;

  const ticketValueDentroLimite = rules.temLimiteDiario
    ? Math.min(ticketValue, limiteSetor)
    : (rules.limiteMensal > 0 ? Math.min(ticketValue, rules.limiteMensal) : ticketValue);

  const ticketValueExcedente = Math.max(0, ticketValue - ticketValueDentroLimite);

  const result = useMemo(() => {
    if (employees > 0 && ticketValue > 0 && (ticketType === 'alimentacao' ? (daysPerMonth > 0) : true) && months > 0) {
      if (ticketType === 'alimentacao') {
        const total = calcTicketSavings(employees, ticketValue, daysPerMonth, months);
        const dentroLimite = calcTicketSavings(employees, ticketValueDentroLimite, daysPerMonth, months);
        return { total, dentroLimite, ticketType: 'alimentacao' as const };
      } else {
        const ticketCost = employees * ticketValue * months;
        const ticketCostLimit = employees * ticketValueDentroLimite * months;
        const salaryCost = ticketCost * (1 + (rules.isentoSS ? 0 : 0.2375));
        const savings = salaryCost - ticketCost;
        const custoDedutivelEmpresa = ticketCost * rules.dedutivelPercent;
        const custoDedutivelLimite = ticketCostLimit * rules.dedutivelPercent;

        return {
          total: { ticketCost, salaryCost, savings, custoDedutivelEmpresa },
          dentroLimite: rules.limiteMensal > 0
            ? { ticketCost: ticketCostLimit, salaryCost: ticketCostLimit * (1 + (rules.isentoSS ? 0 : 0.2375)), savings: ticketCostLimit * 0.2375, custoDedutivelEmpresa: custoDedutivelLimite }
            : null,
          ticketType: ticketType as string,
        };
      }
    }
    return null;
  }, [employees, ticketValue, ticketValueDentroLimite, daysPerMonth, months, ticketType, rules]);

  const inputClass = "w-full pl-[16px] pr-[16px] py-[12px] bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[8px] text-[15px] font-[600] text-[#0F172A] focus:border-[#0F172A] transition-all outline-none";
  const labelClass = "block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[8px]";
  const selectClass = "w-full pl-[16px] pr-[36px] py-[12px] bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[8px] text-[15px] font-[600] text-[#0F172A] focus:border-[#0F172A] transition-all outline-none appearance-none cursor-pointer";

  const ptEur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);

  const TicketTypeIcon = TICKET_TYPES.find(t => t.id === ticketType)?.Icon || Ticket;
  const currentTypeInfo = TICKET_TYPES.find(t => t.id === ticketType)!;

  return (
    <div className={outerCls}>
      <div className={leftCls}>
        <div>
          <h2 className="text-[24px] font-[800] tracking-[-0.5px] text-[#0F172A]">Simulador Tickets / Vales <Tip>Simulador de benefícios fiscais para diferentes tipos de tickets oferecidos aos colaboradores.</Tip></h2>
          <p className="text-[14px] text-[#64748B] font-[500] mt-[4px]">Compare a poupança fiscal com cada tipo de benefício.</p>
        </div>

        <div className="space-y-[24px]">
          <div>
            <label className={labelClass}>Tipo de Ticket</label>
            <div className="relative">
              <select
                value={ticketType}
                onChange={e => setState({ ticketType: e.target.value as TicketType })}
                className={selectClass}
              >
                {TICKET_TYPES.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <div className="mt-3 p-3 bg-[#F0F4FF] border border-[#C7D2FE] rounded-[12px] flex items-start gap-3">
              <TicketTypeIcon className="w-5 h-5 text-[#4F46E5] shrink-0 mt-0.5" />
              <div>
                <p className="text-[13px] font-[600] text-[#1E1B4B]">{currentTypeInfo.label}</p>
                <p className="text-[12px] text-[#4338CA] font-[500] mt-0.5">{currentTypeInfo.desc}</p>
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Número de Colaboradores <Tip>Quantos colaboradores recebem este benefício.</Tip></label>
            <input
              type="number"
              min="0"
              value={employees === 0 ? '' : employees}
              onChange={e => setState({ employees: parseInt(e.target.value) || 0 })}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              {ticketType === 'alimentacao' ? 'Valor Diário (€)' : 'Valor Mensal por Colaborador (€)'}
              <Tip>{ticketType === 'alimentacao' ? 'O valor diário do subsídio de alimentação por colaborador.' : 'O valor mensal do benefício por colaborador.'}</Tip>
            </label>
            <div className="relative">
              <Euro className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={ticketValue === 0 ? '' : ticketValue}
                onChange={e => setState({ ticketValue: parseFloat(e.target.value) || 0 })}
                className={cn(inputClass, "pl-[40px]", excedeNorma && "border-amber-400 bg-amber-50/30")}
              />
            </div>
            {limiteExibido > 0 && (
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
                {rules.temLimiteDiario
                  ? `Limite legal setor "${profile.setorTicket === 'hotelaria' || profile.setorTicket === 'construcao' ? 'Hotelaria/Construção' : 'Geral'}": ${ptEur(limiteSetor)}/dia`
                  : `Limite de referência: ${ptEur(limiteExibido)}/mês`
                }
                {excedeNorma && ` — excedente de ${ptEur(ticketValueExcedente)} ${rules.temLimiteDiario ? '/dia' : '/mês'} é tributável`}
              </div>
            )}
          </div>

          {ticketType === 'alimentacao' && (
            <div>
              <label className={labelClass}>Dias Úteis por Mês <Tip>Número de dias úteis de trabalho por mês em que o subsídio é pago.</Tip></label>
              <input
                type="number"
                min="0"
                max="31"
                value={daysPerMonth === 0 ? '' : daysPerMonth}
                onChange={e => setState({ daysPerMonth: parseInt(e.target.value) || 0 })}
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className={labelClass}>
              {ticketType === 'alimentacao' ? 'Meses por Ano' : 'Nº de Meses'}
              <Tip>{ticketType === 'alimentacao' ? 'Número de meses em que o subsídio é pago (normalmente 11).' : 'Número de meses em que o benefício é concedido.'}</Tip>
            </label>
            <input
              type="number"
              min="1"
              max="12"
              value={months === 0 ? '' : months}
              onChange={e => setState({ months: parseInt(e.target.value) || 12 })}
              className={inputClass}
            />
          </div>

          <div className="p-5 border-2 border-[#E2E8F0] rounded-[16px] bg-[#F8FAFC]">
            <h3 className="text-[12px] font-[800] text-[#0F172A] mb-4">
              REGRAS {ticketType === 'alimentacao' ? 'ALIMENTAÇÃO (DL 133/2024 + CIRC Art. 43.º)' : `${currentTypeInfo.label.toUpperCase()}`}
            </h3>
            <ul className="text-[13px] text-[#64748B] font-[500] leading-relaxed space-y-2">
              {ticketType === 'alimentacao' && (
                <>
                  <li>• Limite diário: <strong>€5,00</strong> (setor geral) / <strong>€7,00</strong> (hotelaria/construção)</li>
                  <li>• Empresa deduz <strong>60%</strong> do custo total</li>
                  <li>• Sem SS patronal sobre tickets (até ao limite)</li>
                  <li>• Colaborador: sem IRS nem SS até ao limite</li>
                </>
              )}
              {ticketType === 'infancia' && (
                <>
                  <li>• Vale infância: creche e pré-escolar (filhos até <strong>7 anos</strong>)</li>
                  <li>• Limite de referência: até <strong>€50/mês</strong> por colaborador</li>
                  <li>• Empresa deduz <strong>60%</strong> do custo (benefício social)</li>
                  <li>• Isento de IRS até ao limite de referência</li>
                  <li>• Sujeito a SS patronal (23,75%)</li>
                </>
              )}
              {ticketType === 'ensino' && (
                <>
                  <li>• Apoio à educação e formação: <strong>Cheque educação</strong> (colaboradores) e <strong>Cheque ensino/formação</strong> (colaboradores e dependentes, sem limite de idade ou valor anual)</li>
                  <li>• Limite de referência: até <strong>€50/mês</strong> por colaborador</li>
                  <li>• Empresa deduz <strong>60%</strong> do custo (benefício social)</li>
                  <li>• Isento de IRS até ao limite de referência</li>
                  <li>• Sujeito a SS patronal</li>
                </>
              )}
              {ticketType === 'saude' && (
                <>
                  <li>• Seguro de saúde e bem-estar: até <strong>€100/mês</strong> por colaborador (referência)</li>
                  <li>• Empresa deduz <strong>60%</strong> do custo</li>
                  <li>• Isento de IRS até ao limite de referência</li>
                  <li>• Sujeito a SS patronal</li>
                </>
              )}
              {ticketType === 'oferta' && (
                <>
                  <li>• Ofertas a colaboradores (ex.: Natal, aniversário)</li>
                  <li>• Empresa deduz apenas <strong>40%</strong> do custo (realizações sociais)</li>
                  <li>• <strong>Sujeito a IRS e SS</strong> para o colaborador (acresce ao rendimento)</li>
                  <li>• Sem limite específico de isenção</li>
                </>
              )}
              {ticketType === 'car' && (
                <>
                  <li>• Cartão combustível / mobilidade</li>
                  <li>• Empresa deduz <strong>50%</strong> do custo (IVA parcialmente dedutível)</li>
                  <li>• <strong>Sujeito a IRS</strong> como rendimento em espécie (se uso pessoal)</li>
                  <li>• Sujeito a SS patronal</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className={rightCls}>
        <div>
          <h1 className="text-[32px] md:text-[40px] font-[800] leading-[1] md:tracking-[-1.5px] mb-[8px] text-[#0F172A]">Resultados Apurados</h1>
          <p className="text-[16px] text-[#64748B] mb-[8px]">Economia fiscal com <strong>{currentTypeInfo.label}</strong>.</p>
        </div>

        {excedeNorma && limiteExibido > 0 && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-[20px] p-5 flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-[14px] font-[800] text-amber-900 mb-1">Valor acima do limite</h4>
              <p className="text-[13px] text-amber-800 font-[500] leading-relaxed">
                O valor de <strong>{ptEur(ticketValue)}{rules.temLimiteDiario ? '/dia' : '/mês'}</strong> excede o limite de <strong>{ptEur(limiteExibido)}{rules.temLimiteDiario ? '/dia' : '/mês'}</strong>.
                O excedente de <strong>{ptEur(ticketValueExcedente)}{rules.temLimiteDiario ? '/dia' : '/mês'}</strong> {rules.isentoIRS ? 'poderá ficar sujeito a IRS e SS' : 'é tributável'}.
              </p>
            </div>
          </div>
        )}

        {result && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-[24px]">
            <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-[24px] md:p-[32px] flex flex-col shadow-sm">
              <div className="flex items-center gap-[16px] mb-[24px]">
                <div className="bg-[#ECFDF5] text-[#10B981] p-[12px] rounded-[16px]">
                  <ShieldCheck className="w-[24px] h-[24px]" />
                </div>
                <div>
                  <h3 className="text-[18px] font-[700] text-[#0F172A]">Poupança Anual <Tip>O valor que a empresa poupa ao oferecer este benefício em vez de um aumento salarial equivalente.</Tip></h3>
                  {excedeNorma && <span className="text-[11px] text-amber-600 font-[600]">Valor total (incl. excedente)</span>}
                </div>
              </div>

              <div className="text-[48px] md:text-[56px] font-[800] text-[#10B981] tracking-[-2px] mb-[32px]">
                {ptEur(result.total.savings)}
              </div>

              <div className="flex-1 space-y-0">
                <div className="flex justify-between py-[16px] border-b border-[#F1F5F9] text-[14px] items-center">
                  <span className="text-[#64748B] font-[600]">Custo Total do Benefício</span>
                  <span className="font-[700] font-mono text-[#0F172A]">{ptEur(result.total.ticketCost)}</span>
                </div>
                <div className="flex justify-between py-[16px] border-b border-[#F1F5F9] text-[14px] items-center">
                  <span className="text-[#64748B] font-[600]">Equivalente em Salário (c/ SS)</span>
                  <span className="font-[700] font-mono text-[#0F172A]">{ptEur(result.total.salaryCost)}</span>
                </div>
                <div className="flex justify-between py-[16px] border-b border-[#F1F5F9] text-[14px] items-center">
                  <span className="text-[#64748B] font-[600]">Custo Dedutível Empresa ({(rules.dedutivelPercent * 100).toFixed(0)}%)</span>
                  <span className="font-[700] font-mono text-emerald-600">{ptEur(result.total.custoDedutivelEmpresa)}</span>
                </div>
              </div>

              <div className="mt-[24px] p-[16px] bg-[#F8FAFC] rounded-[12px] text-[12px] text-[#64748B] font-[500] leading-relaxed">
                {rules.isentoSS
                  ? 'A empresa poupa a SS patronal (23,75%) ao dar este benefício em vez de aumento salarial equivalente.'
                  : 'Este benefício está sujeito a SS patronal, mas pode ter vantagens fiscais ao nível da dedutibilidade.'}
              </div>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-[24px] p-[24px] md:p-[32px] flex flex-col shadow-sm">
              <div className="flex items-center gap-[16px] mb-[24px]">
                <div className="bg-[#EFF6FF] text-[#3B82F6] p-[12px] rounded-[16px]">
                  <Calculator className="w-[24px] h-[24px]" />
                </div>
                <h3 className="text-[18px] font-[700] text-[#0F172A]">Detalhes do Cálculo <Tip>Decomposição dos valores usados no cálculo.</Tip></h3>
              </div>

              <div className="flex-1 space-y-0">
                <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                  <span className="text-[#64748B] font-[600]">Colaboradores</span>
                  <span className="font-[700] font-mono text-[#0F172A]">{employees}</span>
                </div>
                <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                  <span className="text-[#64748B] font-[600]">Valor {rules.temLimiteDiario ? 'Diário' : 'Mensal'}</span>
                  <span className={cn("font-[700] font-mono", excedeNorma ? "text-amber-600" : "text-[#0F172A]")}>{ptEur(ticketValue)}{rules.temLimiteDiario ? '/dia' : '/mês'}</span>
                </div>
                {limiteExibido > 0 && (
                  <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                    <span className="text-[#64748B] font-[600]">Limite Legal</span>
                    <span className="font-[700] font-mono text-[#0F172A]">{ptEur(limiteExibido)}{rules.temLimiteDiario ? '/dia' : '/mês'}</span>
                  </div>
                )}
                <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                  <span className="text-[#64748B] font-[600]">{ticketType === 'alimentacao' ? 'Dias/Mês' : 'Meses'}</span>
                  <span className="font-[700] font-mono text-[#0F172A]">{ticketType === 'alimentacao' ? daysPerMonth : months}</span>
                </div>
                <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                  <span className="text-[#64748B] font-[600]">Meses/Ano</span>
                  <span className="font-[700] font-mono text-[#0F172A]">{months}</span>
                </div>
                {excedeNorma && limiteExibido > 0 && result.dentroLimite && (
                  <>
                    <div className="flex justify-between py-[14px] border-b border-[#F1F5F9] text-[14px] items-center">
                      <span className="text-[#64748B] font-[600]">Poupança dentro do limite</span>
                      <span className="font-[700] font-mono text-emerald-600">{ptEur(result.dentroLimite.savings)}</span>
                    </div>
                    <div className="flex justify-between py-[14px] text-[14px] items-center">
                      <span className="text-[#64748B] font-[600]">Custo dedutível ({(rules.dedutivelPercent * 100).toFixed(0)}%, no limite)</span>
                      <span className="font-[700] font-mono text-emerald-600">{ptEur(result.dentroLimite.custoDedutivelEmpresa)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-[24px] p-[16px] bg-[#FEF3C7] rounded-[12px] text-[12px] text-[#92400E] font-[500] leading-relaxed">
                {rules.isentoIRS && rules.isentoSS && (
                  <><strong>Benefício para o colaborador:</strong> Isento de IRS e SS até ao limite legal. O colaborador recebe o valor integral sem desconto.</>
                )}
                {rules.isentoIRS && !rules.isentoSS && (
                  <><strong>Benefício para o colaborador:</strong> Isento de IRS até ao limite, mas sujeito a SS patronal.</>
                )}
                {!rules.isentoIRS && !rules.isentoSS && (
                  <><strong>Nota:</strong> Este benefício está sujeito a IRS e SS, sendo tratado como rendimento em espécie.</>
                )}
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