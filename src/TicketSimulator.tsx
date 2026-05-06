import React, { useMemo } from 'react';
import {
  UtensilsCrossed, Baby, GraduationCap, Heart, Gift, Car,
  Euro, ShieldCheck, Calculator, AlertTriangle, TrendingUp, Info, Fuel,
} from 'lucide-react';
import { cn } from './lib/utils';
import { TICKET_LIMITS_2026, TICKET_IRC_FACTOR, TICKET_CAR_IVA_RATE, SS_RATE_EMPLOYER } from './lib/pt2026';
import type { TipoTicket, TipoSubsidioRefeicao } from './lib/pt2026';
import { useTheme } from './ThemeContext';
import { Tip } from './Tip';

export type { TipoTicket, TipoSubsidioRefeicao };

export interface TicketSimulatorState {
  tipoTicket: TipoTicket;
  employees: number;
  // Ticket Restaurant® (restaurante):
  ticketValue: number;
  tipoSubsidio: TipoSubsidioRefeicao;
  daysPerMonth: number;
  months: number;
  // Outros tipos — valor anual por beneficiário / viatura:
  valorAnualPorPessoa: number;
  // Ticket Car®:
  tipoVeiculo: 'passageiros' | 'misto' | 'comercial';
}

interface Props {
  initialState: TicketSimulatorState;
  onStateChange: (state: TicketSimulatorState) => void;
  profile?: { setorTicket?: string };
}

const TICKET_META: Record<TipoTicket, {
  label: string; shortLabel: string;
  Icon: React.ComponentType<{ className?: string }>;
  irsIsento: boolean; ssIsento: boolean;
}> = {
  restaurante: { label: 'Ticket Restaurant®', shortLabel: 'Refeição',  Icon: UtensilsCrossed, irsIsento: true,  ssIsento: true  },
  infancia:    { label: 'Ticket Infância®',   shortLabel: 'Infância',  Icon: Baby,            irsIsento: true,  ssIsento: true  },
  educacao:    { label: 'Ticket Educação®',   shortLabel: 'Educação',  Icon: GraduationCap,   irsIsento: true,  ssIsento: true  },
  saude:       { label: 'Ticket Saúde®',      shortLabel: 'Saúde',     Icon: Heart,           irsIsento: true,  ssIsento: true  },
  oferta:      { label: 'Ticket Oferta®',     shortLabel: 'Oferta',    Icon: Gift,            irsIsento: false, ssIsento: false },
  car:         { label: 'Ticket Car®',        shortLabel: 'Car',       Icon: Car,             irsIsento: false, ssIsento: false },
};

