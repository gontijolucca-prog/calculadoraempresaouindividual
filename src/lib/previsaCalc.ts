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

// Taxas do PAGAMENTO ADICIONAL POR CONTA (art. 105.º-A CIRC) por território —
// aplicam-se à parte do lucro tributável que excede 1,5 M€ (escalões 1,5–7,5M /
// 7,5–35M / >35M). ⚠ Antes estavam a ser usadas (erradamente) como "PC" sobre
// o volume de negócios.
const PAC_RATES: Record<Territorio, number[]> = {
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
  /** PPC do PRÓXIMO período (art. 105.º): (c358 − retenções) × 80%/95%. */
  ppcProximoAno: number;
  /** Cada uma das 3 prestações do PPC (jul/set/dez do próximo período). */
  ppcPrestacao: number;
  /** Taxa aplicada (0,80 ou 0,95 conforme volume de negócios ≤/> 500 k€). */
  ppcTaxa: number;
  /** PAC do próximo período (art. 105.º-A) sobre o lucro tributável > 1,5 M€. */
  pacProximoAno: number;
  /** Alertas de validação (Sandrine 11-jun). Cada item = chave + severidade + texto. */
  alertasPrejuizos: AlertaValidacao[];
  /** Alertas PPC (RETGS, juros compensatórios, etc). */
  alertasPPC: AlertaValidacao[];
  /** Limite efetivo de dedução de prejuízos (0,65 ou 0,75). */
  limiteDedPrejuizo: number;
}

export type SeveridadeAlerta = 'info' | 'warning' | 'error';
export interface AlertaValidacao {
  chave: string;
  severidade: SeveridadeAlerta;
  texto: string;
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

  // Pagamentos por conta do PRÓXIMO período — art. 105.º CIRC: base = IRC
  // liquidado (c358) deste período menos as retenções na fonte; taxa 80% se o
  // volume de negócios ≤ 500 k€, 95% acima; 3 prestações (julho, setembro e
  // 15 de dezembro). Não há lugar a PPC quando a base ≤ 200 € (art. 104.º).
  // ⚠ valores/limiares a confirmar pela contabilista.
  const ppcBase = Math.max(0, c358 - s.retencoesFonte);
  const ppcTaxa = s.volumeNegocios <= 500_000 ? 0.80 : 0.95;
  const ppcProximoAno = ppcBase <= 200 ? 0 : ppcBase * ppcTaxa;
  const ppcPrestacao = ppcProximoAno / 3;

  // Pagamento ADICIONAL por conta do próximo período — art. 105.º-A CIRC:
  // sobre a parte do lucro tributável deste período que excede 1,5 M€.
  const pacRates = PAC_RATES[s.territorio];
  let pacProximoAno = 0;
  if (lucroTributavel > 1_500_000) {
    const t1 = Math.min(lucroTributavel, 7_500_000) - 1_500_000;
    const t2 = Math.max(0, Math.min(lucroTributavel, 35_000_000) - 7_500_000);
    const t3 = Math.max(0, lucroTributavel - 35_000_000);
    pacProximoAno = t1 * pacRates[0] + t2 * pacRates[1] + t3 * pacRates[2];
  }

  // ── Alertas de validação (Sandrine 11-jun) ────────────────────────
  const alertasPrejuizos: AlertaValidacao[] = [];
  if (totalPrejuziosDisp > 0 && lucroTributavel > 0 && prejuziosEfetivos < totalPrejuziosDisp) {
    alertasPrejuizos.push({
      chave: 'prej_efeito_limite',
      severidade: 'warning',
      texto: `Limite de dedução aplicado: ${(limite * 100).toFixed(0)}% do LT. Excedente de ${(totalPrejuziosDisp - prejuziosEfetivos).toLocaleString('pt-PT', { minimumFractionDigits: 2 })} € não dedutível este período.`,
    });
  }
  if (s.variacaoCapital50) {
    alertasPrejuizos.push({
      chave: 'prej_variacao_capital',
      severidade: 'error',
      texto: '>50% alteração capital social / direitos de voto. AT pode recusar dedução de prejuízos (CIRC art. 52.º).',
    });
  }
  if (s.metodosIndiretos) {
    alertasPrejuizos.push({
      chave: 'prej_metodos_indiretos',
      severidade: 'error',
      texto: 'LT apurado por métodos indiretos (CIRC art. 90.º). Dedução de prejuízos condicionada.',
    });
  }
  if (s.atividadesIsentas) {
    alertasPrejuizos.push({
      chave: 'prej_atividades_isentas',
      severidade: 'warning',
      texto: 'Atividades parcialmente isentas: dedução de prejuízos proporcional à parte não isenta.',
    });
  }
  if (s.retgsAtiva) {
    alertasPrejuizos.push({
      chave: 'prej_retgs',
      severidade: 'info',
      texto: 'RETGS (art. 71.º): prejuízos deduzidos ao grupo, não à entidade. Confirmar consolidação.',
    });
  }
  if (totalPrejuziosDisp > 0 && !s.prejuAt) {
    alertasPrejuizos.push({
      chave: 'prej_at_atualizar',
      severidade: 'info',
      texto: 'Prejuízos carregados manualmente. Use "Atualizar AT" para validar origem e data.',
    });
  }

