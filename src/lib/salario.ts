/**
 * Cálculo de Salário Líquido — Trabalhador por Conta de Outrem (TCO)
 * Portugal 2026
 * Fontes: CIRS Art. 99º (retenção), DL 133/2024 (subsídio alimentação),
 * CRCSPSS Art. 53º (SS trabalhador), Decreto n.º 233-A/2026
 */

import { calculateIRS, calcIRSJovem, calcDependentsDeduction, TICKET_LIMITS_2026, type TipoSubsidioRefeicao } from './pt2026';

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
}

export interface SalarioResult {
  salarioBruto: number;
  ssTrabalhador: number;
  retencaoIRS: number;
  subsidioAlimentacao: number;
  subsidioAlimentacaoIsento: number;
  subsidioAlimentacaoTributavel: number;
  salarioLiquido: number;
  custoPrevio: number;         // custo mensal antes de qualquer desconto
  custoEmpregador: number;
  ssPatronal: number;
  totalAnual: number;
  salarioLiquidoAnual: number;
  nrPagamentos: number;        // 12 ou 14
  irsJovemIsencao: number;
}

// Limites via constante centralizada em pt2026.ts

// Taxa SS trabalhador TCO — CRCSPSS Art. 53º
const SS_TRABALHADOR = 0.11;
// Taxa SS patronal — CRCSPSS Art. 53º
const SS_PATRONAL = 0.2375;

// Dedução específica mínima categoria A — CIRS Art. 25º
const DEDUCAO_ESPECIFICA_MIN = 4104;
const DEDUCAO_ESPECIFICA_RATE = 0.72;

export function calcSalarioLiquido(p: SalarioParams): SalarioResult {
  const nrPagamentos = p.duodecimos ? 14 : 12;

  // 1. SS trabalhador (mensal)
  const ssTrabalhador = p.salarioBruto * SS_TRABALHADOR;

  // 2. Rendimento anual bruto para cálculo IRS
  const rendimentoAnualBruto = p.salarioBruto * nrPagamentos;

  // 3. Dedução específica Cat. A (mínimo €4.104 ou 72% do rendimento)
  const deducaoEspecifica = Math.max(DEDUCAO_ESPECIFICA_MIN, rendimentoAnualBruto * DEDUCAO_ESPECIFICA_RATE);
  const baseIRSAnual = Math.max(0, rendimentoAnualBruto - deducaoEspecifica);

  // 4. Coleta IRS (tabela escalões 2026)
  let coletaIRS = calculateIRS(baseIRSAnual);

  // 5. Dedução dependentes — CIRS Art. 78º-A
  coletaIRS = Math.max(0, coletaIRS - calcDependentsDeduction(p.nrDependentes));

  // 6. IRS Jovem — CIRS Art. 12º-B
  let irsJovemIsencao = 0;
  if (p.irsJovem && p.idade <= 35) {
    const isencao = calcIRSJovem(p.anosAtividade, baseIRSAnual, p.idade);
    const irsComIsencao = Math.max(0, calculateIRS(Math.max(0, baseIRSAnual - isencao)));
    irsJovemIsencao = Math.max(0, coletaIRS - irsComIsencao);
    coletaIRS = irsComIsencao;
  }

  // 7. Retenção mensal na fonte
  const retencaoIRS = coletaIRS / nrPagamentos;

  // 8. Subsídio de alimentação
  const limiteIsento = TICKET_LIMITS_2026[p.tipoSubsidio];
  const valorDiario = p.subsidioAlimentacaoDiario;
  const subsidioIsento = Math.min(valorDiario, limiteIsento) * p.diasSubsidio;
  const subsidioTotal = valorDiario * p.diasSubsidio;
  const subsidioTributavel = Math.max(0, subsidioTotal - subsidioIsento);

  // 9. Salário líquido mensal
  const salarioLiquido = p.salarioBruto - ssTrabalhador - retencaoIRS + subsidioIsento;

  // 10. Custo empregador
  const ssPatronal = p.salarioBruto * SS_PATRONAL;
  const custoEmpregador = p.salarioBruto + ssPatronal;

  // 11. Totais anuais
  const totalAnual = custoEmpregador * nrPagamentos;
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
    totalAnual,
    salarioLiquidoAnual,
    nrPagamentos,
    irsJovemIsencao,
  };
}