const LEGAL_NOTES: Record<TipoTicket, { limitsNote: string; ircNote: string; refs: string }> = {
  car: {
    limitsNote: 'Cobre combustível e despesas de assistência automóvel nas viaturas da empresa. Aceite em +1.800 postos. Vales de €5, €10 e €15.',
    ircNote: '100% dedutível como gasto com viaturas (CIRC Art. 23.º). IVA: 0% para ligeiros de passageiros · 50% para mistos · 100% para comerciais (CIVA Art. 21.º). Tributação Autónoma pode aplicar-se (CIRC Art. 88.º).',
    refs: 'CIVA Art. 21.º n.º 1 a) e n.º 2 · CIRC Art. 23.º · CIRC Art. 88.º (Trib. Autónoma) · DL 162/2014',
  },
  restaurante: {
    limitsNote: 'Limite diário isento: €10,46 (cartão eletrónico) · €6,15 (dinheiro/transferência) · €5,00 (vale papel, geral) · €7,00 (vale papel, hotelaria/construção)',
    ircNote: '60% dedutível em IRC — CIRC Art. 43.º n.º 2 (limitação específica para subsídio de refeição)',
    refs: 'Despacho 233-A/2026 · DL 133/2024 · CIRC Art. 43.º n.º 2 · Código Contributivo Art. 46.º n.º 1 e)',
  },
  infancia: {
    limitsNote: 'Sem limite de valor. Aplicável a encargos com creche e jardim de infância — crianças até 7 anos de idade.',
    ircNote: '140% dedutível em IRC — majoração de 40% sobre o custo real (CIRC Art. 43.º n.º 9)',
    refs: 'CIRC Art. 43.º n.º 9 · CIRS Art. 24.º · Código Contributivo Art. 46.º n.º 1 · DL 162/2014',
  },
  educacao: {
    limitsNote: 'Sem limite de valor ou de grau de ensino. Abrange ensino privado e público, livros, manuais, material escolar e centros de explicações.',
    ircNote: '100% dedutível como gasto normal — CIRC Art. 43.º n.º 1',
    refs: 'CIRC Art. 43.º n.º 1 · CIRS Art. 24.º · Código Contributivo Art. 46.º · DL 162/2014',
  },
  saude: {
    limitsNote: 'Sem limite de valor. Inclui consultas, medicamentos, fisioterapia, lares, centros de dia e apoio domiciliário para trabalhadores e familiares.',
    ircNote: '100% dedutível como realização de utilidade social — CIRC Art. 43.º n.º 1',
    refs: 'CIRC Art. 43.º n.º 1 · CIRS Art. 24.º n.º 1 b) · Código Contributivo Art. 46.º · DL 162/2014',
  },
  oferta: {
    limitsNote: 'Sem isenção de IRS/SS para trabalhadores. Para clientes/parceiros: gasto de representação. Indicado para campanhas de reconhecimento e prémios de Natal.',
    ircNote: 'Para clientes: limitado a 0,5% do volume de negócios (CIRC Art. 23.º-A n.º 1 h)). Para trabalhadores: remuneração em espécie sujeita a IRS e SS.',
    refs: 'CIRC Art. 23.º-A n.º 1 h) · CIRS Art. 2.º n.º 3 b)',
  },
};