  const alertasPPC: AlertaValidacao[] = [];
  if (ppcBase > 200) {
    if (s.retgsAtiva) {
      alertasPPC.push({
        chave: 'ppc_retgs',
        severidade: 'warning',
        texto: 'RETGS (art. 71.º): PPC da sociedade dominante pode ser centralizado. Verificar perímetro do grupo.',
      });
    }
    if (s.ppcAt) {
      const dias = Math.floor((Date.now() - new Date(s.ppcAt).getTime()) / 86_400_000);
      if (dias > 90) {
        alertasPPC.push({
          chave: 'ppc_at_stale',
          severidade: 'warning',
          texto: `Última atualização PPC há ${dias} dias. Juros compensatórios podem ser aplicáveis se base se alterou.`,
        });
      }
    } else {
      alertasPPC.push({
        chave: 'ppc_at_atualizar',
        severidade: 'info',
        texto: 'PPC não confirmado contra AT. Use "Atualizar PPC" para validar base do próximo período.',
      });
    }
    if (!s.ppc3Reavaliado && ppcBase > 0) {
      alertasPPC.push({
        chave: 'ppc_3_nao_reavaliado',
        severidade: 'info',
        texto: '3.ª prestação (15-dez) ainda não foi reavaliada. Pode ajustar a 1/3 se LT descer 20% (art. 105.º n.4).',
      });
    }
  }
  // Modelo 22 do período anterior não importado (Sandrine 11-jun) — afeta
  // validação cruzada dos prejuízos e base PPC.
  if (!s.modelo22AnteriorDisponivel && (s.periodo - 1) > 0) {
    alertasPPC.push({
      chave: 'ppc_mod22_indisponivel',
      severidade: 'warning',
      texto: `Modelo 22 de ${s.periodo - 1} não importado. Sem ele, validação cruzada da base PPC e dos prejuízos reportados fica limitada.`,
    });
  }
  // 1.ª ou 2.ª prestação sem registo de pagamento — registar antes da 3.ª
  if (ppcBase > 200 && ppcProximoAno > 0 && (!s.ppc1Pago || !s.ppc2Pago)) {
    const falta = !s.ppc1Pago && !s.ppc2Pago ? '1.ª e 2.ª prestações' : !s.ppc1Pago ? '1.ª prestação' : '2.ª prestação';
    alertasPPC.push({
      chave: 'ppc_prestacoes_pendentes',
      severidade: 'warning',
      texto: `${falta} ainda não registada(s) como paga(s). Confirmar antes de reavaliar a 3.ª prestação (15-dez).`,
    });
  }
  // Estimativa fiscal desatualizada — balancete > 90 dias
  if (s.balanceteData) {
    const dias = Math.floor((Date.now() - new Date(s.balanceteData).getTime()) / 86_400_000);
    if (dias > 90) {
      alertasPPC.push({
        chave: 'ppc_estimativa_desatualizada',
        severidade: 'warning',
        texto: `Último balancete há ${dias} dias. Estimativa de LT pode não refletir a situação atual.`,
      });
    }
  } else if (ppcBase > 200) {
    alertasPPC.push({
      chave: 'ppc_sem_balancete',
      severidade: 'info',
      texto: 'Sem data de balancete registada. Reavaliar 3.ª prestação exige um balancete com menos de 90 dias.',
    });
  }

  return {
    totalRendimentos, totalGastos,
    raiCalc, effectiveRai, c708, acrescer, c753, c776,
    lucroTributavel, prejuizoFiscal, totalPrejuziosDisp, prejuziosEfetivos, materiaColetavel,
    ircColeta, derramaEstadual, derrMunicipal, c378, deducoesColeta, c358,
    taViaturas, taOutras, taBruta, taTotal,
    totalPagamentos, c367, pecCalculado,
    ppcProximoAno, ppcPrestacao, ppcTaxa, pacProximoAno,
    alertasPrejuizos, alertasPPC, limiteDedPrejuizo: limite,
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
