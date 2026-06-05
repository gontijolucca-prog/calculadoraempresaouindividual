/**
 * Motor de cálculo do Previsa (IRC Modelo 22) — extraído do PreviSaSimulator
 * para poder ser reutilizado fora do componente (ex.: wordDocs estima o imposto
 * sobre o rendimento do período na Demonstração de Resultados e na Ata).
 * Função pura: PreviSaState → CalcResult, sem dependências de React.
 */
import type { Regime, Territorio, ViaturaRow, PreviSaState } from '../previSaState';

// ─── Constants ────────────────────────────────────────────────────────────────

const PME_BRACKET = 50_000;

// Taxas de IRC OE 2026 — CIRC Art. 87.º (Lei 73-A/2025, em vigor a 1-jan-2026).
// Taxa geral baixou de 20% para 19%; PME continua 15% sobre os primeiros €50.000.
// Madeira: 13,3% geral (era 14%) / 10,5% PME (era 11,2%) — DL Regional 8/2025/M.
// Açores: redução de 20% sobre a taxa do continente; PME beneficia de taxa especial 8,75%.
// Interior: 12,5% PME (EBF art. 41º-B) — sem redução na taxa geral.
// Startup: 12,5% — regime IFICI (Lei 21/2023), aplica-se sobre a totalidade.
export const RATES: Record<Regime, { main: number; pme: number }> = {
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

export function calcTAVeiculo(v: ViaturaRow, agravamento: boolean): number {
  const b = TA_BRACKETS.find(x => v.custoHistorico <= x.max) ?? TA_BRACKETS.at(-1)!;
  let rate = 0;
  if      (v.combustivel === 'eletrico')    rate = b.eletrico;
  else if (v.combustivel === 'plug_in_5050') rate = b.plug5050;
  else if (v.combustivel === 'gnv')          rate = b.gnv;
  else                                       rate = b.conv; // convencional or plug_in
  return v.encargos * rate * (agravamento ? 1.1 : 1);
}

export function calcDerramaEstadual(mc: number, territorio: Territorio): number {
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

export interface CalcResult {
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

export function calculate(s: PreviSaState): CalcResult {
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

/**
 * Imposto sobre o rendimento do período ESTIMADO (gasto contabilístico) a partir
 * do estado Previsa: IRC liquidado (coleta + derramas − deduções) + tributações
 * autónomas. Usado para preencher a DR e a Ata quando o SAF-T não traz a conta
 * 812. Devolve null sem dados de rendimentos/gastos (estado vazio).
 */
export function impostoEstimado(s: PreviSaState): number | null {
  const r = calculate(s);
  if (r.totalRendimentos === 0 && r.totalGastos === 0 && !s.c701_rai) return null;
  return Math.round((r.c358 + r.taTotal) * 100) / 100;
}
