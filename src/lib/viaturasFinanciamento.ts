/**
 * Comparador de aquisição de viatura: compra, crédito, leasing e renting.
 *
 * Reutiliza o motor fiscal de `viaturas.ts` para IVA de aquisição, limites de
 * depreciação e taxa de Tributação Autónoma. Junta a matemática financeira
 * (anuidade com valor residual) e as regras próprias de cada modo:
 *  - crédito: depreciação + juros aceites, IVA como na compra;
 *  - leasing/renting: renda aceite limitada pela depreciação fiscal do prazo,
 *    IVA da renda só com fatura discriminada;
 *  - renting: manutenção/seguro dentro da mensalidade.
 *
 * ⚠ Estimativas para apoio à decisão — confirmar com o Contabilista Certificado.
 */
import { calcViatura, type ViaturaInput, type ViaturaResult } from './viaturas';

export type ModoAquisicao = 'compra' | 'credito' | 'leasing' | 'renting';
export const MODOS: ModoAquisicao[] = ['compra', 'credito', 'leasing', 'renting'];

export interface FinanciamentoInput {
  preco: number;
  duracaoMeses: number;
  entrada: number;
  valorResidual: number;
  tanPercent: number;
  mensalidadeManual?: number;
  incluiManutencao?: boolean;
  incluiSeguro?: boolean;
  rentingDiscriminada?: boolean;
  maintenanceCost: number; // anual, com IVA
  insuranceCost: number;   // anual
  fuelCost: number;        // anual, com IVA
  /** Contexto fiscal (categoria, motor, atividade, IVA, TA…). */
  fiscal?: Partial<ViaturaInput>;
}

export interface FinanciamentoResultado {
  modo: ModoAquisicao;
  mensalidade: number;
  jurosTotais: number;
  cashInicial: number;
  custoTotal: number;
  custoAnualMedio: number;
  ivaDedutivel: number;
  taRate: number;
  taBaseAnual: number;
  taValue: number;
  depAceite: number;
  gastoAceite: number;
  gastoNaoAceite: number;
  custoLiquido: number;
  viatura: ViaturaResult;
}

const IVA = 0.23;
const TAXA_DEPRECIACAO = 0.25;

export function mesesValidos(meses: number): number {
  if (!Number.isFinite(meses) || meses <= 0) return 48;
  return Math.min(120, Math.max(12, Math.round(meses)));
}

/** Anuidade com valor residual (balloon). */
export function pmt(preco: number, entrada: number, tanPercent: number, meses: number, residual = 0): number {
  const n = mesesValidos(meses);
  const capital = Math.max(0, (preco || 0) - Math.max(0, entrada || 0));
  const balloon = Math.max(0, Math.min(residual || 0, capital));
  const r = Math.max(0, tanPercent || 0) / 100 / 12;
  if (capital <= 0) return 0;
  if (r === 0) return Math.max(0, (capital - balloon) / n);
  const fator = Math.pow(1 + r, n);
  const valorPresenteResidual = balloon / fator;
  const capitalFinanciado = Math.max(0, capital - valorPresenteResidual);
  return capitalFinanciado * r / (1 - 1 / fator);
}

/** IVA da renda (leasing/renting): 0% se a fatura não discriminar ou em ligeiros de passageiros. */
export function ivaRendaDedutivel(input: ViaturaInput, rentingDiscriminada: boolean): number {
  if (!rentingDiscriminada) return 0;
  const activity = input.activity || 'other';
  if (['public_transport', 'rent_a_car', 'driving_school', 'tvde'].includes(activity)) return 1;
  if (input.category === 'comercial') return 1;
  if (input.category === 'comercial_n1' || input.category === 'moto' || input.category === 'passageiros') return 0;
  return 0;
}

function anosDoPrazo(meses: number): number {
  return mesesValidos(meses) / 12;
}

function encargosAnuais(input: FinanciamentoInput, v: ViaturaResult, incluiManut: boolean, incluiSeguro: boolean) {
  const semManut = incluiManut ? 0 : input.maintenanceCost;
  const semSeguro = incluiSeguro ? 0 : input.insuranceCost;
  const manutBase = semManut / (1 + IVA);
  const fuelBase = input.fuelCost / (1 + IVA);
  const custo = semManut + semSeguro + input.fuelCost;
  const ivaOperacional = (semManut / (1 + IVA)) * (semManut > 0 ? ivaManutRate(v, input) : 0)
    + (input.fuelCost / (1 + IVA)) * ivaFuelRate(v, input);
  return { custo, ivaOperacional, ivaRecupManut: v.ivaRecupManutencao * (semManut / Math.max(1, input.maintenanceCost)), manutBase, fuelBase };
}

// As taxas já vêm calculadas no motor; recuperamos a proporção aplicada.
function ivaManutRate(v: ViaturaResult, input: FinanciamentoInput): number {
  const base = input.maintenanceCost / (1 + IVA);
  return base > 0 ? v.ivaRecupManutencao / base : 0;
}
function ivaFuelRate(v: ViaturaResult, input: FinanciamentoInput): number {
  const base = input.fuelCost / (1 + IVA);
  return base > 0 ? v.ivaRecupCombustivel / base : 0;
}

