/**
 * Motor de comparação fiscal ENI vs Lda — extraído do TaxSimulator para uma
 * função pura (testável e reutilizável). Não toca em DOM nem em estado React.
 *
 * ENI = regime simplificado (coeficiente art.31 CIRS × faturação, com a regra de
 * justificação dos 15% do n.º13) + SS de independente + IRS marginal sobre o
 * rendimento já existente do sócio.
 * Lda = remuneração do gerente (gross-up do que precisa de levantar) + IRC PME
 * 15%/19% (ou transparência fiscal art.6.º CIRC) + (novo) derrama municipal e a
 * hipótese de distribuição de dividendos (retenção 28%, CIRS art.71.º).
 *
 * ⚠ Valores fiscais a confirmar por um contabilista — ver docs/AUDITORIA-FISCAL-PENDENTE.md.
 */
import {
  calculateIRS, calcIRSJovem, calcDependentsDeduction,
  calcSelfSSContribution, SS_RATE_EMPLOYER, SS_RATE_EMPLOYEE, IAS_2026,
} from './pt2026';

// Dedução específica Cat A 2026 — 8,54 × IAS (art. 25.º CIRS).
export const DED_ESPECIFICA_CAT_A_2026 = Math.round(8.54 * IAS_2026 * 100) / 100; // 4587.09
// Limiar da regra de justificação dos 15% (art.31 n.13). Valor 2025 mantido — a
// Portaria de atualização 2026 ainda não foi publicada. ⚠ confirmar.
export const LIMIAR_JUSTIFICACAO_15PCT = 27360;
// Retenção liberatória sobre dividendos distribuídos — CIRS art.71.º.
const TAXA_DIVIDENDOS = 0.28;

export interface FiscalInput {
  profSit: string;
  currentInc: number;
  isMainAct: boolean;
  monthlyNeed: number;
  isServices: boolean;
  rev: number;
  invEquip: number;
  invLic: number;
  invWorks: number;
  invFundo: number;
  fixedMo: number;
  varYr: number;
  accMoLda: number;
  accMoEni: number;
  anosAtividade: number;
  transparenciaFiscal: boolean;
  /** Coeficiente do art.31 (do perfil); se ausente, 0,75 serviços / 0,15 bens. */
  coefArt31?: number;
  beneficioJovem: boolean;
  idade: number;
  nrDependentes: number;
  /** Taxa de derrama municipal (fração, ex. 0.015 = 1,5%). Default 0. ⚠ por município. */
  taxaDerramaMunicipal?: number;
}

export interface FiscalResult {
  totalInv: number;
  beEni: number;
  beLda: number;
  irsJovemDeduction: number;
  depsDeduction: number;
  ppc: number;
  retencaoFonte: number;
  transparenciaFiscal: boolean;
  transparenciaIRSOnProfit: number;
  derramaMunicipal: number;
  eni: { ss: number; irs: number; net: number; cashFlow: number; costs: number; rendColetavel: number };
  lda: {
    ssComp: number; ssEmp: number; irc: number; irs: number;
    net: number; cashFlow: number; profit: number; costs: number;
    /** Líquido se o lucro for distribuído como dividendos (−28%). */
    netDistribuido: number;
    /** Imposto sobre os dividendos distribuídos. */
    impostoDividendos: number;
  };
}