export default function TicketSimulator({ initialState, onStateChange }: Props) {
  const s = initialState;
  const setState = (u: Partial<TicketSimulatorState>) => onStateChange({ ...s, ...u });
  const { simMode } = useTheme();

  const tipo = s.tipoTicket;
  const meta = TICKET_META[tipo];
  const legal = LEGAL_NOTES[tipo];
  const isRestaurante = tipo === 'restaurante';
  const isOferta = tipo === 'oferta';
  const isCar = tipo === 'car';

  const outerCls = { split: "overflow-y-auto lg:overflow-hidden lg:h-full lg:grid lg:grid-cols-[420px_1fr] bg-[#F8FAFC] text-[#1E293B]", stacked: "h-full flex flex-col bg-[#F0F4F8] text-[#1E293B] overflow-y-auto", mosaic: "h-full bg-[#F0FDF4] text-[#1E293B] md:grid md:grid-cols-2 gap-4 p-4", compact: "h-full overflow-y-auto bg-white text-[#1E293B]", hero: "h-full flex md:flex-row-reverse overflow-hidden bg-[#F5F5F4] text-[#1E293B]" }[simMode];
  const leftCls = { split: "bg-white border-b border-[#E2E8F0] lg:border-b-0 lg:border-r lg:overflow-y-auto p-4 sm:p-5 lg:p-[28px] flex flex-col gap-4 lg:h-full", stacked: "bg-white border-b-2 border-[#E2E8F0] p-6 flex flex-col gap-5", mosaic: "bg-white rounded-[20px] border border-emerald-100 shadow-sm overflow-y-auto p-5 flex flex-col gap-5 h-full", compact: "max-w-xl mx-auto p-4 pb-0 w-full", hero: "md:w-[440px] shrink-0 bg-white border-l border-[#E2E8F0] overflow-y-auto p-6 flex flex-col gap-5 h-full" }[simMode];
  const rightCls = { split: "p-4 sm:p-5 lg:p-[28px] lg:overflow-y-auto lg:h-full flex flex-col gap-4", stacked: "p-6 flex flex-col gap-4 max-w-7xl mx-auto w-full", mosaic: "bg-white rounded-[20px] border border-emerald-100 shadow-sm overflow-y-auto p-5 flex flex-col gap-4 h-full", compact: "max-w-xl mx-auto p-4 pt-2 w-full border-t border-slate-100", hero: "flex-1 overflow-y-auto p-6 flex flex-col gap-4" }[simMode];

  const ptEur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);
  const inputCls = "w-full px-[14px] py-[11px] bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[8px] text-[14px] font-[600] text-[#0F172A] focus:border-[#0F172A] transition-all outline-none";
  const labelCls = "block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-[6px]";

  const calc = useMemo(() => {
    if (s.employees <= 0) return null;

    // ── Ticket Car: lógica própria de frota ──
    if (isCar) {
      if (s.valorAnualPorPessoa <= 0) return null;
      const custoAnual = s.employees * s.valorAnualPorPessoa;
      const ivaRate = TICKET_CAR_IVA_RATE[s.tipoVeiculo];
      const ivaRecuperavel = custoAnual * 0.23 / 1.23 * ivaRate; // IVA embutido no preço
      const dedutivelIRC = custoAnual; // 100% dedutível como gasto
      return {
        custoAnual, custoIsento: 0, custoExcedente: 0, excedeNorma: false, limiteDiario: 0,
        poupancaSSPatronal: 0, poupancaSSTrab: 0,
        dedutivelIRC, majoracaoExtra: 0, ircFactor: 1.00,
        equivalenteSalarial: 0, poupancaVsSalario: 0,
        poupancaTotal: ivaRecuperavel,
        poupancaPorTrabalhador: ivaRecuperavel / s.employees,
        ivaRecuperavel, ivaRate,
      };
    }

    let custoAnual = 0;
    let custoIsento = 0;
    let limiteDiario = 0;

    if (isRestaurante) {
      if (s.ticketValue <= 0 || s.daysPerMonth <= 0 || s.months <= 0) return null;
      limiteDiario = TICKET_LIMITS_2026[s.tipoSubsidio];
      custoAnual = s.employees * s.ticketValue * s.daysPerMonth * s.months;
      custoIsento = s.employees * Math.min(s.ticketValue, limiteDiario) * s.daysPerMonth * s.months;
    } else {
      if (s.valorAnualPorPessoa <= 0) return null;
      custoAnual = s.employees * s.valorAnualPorPessoa;
      custoIsento = isOferta ? 0 : custoAnual;
    }

    const custoExcedente = Math.max(0, custoAnual - custoIsento);
    const excedeNorma = isRestaurante && custoExcedente > 0;

    const poupancaSSPatronal = custoIsento * SS_RATE_EMPLOYER;
    const poupancaSSTrab = custoIsento * 0.11;

    const ircFactor = TICKET_IRC_FACTOR[tipo];
    const dedutivelIRC = custoIsento * ircFactor;
    const majoracaoExtra = tipo === 'infancia' ? custoIsento * 0.40 : 0;

    const equivalenteSalarial = custoIsento > 0 ? (custoIsento / 0.89) * (1 + SS_RATE_EMPLOYER) : 0;
    const poupancaVsSalario = Math.max(0, equivalenteSalarial - custoAnual);
    const poupancaMajoracao = majoracaoExtra * 0.19;
    const poupancaTotal = poupancaVsSalario + poupancaMajoracao;

    return {
      custoAnual, custoIsento, custoExcedente, excedeNorma, limiteDiario,
      poupancaSSPatronal, poupancaSSTrab,
      dedutivelIRC, majoracaoExtra, ircFactor,
      equivalenteSalarial, poupancaVsSalario, poupancaTotal,
      poupancaPorTrabalhador: s.employees > 0 ? poupancaTotal / s.employees : 0,
      ivaRecuperavel: 0, ivaRate: 0,
    };
  }, [s.tipoTicket, s.employees, s.ticketValue, s.tipoSubsidio, s.daysPerMonth, s.months, s.valorAnualPorPessoa, s.tipoVeiculo, isRestaurante, isOferta, isCar, tipo]);

  return (
    <div className={outerCls}>
      {/* ── Left Pane ── */}
      <div className={leftCls}>
        <div>
          <h2 className="text-[22px] font-[800] tracking-[-0.5px] text-[#0F172A]">
            Simulador de Tickets <Tip>Calcula os benefícios fiscais dos tickets Ticket.pt — isenções de IRS e SS para o trabalhador e dedutibilidade em IRC para a empresa.</Tip>
          </h2>
          <p className="text-[13px] text-[#64748B] font-[500] mt-[4px]">Todos os tipos Ticket.pt — benefícios fiscais 2026</p>
        </div>

        {/* Type selector */}
        <div>
          <label className={labelCls}>Tipo de Ticket</label>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(TICKET_META) as [TipoTicket, typeof TICKET_META[TipoTicket]][]).map(([id, { shortLabel, Icon }]) => (
              <button
                key={id}
                type="button"
                onClick={() => setState({ tipoTicket: id })}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-[12px] font-[700] border-2 transition-colors",
                  tipo === id
                    ? "bg-[#0F172A] text-white border-[#0F172A]"
                    : "bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0] hover:border-[#94A3B8]"
                )}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                {shortLabel}
              </button>
            ))}
          </div>
        </div>

        {/* Employees */}
        <div>
          <label className={labelCls}>
            {isOferta ? 'Número de destinatários' : 'Número de funcionários'} <Tip>Número de pessoas que recebem este benefício.</Tip>
          </label>
          <input
            type="number" min="1"
            value={s.employees === 0 ? '' : s.employees}
            onChange={e => setState({ employees: parseInt(e.target.value) || 0 })}
            className={inputCls}
          />
        </div>

        {/* Restaurante inputs */}
        {isRestaurante && (
          <>
            <div>
              <label className={labelCls}>
                Modalidade de Pagamento <Tip>Cada modalidade tem um limite de isenção diferente. Cartão eletrónico tem o limite mais alto.</Tip>
              </label>
              <select
                value={s.tipoSubsidio}
                onChange={e => setState({ tipoSubsidio: e.target.value as TipoSubsidioRefeicao })}
                className={inputCls}
              >
                <option value="cartao">Cartão eletrónico — limite isento €10,46/dia</option>
                <option value="dinheiro">Dinheiro / transferência — limite isento €6,15/dia</option>
                <option value="vale_geral">Vale em papel, setor geral — limite isento €5,00/dia</option>
                <option value="vale_hotelaria">Vale em papel, hotelaria/construção — limite isento €7,00/dia</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>
                Valor Diário (€) <Tip>Valor por dia de trabalho pago a cada funcionário. O excedente ao limite legal fica sujeito a SS e IRS.</Tip>
              </label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                <input
                  type="number" min="0" step="0.01"
                  value={s.ticketValue === 0 ? '' : s.ticketValue}
                  onChange={e => setState({ ticketValue: parseFloat(e.target.value) || 0 })}
                  className={cn(inputCls, "pl-9", calc?.excedeNorma && "border-amber-400 bg-amber-50/30")}
                />
              </div>
              {calc && (
                <div className={cn(
                  "mt-2 flex items-center gap-2 text-[12px] font-[600] px-3 py-1.5 rounded-[8px]",
                  calc.excedeNorma
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                )}>
                  {calc.excedeNorma ? <AlertTriangle size={12} /> : <ShieldCheck size={12} />}
                  Limite legal: {ptEur(calc.limiteDiario)}/dia
                  {calc.excedeNorma && ` — excedente ${ptEur(s.ticketValue - calc.limiteDiario)}/dia tributável`}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Dias úteis/mês <Tip>Dias de trabalho por mês em que o subsídio é pago. Normalmente 22.</Tip></label>
                <input
                  type="number" min="1" max="31"
                  value={s.daysPerMonth === 0 ? '' : s.daysPerMonth}
                  onChange={e => setState({ daysPerMonth: parseInt(e.target.value) || 0 })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Meses/ano <Tip>Número de meses por ano em que o benefício é pago.</Tip></label>
                <input
                  type="number" min="1" max="12"
                  value={s.months === 0 ? '' : s.months}
                  onChange={e => setState({ months: parseInt(e.target.value) || 0 })}
                  className={inputCls}
                />
              </div>
            </div>
          </>
        )}

        {/* Non-restaurante inputs */}
        {!isRestaurante && (
          <div>
            <label className={labelCls}>
              {isOferta ? 'Valor por destinatário (€/ano)' : 'Valor anual por funcionário (€)'} <Tip>Montante total anual atribuído a cada beneficiário.</Tip>
            </label>
            <div className="relative">
              <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
              <input
                type="number" min="0" step="50"
                value={s.valorAnualPorPessoa === 0 ? '' : s.valorAnualPorPessoa}
                onChange={e => setState({ valorAnualPorPessoa: parseFloat(e.target.value) || 0 })}
                className={cn(inputCls, "pl-9")}
                placeholder={tipo === 'infancia' ? 'ex: 3 600' : tipo === 'saude' ? 'ex: 1 200' : tipo === 'educacao' ? 'ex: 2 400' : 'ex: 150'}
              />
            </div>
          </div>
        )}

        {/* Legal notes */}
        <div className="p-4 rounded-[12px] bg-[#F8FAFC] border border-[#E2E8F0] text-[12px] text-[#64748B] font-[500] leading-relaxed space-y-2">
          <div className="flex items-start gap-2">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#94A3B8]" aria-hidden="true" />
            <span>{legal.limitsNote}</span>
          </div>
          <div className="flex items-start gap-2">
            <Calculator className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#94A3B8]" aria-hidden="true" />
            <span>{legal.ircNote}</span>
          </div>
          <div className="text-[10px] text-[#94A3B8] font-[600] uppercase tracking-[0.5px] pt-1 border-t border-[#E2E8F0] mt-2">
            {legal.refs}
          </div>
        </div>
      </div>

      {/* ── Right Pane ── */}
      <div className={rightCls}>
        {!calc ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="bg-[#F1F5F9] p-6 rounded-full inline-block mb-4">
                <meta.Icon className="w-12 h-12 text-[#64748B]" />
              </div>
              <p className="text-[#64748B] text-[16px] font-[500]">Preencha os dados para calcular o benefício fiscal.</p>
              <p className="text-[13px] text-[#94A3B8] mt-1">{meta.label}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Oferta warning */}
            {isOferta && (
              <div className="bg-amber-50 border border-amber-200 rounded-[16px] p-5 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-[700] text-amber-900 mb-1">Ticket Oferta® — sem isenção de IRS/SS</p>
                  <p className="text-[12px] text-amber-800 font-[500] leading-relaxed">
                    Os valores atribuídos a trabalhadores são remuneração em espécie, sujeita a IRS e SS normais. Para clientes e parceiros, é um gasto de representação dedutível até 0,5% do volume de negócios (CIRC Art. 23.º-A n.º 1 h)). É uma ferramenta de gestão de ofertas, não um benefício fiscal.
                  </p>
                </div>
              </div>
            )}

            {/* Excess warning */}
            {calc.excedeNorma && (
              <div className="bg-amber-50 border border-amber-200 rounded-[16px] p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-[700] text-amber-900">Valor acima do limite legal</p>
                  <p className="text-[12px] text-amber-800 font-[500] mt-1 leading-relaxed">
                    O excedente de {ptEur(s.ticketValue - calc.limiteDiario)}/dia por funcionário fica sujeito a IRS e SS. Os cálculos consideram apenas o valor dentro do limite isento.
                  </p>
                </div>
              </div>
            )}

            {/* Hero: poupança total */}
            {!isOferta && (
              <div className="bg-[#0F172A] text-white rounded-[20px] p-6">
                <div className="text-[11px] font-[700] uppercase tracking-[1px] text-slate-400">
                  Poupança Anual vs. Equivalente Salarial
                </div>
                <div className="text-[48px] font-[900] leading-none mt-2 tracking-[-2px]">
                  {ptEur(calc.poupancaTotal)}
                </div>
                <div className="text-[13px] text-slate-400 mt-2">
                  {ptEur(calc.poupancaPorTrabalhador)}/trabalhador · {s.employees} trabalhador{s.employees !== 1 ? 'es' : ''}
                </div>
                {tipo === 'infancia' && calc.majoracaoExtra > 0 && (
                  <div className="text-[12px] text-amber-400 font-[600] mt-2">
                    Inclui benefício da majoração IRC: {ptEur(calc.majoracaoExtra)} extra dedutível (40% do custo)
                  </div>
                )}
              </div>
            )}

            {/* SS Savings */}
            {!isOferta && (
              <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-emerald-50 rounded-[10px]">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  </div>
                  <h3 className="text-[14px] font-[700] text-[#0F172A]">Poupança em Segurança Social</h3>
                </div>
                <div className="space-y-3 text-[14px]">
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">SS Patronal poupada (23,75%)</span>
                    <span className="font-[700] text-emerald-600">{ptEur(calc.poupancaSSPatronal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">SS Trabalhador poupada (11%)</span>
                    <span className="font-[700] text-emerald-600">{ptEur(calc.poupancaSSTrab)}</span>
                  </div>
                  <div className="h-px bg-[#F1F5F9]" />
                  <div className="flex justify-between text-[15px]">
                    <span className="font-[800] text-[#0F172A]">Total SS (empresa + trabalhador)</span>
                    <span className="font-[900] text-emerald-700">{ptEur(calc.poupancaSSPatronal + calc.poupancaSSTrab)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* IRC */}
            <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 rounded-[10px]">
                  <Calculator className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-[14px] font-[700] text-[#0F172A]">Dedutibilidade em IRC</h3>
              </div>
              <div className="space-y-3 text-[14px]">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Custo total dos tickets</span>
                  <span className="font-[700]">{ptEur(calc.custoAnual)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Valor dedutível ({(calc.ircFactor * 100).toFixed(0)}% do custo)</span>
                  <span className={cn("font-[700]", calc.ircFactor >= 1.0 ? "text-emerald-600" : "text-orange-600")}>
                    {ptEur(calc.dedutivelIRC)}
                  </span>
                </div>
                {tipo === 'infancia' && calc.majoracaoExtra > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Majoração extra (40% adicional)</span>
                    <span className="font-[700] text-emerald-600">+ {ptEur(calc.majoracaoExtra)}</span>
                  </div>
                )}
                <div className={cn(
                  "text-[12px] rounded-[8px] p-2 mt-1",
                  isRestaurante ? "text-orange-700 bg-orange-50 border border-orange-100" :
                  isOferta ? "text-violet-700 bg-violet-50 border border-violet-100" :
                  "text-emerald-700 bg-emerald-50 border border-emerald-100"
                )}>
                  {isRestaurante && "Ticket Restaurante é dedutível apenas a 60% (vs. 100% para salário). A poupança em SS compensa amplamente esta limitação."}
                  {tipo === 'infancia' && "Majoração de 40%: a empresa deduz 140% do custo real em IRC — benefício adicional às poupanças de SS."}
                  {(tipo === 'educacao' || tipo === 'saude') && "Dedução a 100% — idêntica a um custo salarial normal, sem penalização em IRC."}
                  {isOferta && "Para clientes/parceiros: gasto de representação (Art. 23.º-A). Para trabalhadores: remuneração em espécie — sujeita a IRS e SS."}
                </div>
              </div>
            </div>

            {/* Comparison */}
            <div className="bg-white border border-[#E2E8F0] rounded-[20px] p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-slate-50 rounded-[10px]">
                  <TrendingUp className="w-5 h-5 text-slate-600" />
                </div>
                <h3 className="text-[14px] font-[700] text-[#0F172A]">
                  {isOferta ? 'Custo Anual' : 'Ticket vs. Equivalente Salarial'}
                </h3>
              </div>
              <div className="space-y-3 text-[14px]">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Custo com {meta.shortLabel}</span>
                  <span className="font-[700]">{ptEur(calc.custoAnual)}</span>
                </div>
                {!isOferta && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Custo equivalente como salário (c/ SS)</span>
                      <span className="font-[700] text-[#64748B]">{ptEur(calc.equivalenteSalarial)}</span>
                    </div>
                    <div className="h-px bg-[#F1F5F9]" />
                    <div className="flex justify-between text-[15px]">
                      <span className="font-[800] text-[#0F172A]">Poupança vs. salário</span>
                      <span className="font-[900] text-emerald-600">{ptEur(calc.poupancaVsSalario)}</span>
                    </div>
                    <div className="text-[11px] text-[#94A3B8]">
                      Taxa de poupança: {calc.equivalenteSalarial > 0
                        ? ((calc.poupancaVsSalario / calc.equivalenteSalarial) * 100).toFixed(1)
                        : '0'}% face ao custo equivalente como salário
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
