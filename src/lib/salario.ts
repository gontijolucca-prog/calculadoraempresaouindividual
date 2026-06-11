/**
 * Cálculo de Salário Líquido — Trabalhador por Conta de Outrem (TCO)
 * Portugal 2026
 *
 * Retenção mensal: TABELAS OFICIAIS de retenção na fonte 2026 (src/lib/retencao.ts)
 *   — Continente: Despacho SEAF de 05/01/2026; Madeira: Despacho n.º 19/2026 (AT-RAM);
 *   Açores: estimativa sinalizada (tabelas 2026 não localizadas — ver retencao.ts).
 * IRS anual: estimativa pelos escalões do Art. 68.º CIRS para calcular o acerto
 *   esperado na declaração (a retenção mensal ≠ imposto final).
 * Outras fontes: CIRS Art. 99.º-C/99.º-F (retenção), DL 133/2024 + Despacho
 *   233-A/2026 (subsídio alimentação), CRCSPSS Art. 53.º (SS), DL 139/2025 (SMN).
 */

import {
  calculateIRS, calcIRSJovem, calcDependentsDeduction,
  TICKET_LIMITS_2026, SS_RATE_EMPLOYER, SS_RATE_EMPLOYEE, IAS_2026,
  type TipoSubsidioRefeicao,
} from './pt2026';
// Fator regional dos ESCALÕES ANUAIS de IRS (Açores 0,80 / Madeira 0,70) — usado
// apenas na estimativa do IRS anual; a retenção mensal usa as tabelas regionais próprias.
import { REGIOES } from './irs';
import { calcRetencaoMensal, calcRetencaoSubsidio, type SituacaoFamiliarRF } from './retencao';
import type { RegiaoRF } from './retencaoTabelas';

export type EstadoCivil = SituacaoFamiliarRF;

export interface SalarioParams {
  salarioBruto: number;
  estadoCivil: EstadoCivil;
  nrDependentes: number;
  localizacao: RegiaoRF;
  duodecimos: boolean;
  subsidioAlimentacaoDiario: number;
  tipoSubsidio: TipoSubsidioRefeicao;
  diasSubsidio: number;
  irsJovem: boolean;
  anosAtividade: number;
  idade: number;
  taxaSeguroTrabalho: number;
  /** titular com deficiência (grau fiscal relevante) — tabelas IV–VII */
  deficiente?: boolean;
}

export interface SalarioResult {
  salarioBruto: number;
  ssTrabalhador: number;
  retencaoIRS: number;
  subsidioAlimentacao: number;
  subsidioAlimentacaoIsento: number;
  subsidioAlimentacaoTributavel: number;
  salarioLiquido: number;
  custoPrevio: number;
  custoEmpregador: number;
  ssPatronal: number;
  seguroTrabalho: number;
  custoSalarial: number;
  custoEmpregadorReal: number;
  totalAnual: number;
  salarioLiquidoAnual: number;
  nrPagamentos: number;
  irsJovemIsencao: number;
  /** id da tabela oficial aplicada (I–VII); null = modo estimativa (Açores) */
  tabelaRetencao: string | null;
  /** false = retenção estimada (região sem tabelas oficiais publicadas) */
  retencaoOficial: boolean;
  /** taxa efetiva mensal de retenção sobre a remuneração sujeita */
  taxaEfetivaRetencao: number;
  /** retenção autónoma sobre cada subsídio (férias/Natal) por inteiro — 0 com duodécimos */
  retencaoSubsidio: number;
  /** totais anuais reais */
  brutoAnual: number;
  ssAnual: number;
  retencaoAnual: number;
  /** estimativa do IRS anual final (escalões Art. 68.º) e do acerto na declaração */
  irsAnualEstimado: number;
  /** positivo = a pagar no acerto; negativo = reembolso esperado */
  acertoEstimado: number;
}

// Dedução específica categoria A — CIRS Art. 25º (OE 2026).
// Fórmula: max(8,54 × IAS, contribuições obrigatórias). Para 2026: €4.587,09.
const DEDUCAO_ESPECIFICA_MIN = Math.round(8.54 * IAS_2026 * 100) / 100; // 4587.09