export function compararEniLda(i: FiscalInput): FiscalResult {
  const totalInv = i.invEquip + i.invLic + i.invWorks + i.invFundo;
  const invCapex = i.invEquip + i.invLic + i.invWorks;
  const fixedYr = i.fixedMo * 12;
  const accYrLda = i.accMoLda * 12;
  const accYrEni = i.accMoEni * 12;
  const dpNaoAceite = invCapex * 0.25;
  const costsLdaOutPocket = fixedYr + i.varYr + accYrLda;
  const costsEniOutPocket = fixedYr + i.varYr + accYrEni;

  // ── ENI ──
  let eniSS = 0;
  if (i.profSit === 'tco' && !i.isMainAct && i.rev <= 20000) {
    eniSS = 0; // ENI complementar isento (art. 168.º-A CRCSPSS)
  } else {
    eniSS = calcSelfSSContribution(i.rev / 12, i.isServices ? 'servicos' : 'bens', false).anual;
  }

  const coefArt31 = i.coefArt31 ?? (i.isServices ? 0.75 : 0.15);
  let eniRendColetavel = i.rev * coefArt31;
  const aplicaJustificacao = coefArt31 === 0.75 || coefArt31 === 0.35;
  if (aplicaJustificacao && i.rev > LIMIAR_JUSTIFICACAO_15PCT) {
    const requiredJustDocs = i.rev * 0.15;
    const justDocsPresented = costsEniOutPocket + DED_ESPECIFICA_CAT_A_2026;
    if (justDocsPresented < requiredJustDocs) {
      eniRendColetavel += (requiredJustDocs - justDocsPresented);
    }
  }

  let irsJovemDeduction = 0;
  if (i.beneficioJovem && i.idade <= 35) {
    irsJovemDeduction = calcIRSJovem(i.anosAtividade, eniRendColetavel, i.idade);
    eniRendColetavel = Math.max(0, eniRendColetavel - irsJovemDeduction);
  }

  const eniIRS_Total = calculateIRS(i.currentInc + eniRendColetavel);
  const eniIRS_Current = calculateIRS(i.currentInc);
  const depsDeduction = calcDependentsDeduction(i.nrDependentes);
  const eniIRS = Math.max(0, eniIRS_Total - eniIRS_Current - depsDeduction);

  const ppc = eniIRS * 0.25;
  const retencaoFonte = i.isServices ? i.rev * 0.115 : 0;
  const eniNet = i.rev - costsEniOutPocket - eniSS - eniIRS;
  const eniCashFlow = eniNet - totalInv;

  // ── Lda ──
  const rawGross = i.monthlyNeed / 0.70;
  const grossSalaryYr = rawGross * 14;
  const ldaSSCompany = grossSalaryYr * SS_RATE_EMPLOYER; // 23,75%
  const ldaSSManager = grossSalaryYr * SS_RATE_EMPLOYEE; // 11%
  const ldaIRSManager = calculateIRS(grossSalaryYr);
  const profit = i.rev - costsLdaOutPocket - dpNaoAceite - grossSalaryYr - ldaSSCompany;

  let irc = 0;
  let transparenciaIRSOnProfit = 0;
  let derramaMunicipal = 0;
  if (i.transparenciaFiscal) {
    if (profit > 0) {
      transparenciaIRSOnProfit = Math.max(0, calculateIRS(grossSalaryYr + profit) - calculateIRS(grossSalaryYr));
    }
  } else if (profit > 0) {
    irc = profit <= 50000 ? profit * 0.15 : (50000 * 0.15) + ((profit - 50000) * 0.19);
    derramaMunicipal = profit * (i.taxaDerramaMunicipal ?? 0); // ⚠ taxa por município
  }

  const companyNetEarnings = profit - irc - derramaMunicipal - transparenciaIRSOnProfit;
  const ldaBusinessNet = companyNetEarnings + (i.monthlyNeed * 12);
  const ldaCashFlow = (companyNetEarnings + dpNaoAceite) - totalInv;

  // Hipótese: lucro retido vs distribuído como dividendos (retenção 28%).
  const impostoDividendos = Math.max(0, companyNetEarnings) * TAXA_DIVIDENDOS;
  const ldaNetDistribuido = (Math.max(0, companyNetEarnings) - impostoDividendos) + (i.monthlyNeed * 12);

  const varMargin = i.rev > 0 ? (i.rev - i.varYr) / i.rev : 0.01;
  const beEni = varMargin > 0 ? (fixedYr + accYrEni) / varMargin : 0;
  const beLda = varMargin > 0 ? (fixedYr + accYrLda + grossSalaryYr + ldaSSCompany) / varMargin : 0;

  return {
    totalInv, beEni, beLda, irsJovemDeduction, depsDeduction, ppc, retencaoFonte,
    transparenciaFiscal: i.transparenciaFiscal, transparenciaIRSOnProfit, derramaMunicipal,
    eni: { ss: eniSS, irs: eniIRS, net: eniNet, cashFlow: eniCashFlow, costs: costsEniOutPocket, rendColetavel: eniRendColetavel },
    lda: {
      ssComp: ldaSSCompany, ssEmp: ldaSSManager, irc, irs: ldaIRSManager,
      net: ldaBusinessNet, cashFlow: ldaCashFlow, profit: companyNetEarnings, costs: costsLdaOutPocket,
      netDistribuido: ldaNetDistribuido, impostoDividendos,
    },
  };
}
