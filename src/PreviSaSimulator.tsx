import React, { useState, useCallback, useEffect } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { cn } from './lib/utils';
import type { Regime, Territorio, FuelType, ViaturaRow, PreviSaState } from './previSaState';
import { defaultPreviSaState } from './previSaState';

export type { PreviSaState } from './previSaState';
export { defaultPreviSaState } from './previSaState';

// ─── Constants ────────────────────────────────────────────────────────────────

const PME_BRACKET = 50_000;

const RATES: Record<Regime, { main: number; pme: number }> = {
  geral:         { main: 0.20, pme: 0.16 },
  madeira:       { main: 0.14, pme: 0.0875 },
  acores:        { main: 0.14, pme: 0.0875 },
  interioridade: { main: 0.20, pme: 0.125 },
  startup:       { main: 0.125, pme: 0.125 },
};

const DERRAMA_CONTINENTAL = [
  { limit: 1_500_000,  rate: 0.03 },
  { limit: 7_500_000,  rate: 0.05 },
  { limit: 35_000_000, rate: 0.09 },
  { limit: Infinity,   rate: 0.09 },
];

const DERRAMA_ACORES = [
  { limit: 1_500_000,  rate: 0.021 },
  { limit: 7_500_000,  rate: 0.035 },
  { limit: 35_000_000, rate: 0.063 },
  { limit: Infinity,   rate: 0.063 },
];

const PC_RATES: Record<Territorio, number[]> = {
  continental: [0.025, 0.045, 0.085],
  madeira:     [0.018, 0.032, 0.060],
  acores:      [0.0175, 0.0315, 0.0595],
};

const TA_VEICULO_RATES: { max: number; conv: number; plug5050: number; gnv: number; eletrico: number }[] = [
  { max: 37_500,  conv: 0.08,  plug5050: 0.025, gnv: 0.025, eletrico: 0 },
  { max: 45_000,  conv: 0.25,  plug5050: 0.075, gnv: 0.075, eletrico: 0 },
  { max: 62_500,  conv: 0.32,  plug5050: 0.15,  gnv: 0.15,  eletrico: 0 },
  { max: Infinity,conv: 0.32,  plug5050: 0.15,  gnv: 0.15,  eletrico: 0.10 },
];

// ─── Calculation engine ───────────────────────────────────────────────────────

function calcTAVeiculo(v: ViaturaRow, agravamento: boolean): number {
  const bracket = TA_VEICULO_RATES.find(b => v.custoHistorico <= b.max) ?? TA_VEICULO_RATES.at(-1)!;
  let rate: number;
  if (v.combustivel === 'eletrico') rate = bracket.eletrico;
  else if (v.combustivel === 'plug_in') rate = bracket.conv;
  else if (v.combustivel === 'plug_in_5050') rate = bracket.plug5050;
  else if (v.combustivel === 'gnv') rate = bracket.gnv;
  else rate = bracket.conv;
  return v.encargos * rate * (agravamento ? 1.1 : 1);
}

function calcDerramaEstadual(materia: number, territorio: Territorio): number {
  const tiers = territorio === 'acores' ? DERRAMA_ACORES : DERRAMA_CONTINENTAL;
  if (materia <= 0) return 0;
  let tax = 0;
  let prev = 0;
  for (const tier of tiers) {
    if (materia <= prev) break;
    const slice = Math.min(materia, tier.limit) - prev;
    if (slice <= 0) continue;
    tax += slice * tier.rate;
    prev = tier.limit;
    if (materia <= tier.limit) break;
  }
  return tax;
}

interface CalcResult {
  c708: number; c753: number; c776: number;
  lucroTributavel: number; prejuizoFiscal: number;
  materiaColetavel: number;
  ircBase: number; derramaEstadual: number;
  taTotal: number; ircLiquidacao: number;
  pecCalculado: number; pcCalculado: number;
  totalDeducoesColeta: number; ircApagar: number;
}

