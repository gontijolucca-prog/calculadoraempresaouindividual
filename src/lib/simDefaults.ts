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
  // Investimento previsto — vem do diagnóstico da ficha (não voltar a pedir).
  invEquip: p.investimento?.equipamentos || 0,
  invLic: 0,
  invWorks: p.investimento?.obras || 0,
  invFundo: p.investimento?.stock || 0,
  // Custos da ficha são ANUAIS: fixos (rendas, serviços externos, viaturas,
  // equipamentos) → mensal; variáveis (mercadorias, combustíveis, outros) → ano.
  fixedMo: Math.round(((p.custos?.rendas || 0) + (p.custos?.servicosExternos || 0) + (p.custos?.viaturas || 0) + (p.custos?.equipamentos || 0)) / 12),
  varYr: (p.custos?.mercadorias || 0) + (p.custos?.combustiveis || 0) + (p.custos?.outros || 0),
  accMoLda: 0, accMoEni: 0,
  anosAtividade: p.inicioAtividade > 0 ? Math.max(0, new Date().getFullYear() - p.inicioAtividade) : 0,
  transparenciaFiscal: p.regimeContabilidade === 'transparencia_fiscal',
});

export const getInitialVehicleState = (p?: ClientProfile): VehicleSimulatorState => ({
  // Categoria/motor derivados do diagnóstico de viaturas da ficha, quando existe.
  category: p?.viaturasDiag?.tipo?.comercial && !p?.viaturasDiag?.tipo?.passageiros ? 'comercial' : 'passageiros',
  engineType: p?.viaturasDiag?.tipo?.eletrico ? 'electric' : p?.viaturasDiag?.tipo?.hibrido ? 'hybrid' : 'diesel',
  price: 0,
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
  income: p.rendimentoMensalEni || 0,
  // Regime e 1.º ano vêm da ficha (regimeSs + ano de início de atividade).
  regime: p.regimeSs === 'general' ? 'general' : 'simplified',
  tipoRendimento: p.tipoRendimentoSs,
  primeiroAno: p.inicioAtividade > 0 && p.inicioAtividade >= new Date().getFullYear(),
});
