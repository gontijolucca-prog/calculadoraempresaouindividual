/**
 * Estados iniciais dos simuladores derivados do perfil do cliente. Extraídos
 * para um lib partilhado para que tanto o App como a vista "Exportar documentos"
 * (que gera o Pacote do Cliente para a empresa seleccionada) cheguem aos mesmos
 * valores por defeito quando uma empresa ainda não tem o simulador preenchido.
 *
 * Sem dados fantasma: os campos numéricos começam a ZERO; só o que vem do perfil
 * (faturação, idade, tipo de atividade…) chega preenchido.
 */
import type { ClientProfile } from '../ClientProfile';
import type { TicketSimulatorState } from '../TicketSimulator';

export interface TaxSimulatorState {
  profSit: string; currentInc: number; age: number; isMainAct: boolean;
  monthlyNeed: number; isServices: boolean; b2b: boolean; rev: number;
  isSeasonal: boolean; invEquip: number; invLic: number; invWorks: number;
  invFundo: number; fixedMo: number; varYr: number; accMoLda: number;
  accMoEni: number; anosAtividade: number; transparenciaFiscal: boolean;
}

export interface VehicleSimulatorState {
  category: 'comercial' | 'passageiros'; engineType: string; price: number;
  ivaRegime: string; activity: string; maintenanceCost: number;
  insuranceCost: number; fuelCost: number; exemptTA: boolean; phevCompliant: boolean;
}

export interface SSState {
  income: number; regime: 'general' | 'simplified';
  tipoRendimento: 'servicos' | 'bens'; primeiroAno: boolean;
}

export type { TicketSimulatorState };

export const getInitialTaxState = (p: ClientProfile): TaxSimulatorState => ({
  profSit: p.tipoEntidade === 'eni' ? 'outro' : 'tco',
  currentInc: 0, age: p.idade || 0, isMainAct: p.tipoEntidade !== 'eni',
  monthlyNeed: 0, isServices: p.atividadePrincipal === 'servicos',
  b2b: true, rev: p.faturaçaoAnualPrevista || 0, isSeasonal: p.isSazonal,
  invEquip: 0, invLic: 0, invWorks: 0, invFundo: 0,
  fixedMo: 0, varYr: 0, accMoLda: 0, accMoEni: 0,
  anosAtividade: p.inicioAtividade > 0 ? Math.max(0, new Date().getFullYear() - p.inicioAtividade) : 0,
  transparenciaFiscal: p.regimeContabilidade === 'transparencia_fiscal',
});

export const getInitialVehicleState = (): VehicleSimulatorState => ({
  category: 'passageiros', engineType: 'diesel', price: 0,
  ivaRegime: 'normal', activity: 'other', maintenanceCost: 0,
  insuranceCost: 0, fuelCost: 0, exemptTA: false, phevCompliant: true,
});

export const getInitialTicketState = (p: ClientProfile): TicketSimulatorState => ({
  tipoTicket: 'restaurante',
  employees: p.nrFuncionarios || 0,
  ticketValue: p.valorTicket || 0,
  tipoSubsidio: 'cartao',
  daysPerMonth: 22,
  months: 12,
  valorAnualPorPessoa: 0,
  tipoVeiculo: 'passageiros',
});

export const getInitialSSState = (p: ClientProfile): SSState => ({
  income: p.rendimentoMensalEni || 0, regime: 'simplified',
  tipoRendimento: p.tipoRendimentoSs, primeiroAno: false,
});