function calculate(s: PreviSaState): CalcResult {
  // Q07
  const c708 = s.c701_rai + s.c702 + s.c703 - s.c704 - s.c705 + s.c706 - s.c707;

  const acrescer = [
    s.c709, s.c710, s.c711, s.c712, s.c713, s.c714, s.c715, s.c716,
    s.c717, s.c718, s.c719, s.c720, s.c721, s.c722, s.c723, s.c724,
    s.c725, s.c726, s.c727, s.c728, s.c729, s.c730, s.c731, s.c732,
    s.c733, s.c734, s.c735, s.c736, s.c737, s.c738, s.c739, s.c740,
    s.c741, s.c742, s.c743, s.c744, s.c745, s.c746, s.c747, s.c748,
    s.c749, s.c750, s.c751, s.c752,
  ].reduce((a, b) => a + (b || 0), 0);

  const c753 = c708 + acrescer;

  const deducoesQ07 = [
    s.c754, s.c755, s.c756, s.c757, s.c758, s.c759, s.c760, s.c761,
    s.c762, s.c763, s.c764, s.c765, s.c766, s.c767, s.c768, s.c769,
    s.c770, s.c771, s.c772, s.c773, s.c774, s.c775,
  ].reduce((a, b) => a + (b || 0), 0);

  const c776 = deducoesQ07;
  const rawLT = c753 - c776;
  const lucroTributavel = Math.max(0, rawLT);
  const prejuizoFiscal = Math.abs(Math.min(0, rawLT));

  // Q09 — Matéria coletável
  const limiteDeducao = s.limiteMaisPP ? 0.75 : 0.65;
  const maxDeducaoPrej = lucroTributavel * limiteDeducao;
  const prejuziosEfetivos = Math.min(s.prejuizosDeduzir, maxDeducaoPrej);
  const materiaColetavel = Math.max(0, lucroTributavel - prejuziosEfetivos - s.beneficiosFiscais);

  // IRC taxa
  const r = RATES[s.isStartup ? 'startup' : s.regime];
  let ircBase = 0;
  if (s.isPME && !s.isStartup) {
    const bracket1 = Math.min(materiaColetavel, PME_BRACKET);
    const bracket2 = Math.max(0, materiaColetavel - PME_BRACKET);
    ircBase = bracket1 * r.pme + bracket2 * r.main;
  } else {
    ircBase = materiaColetavel * r.main;
  }

  // Derrama Estadual (apenas continental ou açores)
  const derramaEstadual = s.territorio === 'madeira' ? 0 : calcDerramaEstadual(materiaColetavel, s.territorio);

  // TA
  const taViaturas = s.viaturas.reduce((sum, v) => sum + calcTAVeiculo(v, s.agravamentoTA), 0);
  const agr = s.agravamentoTA ? 1.1 : 1;
  const taOutras =
    s.ta_despNaoDocPrincipal   * 0.50 * agr +
    s.ta_despNaoDocNaoPrincipal* 0.70 * agr +
    s.ta_representacao          * 0.10 * agr +
    s.ta_ajadasCusto            * 0.05 * agr +
    s.ta_lucrosDistribuidos     * 0.23 * agr +
    s.ta_offshores              * 0.35 * agr +
    s.ta_indemCessacao          * 0.35 * agr +
    s.ta_bonus                  * 0.35 * agr;

  const taTotal = taViaturas + taOutras;
  const ircLiquidacao = ircBase + derramaEstadual + taTotal;

  // PEC
  const pecBruto = s.volumeNegocios * 0.01 - s.retencoesFonte;
  const pecCalculado = Math.max(850, Math.min(70_000, pecBruto));

  // PC
  const pcRates = PC_RATES[s.territorio];
  const vn = s.volumeNegocios;
  let pcCalculado = 0;
  if (vn <= 500_000) {
    pcCalculado = vn * pcRates[0];
  } else if (vn <= 5_000_000) {
    pcCalculado = 500_000 * pcRates[0] + (vn - 500_000) * pcRates[1];
  } else {
    pcCalculado = 500_000 * pcRates[0] + 4_500_000 * pcRates[1] + (vn - 5_000_000) * pcRates[2];
  }

  const totalDeducoesColeta = s.retencoesFonte + s.pecPagamentos + s.pcPagamentos + s.pagamentosAdicionais;
  const ircApagar = Math.max(0, ircLiquidacao - totalDeducoesColeta);

  return {
    c708, c753, c776, lucroTributavel, prejuizoFiscal,
    materiaColetavel, ircBase, derramaEstadual, taTotal,
    ircLiquidacao, pecCalculado, pcCalculado,
    totalDeducoesColeta, ircApagar,
  };
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => (n * 100).toFixed(2) + '%';

function NumInput({ label, value, onChange, help, indent = false }: {
  label: string; value: number; onChange: (v: number) => void;
  help?: string; indent?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-3 py-1.5', indent && 'pl-4')}>
      <label className="flex-1 text-[12px] font-[500] text-slate-600 leading-snug">{label}</label>
      {help && <span className="text-[10px] text-slate-400 hidden sm:block">{help}</span>}
      <input
        type="number"
        step="0.01"
        value={value || ''}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-36 text-right text-[13px] font-[600] text-[#0F172A] border border-slate-200 rounded-[8px] px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#781D1D]/30 focus:border-[#781D1D]"
        placeholder="0,00"
      />
    </div>
  );
}

function ResultRow({ label, value, highlight = false, sub = false }: {
  label: string; value: number | string; highlight?: boolean; sub?: boolean;
}) {
  return (
    <div className={cn(
      'flex items-center justify-between py-2 px-4 rounded-[8px]',
      highlight ? 'bg-[#781D1D]/8 border border-[#781D1D]/20' : sub ? 'pl-8' : '',
    )}>
      <span className={cn('text-[12px] font-[500] text-slate-600', highlight && 'font-[700] text-[#781D1D]')}>{label}</span>
      <span className={cn('text-[13px] font-[700] tabular-nums', highlight ? 'text-[#781D1D]' : 'text-[#0F172A]')}>
        {typeof value === 'number' ? fmt(value) + ' €' : value}
      </span>
    </div>
  );
}

function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-[12px] overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-[12px] font-[700] text-[#0F172A] uppercase tracking-[0.5px]">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-4 py-3 divide-y divide-slate-50">{children}</div>}
    </div>
  );
}

const TABS = ['Identificação', 'Q07 Apuramento', 'Q09 Mat. Coletável', 'TA', 'Resultados'] as const;
type Tab = typeof TABS[number];

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  initialState?: Partial<PreviSaState>;
  onStateChange?: (s: PreviSaState) => void;
}