export function calcularModo(modo: ModoAquisicao, input: FinanciamentoInput): FinanciamentoResultado {
  const viaturaInput: ViaturaInput = {
    category: 'passageiros',
    engineType: 'diesel',
    ivaRegime: 'normal',
    activity: 'other',
    exemptTA: false,
    phevCompliant: false,
    ...(input.fiscal ?? {}),
    price: input.preco,
    maintenanceCost: input.maintenanceCost,
    insuranceCost: input.insuranceCost,
    fuelCost: input.fuelCost,
  };
  // Campos de financiamento não existem no motor fiscal — removem-se por tipagem estrutural.
  const v = calcViatura(viaturaInput);
  const n = mesesValidos(input.duracaoMeses);
  const anos = anosDoPrazo(n);
  const entrada = Math.max(0, input.entrada || 0);
  const residual = Math.max(0, input.valorResidual || 0);
  const incluiManut = modo === 'renting' && !!input.incluiManutencao;
  const incluiSeguro = modo === 'renting' && !!input.incluiSeguro;
  const discrim = input.rentingDiscriminada !== false;

  const enc = encargosAnuais(input, v, incluiManut, incluiSeguro);
  const encargosPrazo = enc.custo * anos;
  // Base fiscal sem IVA dedutível; o desembolso mantém o IVA.
  const encargoFiscalPrazo = Math.max(0, enc.custo - enc.ivaOperacional) * anos;

  const depAnualAceite = Math.min(input.preco, v.limit === Infinity ? input.preco : v.limit) * TAXA_DEPRECIACAO;
  const depAceitePrazo = Math.min(input.preco, depAnualAceite * anos);

  let mensalidade = 0;
  let jurosTotais = 0;
  let cashInicial = entrada;
  let custoTotal = 0;
  let ivaDedutivel = 0;
  let gastoAceite = 0;
  let taBaseAnual = 0;

  if (modo === 'compra') {
    cashInicial = input.preco;
    custoTotal = input.preco + encargosPrazo;
    // IVA da aquisição só uma vez; manutenção/combustível repetem-se por ano.
    ivaDedutivel = v.ivaAquisicaoDedutivel + (v.ivaRecupManutencao + v.ivaRecupCombustivel) * anos;
    gastoAceite = depAceitePrazo + encargoFiscalPrazo;
    taBaseAnual = v.totalEncsTA;
  } else if (modo === 'credito') {
    mensalidade = pmt(input.preco, entrada, input.tanPercent, n, residual);
    jurosTotais = Math.max(0, mensalidade * n + residual - (input.preco - entrada));
    cashInicial = entrada;
    custoTotal = entrada + mensalidade * n + residual + encargosPrazo;
    ivaDedutivel = v.ivaAquisicaoDedutivel + (v.ivaRecupManutencao + v.ivaRecupCombustivel) * anos;
    gastoAceite = depAceitePrazo + jurosTotais + encargoFiscalPrazo;
    // Juros não entram na base da TA (CIRC art. 88.º): só depreciação + encargos.
    taBaseAnual = v.totalEncsTA;
  } else {
    const manual = input.mensalidadeManual && input.mensalidadeManual > 0 ? input.mensalidadeManual : 0;
    const mensalidadeCalculada = pmt(input.preco, entrada, input.tanPercent, n, residual);
    mensalidade = manual || mensalidadeCalculada;
    cashInicial = entrada;
    custoTotal = entrada + mensalidade * n + residual + encargosPrazo;
    jurosTotais = Math.max(0, mensalidade * n + residual - (input.preco - entrada));
    const rendaNaoIva = mensalidade * n;
    ivaDedutivel = (rendaNaoIva / (1 + IVA)) * IVA * ivaRendaDedutivel(viaturaInput, discrim) + enc.ivaOperacional * anos;
    // Renda aceite limitada pela depreciação fiscal do prazo (as rendas substituem a depreciação).
    const limiteRendaPrazo = depAceitePrazo + jurosTotais;
    gastoAceite = Math.min(rendaNaoIva / (1 + IVA), Math.max(0, limiteRendaPrazo)) + encargoFiscalPrazo;
    taBaseAnual = (mensalidade / (1 + IVA)) * 12 + Math.max(0, enc.custo - enc.ivaOperacional);
  }

  const taValue = taBaseAnual * (v.taRate || 0);
  const custoLiquido = Math.max(0, custoTotal - ivaDedutivel);

  return {
    modo,
    mensalidade,
    jurosTotais,
    cashInicial,
    custoTotal,
    custoAnualMedio: custoTotal / Math.max(1, anos),
    ivaDedutivel,
    taRate: v.taRate || 0,
    taBaseAnual,
    taValue,
    depAceite: depAceitePrazo,
    gastoAceite,
    gastoNaoAceite: Math.max(0, custoTotal - gastoAceite),
    custoLiquido,
    viatura: v,
  };
}

export interface ComparacaoResultado {
  resultados: Record<ModoAquisicao, FinanciamentoResultado>;
  melhor: ModoAquisicao;
}

export function compararModos(input: FinanciamentoInput, ordem: ModoAquisicao[] = MODOS): ComparacaoResultado {
  const resultados = {} as Record<ModoAquisicao, FinanciamentoResultado>;
  for (const m of MODOS) resultados[m] = calcularModo(m, input);
  let melhor: ModoAquisicao = ordem[0] ?? 'compra';
  for (const m of ordem) {
    if (resultados[m].custoLiquido < resultados[melhor].custoLiquido) melhor = m;
  }
  return { resultados, melhor };
}

export const ETIQUETA_MODO: Record<ModoAquisicao, string> = {
  compra: 'Compra',
  credito: 'Crédito',
  leasing: 'Leasing',
  renting: 'Renting',
};
