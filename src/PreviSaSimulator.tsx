import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, ChevronRight, Plus, Trash2, Calculator, Download } from 'lucide-react';
import { cn } from './lib/utils';
import type { Regime, Territorio, FuelType, ViaturaRow, PreviSaState } from './previSaState';
import { defaultPreviSaState } from './previSaState';
import { FlowWizard, type FlowStep } from './FlowWizard';
import { useFlowMode } from './AnimatedPage';
import { downloadPrevisaExcel } from './lib/previsaExcel';

export type { PreviSaState } from './previSaState';
export { defaultPreviSaState } from './previSaState';

// ─── Constants ────────────────────────────────────────────────────────────────

const PME_BRACKET = 50_000;

// Taxas de IRC OE 2026 — CIRC Art. 87.º (Lei 73-A/2025, em vigor a 1-jan-2026).
// Taxa geral baixou de 20% para 19%; PME continua 15% sobre os primeiros €50.000.
// Madeira: 13,3% geral (era 14%) / 10,5% PME (era 11,2%) — DL Regional 8/2025/M.
// Açores: redução de 20% sobre a taxa do continente; PME beneficia de taxa especial 8,75%.
// Interior: 12,5% PME (EBF art. 41º-B) — sem redução na taxa geral.
// Startup: 12,5% — regime IFICI (Lei 21/2023), aplica-se sobre a totalidade.
const RATES: Record<Regime, { main: number; pme: number }> = {
  geral:         { main: 0.19,   pme: 0.15   },
  madeira:       { main: 0.133,  pme: 0.105  },
  acores:        { main: 0.152,  pme: 0.0875 },
  interioridade: { main: 0.19,   pme: 0.125  },
  startup:       { main: 0.125,  pme: 0.125  },
};

// Derrama estadual — CIRC Art. 87.º-A (OE 2026, sem alterações vs 2025):
//   0%   até        €1.500.000
//   3%   €1,5M  a   €7,5M
//   5%   €7,5M  a   €35M
//   9%   acima de   €35M
// Para os Açores aplica-se a redução de 20% da Lei das Finanças Regionais (2026):
// taxas multiplicadas por 0,80 = 2,4% / 4,0% / 7,2%.
const DERRAMA_TIERS: Record<'continental' | 'acores', { limit: number; rate: number }[]> = {
  continental: [
    { limit: 1_500_000,  rate: 0    },  // isento até €1,5M
    { limit: 7_500_000,  rate: 0.03 },
    { limit: 35_000_000, rate: 0.05 },
    { limit: Infinity,   rate: 0.09 },
  ],
  acores: [
    { limit: 1_500_000,  rate: 0     }, // isento até €1,5M
    { limit: 7_500_000,  rate: 0.024 }, // 3% × 0,80
    { limit: 35_000_000, rate: 0.04  }, // 5% × 0,80
    { limit: Infinity,   rate: 0.072 }, // 9% × 0,80
  ],
};

const PC_RATES: Record<Territorio, number[]> = {
  continental: [0.025, 0.045, 0.085],
  madeira:     [0.018, 0.032, 0.060],
  acores:      [0.0175, 0.0315, 0.0595],
};

const PEC_LIMITS: Record<Territorio, [number, number]> = {
  continental: [850, 70_000],
  madeira:     [680, 56_000],
  acores:      [680, 56_000],
};

const TA_BRACKETS: { max: number; conv: number; plug5050: number; gnv: number; eletrico: number }[] = [
  { max: 37_500,   conv: 0.08,  plug5050: 0.025, gnv: 0.025, eletrico: 0 },
  { max: 45_000,   conv: 0.25,  plug5050: 0.075, gnv: 0.075, eletrico: 0 },
  { max: 62_500,   conv: 0.32,  plug5050: 0.15,  gnv: 0.15,  eletrico: 0 },
  { max: Infinity, conv: 0.32,  plug5050: 0.15,  gnv: 0.15,  eletrico: 0.10 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sumFields(s: PreviSaState, keys: (keyof PreviSaState)[]): number {
  return keys.reduce((acc, k) => acc + ((s[k] as number) || 0), 0);
}

function calcTAVeiculo(v: ViaturaRow, agravamento: boolean): number {
  const b = TA_BRACKETS.find(x => v.custoHistorico <= x.max) ?? TA_BRACKETS.at(-1)!;
  let rate = 0;
  if      (v.combustivel === 'eletrico')    rate = b.eletrico;
  else if (v.combustivel === 'plug_in_5050') rate = b.plug5050;
  else if (v.combustivel === 'gnv')          rate = b.gnv;
  else                                       rate = b.conv; // convencional or plug_in
  return v.encargos * rate * (agravamento ? 1.1 : 1);
}

function calcDerramaEstadual(mc: number, territorio: Territorio): number {
  if (mc <= 0 || territorio === 'madeira') return 0;
  const tiers = DERRAMA_TIERS[territorio === 'acores' ? 'acores' : 'continental'];
  let tax = 0, prev = 0;
  for (const t of tiers) {
    if (mc <= prev) break;
    tax += (Math.min(mc, t.limit) - prev) * t.rate;
    prev = t.limit;
    if (mc <= t.limit) break;
  }
  return tax;
}

// ─── Calculation engine ───────────────────────────────────────────────────────

interface CalcResult {
  totalRendimentos: number; // soma 711+712+72+74..79 (Excel ' Res Q10'!C21)
  totalGastos: number;      // CMV+CMC+62..69 (Excel ' Res Q10'!C62)
  raiCalc: number;
  effectiveRai: number;
  c708: number;
  acrescer: number;
  c753: number;
  c776: number;
  lucroTributavel: number;
  prejuizoFiscal: number;
  totalPrejuziosDisp: number;
  prejuziosEfetivos: number;
  materiaColetavel: number;
  ircColeta: number;        // c347 + c349
  derramaEstadual: number;
  derrMunicipal: number;
  c378: number;             // total antes deduções
  deducoesColeta: number;   // c357
  c358: number;             // IRC liquidado
  taViaturas: number;
  taOutras: number;
  taBruta: number;
  taTotal: number;          // c365 (líq. art.88n12)
  totalPagamentos: number;  // retFonte + PC + PAC
  c367: number;             // total a pagar (positivo = pagar, negativo = receber)
  pecCalculado: number;
  pcCalculado: number;
}

const ACRESCER_KEYS: (keyof PreviSaState)[] = [
  'c709','c710','c711','c782','c712','c713','c714','c715','c717','c721',
  'c724','c725','c716','c731','c726','c783','c728','c727','c729','c730',
  'c732','c733','c784','c734','c735','c780','c785','c802','c746','c737',
  'c786','c718','c719','c720','c722','c723','c736','c738','c739','c740',
  'c741','c742','c743','c787','c744','c745','c747','c748','c749','c788',
  'c750','c789','c790','c751','c803','c779','c797','c799','c804','c752',
];

const DEDUZIR_KEYS: (keyof PreviSaState)[] = [
  'c754','c755','c756','c757','c791','c758','c759','c760','c761','c762',
  'c763','c781','c764','c765','c766','c792','c767','c768','c769','c770',
  'c793','c771','c794','c772','c795','c773','c796','c774','c800','c801',
  'c798','c775',
];

const PREJ_KEYS: (keyof PreviSaState)[] = [
  'prej_ate2017','prej_2018','prej_2019','prej_2020',
  'prej_2021','prej_2022','prej_2023','prej_2024','c397',
];

function calculate(s: PreviSaState): CalcResult {
  // RAI — mesma demonstração de resultados do Excel ' Res Q10':
  // TOTAL DE RENDIMENTOS (C21) − total de gastos (C62) ± imposto diferido (C64).
  const totalRendimentos =
    s.rai_711 + s.rai_712 + s.rai_72 + s.rai_74 + s.rai_75 +
    s.rai_76 + s.rai_77 + s.rai_78 + s.rai_79;
  const totalGastos =
    s.rai_cmv + s.rai_cmc + s.rai_62 + s.rai_63 + s.rai_64 +
    s.rai_65 + s.rai_66 + s.rai_67 + s.rai_68 + s.rai_69;
  const raiCalc = totalRendimentos - totalGastos + s.rai_8122_db - s.rai_8122_cr;

  const effectiveRai = s.useRaiCalc ? raiCalc : s.c701_rai;

  // Q07 c708
  const c708 = s.c708_override
    ? effectiveRai
    : effectiveRai + s.c702 + s.c703 + s.c805 - s.c704 - s.c705 - s.c806 + s.c706 - s.c707;

  // Q07 acrescer / deduzir
  const acrescer = sumFields(s, ACRESCER_KEYS);
  const c753 = c708 + acrescer;
  const c776 = sumFields(s, DEDUZIR_KEYS);
  const rawLT = c753 - c776;
  const lucroTributavel = Math.max(0, rawLT);
  const prejuizoFiscal  = Math.abs(Math.min(0, rawLT));

  // Q09 prejuízos
  const totalPrejuziosDisp = sumFields(s, PREJ_KEYS);
  const limite = s.limiteMaisPP ? 0.75 : 0.65;
  const prejuziosEfetivos = Math.min(totalPrejuziosDisp, lucroTributavel * limite);
  const materiaColetavel  = Math.max(0, lucroTributavel - prejuziosEfetivos - s.beneficiosFiscais);

  // IRC coleta (c347)
  const r = RATES[s.isStartup ? 'startup' : s.regime];
  let ircBase = 0;
  if (s.isPME && !s.isStartup) {
    ircBase = Math.min(materiaColetavel, PME_BRACKET) * r.pme
            + Math.max(0, materiaColetavel - PME_BRACKET) * r.main;
  } else {
    ircBase = materiaColetavel * r.main;
  }
  const ircColeta = ircBase + s.c349 * s.c349_taxa;

  // Derramas
  const derramaEstadual = calcDerramaEstadual(materiaColetavel, s.territorio);
  const derrMunicipal   = lucroTributavel * s.taxaDerramaMunicipal;

  // c378
  const c378 = ircColeta + derramaEstadual + derrMunicipal;

  // Deduções à coleta (c357)
  const deducoesColeta = s.c353 + s.c375 + s.c355_bf + s.c355_cfei + s.c355_ifr + s.c470;

  // c358 — IRC liquidado
  const c358 = Math.max(0, c378 - deducoesColeta);

  // Tributações Autónomas
  const taViaturas = s.viaturas.reduce((sum, v) => sum + calcTAVeiculo(v, s.agravamentoTA), 0);
  const agr = s.agravamentoTA ? 1.1 : 1;
  const taOutras =
    s.ta_despNaoDocPrincipal    * 0.50 * agr +
    s.ta_despNaoDocNaoPrincipal * 0.70 * agr +
    s.ta_representacao          * 0.10 * agr +
    s.ta_ajadasCusto            * 0.05 * agr +
    s.ta_lucrosDistribuidos     * 0.23 * agr +
    s.ta_offshores              * 0.35 * agr +
    s.ta_indemCessacao          * 0.35 * agr +
    s.ta_bonus                  * 0.35 * agr;
  const taBruta = taViaturas + taOutras;
  const taTotal = Math.max(0, taBruta - s.ta_retFonteArt88n12);

  // Pagamentos
  const totalPagamentos = s.retencoesFonte + s.pcPagamentos + s.pacPagamentos;

  // c367 = IRC a pagar / recuperar
  // pagar = c358 + c365(TA) + c366 + c369 - pecPagamentos - totalPagamentos - c379 + c363 + c372
  const c367 =
    c358 + taTotal + s.c366 + s.c369
    - s.pecPagamentos - totalPagamentos - s.c379
    + s.c363 + s.c372;

  // PEC estimado
  const [pecMin, pecMax] = PEC_LIMITS[s.territorio];
  const pecBruto = s.volumeNegocios * 0.01 - s.retencoesFonte;
  const pecCalculado = pecBruto <= 0 ? 0 : Math.max(pecMin, Math.min(pecMax, pecBruto));

  // PC estimado
  const pcRates = PC_RATES[s.territorio];
  const vn = s.volumeNegocios;
  let pcCalculado = 0;
  if (vn <= 500_000)       pcCalculado = vn * pcRates[0];
  else if (vn <= 5_000_000) pcCalculado = 500_000 * pcRates[0] + (vn - 500_000) * pcRates[1];
  else                      pcCalculado = 500_000 * pcRates[0] + 4_500_000 * pcRates[1] + (vn - 5_000_000) * pcRates[2];

  return {
    totalRendimentos, totalGastos,
    raiCalc, effectiveRai, c708, acrescer, c753, c776,
    lucroTributavel, prejuizoFiscal, totalPrejuziosDisp, prejuziosEfetivos, materiaColetavel,
    ircColeta, derramaEstadual, derrMunicipal, c378, deducoesColeta, c358,
    taViaturas, taOutras, taBruta, taTotal,
    totalPagamentos, c367, pecCalculado, pcCalculado,
  };
}

// ─── UI primitives ────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => (n * 100).toFixed(2) + '%';

function NumInput({ label, value, onChange, help, indent = false, readOnly = false }: {
  label: string; value: number; onChange?: (v: number) => void;
  help?: string; indent?: boolean; readOnly?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-3 py-1.5', indent && 'pl-4')}>
      <label className="flex-1 text-[12px] font-[500] text-slate-600 leading-snug">{label}</label>
      {help && <span className="text-[10px] text-slate-400 hidden sm:block shrink-0">{help}</span>}
      <input
        type="number" step="0.01"
        value={value || ''}
        readOnly={readOnly}
        onChange={e => onChange?.(parseFloat(e.target.value) || 0)}
        className={cn(
          'w-36 text-right text-[13px] font-[600] text-[#0F172A] border border-slate-200 rounded-[8px] px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#0677FF]/30 focus:border-[#0677FF]',
          readOnly && 'bg-slate-50 text-slate-400 cursor-default',
        )}
        placeholder="0,00"
      />
    </div>
  );
}

// O valor guardado é uma FRAÇÃO (1,5% → 0,015); o input mostra a PERCENTAGEM.
// Antes tinha max="1" aplicado à escala da percentagem → travava em 1,000% e
// não deixava inserir 1,5%. Agora sem esse limite, com step 0,01 e estado de
// texto local (só reformata ao perder o foco) para escrever sem saltos.
function PctInput({ label, value, onChange, help }: {
  label: string; value: number; onChange: (v: number) => void; help?: string;
}) {
  const fmtPct = (v: number) => (v ? String(+(v * 100).toFixed(3)) : '');
  const [txt, setTxt] = useState<string>(() => fmtPct(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setTxt(fmtPct(value)); }, [value]);
  return (
    <div className="flex items-center gap-3 py-1.5">
      <label className="flex-1 text-[12px] font-[500] text-slate-600 leading-snug">{label}</label>
      {help && <span className="text-[10px] text-slate-400 hidden sm:block shrink-0">{help}</span>}
      <div className="relative w-36">
        <input
          type="number" step="0.01" min="0"
          value={txt}
          onFocus={() => { focused.current = true; }}
          onBlur={() => { focused.current = false; setTxt(fmtPct(value)); }}
          onChange={e => {
            setTxt(e.target.value);
            const n = parseFloat(e.target.value);
            onChange(Number.isFinite(n) && n >= 0 ? n / 100 : 0);
          }}
          className="w-full text-right text-[13px] font-[600] text-[#0F172A] border border-slate-200 rounded-[8px] px-3 py-1.5 pr-6 bg-white focus:outline-none focus:ring-2 focus:ring-[#0677FF]/30 focus:border-[#0677FF]"
          placeholder="0,000"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">%</span>
      </div>
    </div>
  );
}

function ResultRow({ label, value, highlight = false, sub = false, positive = false }: {
  label: string; value: number | string; highlight?: boolean; sub?: boolean; positive?: boolean;
}) {
  return (
    <div className={cn(
      'flex items-center justify-between py-2 px-3 rounded-[8px]',
      highlight ? 'bg-[#0677FF]/8 border border-[#0677FF]/20' : sub ? 'pl-6' : '',
    )}>
      <span className={cn('text-[12px] font-[500] text-slate-600', highlight && 'font-[700] text-[#0677FF]')}>{label}</span>
      <span className={cn('text-[13px] font-[700] tabular-nums',
        highlight ? 'text-[#0677FF]' : positive ? 'text-emerald-700' : 'text-[#0F172A]')}>
        {typeof value === 'number' ? fmt(value) + ' €' : value}
      </span>
    </div>
  );
}

function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-[12px] overflow-hidden">
      <button type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        onClick={() => setOpen(o => !o)}>
        <span className="text-[12px] font-[700] text-[#0F172A] uppercase tracking-[0.5px]">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-4 py-3 divide-y divide-slate-50">{children}</div>}
    </div>
  );
}

