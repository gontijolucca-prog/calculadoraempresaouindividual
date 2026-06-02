/**
 * Cálculo de Salário Líquido — Trabalhador por Conta de Outrem (TCO)
 * Portugal 2026
 * Fontes: CIRS Art. 99º (retenção), DL 133/2024 (subsídio alimentação),
 * CRCSPSS Art. 53º (SS trabalhador), Decreto n.º 233-A/2026
 */

import {
  calculateIRS, calcIRSJovem, calcDependentsDeduction,
  TICKET_LIMITS_2026, SS_RATE_EMPLOYER, SS_RATE_EMPLOYEE, IAS_2026,
  type TipoSubsidioRefeicao,
} from './pt2026';

export type EstadoCivil = 'solteiro' | 'casado_1titular' | 'casado_2titulares';

export interface SalarioParams {
  salarioBruto: number;
  estadoCivil: EstadoCivil;
  nrDependentes: number;
  localizacao: 'continente' | 'madeira' | 'acores';
  duodecimos: boolean;
  subsidioAlimentacaoDiario: number;
  tipoSubsidio: TipoSubsidioRefeicao;
  diasSubsidio: number;
  irsJovem: boolean;
  anosAtividade: number;
  idade: number;
  taxaSeguroTrabalho: number;
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
}

// Dedução específica categoria A — CIRS Art. 25º (OE 2026).
// Fórmula: max(8,54 × IAS, contribuições obrigatórias). Para 2026: €4.587,09.
const DEDUCAO_ESPECIFICA_MIN = Math.round(8.54 * IAS_2026 * 100) / 100; // 4587.09

export function calcSalarioLiquido(p: SalarioParams): SalarioResult {
  const nrPagamentos = p.duodecimos ? 14 : 12;

  // 1. SS trabalhador (mensal)
  const ssTrabalhador = p.salarioBruto * SS_RATE_EMPLOYEE;

  // 2. Subsídio de alimentação (mensal) — calculado primeiro porque o excesso
  // sobre o limite isento é rendimento sujeito a IRS (CIRS Art. 2º n.º 3 c)).
  const limiteIsento = TICKET_LIMITS_2026[p.tipoSubsidio];
  const valorDiario = p.subsidioAlimentacaoDiario;
  const subsidioIsento = Math.min(valorDiario, limiteIsento) * p.diasSubsidio;
  const subsidioTotal = valorDiario * p.diasSubsidio;
  const subsidioTributavel = Math.max(0, subsidioTotal - subsidioIsento);

  // 3. Rendimento anual bruto = salário + excesso tributável do subsídio.
  // Assume-se 11 meses de subsídio (excluindo férias) — convenção contabilística mais comum.
  const subsidioTributavelAnual = subsidioTributavel * 11;
  const rendimentoAnualBruto = p.salarioBruto * nrPagamentos + subsidioTributavelAnual;

  // 4. Dedução específica Cat. A — CIRS Art. 25º: max(8,54×IAS, contribuições
  //    obrigatórias do trabalhador). As contribuições = SS anual (11% do bruto ×
  //    nº de pagamentos), NÃO uma percentagem do rendimento. (Antes usava 0,72 do
  //    rendimento, o que inflacionava a dedução e subavaliava o IRS de quase todos.)
  const contribuicoesAnuais = ssTrabalhador * nrPagamentos;
  const deducaoEspecifica = Math.max(DEDUCAO_ESPECIFICA_MIN, contribuicoesAnuais);
  const baseIRSAnual = Math.max(0, rendimentoAnualBruto - deducaoEspecifica);

  // 5. Coleta IRS (tabela escalões 2026)
  let coletaIRS = calculateIRS(baseIRSAnual);

  // 6. Dedução dependentes — CIRS Art. 78º-A
  coletaIRS = Math.max(0, coletaIRS - calcDependentsDeduction(p.nrDependentes));

  // 7. IRS Jovem — CIRS Art. 12º-B
  let irsJovemIsencao = 0;
  if (p.irsJovem && p.idade <= 35) {
    const isencao = calcIRSJovem(p.anosAtividade, baseIRSAnual, p.idade);
    const irsComIsencao = Math.max(0, calculateIRS(Math.max(0, baseIRSAnual - isencao)));
    irsJovemIsencao = Math.max(0, coletaIRS - irsComIsencao);
    coletaIRS = irsComIsencao;
  }

  // 8. Retenção mensal na fonte
  const retencaoIRS = coletaIRS / nrPagamentos;

  // 9. Salário líquido mensal
  const salarioLiquido = p.salarioBruto - ssTrabalhador - retencaoIRS + subsidioIsento;

  // 10. Custo empregador — encargos salariais
  const ssPatronal = p.salarioBruto * SS_RATE_EMPLOYER;
  const seguroTrabalho = p.salarioBruto * (p.taxaSeguroTrabalho || 0);
  const custoSalarial = p.salarioBruto + ssPatronal + seguroTrabalho;

  // 11. Custo total real (inclui subsídio de alimentação pago pela empresa)
  const custoEmpregador = custoSalarial;
  const custoEmpregadorReal = custoSalarial + subsidioTotal;

  // 12. Totais anuais
  const totalAnual = custoEmpregadorReal * nrPagamentos;
  const salarioLiquidoAnual = salarioLiquido * nrPagamentos;

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
  };
}