// Teto de rendimentos abrangidos pelo IRS Jovem — CIRS Art. 12.º-B: 55 × IAS.
const TETO_IRS_JOVEM = IAS_2026 * 55; // 29 542,15 €

/** Fração de isenção IRS Jovem por anos de atividade (CIRS Art. 12.º-B). */
function pctIsencaoJovem(anosAtividade: number, idade: number): number {
  if (idade > 35 || anosAtividade < 0 || anosAtividade > 9) return 0;
  if (anosAtividade < 1) return 1.0;
  if (anosAtividade < 4) return 0.75;
  if (anosAtividade < 7) return 0.5;
  return 0.25;
}

export function calcSalarioLiquido(p: SalarioParams): SalarioResult {
  const deficiente = p.deficiente ?? false;
  // Recibos por ano: 14 (12 meses + férias + Natal) ou 12 com subsídios em duodécimos.
  const nrPagamentos = p.duodecimos ? 12 : 14;

  // 1. Subsídio de alimentação (mensal) — o excesso sobre o limite isento é
  //    rendimento sujeito a IRS no mês (CIRS Art. 2.º n.º 3 c)) e entra na
  //    remuneração mensal para efeitos de retenção.
  const limiteIsento = TICKET_LIMITS_2026[p.tipoSubsidio];
  const valorDiario = p.subsidioAlimentacaoDiario;
  const subsidioIsento = Math.min(valorDiario, limiteIsento) * p.diasSubsidio;
  const subsidioTotal = valorDiario * p.diasSubsidio;
  const subsidioTributavel = Math.max(0, subsidioTotal - subsidioIsento);
  // Convenção: 11 meses de subsídio de alimentação por ano (excluindo férias).
  const MESES_SUBSIDIO_ALIMENTACAO = 11;

  // 2. IRS Jovem — fração isenta aplicada na retenção (taxa efetiva da remuneração
  //    total incide só sobre a parte não isenta), com o teto anual de 55 × IAS.
  const rendimentoAnualBase = p.salarioBruto * 14;
  const pctJovem = p.irsJovem ? pctIsencaoJovem(p.anosAtividade, p.idade) : 0;
  const isencaoJovemPct = rendimentoAnualBase > 0
    ? pctJovem * Math.min(1, TETO_IRS_JOVEM / rendimentoAnualBase)
    : 0;

  // 3. Retenção mensal — tabelas oficiais 2026.
  const paramsRF = {
    situacao: p.estadoCivil,
    nrDependentes: p.nrDependentes,
    deficiente,
    regiao: p.localizacao,
  };
  const remuneracaoMensal = p.salarioBruto + subsidioTributavel;
  const retMes = calcRetencaoMensal({ ...paramsRF, remuneracao: remuneracaoMensal }, isencaoJovemPct);
  const retMesSemJovem = isencaoJovemPct > 0
    ? calcRetencaoMensal({ ...paramsRF, remuneracao: remuneracaoMensal }, 0)
    : retMes;

  // 4. Subsídios de férias/Natal — retenção autónoma (Art. 99.º-C n.º 5).
  //    Com duodécimos, retém-se mensalmente a parte proporcional (2 × 1/12).
  const retSubsidioInteiro = calcRetencaoSubsidio(p.salarioBruto, paramsRF, isencaoJovemPct).retencao;
  const retDuodecimosMensal = p.duodecimos ? (retSubsidioInteiro * 2) / 12 : 0;

  const retencaoIRS = retMes.retencao + retDuodecimosMensal;
  const irsJovemIsencao = Math.max(0, retMesSemJovem.retencao - retMes.retencao);

  // 5. SS do trabalhador — 11% sobre a remuneração base do mês (os subsídios de
  //    férias/Natal também descontam SS; com duodécimos o desconto acompanha o mês).
  const cashBrutoMensal = p.duodecimos ? p.salarioBruto * (14 / 12) : p.salarioBruto;
  const ssTrabalhador = cashBrutoMensal * SS_RATE_EMPLOYEE;

  // 6. Salário líquido do mês típico.
  const salarioLiquido = cashBrutoMensal - ssTrabalhador - retencaoIRS + subsidioIsento;

  // 7. Totais anuais reais (14 remunerações base + subsídio alimentação 11 meses).
  const brutoAnual = p.salarioBruto * 14 + subsidioTributavel * MESES_SUBSIDIO_ALIMENTACAO;
  const ssAnual = p.salarioBruto * 14 * SS_RATE_EMPLOYEE;
  const retencaoAnual = p.duodecimos
    ? retencaoIRS * 12
    : retMes.retencao * 12 + retSubsidioInteiro * 2;
  const salarioLiquidoAnual =
    p.salarioBruto * 14 - ssAnual - retencaoAnual + subsidioIsento * MESES_SUBSIDIO_ALIMENTACAO;

  // 8. IRS anual estimado (escalões Art. 68.º) → acerto esperado na declaração.
  //    Nota: para titulares com deficiência a estimativa anual não modela os
  //    abatimentos próprios — o acerto apresentado é indicativo.
  const contribuicoesAnuais = ssAnual;
  const deducaoEspecifica = Math.max(DEDUCAO_ESPECIFICA_MIN, contribuicoesAnuais);
  const baseIRSAnual = Math.max(0, brutoAnual - deducaoEspecifica);
  const fatorRegiao = REGIOES[p.localizacao] ?? 1;
  const qf = p.estadoCivil === 'casado_1titular' ? 2 : 1;
  const irsAnual = (base: number) => calculateIRS(Math.max(0, base) / qf) * qf * fatorRegiao;
  let irsAnualEstimado = irsAnual(baseIRSAnual);
  irsAnualEstimado = Math.max(0, irsAnualEstimado - calcDependentsDeduction(p.nrDependentes));
  if (pctJovem > 0) {
    const isencao = calcIRSJovem(p.anosAtividade, baseIRSAnual, p.idade);
    irsAnualEstimado = Math.min(irsAnualEstimado, Math.max(0, irsAnual(baseIRSAnual - isencao)));
  }
  const acertoEstimado = irsAnualEstimado - retencaoAnual;

  // 9. Custo empregador — encargos sobre a remuneração base.
  const ssPatronal = p.salarioBruto * SS_RATE_EMPLOYER;
  const seguroTrabalho = p.salarioBruto * (p.taxaSeguroTrabalho || 0);
  const custoSalarial = p.salarioBruto + ssPatronal + seguroTrabalho;
  const custoEmpregador = custoSalarial;
  const custoEmpregadorReal = custoSalarial + subsidioTotal;

  // 10. Custo total anual: 14 remunerações base com encargos + subsídio
  //     alimentação em 11 meses (antes contava o subsídio 14×).
  const totalAnual =
    (p.salarioBruto + ssPatronal + seguroTrabalho) * 14 +
    subsidioTotal * MESES_SUBSIDIO_ALIMENTACAO;

  return {
    salarioBruto: p.salarioBruto,
    ssTrabalhador,
    retencaoIRS,
    subsidioAlimentacao: subsidioTotal,
    subsidioAlimentacaoIsento: subsidioIsento,
    subsidioAlimentacaoTributavel: subsidioTributavel,
    salarioLiquido,
    custoPrevio: p.salarioBruto,
    custoEmpregador,
    ssPatronal,
    seguroTrabalho,
    custoSalarial,
    custoEmpregadorReal,
    totalAnual,
    salarioLiquidoAnual,
    nrPagamentos,
    irsJovemIsencao,
    tabelaRetencao: retMes.tabelaId,
    retencaoOficial: retMes.oficial,
    taxaEfetivaRetencao: retMes.taxaEfetiva,
    retencaoSubsidio: p.duodecimos ? 0 : retSubsidioInteiro,
    brutoAnual,
    ssAnual,
    retencaoAnual,
    irsAnualEstimado,
    acertoEstimado,
  };
}