function CalcRow({ label, value, highlight = false, indent = false }: {
  label: string; value: number; highlight?: boolean; indent?: boolean;
}) {
  return (
    <div className={cn(
      'flex items-center justify-between py-2 px-3 rounded-[8px]',
      highlight ? 'bg-[#0677FF]/8 border border-[#0677FF]/20' : 'bg-slate-50',
      indent && 'ml-4',
    )}>
      <span className={cn('text-[12px] font-[700]', highlight ? 'text-[#0677FF]' : 'text-[#0F172A]')}>{label}</span>
      <span className={cn('text-[13px] font-[800] tabular-nums', highlight ? 'text-[#0677FF]' : 'text-[#0F172A]')}>{fmt(value)} €</span>
    </div>
  );
}

// ─── Q07 campo lists ──────────────────────────────────────────────────────────

const ACRESCER_LABELS: [string, string][] = [
  ['c709','709 — Encargos não documentados (art.23-A n.1 a))'],
  ['c710','710 — IRC, IS e outros impostos não dedutíveis'],
  ['c711','711 — Multas, coimas e encargos de mora'],
  ['c782','782 — Diferença positiva preço aquisição (OE2014)'],
  ['c712','712 — Indemnizações pagas'],
  ['c713','713 — Ajudas de custo e comp. além TA'],
  ['c714','714 — Encargos de representação além TA'],
  ['c715','715 — Provisões não aceites (art.39)'],
  ['c717','717 — Encargos com viaturas (excedente art.34)'],
  ['c721','721 — Diferença preços de transferência (art.63)'],
  ['c724','724 — Correções de exercícios anteriores'],
  ['c725','725 — Outros acréscimos'],
  ['c716','716 — Perdas por imparidade créditos não aceites'],
  ['c731','731 — Donativos mecenato excedente'],
  ['c726','726 — Subcapitalização (art.67)'],
  ['c783','783 — Correções art.78 n.3 CIRC'],
  ['c728','728 — Reintegrações e amortizações não aceites'],
  ['c727','727 — SGPS — perdas e variações de JV'],
  ['c729','729 — Imparidades em inventários não aceites'],
  ['c730','730 — Gastos regime R&D (art.59-D)'],
  ['c732','732 — Mais-valias fiscais (art.46)'],
  ['c733','733 — Regime tributação grupos (art.70)'],
  ['c784','784 — Correções OE2008 (art.45-A)'],
  ['c734','734 — Benefícios pós-emprego — diferença'],
  ['c735','735 — Perdas em associadas (MEP) não aceites'],
  ['c780','780 — Contratos construção — alteração regime (+)'],
  ['c785','785 — Outros acréscimos (art.18 n.9)'],
  ['c802','802 — Mensuração contratos seguros (+) OE2024'],
  ['c746','746 — RETGS — excedente'],
  ['c737','737 — Regime simplificado — diferença'],
  ['c786','786 — Limitação gastos financiamentos (art.67)'],
  ['c718','718 — Depreciações e amortizações não aceites'],
  ['c719','719 — Donativos não aceites (art.62)'],
  ['c720','720 — Diferenças cambiais não aceites'],
  ['c722','722 — Regime simplificado grupo — diferença'],
  ['c723','723 — Despesas de financiamento excessivas (art.67)'],
  ['c736','736 — Correções art.135 CIRC'],
  ['c738','738 — Variações patrimoniais positivas (a acrescer)'],
  ['c739','739 — Rendimentos isentos/não sujeitos (revertidos)'],
  ['c740','740 — Diferenças cambiais — correção art.18 n.10'],
  ['c741','741 — Excedentes RETGS'],
  ['c742','742 — Juros compensatórios (art.102)'],
  ['c743','743 — Excedente art.67 n.1 (limitação gastos)'],
  ['c787','787 — Correção SGPS art.32 (ganhos JV)'],
  ['c744','744 — Outras correções a acrescer'],
  ['c745','745 — Limitação amortizações art.72'],
  ['c747','747 — Diferenças temporárias (a acrescer)'],
  ['c748','748 — IRC pago no estrangeiro (art.91-A n.1b)'],
  ['c749','749 — Donativos a entidades públicas (excedente)'],
  ['c788','788 — Depreciações art.34-A'],
  ['c750','750 — Gastos não aceites — art.23-A'],
  ['c789','789 — Benefícios fiscais — reposição'],
  ['c790','790 — Correções cambiais art.18 n.10'],
  ['c751','751 — Outros acréscimos (especificados)'],
  ['c803','803 — Transição IFRS 17 (+)'],
  ['c779','779 — Limitação benefícios fiscais (art.92)'],
  ['c797','797 — Correção art.48 n.7 (+)'],
  ['c799','799 — Subvenções art.22-A (a acrescer)'],
  ['c804','804 — Transição IFRS 17 — reajustamento (+)'],
  ['c752','752 — Outros acréscimos (campo livre)'],
];