export default function PreviSaSimulator({ initialState, onStateChange }: Props = {}) {
  const [state, setState] = useState<PreviSaState>(() => ({ ...defaultPreviSaState(), ...initialState }));
  const [tab, setTab] = useState<Tab>('Identificação');

  // Sync when external SAF-T data changes (only non-zero/non-empty fields)
  useEffect(() => {
    if (!initialState || Object.keys(initialState).length === 0) return;
    setState(prev => ({ ...prev, ...initialState }));
  }, [JSON.stringify(initialState)]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback(<K extends keyof PreviSaState>(key: K, value: PreviSaState[K]) => {
    setState(prev => {
      const next = { ...prev, [key]: value };
      onStateChange?.(next);
      return next;
    });
  }, [onStateChange]);

  const addViatura = () => {
    setState(prev => ({
      ...prev,
      viaturas: [...prev.viaturas, {
        id: Math.random().toString(36).slice(2),
        ano: new Date().getFullYear(),
        combustivel: 'convencional',
        custoHistorico: 0,
        encargos: 0,
      }],
    }));
  };

  const updateViatura = (id: string, patch: Partial<ViaturaRow>) => {
    setState(prev => ({
      ...prev,
      viaturas: prev.viaturas.map(v => v.id === id ? { ...v, ...patch } : v),
    }));
  };

  const removeViatura = (id: string) => {
    setState(prev => ({ ...prev, viaturas: prev.viaturas.filter(v => v.id !== id) }));
  };

  const res = calculate(state);

  return (
    <div className="h-full flex flex-col bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shrink-0">
        <h1 className="text-[20px] font-[800] text-[#0F172A] leading-tight">Simulador PreviSa</h1>
        <p className="text-[12px] text-slate-500 font-[500] mt-0.5">IRC — Modelo 22 · Previsão de IRC</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 overflow-x-auto scrollbar-none shrink-0">
        <div className="flex gap-0 min-w-max">
          {TABS.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-3 text-[12px] font-[600] border-b-2 transition-colors whitespace-nowrap',
                tab === t
                  ? 'border-[#781D1D] text-[#781D1D]'
                  : 'border-transparent text-slate-500 hover:text-[#0F172A] hover:border-slate-300',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: inputs */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* ── IDENTIFICAÇÃO ── */}
            {tab === 'Identificação' && (
              <>
                <Section title="Identificação da Empresa">
                  <div className="space-y-3 py-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-[600] text-slate-500 mb-1">NIF</label>
                        <input value={state.nif} onChange={e => set('nif', e.target.value)}
                          placeholder="500000000"
                          className="w-full text-[13px] font-[600] border border-slate-200 rounded-[8px] px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#781D1D]/30 focus:border-[#781D1D]" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-[600] text-slate-500 mb-1">Período</label>
                        <input type="number" value={state.periodo} onChange={e => set('periodo', parseInt(e.target.value) || 2024)}
                          className="w-full text-[13px] font-[600] border border-slate-200 rounded-[8px] px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#781D1D]/30 focus:border-[#781D1D]" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-[600] text-slate-500 mb-1">Designação Social</label>
                      <input value={state.designacao} onChange={e => set('designacao', e.target.value)}
                        placeholder="Nome da empresa"
                        className="w-full text-[13px] font-[600] border border-slate-200 rounded-[8px] px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#781D1D]/30 focus:border-[#781D1D]" />
                    </div>
                  </div>
                </Section>

                <Section title="Regime Fiscal">
                  <div className="space-y-3 py-1">
                    <div>
                      <label className="block text-[11px] font-[600] text-slate-500 mb-1">Regime</label>
                      <select value={state.regime} onChange={e => set('regime', e.target.value as Regime)}
                        className="w-full text-[13px] font-[600] border border-slate-200 rounded-[8px] px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#781D1D]/30 focus:border-[#781D1D]">
                        <option value="geral">Regime Geral (Continental)</option>
                        <option value="madeira">Região Autónoma da Madeira</option>
                        <option value="acores">Região Autónoma dos Açores</option>
                        <option value="interioridade">Interioridade</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-[600] text-slate-500 mb-1">Território</label>
                      <select value={state.territorio} onChange={e => set('territorio', e.target.value as Territorio)}
                        className="w-full text-[13px] font-[600] border border-slate-200 rounded-[8px] px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#781D1D]/30 focus:border-[#781D1D]">
                        <option value="continental">Continental</option>
                        <option value="madeira">Madeira</option>
                        <option value="acores">Açores</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={state.isPME} onChange={e => set('isPME', e.target.checked)}
                        className="w-4 h-4 accent-[#781D1D]" />
                      <span className="text-[13px] font-[600] text-[#0F172A]">PME (beneficia da taxa reduzida nos primeiros €50.000)</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={state.isStartup} onChange={e => set('isStartup', e.target.checked)}
                        className="w-4 h-4 accent-[#781D1D]" />
                      <span className="text-[13px] font-[600] text-[#0F172A]">Startup (Lei 21/2023 — taxa 12,5% em toda a matéria)</span>
                    </label>
                    <NumInput label="Volume de Negócios (€)" value={state.volumeNegocios} onChange={v => set('volumeNegocios', v)} help="Para PEC/PC" />
                  </div>
                </Section>
              </>
            )}

            {/* ── Q07 ── */}
            {tab === 'Q07 Apuramento' && (
              <>
                <Section title="Ponto de Partida — Campo 708">
                  <NumInput label="701 — Resultado antes de impostos (RAI)" value={state.c701_rai} onChange={v => set('c701_rai', v)} />
                  <NumInput label="702 — Variações de justo valor (a acrescer)" value={state.c702} onChange={v => set('c702', v)} indent />
                  <NumInput label="703 — Ajustamentos e perdas por imparidade (a acrescer)" value={state.c703} onChange={v => set('c703', v)} indent />
                  <NumInput label="704 — Variações de justo valor (a deduzir)" value={state.c704} onChange={v => set('c704', v)} indent />
                  <NumInput label="705 — Reversão de ajustamentos (a deduzir)" value={state.c705} onChange={v => set('c705', v)} indent />
                  <NumInput label="706 — Mais-valias contabilísticas (a acrescer)" value={state.c706} onChange={v => set('c706', v)} indent />
                  <NumInput label="707 — Menos-valias contabilísticas (a deduzir)" value={state.c707} onChange={v => set('c707', v)} indent />
                  <div className="flex items-center justify-between py-2 bg-slate-50 rounded-[8px] px-3 mt-1">
                    <span className="text-[12px] font-[700] text-[#0F172A]">708 — Base de apuramento</span>
                    <span className="text-[14px] font-[800] text-[#781D1D] tabular-nums">{fmt(res.c708)} €</span>
                  </div>
                </Section>

                <Section title="A Acrescer (campos 709–752)" defaultOpen={false}>
                  {([
                    ['709','Encargos não documentados'], ['710','Impostos e outros (incl. IRC)'],
                    ['711','Multas e penalidades'], ['712','Indemnizações'],
                    ['713','Ajudas de custo e compensações s/ TA'], ['714','Representação s/ TA'],
                    ['715','Provisões não dedutíveis'], ['716','Perdas por imparidade créditos não aceites'],
                    ['717','Gastos com viaturas (excedente)'], ['718','Depreciações não aceites'],
                    ['719','Donativos não dedutíveis'], ['720','Diferenças cambiais'],
                    ['721','Preços de transferência'], ['722','Regime simplificado — diferença'],
                    ['723','Despesas de financiamento excessivas'], ['724','Correções de exercícios anteriores'],
                    ['725','Outros acréscimos'], ['726','Subcapitalização'],
                    ['727','Limitação de perdas (SGPS)'], ['728','Reintegrações e amortizações excedentes'],
                    ['729','Imparidades em inventários não aceites'], ['730','Gastos em R&D (regime especial)'],
                    ['731','Donativos mecenato excedente'], ['732','Mais-valias fiscais'],
                    ['733','Regime tributação grupos'], ['734','Benefícios pós emprego — diferença'],
                    ['735','Perdas em assoc. (MEP)'], ['736','Correções art. 135.º'],
                    ['737','Regime simplif. grupos'], ['738','Variações patrimoniaisPos'],
                    ['739','Rendimentos isentos (acrescer)'], ['740','Correções cambiais'],
                    ['741','Excedentes RETGS'], ['742','Juros compensatórios'],
                    ['743','Art. 67.º CIRC excedente'], ['744','Outras corr. por acrescer'],
                    ['745','Art. 72.º — limitação amort.'], ['746','Regime fiscal investimento'],
                    ['747','Diferenças temporárias'], ['748','IRC outros países'],
                    ['749','Donativos (entidades públicas)'], ['750','Gastos não aceites (outros)'],
                    ['751','Outros'], ['752','Total acréscimos (calculado)'],
                  ] as [string, string][]).map(([c, lbl]) => {
                    const stateKey = `c${c}` as keyof PreviSaState;
                    if (c === '752') return (
                      <div key={c} className="flex items-center justify-between py-2 bg-slate-50 rounded-[8px] px-3 mt-1">
                        <span className="text-[12px] font-[700]">752 — Total a acrescer</span>
                        <span className="text-[13px] font-[800] text-[#781D1D] tabular-nums">{fmt(res.c753 - res.c708)} €</span>
                      </div>
                    );
                    return (
                      <div key={c}>
                        <NumInput label={`${c} — ${lbl}`}
                          value={state[stateKey] as number}
                          onChange={v => set(stateKey, v as PreviSaState[typeof stateKey])} indent />
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between py-2 bg-slate-50 rounded-[8px] px-3 mt-1">
                    <span className="text-[12px] font-[700]">753 — Soma (708 + acréscimos)</span>
                    <span className="text-[14px] font-[800] text-[#781D1D] tabular-nums">{fmt(res.c753)} €</span>
                  </div>
                </Section>

                <Section title="A Deduzir (campos 754–776)" defaultOpen={false}>
                  {([
                    ['754','Dividendos isentos (art. 51.º)'], ['755','Mais-valias isentas (art. 48.º)'],
                    ['756','Rendimentos estabelecimentos estáveis isentos'], ['757','Reversão de provisões (tributadas)'],
                    ['758','Variações patrimoniais negativas'], ['759','Diferenças cambiais (a deduzir)'],
                    ['760','Perdas de ex. anteriores (reconhecidas)'], ['761','Imparidades em dívidas a receber'],
                    ['762','Perdas em assoc. (MEP) — dedutíveis'], ['763','Benefício fiscal SIFIDE / CFEI'],
                    ['764','Rendimentos sujeitos a TE'], ['765','Diferenças temporárias (a deduzir)'],
                    ['766','Reversão prejuízo reconhecido'], ['767','Dedução lucros reinvestidos (art. 48.º)'],
                    ['768','Menos-valias fiscais'], ['769','Deduções regime simplif.'],
                    ['770','Outros regimes especiais'], ['771','Remuneração convencional capital social'],
                    ['772','Deduções art. 67.º'], ['773','Rendimentos isentos (a deduzir)'],
                    ['774','Benefícios fiscais (RFAI, SIFIDE…)'], ['775','Outros'],
                  ] as [string, string][]).map(([c, lbl]) => {
                    const stateKey = `c${c}` as keyof PreviSaState;
                    return (
                      <div key={c}>
                        <NumInput label={`${c} — ${lbl}`}
                          value={state[stateKey] as number}
                          onChange={v => set(stateKey, v as PreviSaState[typeof stateKey])} indent />
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between py-2 bg-slate-50 rounded-[8px] px-3 mt-1">
                    <span className="text-[12px] font-[700]">776 — Total a deduzir</span>
                    <span className="text-[14px] font-[800] text-emerald-700 tabular-nums">{fmt(res.c776)} €</span>
                  </div>
                </Section>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white border border-slate-200 rounded-[12px] p-4">
                    <p className="text-[11px] font-[600] text-slate-500 uppercase tracking-[0.5px]">778 — Lucro Tributável</p>
                    <p className="text-[22px] font-[800] text-[#0F172A] tabular-nums mt-1">{fmt(res.lucroTributavel)} €</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-[12px] p-4">
                    <p className="text-[11px] font-[600] text-slate-500 uppercase tracking-[0.5px]">777 — Prejuízo Fiscal</p>
                    <p className="text-[22px] font-[800] text-emerald-700 tabular-nums mt-1">{fmt(res.prejuizoFiscal)} €</p>
                  </div>
                </div>
              </>
            )}

            {/* ── Q09 ── */}
            {tab === 'Q09 Mat. Coletável' && (
              <Section title="Matéria Coletável — Q09">
                <div className="py-2 bg-slate-50 rounded-[8px] px-3 flex justify-between items-center">
                  <span className="text-[12px] font-[700]">Lucro Tributável (de Q07)</span>
                  <span className="text-[14px] font-[700] tabular-nums">{fmt(res.lucroTributavel)} €</span>
                </div>
                <NumInput label="Prejuízos fiscais a deduzir" value={state.prejuizosDeduzir}
                  onChange={v => set('prejuizosDeduzir', v)}
                  help={`Limite: ${pct(state.limiteMaisPP ? 0.75 : 0.65)} do LT`} />
                <label className="flex items-center gap-3 py-1.5 cursor-pointer">
                  <input type="checkbox" checked={state.limiteMaisPP} onChange={e => set('limiteMaisPP', e.target.checked)}
                    className="w-4 h-4 accent-[#781D1D]" />
                  <span className="text-[12px] font-[500] text-slate-600">
                    Aumentar limite de dedução para 75% (micro/pequenas com perda {'>'} 25% capital próprio)
                  </span>
                </label>
                <NumInput label="Benefícios fiscais (RFAI, SIFIDE, etc.)" value={state.beneficiosFiscais}
                  onChange={v => set('beneficiosFiscais', v)} />
                <div className="py-2 bg-[#781D1D]/8 border border-[#781D1D]/20 rounded-[8px] px-3 flex justify-between items-center mt-2">
                  <span className="text-[12px] font-[700] text-[#781D1D]">Matéria Coletável</span>
                  <span className="text-[18px] font-[800] text-[#781D1D] tabular-nums">{fmt(res.materiaColetavel)} €</span>
                </div>
              </Section>
            )}

            {/* ── TA ── */}
            {tab === 'TA' && (
              <>
                <Section title="Tributações Autónomas — Viaturas">
                  <label className="flex items-center gap-3 py-1.5 cursor-pointer">
                    <input type="checkbox" checked={state.agravamentoTA} onChange={e => set('agravamentoTA', e.target.checked)}
                      className="w-4 h-4 accent-[#781D1D]" />
                    <span className="text-[12px] font-[500] text-slate-600">Agravamento de 10% (empresa com prejuízo fiscal no período)</span>
                  </label>

                  {state.viaturas.length === 0 && (
                    <p className="text-[12px] text-slate-400 py-3 text-center">Sem viaturas adicionadas</p>
                  )}

                  {state.viaturas.map(v => (
                    <div key={v.id} className="bg-slate-50 rounded-[10px] p-3 flex flex-col gap-2 mt-2 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-[700] text-slate-500 uppercase tracking-[0.5px]">Viatura</span>
                        <button type="button" onClick={() => removeViatura(v.id)}
                          className="text-red-400 hover:text-red-600 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-[600] text-slate-400 mb-0.5">Combustível</label>
                          <select value={v.combustivel}
                            onChange={e => updateViatura(v.id, { combustivel: e.target.value as FuelType })}
                            className="w-full text-[12px] border border-slate-200 rounded-[6px] px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#781D1D]/30">
                            <option value="convencional">Convencional / GPL / Plug-in</option>
                            <option value="plug_in_5050">Plug-in (50%/50%)</option>
                            <option value="gnv">GNV</option>
                            <option value="eletrico">Elétrico</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-[600] text-slate-400 mb-0.5">Custo histórico (€)</label>
                          <input type="number" value={v.custoHistorico || ''}
                            onChange={e => updateViatura(v.id, { custoHistorico: parseFloat(e.target.value) || 0 })}
                            placeholder="0,00"
                            className="w-full text-[12px] border border-slate-200 rounded-[6px] px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#781D1D]/30 text-right" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-[600] text-slate-400 mb-0.5">Encargos com viatura no período (€)</label>
                        <input type="number" value={v.encargos || ''}
                          onChange={e => updateViatura(v.id, { encargos: parseFloat(e.target.value) || 0 })}
                          placeholder="0,00"
                          className="w-full text-[12px] border border-slate-200 rounded-[6px] px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#781D1D]/30 text-right" />
                      </div>
                      <div className="flex justify-between text-[11px] font-[600]">
                        <span className="text-slate-500">TA calculada:</span>
                        <span className="text-[#781D1D]">{fmt(calcTAVeiculo(v, state.agravamentoTA))} €</span>
                      </div>
                    </div>
                  ))}

                  <button type="button" onClick={addViatura}
                    className="mt-3 flex items-center gap-2 px-3 py-2 text-[12px] font-[600] text-[#781D1D] border border-dashed border-[#781D1D]/40 rounded-[8px] hover:bg-[#781D1D]/5 transition-colors w-full justify-center">
                    <Plus className="w-4 h-4" />
                    Adicionar viatura
                  </button>
                </Section>

                <Section title="Outras Tributações Autónomas">
                  <NumInput label="Despesas não documentadas (suj. atividade principal)" value={state.ta_despNaoDocPrincipal} onChange={v => set('ta_despNaoDocPrincipal', v)} help="50%" />
                  <NumInput label="Despesas não documentadas (não atividade principal)" value={state.ta_despNaoDocNaoPrincipal} onChange={v => set('ta_despNaoDocNaoPrincipal', v)} help="70%" />
                  <NumInput label="Encargos de representação" value={state.ta_representacao} onChange={v => set('ta_representacao', v)} help="10%" />
                  <NumInput label="Ajudas de custo e comp. de viagem" value={state.ta_ajadasCusto} onChange={v => set('ta_ajadasCusto', v)} help="5%" />
                  <NumInput label="Lucros distribuídos a entidades isentas" value={state.ta_lucrosDistribuidos} onChange={v => set('ta_lucrosDistribuidos', v)} help="23%" />
                  <NumInput label="Pagamentos a entidades em offshores" value={state.ta_offshores} onChange={v => set('ta_offshores', v)} help="35%" />
                  <NumInput label="Indemnizações por cessação de funções" value={state.ta_indemCessacao} onChange={v => set('ta_indemCessacao', v)} help="35%" />
                  <NumInput label="Bónus e remunerações variáveis de gestores" value={state.ta_bonus} onChange={v => set('ta_bonus', v)} help="35%" />
                </Section>
              </>
            )}

            {/* ── RESULTADOS ── */}
            {tab === 'Resultados' && (
              <Section title="Pagamentos por Conta e Deduções à Coleta">
                <NumInput label="Retenções na fonte" value={state.retencoesFonte} onChange={v => set('retencoesFonte', v)} />
                <NumInput label="PEC — pagamentos efectuados" value={state.pecPagamentos} onChange={v => set('pecPagamentos', v)}
                  help={`Calculado: ${fmt(res.pecCalculado)} €`} />
                <NumInput label="PC — pagamentos por conta" value={state.pcPagamentos} onChange={v => set('pcPagamentos', v)}
                  help={`Estimado: ${fmt(res.pcCalculado)} €`} />
                <NumInput label="Pagamentos adicionais por conta" value={state.pagamentosAdicionais} onChange={v => set('pagamentosAdicionais', v)} />
              </Section>
            )}
          </div>

          {/* Right: results summary — always visible */}
          <div className="flex flex-col gap-3 lg:sticky lg:top-6 self-start">
            <div className="bg-white border border-slate-200 rounded-[16px] overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-[#781D1D] to-[#b83030]" />
              <div className="p-4">
                <p className="text-[11px] font-[700] uppercase tracking-[0.5px] text-slate-400 mb-3">Resumo IRC {state.periodo}</p>

                <div className="space-y-1">
                  <ResultRow label="Lucro Tributável" value={res.lucroTributavel} />
                  <ResultRow label="Prejuízo Fiscal" value={res.prejuizoFiscal} sub />
                  <ResultRow label="Matéria Coletável" value={res.materiaColetavel} />
                  <div className="border-t border-slate-100 my-1" />
                  <ResultRow label="IRC (taxa)" value={res.ircBase} />
                  <ResultRow label="Derrama Estadual" value={res.derramaEstadual} sub />
                  <ResultRow label="Tributações Autónomas" value={res.taTotal} sub />
                  <ResultRow label="IRC Liquidação" value={res.ircLiquidacao} highlight />
                  <div className="border-t border-slate-100 my-1" />
                  <ResultRow label="Deduções à coleta" value={res.totalDeducoesColeta} sub />
                  <ResultRow label="IRC a pagar" value={res.ircApagar} highlight />
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400 font-[500]">Taxa IRC base</span>
                    <span className="font-[700] text-slate-600">
                      {state.isPME && !state.isStartup
                        ? `${pct(RATES[state.regime].pme)} / ${pct(RATES[state.regime].main)}`
                        : pct(RATES[state.isStartup ? 'startup' : state.regime].main)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400 font-[500]">PEC estimado</span>
                    <span className="font-[700] text-slate-600">{fmt(res.pecCalculado)} €</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400 font-[500]">PC estimado</span>
                    <span className="font-[700] text-slate-600">{fmt(res.pcCalculado)} €</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400 font-[500]">Taxa efectiva</span>
                    <span className="font-[700] text-slate-600">
                      {state.c701_rai !== 0 ? pct(res.ircLiquidacao / Math.abs(state.c701_rai)) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setState(defaultPreviSaState())}
              className="text-[12px] font-[600] text-slate-400 hover:text-red-500 transition-colors py-2 text-center"
            >
              Limpar simulação
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
