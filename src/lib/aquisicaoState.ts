import type { ModoAquisicao } from './viaturasFinanciamento';

export interface AquisicaoState {
  categoria: 'passageiros' | 'comercial' | 'comercial_n1' | 'moto';
  motor: string;
  ivaRegime: 'normal' | 'second_hand' | 'leasing';
  activity: string;
  regimeTributario: 'irc' | 'irs';
  price: number;
  maintenanceCost: number;
  insuranceCost: number;
  fuelCost: number;
  /** Campos marcados como "não aplicável" (desativados e a 0). */
  na?: string[];
  modoAquisicao?: ModoAquisicao;
  financiamento?: Record<string, unknown>;
}

export const defaultAquisicaoState: AquisicaoState = {
  categoria: 'passageiros', motor: 'diesel', ivaRegime: 'normal', activity: 'other',
  regimeTributario: 'irc', price: 0, maintenanceCost: 0, insuranceCost: 0, fuelCost: 0,
  modoAquisicao: 'compra',
  financiamento: { entrada: 0, duracaoMeses: 48, tanPercent: 6, valorResidual: 0 },
};