const DEDUZIR_LABELS: [string, string][] = [
  ['c754','754 — Rendimentos sujeitos a tributação autónoma'],
  ['c755','755 — Rendimentos já tributados noutro período'],
  ['c756','756 — Ajustamentos não aceites (a deduzir)'],
  ['c757','757 — Reversão de provisões (tributadas)'],
  ['c791','791 — Diferença negativa preço aquisição (OE2014)'],
  ['c758','758 — Variações patrimoniais negativas (a deduzir)'],
  ['c759','759 — Diferenças cambiais (a deduzir)'],
  ['c760','760 — Perdas de exercícios anteriores (reconhecidas)'],
  ['c761','761 — Imparidades dívidas a receber (aceites)'],
  ['c762','762 — Perdas em associadas (MEP) aceites'],
  ['c763','763 — Rendimentos sujeitos a taxa especial (art.7)'],
  ['c781','781 — Correções art.78 n.3 CIRC (a deduzir)'],
  ['c764','764 — Rendimentos estabelecimentos estáveis isentos'],
  ['c765','765 — Diferenças temporárias (a deduzir)'],
  ['c766','766 — Reversão prejuízo reconhecido'],
  ['c792','792 — Correções OE2008 (art.45-A) a deduzir'],
  ['c767','767 — Dedução lucros reinvestidos (RFAI)'],
  ['c768','768 — Menos-valias fiscais (art.46)'],
  ['c769','769 — Deduções regime simplificado'],
  ['c770','770 — Outros regimes especiais'],
  ['c793','793 — Outros a deduzir (art.18 n.9)'],
  ['c771','771 — Remuneração convencional capital social'],
  ['c794','794 — SGPS art.32 (perdas JV)'],
  ['c772','772 — Deduções art.67 (excedentes anteriores)'],
  ['c795','795 — Rendimentos não tributados — dedução'],
  ['c773','773 — Rendimentos isentos — art.7'],
  ['c796','796 — Correção art.135 CIRC (a deduzir)'],
  ['c774','774 — Benefícios fiscais (dedução lucro tributável)'],
  ['c800','800 — Benefícios RFAI/DLRR (a deduzir no LT)'],
  ['c801','801 — Deduções art.48 n.7'],
  ['c798','798 — Subvenções art.22-A (a deduzir)'],
  ['c775','775 — Outros a deduzir (campo livre)'],
];

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = ['Identificação', 'Rendimentos', 'Q07 Apuramento', 'Q09 Mat. Coletável', 'TA', 'Q10 Cálculo'] as const;
type Tab = typeof TABS[number];

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  initialState?: Partial<PreviSaState>;
  onStateChange?: (s: PreviSaState) => void;
}

export default function PreviSaSimulator({ initialState, onStateChange }: Props = {}) {
  const [state, setState] = useState<PreviSaState>(() => ({ ...defaultPreviSaState(), ...initialState }));
  const [tab, setTab] = useState<Tab>('Identificação');
  const { flowMode, exitFlow } = useFlowMode();

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

  const addViatura = () => setState(prev => ({
    ...prev,
    viaturas: [...prev.viaturas, {
      id: Math.random().toString(36).slice(2),
      ano: new Date().getFullYear(),
      combustivel: 'convencional' as FuelType,
      custoHistorico: 0,
      encargos: 0,
    }],
  }));

  const updateViatura = (id: string, patch: Partial<ViaturaRow>) =>
    setState(prev => ({ ...prev, viaturas: prev.viaturas.map(v => v.id === id ? { ...v, ...patch } : v) }));

  const removeViatura = (id: string) =>
    setState(prev => ({ ...prev, viaturas: prev.viaturas.filter(v => v.id !== id) }));

  const res = calculate(state);

  const [exporting, setExporting] = useState(false);

  // Descarregar o Previsa preenchido — IGUAL ao modelo original PrevisaV25_01.xls.
  // Usa o PRÓPRIO ficheiro como template (preserva as 13 folhas e 100% das
  // fórmulas) e escreve só as células de input com os dados da empresa.
  // Ver src/lib/previsaExcel.ts para o mapa de células.
  const handleExportExcel = useCallback(async () => {
    setExporting(true);
    try {
      await downloadPrevisaExcel(state);
    } catch (e) {
      console.error('Falha ao exportar o Previsa:', e);
      alert('Não foi possível gerar o Excel do Previsa. Tenta novamente.');
    } finally {
      setExporting(false);
    }
  }, [state]);

  const inputClass = 'w-full text-[13px] font-[600] border border-slate-200 rounded-[8px] px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0677FF]/30 focus:border-[#0677FF]';

  const wrapSet = (setSt: (u: Partial<PreviSaState>) => void) =>
    <K extends keyof PreviSaState>(key: K, value: PreviSaState[K]) =>
      setSt({ [key]: value } as Partial<PreviSaState>);

  const steps: FlowStep<PreviSaState>[] = [
    {
      id: 'identificacao',
      label: 'Identificação',
      description: 'Dados da empresa e regime fiscal.',
      render: (st, setSt) => {
        const s = wrapSet(setSt);
        return (
          <div className="flex flex-col gap-4">
            <Section title="Identificação da Empresa">
              <div className="space-y-3 py-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-[600] text-slate-500 mb-1">NIF</label>
                    <input value={st.nif} onChange={e => s('nif', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-[600] text-slate-500 mb-1">Período</label>
                    <input type="number" value={st.periodo} onChange={e => s('periodo', parseInt(e.target.value) || 2024)} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-[600] text-slate-500 mb-1">Designação Social</label>
                  <input value={st.designacao} onChange={e => s('designacao', e.target.value)} placeholder="Nome da empresa" className={inputClass} />
                </div>
              </div>
            </Section>

            <Section title="Regime Fiscal">
              <div className="space-y-3 py-1">
                <div>
                  <label className="block text-[11px] font-[600] text-slate-500 mb-1">Regime</label>
                  <select value={st.regime} onChange={e => s('regime', e.target.value as Regime)} className={inputClass}>
                    <option value="geral">Regime Geral (Continental)</option>
                    <option value="madeira">Região Autónoma da Madeira</option>
                    <option value="acores">Região Autónoma dos Açores</option>
                    <option value="interioridade">Interioridade</option>
                    <option value="startup">Startup (Lei 21/2023)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-[600] text-slate-500 mb-1">Território (para PEC/PC/Derrama)</label>
                  <select value={st.territorio} onChange={e => s('territorio', e.target.value as Territorio)} className={inputClass}>
                    <option value="continental">Continental</option>
                    <option value="madeira">Madeira</option>
                    <option value="acores">Açores</option>
                  </select>
                </div>
                <label className="flex items-center gap-3 cursor-pointer py-1">
                  <input type="checkbox" checked={st.isPME} onChange={e => s('isPME', e.target.checked)} className="w-4 h-4 accent-[#0677FF]" />
                  <span className="text-[13px] font-[600] text-[#0F172A]">PME — taxa reduzida nos primeiros €50.000</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer py-1">
                  <input type="checkbox" checked={st.isStartup} onChange={e => s('isStartup', e.target.checked)} className="w-4 h-4 accent-[#0677FF]" />
                  <span className="text-[13px] font-[600] text-[#0F172A]">Startup (12,5% em toda a matéria coletável)</span>
                </label>
                <NumInput label="Volume de Negócios (€)" value={st.volumeNegocios} onChange={v => s('volumeNegocios', v)} help="Para PEC/PC" />
                <PctInput label="Taxa Derrama Municipal" value={st.taxaDerramaMunicipal} onChange={v => s('taxaDerramaMunicipal', v)} help="Ex: 1,5%" />
              </div>
            </Section>
          </div>
        );
      },
    },
    {
      id: 'rendimentos',
      label: 'Rendimentos',
      description: 'Cálculo do RAI e demonstração de resultados.',
      render: (st, setSt) => {
        const s = wrapSet(setSt);
        const stepRes = calculate(st);
        return (
          <div className="flex flex-col gap-4">
            <Section title="Cálculo do RAI (Resultado Antes de Impostos)">
              <div className="py-2">
                <label className="flex items-center gap-3 cursor-pointer mb-3">
                  <input type="checkbox" checked={st.useRaiCalc} onChange={e => s('useRaiCalc', e.target.checked)} className="w-4 h-4 accent-[#0677FF]" />
                  <span className="text-[13px] font-[600] text-[#0F172A]">Calcular RAI a partir da demonstração de resultados</span>
                </label>
                {!st.useRaiCalc && (
                  <NumInput label="701 — RAI (introdução direta)" value={st.c701_rai} onChange={v => s('c701_rai', v)} />
                )}
              </div>
            </Section>

            {st.useRaiCalc && (<>
              <Section title="Rendimentos Contabilísticos">
                <NumInput label="711 — Vendas de mercadorias" value={st.rai_711} onChange={v => s('rai_711', v)} />
                <NumInput label="712 — Vendas de produtos acabados e em curso" value={st.rai_712} onChange={v => s('rai_712', v)} />
                <NumInput label="72 — Prestações de serviços" value={st.rai_72} onChange={v => s('rai_72', v)} />
                <NumInput label="74 — Trabalhos para a própria entidade" value={st.rai_74} onChange={v => s('rai_74', v)} />
                <NumInput label="75 — Subsídios à exploração" value={st.rai_75} onChange={v => s('rai_75', v)} />
                <NumInput label="76 — Reversões" value={st.rai_76} onChange={v => s('rai_76', v)} />
                <NumInput label="77 — Ganhos por aumentos de justo valor" value={st.rai_77} onChange={v => s('rai_77', v)} />
                <NumInput label="78 — Outros rendimentos e ganhos" value={st.rai_78} onChange={v => s('rai_78', v)} />
                <NumInput label="79 — Juros, dividendos e outros rdtos. financeiros" value={st.rai_79} onChange={v => s('rai_79', v)} />
                <CalcRow label="TOTAL DE RENDIMENTOS" value={stepRes.totalRendimentos} highlight />
              </Section>

              <Section title="Gastos Contabilísticos">
                <NumInput label="CMV — Custo das mercadorias vendidas" value={st.rai_cmv} onChange={v => s('rai_cmv', v)} />
                <NumInput label="CMC — Custo das matérias consumidas" value={st.rai_cmc} onChange={v => s('rai_cmc', v)} />
                <NumInput label="62 — FSE — Fornecimentos e serviços externos" value={st.rai_62} onChange={v => s('rai_62', v)} />
                <NumInput label="63 — Gastos com pessoal" value={st.rai_63} onChange={v => s('rai_63', v)} />
                <NumInput label="64 — Depreciações e amortizações" value={st.rai_64} onChange={v => s('rai_64', v)} />
                <NumInput label="65 — Perdas por imparidade" value={st.rai_65} onChange={v => s('rai_65', v)} />
                <NumInput label="66 — Perdas por reduções de justo valor" value={st.rai_66} onChange={v => s('rai_66', v)} />
                <NumInput label="67 — Provisões" value={st.rai_67} onChange={v => s('rai_67', v)} />
                <NumInput label="68 — Outros gastos e perdas" value={st.rai_68} onChange={v => s('rai_68', v)} />
                <NumInput label="69 — Gastos de financiamento" value={st.rai_69} onChange={v => s('rai_69', v)} />
                <CalcRow label="Total de gastos contabilísticos" value={stepRes.totalGastos} highlight />
              </Section>

              <Section title="Imposto diferido">
                <NumInput label="8122 — Imposto diferido — Débito (+)" value={st.rai_8122_db} onChange={v => s('rai_8122_db', v)} />
                <NumInput label="8122 — Imposto diferido — Crédito (−)" value={st.rai_8122_cr} onChange={v => s('rai_8122_cr', v)} />
              </Section>

              <CalcRow label={`701 — RAI calculado (campo 708 ponto de partida)`} value={stepRes.raiCalc} highlight />
            </>)}
          </div>
        );
      },
    },
    {
      id: 'q07',
      label: 'Q07 Apuramento',
      description: 'Ponto de partida, acréscimos e deduções.',
      render: (st, setSt) => {
        const s = wrapSet(setSt);
        const stepRes = calculate(st);
        return (
          <div className="flex flex-col gap-4">
            <Section title="Ponto de Partida — Campo 708">
              {st.useRaiCalc
                ? <NumInput label="701 — RAI (calculado na aba Rendimentos)" value={stepRes.raiCalc} readOnly />
                : <NumInput label="701 — Resultado antes de impostos (RAI)" value={st.c701_rai} onChange={v => s('c701_rai', v)} />
              }
              <NumInput label="702 — Variações patrimoniais positivas (a acrescer)" value={st.c702} onChange={v => s('c702', v)} indent />
              <NumInput label="703 — Variações patrimoniais pos. — regimes transitórios" value={st.c703} onChange={v => s('c703', v)} indent />
              <NumInput label="805 — Mensuração passivos contratos seguros (+) OE2024" value={st.c805} onChange={v => s('c805', v)} indent />
              <NumInput label="704 — Variações patrimoniais negativas (a deduzir)" value={st.c704} onChange={v => s('c704', v)} indent />
              <NumInput label="705 — Variações patrimoniais neg. — regimes transitórios" value={st.c705} onChange={v => s('c705', v)} indent />
              <NumInput label="806 — Mensuração passivos contratos seguros (−) OE2024" value={st.c806} onChange={v => s('c806', v)} indent />
              <NumInput label="706 — Alteração regime contratos construção (+)" value={st.c706} onChange={v => s('c706', v)} indent />
              <NumInput label="707 — Alteração regime contratos construção (−)" value={st.c707} onChange={v => s('c707', v)} indent />
              <div className="flex items-center gap-3 py-1.5">
                <label className="flex-1 text-[12px] font-[500] text-slate-600">Ignorar cálculo automático do 708 (usar RAI direto)</label>
                <input type="checkbox" checked={st.c708_override} onChange={e => s('c708_override', e.target.checked)} className="w-4 h-4 accent-[#0677FF]" />
              </div>
              <CalcRow label="708 — Base de apuramento" value={stepRes.c708} highlight />
            </Section>

            <Section title="A Acrescer (campos 709–804)" defaultOpen={false}>
              {ACRESCER_LABELS.map(([key, lbl]) => (
                <div key={key}>
                  <NumInput label={lbl} value={st[key as keyof PreviSaState] as number}
                    onChange={v => s(key as keyof PreviSaState, v as PreviSaState[keyof PreviSaState])} indent />
                </div>
              ))}
              <CalcRow label="Total acréscimos" value={stepRes.acrescer} />
              <CalcRow label="753 — Soma (708 + acréscimos)" value={stepRes.c753} highlight />
            </Section>

            <Section title="A Deduzir (campos 754–775)" defaultOpen={false}>
              {DEDUZIR_LABELS.map(([key, lbl]) => (
                <div key={key}>
                  <NumInput label={lbl} value={st[key as keyof PreviSaState] as number}
                    onChange={v => s(key as keyof PreviSaState, v as PreviSaState[keyof PreviSaState])} indent />
                </div>
              ))}
              <CalcRow label="776 — Total a deduzir" value={stepRes.c776} />
            </Section>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white border border-slate-200 rounded-[12px] p-4">
                <p className="text-[11px] font-[600] text-slate-500 uppercase tracking-[0.5px]">778 — Lucro Tributável</p>
                <p className="text-[22px] font-[800] text-[#0F172A] tabular-nums mt-1">{fmt(stepRes.lucroTributavel)} €</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-[12px] p-4">
                <p className="text-[11px] font-[600] text-slate-500 uppercase tracking-[0.5px]">777 — Prejuízo Fiscal</p>
                <p className="text-[22px] font-[800] text-emerald-700 tabular-nums mt-1">{fmt(stepRes.prejuizoFiscal)} €</p>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'q09',
      label: 'Q09 Mat. Coletável',
      description: 'Prejuízos fiscais e benefícios.',
      render: (st, setSt) => {
        const s = wrapSet(setSt);
        const stepRes = calculate(st);
        return (
          <div className="flex flex-col gap-4">
            <Section title="Lucro Tributável (de Q07)">
              <CalcRow label="778 — Lucro tributável" value={stepRes.lucroTributavel} highlight />
            </Section>

            <Section title="Prejuízos Fiscais Dedutíveis">
              <NumInput label="Prejuízos 2014–2017 (agrupados)" value={st.prej_ate2017} onChange={v => s('prej_ate2017', v)} />
              <NumInput label="Prejuízos 2018" value={st.prej_2018} onChange={v => s('prej_2018', v)} indent />
              <NumInput label="Prejuízos 2019" value={st.prej_2019} onChange={v => s('prej_2019', v)} indent />
              <NumInput label="Prejuízos 2020" value={st.prej_2020} onChange={v => s('prej_2020', v)} indent />
              <NumInput label="Prejuízos 2021" value={st.prej_2021} onChange={v => s('prej_2021', v)} indent />
              <NumInput label="Prejuízos 2022" value={st.prej_2022} onChange={v => s('prej_2022', v)} indent />
              <NumInput label="Prejuízos 2023" value={st.prej_2023} onChange={v => s('prej_2023', v)} indent />
              <NumInput label="Prejuízos 2024" value={st.prej_2024} onChange={v => s('prej_2024', v)} indent />
              <NumInput label="397 — Prejuízos c/ transmissão autorizada (art.15)" value={st.c397} onChange={v => s('c397', v)} />
              <div className="flex items-center justify-between py-1.5 text-[12px] text-slate-500">
                <span>Total prejuízos disponíveis</span>
                <span className="font-[700] tabular-nums">{fmt(stepRes.totalPrejuziosDisp)} €</span>
              </div>
              <div className="flex items-center justify-between py-1.5 text-[12px] text-slate-500">
                <span>Limite de dedução ({st.limiteMaisPP ? '75%' : '65%'} × LT)</span>
                <span className="font-[700] tabular-nums">{fmt(stepRes.lucroTributavel * (st.limiteMaisPP ? 0.75 : 0.65))} €</span>
              </div>
              <label className="flex items-center gap-3 py-1.5 cursor-pointer">
                <input type="checkbox" checked={st.limiteMaisPP} onChange={e => s('limiteMaisPP', e.target.checked)} className="w-4 h-4 accent-[#0677FF]" />
                <span className="text-[12px] font-[500] text-slate-600">Aumentar limite para 75% (perda {'>'} 25% capital próprio)</span>
              </label>
              <CalcRow label="Prejuízos efetivamente deduzidos" value={stepRes.prejuziosEfetivos} />
            </Section>

            <Section title="Benefícios Fiscais">
              <NumInput label="Benefícios fiscais — dedução na matéria coletável" value={st.beneficiosFiscais}
                onChange={v => s('beneficiosFiscais', v)} help="c774+c775 (Q09)" />
            </Section>

            <CalcRow label="Matéria Coletável" value={stepRes.materiaColetavel} highlight />
          </div>
        );
      },
    },
    {
      id: 'ta',
      label: 'Tributações Autónomas',
      description: 'Viaturas e outras tributações autónomas.',
      render: (st, setSt) => {
        const s = wrapSet(setSt);
        const stepRes = calculate(st);
        const addV = () => setSt({
          viaturas: [...st.viaturas, {
            id: Math.random().toString(36).slice(2),
            ano: new Date().getFullYear(),
            combustivel: 'convencional' as FuelType,
            custoHistorico: 0,
            encargos: 0,
          }],
        });
        const updateV = (id: string, patch: Partial<ViaturaRow>) =>
          setSt({ viaturas: st.viaturas.map(v => v.id === id ? { ...v, ...patch } : v) });
        const removeV = (id: string) =>
          setSt({ viaturas: st.viaturas.filter(v => v.id !== id) });

        return (
          <div className="flex flex-col gap-4">
            <Section title="Tributações Autónomas — Viaturas">
              <label className="flex items-center gap-3 py-1.5 cursor-pointer">
                <input type="checkbox" checked={st.agravamentoTA} onChange={e => s('agravamentoTA', e.target.checked)} className="w-4 h-4 accent-[#0677FF]" />
                <span className="text-[12px] font-[500] text-slate-600">Agravamento +10% (empresa com prejuízo fiscal no período)</span>
              </label>

              {st.viaturas.length === 0 && (
                <p className="text-[12px] text-slate-400 py-3 text-center">Sem viaturas adicionadas</p>
              )}

              {st.viaturas.map(v => (
                <div key={v.id} className="bg-slate-50 rounded-[10px] p-3 flex flex-col gap-2 mt-2 border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-[700] text-slate-500 uppercase tracking-[0.5px]">Viatura</span>
                    <button type="button" onClick={() => removeV(v.id)} className="text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-[600] text-slate-400 mb-0.5">Combustível</label>
                      <select value={v.combustivel}
                        onChange={e => updateV(v.id, { combustivel: e.target.value as FuelType })}
                        className="w-full text-[12px] border border-slate-200 rounded-[6px] px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#0677FF]/30">
                        <option value="convencional">Convencional / GPL</option>
                        <option value="plug_in">Plug-in híbrido</option>
                        <option value="plug_in_5050">Plug-in 50%/50%</option>
                        <option value="gnv">GNV</option>
                        <option value="eletrico">Elétrico</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-[600] text-slate-400 mb-0.5">Custo histórico (€)</label>
                      <input type="number" value={v.custoHistorico || ''}
                        onChange={e => updateV(v.id, { custoHistorico: parseFloat(e.target.value) || 0 })}
                        placeholder="0,00"
                        className="w-full text-[12px] border border-slate-200 rounded-[6px] px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#0677FF]/30 text-right" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-[600] text-slate-400 mb-0.5">Encargos com viatura no período (€)</label>
                    <input type="number" value={v.encargos || ''}
                      onChange={e => updateV(v.id, { encargos: parseFloat(e.target.value) || 0 })}
                      placeholder="0,00"
                      className="w-full text-[12px] border border-slate-200 rounded-[6px] px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#0677FF]/30 text-right" />
                  </div>
                  <div className="flex justify-between text-[11px] font-[600]">
                    <span className="text-slate-500">TA calculada:</span>
                    <span className="text-[#0677FF]">{fmt(calcTAVeiculo(v, st.agravamentoTA))} €</span>
                  </div>
                </div>
              ))}

              <button type="button" onClick={addV}
                className="mt-3 flex items-center gap-2 px-3 py-2 text-[12px] font-[600] text-[#0677FF] border border-dashed border-[#0677FF]/40 rounded-[8px] hover:bg-[#0677FF]/5 transition-colors w-full justify-center">
                <Plus className="w-4 h-4" />
                Adicionar viatura
              </button>
            </Section>

            <Section title="Outras Tributações Autónomas">
              <NumInput label="Despesas não documentadas — atividade principal" value={st.ta_despNaoDocPrincipal} onChange={v => s('ta_despNaoDocPrincipal', v)} help="50%" />
              <NumInput label="Despesas não documentadas — não atividade principal" value={st.ta_despNaoDocNaoPrincipal} onChange={v => s('ta_despNaoDocNaoPrincipal', v)} help="70%" />
              <NumInput label="Encargos de representação" value={st.ta_representacao} onChange={v => s('ta_representacao', v)} help="10%" />
              <NumInput label="Ajudas de custo e comp. de viagem" value={st.ta_ajadasCusto} onChange={v => s('ta_ajadasCusto', v)} help="5%" />
              <NumInput label="Lucros distribuídos a entidades isentas" value={st.ta_lucrosDistribuidos} onChange={v => s('ta_lucrosDistribuidos', v)} help="23%" />
              <NumInput label="Pagamentos a entidades em paraísos fiscais" value={st.ta_offshores} onChange={v => s('ta_offshores', v)} help="35%" />
              <NumInput label="Indemnizações por cessação de funções" value={st.ta_indemCessacao} onChange={v => s('ta_indemCessacao', v)} help="35%" />
              <NumInput label="Bónus e rem. variáveis (gestores/administradores)" value={st.ta_bonus} onChange={v => s('ta_bonus', v)} help="35%" />
              <div className="pt-1">
                <NumInput label="Retenções na fonte a deduzir das TA (art.88 n.12)" value={st.ta_retFonteArt88n12} onChange={v => s('ta_retFonteArt88n12', v)} />
              </div>
            </Section>

            <div className="bg-white border border-slate-200 rounded-[12px] p-4 space-y-1">
              <ResultRow label="TA viaturas" value={stepRes.taViaturas} />
              <ResultRow label="TA outras" value={stepRes.taOutras} />
              <ResultRow label="TA bruta" value={stepRes.taBruta} />
              <ResultRow label="(-) Retenções art.88 n.12" value={st.ta_retFonteArt88n12} />
              <ResultRow label="TA total líquida (c365)" value={stepRes.taTotal} highlight />
            </div>
          </div>
        );
      },
    },
    {
      id: 'q10',
      label: 'Q10 Cálculo',
      description: 'Coleta IRC, derramas, deduções e pagamentos.',
      render: (st, setSt) => {
        const s = wrapSet(setSt);
        const stepRes = calculate(st);
        return (
          <div className="flex flex-col gap-4">
            <Section title="Coleta IRC">
              <CalcRow label="Matéria coletável" value={stepRes.materiaColetavel} />
              <CalcRow label="IRC sobre mat. coletável (c347)" value={stepRes.ircColeta - st.c349 * st.c349_taxa} indent />
              <div className="flex items-center gap-3 py-1.5 pl-4">
                <label className="flex-1 text-[12px] font-[500] text-slate-600">349 — IRC a outras taxas — base</label>
                <input type="number" step="0.01" value={st.c349 || ''}
                  onChange={e => s('c349', parseFloat(e.target.value) || 0)}
                  className="w-36 text-right text-[13px] font-[600] border border-slate-200 rounded-[8px] px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#0677FF]/30"
                  placeholder="0,00" />
              </div>
              <div className="flex items-center gap-3 py-1.5 pl-4">
                <label className="flex-1 text-[12px] font-[500] text-slate-600">349 — taxa (%)</label>
                <div className="relative w-36">
                  <input type="number" step="0.1" min="0" max="100"
                    value={st.c349_taxa ? (st.c349_taxa * 100).toFixed(1) : ''}
                    onChange={e => s('c349_taxa', (parseFloat(e.target.value) || 0) / 100)}
                    className="w-full text-right text-[13px] font-[600] border border-slate-200 rounded-[8px] px-3 py-1.5 pr-6 bg-white focus:outline-none focus:ring-2 focus:ring-[#0677FF]/30"
                    placeholder="0,0" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">%</span>
                </div>
              </div>
              <CalcRow label="351 — Coleta IRC total" value={stepRes.ircColeta} highlight />
            </Section>

            <Section title="Derramas">
              <CalcRow label="Derrama estadual (art.87-A)" value={stepRes.derramaEstadual} />
              <CalcRow label="Derrama municipal" value={stepRes.derrMunicipal} />
              <div className="text-[11px] text-slate-400 px-1 py-1">
                Taxa derrama municipal: {pct(st.taxaDerramaMunicipal)} (configurar em Identificação)
              </div>
              <CalcRow label="378 — Total coleta + derramas" value={stepRes.c378} highlight />
            </Section>

            <Section title="Deduções à Coleta (c357)">
              <NumInput label="353 — DTJI — dupla tributação jurídica int. (art.91)" value={st.c353} onChange={v => s('c353', v)} />
              <NumInput label="375 — DTEI — dupla tributação económica int. (art.91-A)" value={st.c375} onChange={v => s('c375', v)} />
              <NumInput label="355 — Benefícios fiscais (exceto CFEI II e IFR)" value={st.c355_bf} onChange={v => s('c355_bf', v)} />
              <NumInput label="355 — CFEI II" value={st.c355_cfei} onChange={v => s('c355_cfei', v)} indent />
              <NumInput label="355 — IFR" value={st.c355_ifr} onChange={v => s('c355_ifr', v)} indent />
              <NumInput label="470 — Adicional ao IMI (art.135-J CIMI)" value={st.c470} onChange={v => s('c470', v)} />
              <CalcRow label="357 — Total deduções à coleta" value={stepRes.deducoesColeta} highlight />
            </Section>

            <CalcRow label="358 — IRC liquidado (c378 − c357)" value={stepRes.c358} highlight />

            <Section title="Pagamentos e Deduções">
              <NumInput label="356 — PEC efectuado" value={st.pecPagamentos} onChange={v => s('pecPagamentos', v)}
                help={`Estimado: ${fmt(stepRes.pecCalculado)} €`} />
              <NumInput label="359 — Retenções na fonte" value={st.retencoesFonte} onChange={v => s('retencoesFonte', v)} />
              <NumInput label="360 — PC — pagamentos por conta" value={st.pcPagamentos} onChange={v => s('pcPagamentos', v)}
                help={`Estimado: ${fmt(stepRes.pcCalculado)} €`} />
              <NumInput label="374 — PAC — pagamentos adicionais por conta" value={st.pacPagamentos} onChange={v => s('pacPagamentos', v)} />
              <NumInput label="379 — DTJI CDT (países com CDT — art.91 n.2)" value={st.c379} onChange={v => s('c379', v)} />
            </Section>

            <Section title="Outras Correções" defaultOpen={false}>
              <NumInput label="363 — IRC de períodos anteriores" value={st.c363} onChange={v => s('c363', v)} />
              <NumInput label="372 — Reposição de benefícios fiscais" value={st.c372} onChange={v => s('c372', v)} />
              <NumInput label="366 — Juros compensatórios" value={st.c366} onChange={v => s('c366', v)} />
              <NumInput label="369 — Juros de mora" value={st.c369} onChange={v => s('c369', v)} />
            </Section>

            <div className="bg-white border border-slate-200 rounded-[12px] p-4 space-y-1">
              <ResultRow label="IRC liquidado (c358)" value={stepRes.c358} />
              <ResultRow label="Tributações autónomas (c365)" value={stepRes.taTotal} />
              <ResultRow label="Juros e correções" value={st.c366 + st.c369 + st.c363 + st.c372} />
              <ResultRow label="(−) PEC dedutível" value={st.pecPagamentos} sub />
              <ResultRow label="(−) Retenções + PC + PAC" value={stepRes.totalPagamentos} sub />
              <ResultRow label="(−) DTJI CDT" value={st.c379} sub />
              <div className="border-t border-slate-200 my-2" />
              <ResultRow label={stepRes.c367 >= 0 ? '367 — Total a pagar' : '368 — Total a recuperar'} value={Math.abs(stepRes.c367)} highlight />
            </div>
          </div>
        );
      },
    },
  ];

  const resultsContent = (
    <div className="flex flex-col gap-3 lg:sticky lg:top-6 self-start">
      <div className="bg-white border border-slate-200 rounded-[16px] overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[#0677FF] to-[#b83030]" />
        <div className="p-4">
          <p className="text-[11px] font-[700] uppercase tracking-[0.5px] text-slate-400 mb-3">Resumo IRC {state.periodo}</p>
          <div className="space-y-0.5">
            <ResultRow label="Lucro Tributável" value={res.lucroTributavel} />
            <ResultRow label="Prejuízo Fiscal" value={res.prejuizoFiscal} sub positive />
            <ResultRow label="Matéria Coletável" value={res.materiaColetavel} />
            <div className="border-t border-slate-100 my-1" />
            <ResultRow label="Coleta IRC" value={res.ircColeta} />
            <ResultRow label="Derrama Estadual" value={res.derramaEstadual} sub />
            <ResultRow label="Derrama Municipal" value={res.derrMunicipal} sub />
            <ResultRow label="(−) Ded. à Coleta" value={res.deducoesColeta} sub positive />
            <ResultRow label="IRC Liquidado (c358)" value={res.c358} highlight />
            <div className="border-t border-slate-100 my-1" />
            <ResultRow label="Tributações Autónomas" value={res.taTotal} />
            <div className="border-t border-slate-100 my-1" />
            <ResultRow label={res.c367 >= 0 ? 'Total a Pagar' : 'Total a Recuperar'} value={Math.abs(res.c367)} highlight />
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400 font-[500]">Taxa IRC</span>
              <span className="font-[700] text-slate-600">
                {state.isPME && !state.isStartup
                  ? `${pct(RATES[state.regime].pme)} / ${pct(RATES[state.regime].main)}`
                  : pct(RATES[state.isStartup ? 'startup' : state.regime].main)}
              </span>
            </div>
            {res.derrMunicipal > 0 && (
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400 font-[500]">Derrama Municipal</span>
                <span className="font-[700] text-slate-600">{pct(state.taxaDerramaMunicipal)}</span>
              </div>
            )}
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400 font-[500]">PEC estimado</span>
              <span className="font-[700] text-slate-600">{fmt(res.pecCalculado)} €</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400 font-[500]">PC estimado</span>
              <span className="font-[700] text-slate-600">{fmt(res.pcCalculado)} €</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400 font-[500]">Taxa efectiva s/ RAI</span>
              <span className="font-[700] text-slate-600">
                {res.effectiveRai !== 0 ? pct((res.c358 + res.taTotal) / Math.abs(res.effectiveRai)) : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleExportExcel}
        disabled={exporting}
        className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#0677FF] px-4 py-2.5 text-[13px] font-[700] text-white transition-colors hover:bg-[#0560d6] disabled:opacity-60"
        title="Descarregar o Modelo 22 preenchido em Excel (.xlsx)"
      >
        <Download className="h-4 w-4" />
        {exporting ? 'A gerar Excel…' : 'Descarregar Excel preenchido'}
      </button>

      <button type="button" onClick={() => setState(defaultPreviSaState())}
        className="text-[12px] font-[600] text-slate-400 hover:text-red-500 transition-colors py-2 text-center">
        Limpar simulação
      </button>
    </div>
  );

  if (flowMode) {
    return (
      <FlowWizard
        open={flowMode}
        onClose={exitFlow}
        title="Simulador Previsa"
        icon={Calculator}
        steps={steps}
        resultsStep={{ label: 'Resumo do Modelo 22', description: 'Resultado da previsão de IRC para o período.', render: resultsContent }}
        state={state}
        setState={(u) => {
          setState(prev => {
            const next = { ...prev, ...u };
            onStateChange?.(next);
            return next;
          });
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#F5F7FA]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 shrink-0 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-[800] text-[#0F172A]">Simulador Previsa</h1>
          <p className="text-[12px] text-slate-500 font-[500] mt-0.5">IRC — Modelo 22 · Previsão de IRC</p>
        </div>
        {/* Nota: o canto superior direito é ocupado pelo FloatingFlowToggle (fixed, z-60).
            Não colocar botões aqui — ficam tapados. O botão de Excel vive no cartão de resumo. */}
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 overflow-x-auto scrollbar-none shrink-0">
        <div className="flex gap-0 min-w-max">
          {TABS.map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={cn(
                'px-4 py-3 text-[12px] font-[600] border-b-2 transition-colors whitespace-nowrap',
                tab === t
                  ? 'border-[#0677FF] text-[#0677FF]'
                  : 'border-transparent text-slate-500 hover:text-[#0F172A] hover:border-slate-300',
              )}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left: inputs ── */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* ── IDENTIFICAÇÃO ── */}
            {tab === 'Identificação' && (<>
              <Section title="Identificação da Empresa">
                <div className="space-y-3 py-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-[600] text-slate-500 mb-1">NIF</label>
                      <input value={state.nif} onChange={e => set('nif', e.target.value)} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-[600] text-slate-500 mb-1">Período</label>
                      <input type="number" value={state.periodo} onChange={e => set('periodo', parseInt(e.target.value) || 2024)} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-[600] text-slate-500 mb-1">Designação Social</label>
                    <input value={state.designacao} onChange={e => set('designacao', e.target.value)} placeholder="Nome da empresa" className={inputClass} />
                  </div>
                </div>
              </Section>

              <Section title="Regime Fiscal">
                <div className="space-y-3 py-1">
                  <div>
                    <label className="block text-[11px] font-[600] text-slate-500 mb-1">Regime</label>
                    <select value={state.regime} onChange={e => set('regime', e.target.value as Regime)} className={inputClass}>
                      <option value="geral">Regime Geral (Continental)</option>
                      <option value="madeira">Região Autónoma da Madeira</option>
                      <option value="acores">Região Autónoma dos Açores</option>
                      <option value="interioridade">Interioridade</option>
                      <option value="startup">Startup (Lei 21/2023)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-[600] text-slate-500 mb-1">Território (para PEC/PC/Derrama)</label>
                    <select value={state.territorio} onChange={e => set('territorio', e.target.value as Territorio)} className={inputClass}>
                      <option value="continental">Continental</option>
                      <option value="madeira">Madeira</option>
                      <option value="acores">Açores</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer py-1">
                    <input type="checkbox" checked={state.isPME} onChange={e => set('isPME', e.target.checked)} className="w-4 h-4 accent-[#0677FF]" />
                    <span className="text-[13px] font-[600] text-[#0F172A]">PME — taxa reduzida nos primeiros €50.000</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer py-1">
                    <input type="checkbox" checked={state.isStartup} onChange={e => set('isStartup', e.target.checked)} className="w-4 h-4 accent-[#0677FF]" />
                    <span className="text-[13px] font-[600] text-[#0F172A]">Startup (12,5% em toda a matéria coletável)</span>
                  </label>
                  <NumInput label="Volume de Negócios (€)" value={state.volumeNegocios} onChange={v => set('volumeNegocios', v)} help="Para PEC/PC" />
                  <PctInput label="Taxa Derrama Municipal" value={state.taxaDerramaMunicipal} onChange={v => set('taxaDerramaMunicipal', v)} help="Ex: 1,5%" />
                </div>
              </Section>
            </>)}

            {/* ── RENDIMENTOS / RAI ── */}
            {tab === 'Rendimentos' && (<>
              <Section title="Cálculo do RAI (Resultado Antes de Impostos)">
                <div className="py-2">
                  <label className="flex items-center gap-3 cursor-pointer mb-3">
                    <input type="checkbox" checked={state.useRaiCalc} onChange={e => set('useRaiCalc', e.target.checked)} className="w-4 h-4 accent-[#0677FF]" />
                    <span className="text-[13px] font-[600] text-[#0F172A]">Calcular RAI a partir da demonstração de resultados</span>
                  </label>
                  {!state.useRaiCalc && (
                    <NumInput label="701 — RAI (introdução direta)" value={state.c701_rai} onChange={v => set('c701_rai', v)} />
                  )}
                </div>
              </Section>

              {state.useRaiCalc && (<>
                <Section title="Rendimentos Contabilísticos">
                  <NumInput label="711 — Vendas de mercadorias" value={state.rai_711} onChange={v => set('rai_711', v)} />
                  <NumInput label="712 — Vendas de produtos acabados e em curso" value={state.rai_712} onChange={v => set('rai_712', v)} />
                  <NumInput label="72 — Prestações de serviços" value={state.rai_72} onChange={v => set('rai_72', v)} />
                  <NumInput label="74 — Trabalhos para a própria entidade" value={state.rai_74} onChange={v => set('rai_74', v)} />
                  <NumInput label="75 — Subsídios à exploração" value={state.rai_75} onChange={v => set('rai_75', v)} />
                  <NumInput label="76 — Reversões" value={state.rai_76} onChange={v => set('rai_76', v)} />
                  <NumInput label="77 — Ganhos por aumentos de justo valor" value={state.rai_77} onChange={v => set('rai_77', v)} />
                  <NumInput label="78 — Outros rendimentos e ganhos" value={state.rai_78} onChange={v => set('rai_78', v)} />
                  <NumInput label="79 — Juros, dividendos e outros rdtos. financeiros" value={state.rai_79} onChange={v => set('rai_79', v)} />
                  <CalcRow label="TOTAL DE RENDIMENTOS" value={res.totalRendimentos} highlight />
                </Section>

                <Section title="Gastos Contabilísticos">
                  <NumInput label="CMV — Custo das mercadorias vendidas" value={state.rai_cmv} onChange={v => set('rai_cmv', v)} />
                  <NumInput label="CMC — Custo das matérias consumidas" value={state.rai_cmc} onChange={v => set('rai_cmc', v)} />
                  <NumInput label="62 — FSE — Fornecimentos e serviços externos" value={state.rai_62} onChange={v => set('rai_62', v)} />
                  <NumInput label="63 — Gastos com pessoal" value={state.rai_63} onChange={v => set('rai_63', v)} />
                  <NumInput label="64 — Depreciações e amortizações" value={state.rai_64} onChange={v => set('rai_64', v)} />
                  <NumInput label="65 — Perdas por imparidade" value={state.rai_65} onChange={v => set('rai_65', v)} />
                  <NumInput label="66 — Perdas por reduções de justo valor" value={state.rai_66} onChange={v => set('rai_66', v)} />
                  <NumInput label="67 — Provisões" value={state.rai_67} onChange={v => set('rai_67', v)} />
                  <NumInput label="68 — Outros gastos e perdas" value={state.rai_68} onChange={v => set('rai_68', v)} />
                  <NumInput label="69 — Gastos de financiamento" value={state.rai_69} onChange={v => set('rai_69', v)} />
                  <CalcRow label="Total de gastos contabilísticos" value={res.totalGastos} highlight />
                </Section>

                <Section title="Imposto diferido">
                  <NumInput label="8122 — Imposto diferido — Débito (+)" value={state.rai_8122_db} onChange={v => set('rai_8122_db', v)} />
                  <NumInput label="8122 — Imposto diferido — Crédito (−)" value={state.rai_8122_cr} onChange={v => set('rai_8122_cr', v)} />
                </Section>

                <CalcRow label={`701 — RAI calculado (campo 708 ponto de partida)`} value={res.raiCalc} highlight />
              </>)}
            </>)}

            {/* ── Q07 ── */}
            {tab === 'Q07 Apuramento' && (<>
              <Section title="Ponto de Partida — Campo 708">
                {state.useRaiCalc
                  ? <NumInput label="701 — RAI (calculado na aba Rendimentos)" value={res.raiCalc} readOnly />
                  : <NumInput label="701 — Resultado antes de impostos (RAI)" value={state.c701_rai} onChange={v => set('c701_rai', v)} />
                }
                <NumInput label="702 — Variações patrimoniais positivas (a acrescer)" value={state.c702} onChange={v => set('c702', v)} indent />
                <NumInput label="703 — Variações patrimoniais pos. — regimes transitórios" value={state.c703} onChange={v => set('c703', v)} indent />
                <NumInput label="805 — Mensuração passivos contratos seguros (+) OE2024" value={state.c805} onChange={v => set('c805', v)} indent />
                <NumInput label="704 — Variações patrimoniais negativas (a deduzir)" value={state.c704} onChange={v => set('c704', v)} indent />
                <NumInput label="705 — Variações patrimoniais neg. — regimes transitórios" value={state.c705} onChange={v => set('c705', v)} indent />
                <NumInput label="806 — Mensuração passivos contratos seguros (−) OE2024" value={state.c806} onChange={v => set('c806', v)} indent />
                <NumInput label="706 — Alteração regime contratos construção (+)" value={state.c706} onChange={v => set('c706', v)} indent />
                <NumInput label="707 — Alteração regime contratos construção (−)" value={state.c707} onChange={v => set('c707', v)} indent />
                <div className="flex items-center gap-3 py-1.5">
                  <label className="flex-1 text-[12px] font-[500] text-slate-600">Ignorar cálculo automático do 708 (usar RAI direto)</label>
                  <input type="checkbox" checked={state.c708_override} onChange={e => set('c708_override', e.target.checked)} className="w-4 h-4 accent-[#0677FF]" />
                </div>
                <CalcRow label="708 — Base de apuramento" value={res.c708} highlight />
              </Section>

              <Section title="A Acrescer (campos 709–804)" defaultOpen={false}>
                {ACRESCER_LABELS.map(([key, lbl]) => (
                  <div key={key}>
                    <NumInput label={lbl} value={state[key as keyof PreviSaState] as number}
                      onChange={v => set(key as keyof PreviSaState, v as PreviSaState[keyof PreviSaState])} indent />
                  </div>
                ))}
                <CalcRow label="Total acréscimos" value={res.acrescer} />
                <CalcRow label="753 — Soma (708 + acréscimos)" value={res.c753} highlight />
              </Section>

              <Section title="A Deduzir (campos 754–775)" defaultOpen={false}>
                {DEDUZIR_LABELS.map(([key, lbl]) => (
                  <div key={key}>
                    <NumInput label={lbl} value={state[key as keyof PreviSaState] as number}
                      onChange={v => set(key as keyof PreviSaState, v as PreviSaState[keyof PreviSaState])} indent />
                  </div>
                ))}
                <CalcRow label="776 — Total a deduzir" value={res.c776} />
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
            </>)}

            {/* ── Q09 ── */}
            {tab === 'Q09 Mat. Coletável' && (<>
              <Section title="Lucro Tributável (de Q07)">
                <CalcRow label="778 — Lucro tributável" value={res.lucroTributavel} highlight />
              </Section>

              <Section title="Prejuízos Fiscais Dedutíveis">
                <NumInput label="Prejuízos 2014–2017 (agrupados)" value={state.prej_ate2017} onChange={v => set('prej_ate2017', v)} />
                <NumInput label="Prejuízos 2018" value={state.prej_2018} onChange={v => set('prej_2018', v)} indent />
                <NumInput label="Prejuízos 2019" value={state.prej_2019} onChange={v => set('prej_2019', v)} indent />
                <NumInput label="Prejuízos 2020" value={state.prej_2020} onChange={v => set('prej_2020', v)} indent />
                <NumInput label="Prejuízos 2021" value={state.prej_2021} onChange={v => set('prej_2021', v)} indent />
                <NumInput label="Prejuízos 2022" value={state.prej_2022} onChange={v => set('prej_2022', v)} indent />
                <NumInput label="Prejuízos 2023" value={state.prej_2023} onChange={v => set('prej_2023', v)} indent />
                <NumInput label="Prejuízos 2024" value={state.prej_2024} onChange={v => set('prej_2024', v)} indent />
                <NumInput label="397 — Prejuízos c/ transmissão autorizada (art.15)" value={state.c397} onChange={v => set('c397', v)} />
                <div className="flex items-center justify-between py-1.5 text-[12px] text-slate-500">
                  <span>Total prejuízos disponíveis</span>
                  <span className="font-[700] tabular-nums">{fmt(res.totalPrejuziosDisp)} €</span>
                </div>
                <div className="flex items-center justify-between py-1.5 text-[12px] text-slate-500">
                  <span>Limite de dedução ({state.limiteMaisPP ? '75%' : '65%'} × LT)</span>
                  <span className="font-[700] tabular-nums">{fmt(res.lucroTributavel * (state.limiteMaisPP ? 0.75 : 0.65))} €</span>
                </div>
                <label className="flex items-center gap-3 py-1.5 cursor-pointer">
                  <input type="checkbox" checked={state.limiteMaisPP} onChange={e => set('limiteMaisPP', e.target.checked)} className="w-4 h-4 accent-[#0677FF]" />
                  <span className="text-[12px] font-[500] text-slate-600">Aumentar limite para 75% (perda {'>'} 25% capital próprio)</span>
                </label>
                <CalcRow label="Prejuízos efetivamente deduzidos" value={res.prejuziosEfetivos} />
              </Section>

              <Section title="Benefícios Fiscais">
                <NumInput label="Benefícios fiscais — dedução na matéria coletável" value={state.beneficiosFiscais}
                  onChange={v => set('beneficiosFiscais', v)} help="c774+c775 (Q09)" />
              </Section>

              <CalcRow label="Matéria Coletável" value={res.materiaColetavel} highlight />
            </>)}

            {/* ── TA ── */}
            {tab === 'TA' && (<>
              <Section title="Tributações Autónomas — Viaturas">
                <label className="flex items-center gap-3 py-1.5 cursor-pointer">
                  <input type="checkbox" checked={state.agravamentoTA} onChange={e => set('agravamentoTA', e.target.checked)} className="w-4 h-4 accent-[#0677FF]" />
                  <span className="text-[12px] font-[500] text-slate-600">Agravamento +10% (empresa com prejuízo fiscal no período)</span>
                </label>

                {state.viaturas.length === 0 && (
                  <p className="text-[12px] text-slate-400 py-3 text-center">Sem viaturas adicionadas</p>
                )}

                {state.viaturas.map(v => (
                  <div key={v.id} className="bg-slate-50 rounded-[10px] p-3 flex flex-col gap-2 mt-2 border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-[700] text-slate-500 uppercase tracking-[0.5px]">Viatura</span>
                      <button type="button" onClick={() => removeViatura(v.id)} className="text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-[600] text-slate-400 mb-0.5">Combustível</label>
                        <select value={v.combustivel}
                          onChange={e => updateViatura(v.id, { combustivel: e.target.value as FuelType })}
                          className="w-full text-[12px] border border-slate-200 rounded-[6px] px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#0677FF]/30">
                          <option value="convencional">Convencional / GPL</option>
                          <option value="plug_in">Plug-in híbrido</option>
                          <option value="plug_in_5050">Plug-in 50%/50%</option>
                          <option value="gnv">GNV</option>
                          <option value="eletrico">Elétrico</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-[600] text-slate-400 mb-0.5">Custo histórico (€)</label>
                        <input type="number" value={v.custoHistorico || ''}
                          onChange={e => updateViatura(v.id, { custoHistorico: parseFloat(e.target.value) || 0 })}
                          placeholder="0,00"
                          className="w-full text-[12px] border border-slate-200 rounded-[6px] px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#0677FF]/30 text-right" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-[600] text-slate-400 mb-0.5">Encargos com viatura no período (€)</label>
                      <input type="number" value={v.encargos || ''}
                        onChange={e => updateViatura(v.id, { encargos: parseFloat(e.target.value) || 0 })}
                        placeholder="0,00"
                        className="w-full text-[12px] border border-slate-200 rounded-[6px] px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#0677FF]/30 text-right" />
                    </div>
                    <div className="flex justify-between text-[11px] font-[600]">
                      <span className="text-slate-500">TA calculada:</span>
                      <span className="text-[#0677FF]">{fmt(calcTAVeiculo(v, state.agravamentoTA))} €</span>
                    </div>
                  </div>
                ))}

                <button type="button" onClick={addViatura}
                  className="mt-3 flex items-center gap-2 px-3 py-2 text-[12px] font-[600] text-[#0677FF] border border-dashed border-[#0677FF]/40 rounded-[8px] hover:bg-[#0677FF]/5 transition-colors w-full justify-center">
                  <Plus className="w-4 h-4" />
                  Adicionar viatura
                </button>
              </Section>

              <Section title="Outras Tributações Autónomas">
                <NumInput label="Despesas não documentadas — atividade principal" value={state.ta_despNaoDocPrincipal} onChange={v => set('ta_despNaoDocPrincipal', v)} help="50%" />
                <NumInput label="Despesas não documentadas — não atividade principal" value={state.ta_despNaoDocNaoPrincipal} onChange={v => set('ta_despNaoDocNaoPrincipal', v)} help="70%" />
                <NumInput label="Encargos de representação" value={state.ta_representacao} onChange={v => set('ta_representacao', v)} help="10%" />
                <NumInput label="Ajudas de custo e comp. de viagem" value={state.ta_ajadasCusto} onChange={v => set('ta_ajadasCusto', v)} help="5%" />
                <NumInput label="Lucros distribuídos a entidades isentas" value={state.ta_lucrosDistribuidos} onChange={v => set('ta_lucrosDistribuidos', v)} help="23%" />
                <NumInput label="Pagamentos a entidades em paraísos fiscais" value={state.ta_offshores} onChange={v => set('ta_offshores', v)} help="35%" />
                <NumInput label="Indemnizações por cessação de funções" value={state.ta_indemCessacao} onChange={v => set('ta_indemCessacao', v)} help="35%" />
                <NumInput label="Bónus e rem. variáveis (gestores/administradores)" value={state.ta_bonus} onChange={v => set('ta_bonus', v)} help="35%" />
                <div className="pt-1">
                  <NumInput label="Retenções na fonte a deduzir das TA (art.88 n.12)" value={state.ta_retFonteArt88n12} onChange={v => set('ta_retFonteArt88n12', v)} />
                </div>
              </Section>

              <div className="bg-white border border-slate-200 rounded-[12px] p-4 space-y-1">
                <ResultRow label="TA viaturas" value={res.taViaturas} />
                <ResultRow label="TA outras" value={res.taOutras} />
                <ResultRow label="TA bruta" value={res.taBruta} />
                <ResultRow label="(-) Retenções art.88 n.12" value={state.ta_retFonteArt88n12} />
                <ResultRow label="TA total líquida (c365)" value={res.taTotal} highlight />
              </div>
            </>)}

            {/* ── Q10 ── */}
            {tab === 'Q10 Cálculo' && (<>
              <Section title="Coleta IRC">
                <CalcRow label="Matéria coletável" value={res.materiaColetavel} />
                <CalcRow label="IRC sobre mat. coletável (c347)" value={res.ircColeta - state.c349 * state.c349_taxa} indent />
                <div className="flex items-center gap-3 py-1.5 pl-4">
                  <label className="flex-1 text-[12px] font-[500] text-slate-600">349 — IRC a outras taxas — base</label>
                  <input type="number" step="0.01" value={state.c349 || ''}
                    onChange={e => set('c349', parseFloat(e.target.value) || 0)}
                    className="w-36 text-right text-[13px] font-[600] border border-slate-200 rounded-[8px] px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#0677FF]/30"
                    placeholder="0,00" />
                </div>
                <div className="flex items-center gap-3 py-1.5 pl-4">
                  <label className="flex-1 text-[12px] font-[500] text-slate-600">349 — taxa (%)</label>
                  <div className="relative w-36">
                    <input type="number" step="0.1" min="0" max="100"
                      value={state.c349_taxa ? (state.c349_taxa * 100).toFixed(1) : ''}
                      onChange={e => set('c349_taxa', (parseFloat(e.target.value) || 0) / 100)}
                      className="w-full text-right text-[13px] font-[600] border border-slate-200 rounded-[8px] px-3 py-1.5 pr-6 bg-white focus:outline-none focus:ring-2 focus:ring-[#0677FF]/30"
                      placeholder="0,0" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">%</span>
                  </div>
                </div>
                <CalcRow label="351 — Coleta IRC total" value={res.ircColeta} highlight />
              </Section>

              <Section title="Derramas">
                <CalcRow label="Derrama estadual (art.87-A)" value={res.derramaEstadual} />
                <CalcRow label="Derrama municipal" value={res.derrMunicipal} />
                <div className="text-[11px] text-slate-400 px-1 py-1">
                  Taxa derrama municipal: {pct(state.taxaDerramaMunicipal)} (configurar em Identificação)
                </div>
                <CalcRow label="378 — Total coleta + derramas" value={res.c378} highlight />
              </Section>

              <Section title="Deduções à Coleta (c357)">
                <NumInput label="353 — DTJI — dupla tributação jurídica int. (art.91)" value={state.c353} onChange={v => set('c353', v)} />
                <NumInput label="375 — DTEI — dupla tributação económica int. (art.91-A)" value={state.c375} onChange={v => set('c375', v)} />
                <NumInput label="355 — Benefícios fiscais (exceto CFEI II e IFR)" value={state.c355_bf} onChange={v => set('c355_bf', v)} />
                <NumInput label="355 — CFEI II" value={state.c355_cfei} onChange={v => set('c355_cfei', v)} indent />
                <NumInput label="355 — IFR" value={state.c355_ifr} onChange={v => set('c355_ifr', v)} indent />
                <NumInput label="470 — Adicional ao IMI (art.135-J CIMI)" value={state.c470} onChange={v => set('c470', v)} />
                <CalcRow label="357 — Total deduções à coleta" value={res.deducoesColeta} highlight />
              </Section>

              <CalcRow label="358 — IRC liquidado (c378 − c357)" value={res.c358} highlight />

              <Section title="Pagamentos e Deduções">
                <NumInput label="356 — PEC efectuado" value={state.pecPagamentos} onChange={v => set('pecPagamentos', v)}
                  help={`Estimado: ${fmt(res.pecCalculado)} €`} />
                <NumInput label="359 — Retenções na fonte" value={state.retencoesFonte} onChange={v => set('retencoesFonte', v)} />
                <NumInput label="360 — PC — pagamentos por conta" value={state.pcPagamentos} onChange={v => set('pcPagamentos', v)}
                  help={`Estimado: ${fmt(res.pcCalculado)} €`} />
                <NumInput label="374 — PAC — pagamentos adicionais por conta" value={state.pacPagamentos} onChange={v => set('pacPagamentos', v)} />
                <NumInput label="379 — DTJI CDT (países com CDT — art.91 n.2)" value={state.c379} onChange={v => set('c379', v)} />
              </Section>

              <Section title="Outras Correções" defaultOpen={false}>
                <NumInput label="363 — IRC de períodos anteriores" value={state.c363} onChange={v => set('c363', v)} />
                <NumInput label="372 — Reposição de benefícios fiscais" value={state.c372} onChange={v => set('c372', v)} />
                <NumInput label="366 — Juros compensatórios" value={state.c366} onChange={v => set('c366', v)} />
                <NumInput label="369 — Juros de mora" value={state.c369} onChange={v => set('c369', v)} />
              </Section>

              <div className="bg-white border border-slate-200 rounded-[12px] p-4 space-y-1">
                <ResultRow label="IRC liquidado (c358)" value={res.c358} />
                <ResultRow label="Tributações autónomas (c365)" value={res.taTotal} />
                <ResultRow label="Juros e correções" value={state.c366 + state.c369 + state.c363 + state.c372} />
                <ResultRow label="(−) PEC dedutível" value={state.pecPagamentos} sub />
                <ResultRow label="(−) Retenções + PC + PAC" value={res.totalPagamentos} sub />
                <ResultRow label="(−) DTJI CDT" value={state.c379} sub />
                <div className="border-t border-slate-200 my-2" />
                <ResultRow label={res.c367 >= 0 ? '367 — Total a pagar' : '368 — Total a recuperar'} value={Math.abs(res.c367)} highlight />
              </div>
            </>)}
          </div>

          {/* ── Right: summary (always visible) ── */}
          {resultsContent}
        </div>
      </div>
    </div>
  );
}
