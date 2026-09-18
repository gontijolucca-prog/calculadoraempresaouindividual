/**
 * Helper puro de Tickets — isento vs excedente (OE 2026).
 * Extraído do TicketSimulator para testabilidade sem tocar na UI.
 * Regra: isento = min(valorPago, limiteDiario) × dias × trabalhadores
 *        tributável = max(0, valorPago - limite) × dias × trabalhadores
 * IRS e SS usam a mesma base isenta (excedente tributável em ambos).
 */

export interface TicketIsencao {
  isentoDiario: number;
  tributavelDiario: number;
}

export function calcTicketIsencao(valorPago: number, limiteDiario: number): TicketIsencao {
  const isentoDiario = Math.min(valorPago, limiteDiario);
  const tributavelDiario = Math.max(0, valorPago - limiteDiario);
  return { isentoDiario, tributavelDiario };
}

export interface TicketAnual {
  custoAnual: number;
  custoIsento: number;
  custoExcedente: number;
  isentoDiario: number;
  tributavelDiario: number;
}

export function calcTicketAnual(
  employees: number,
  ticketValue: number,
  limiteDiario: number,
  daysPerMonth: number,
  months: number
): TicketAnual {
  const { isentoDiario, tributavelDiario } = calcTicketIsencao(ticketValue, limiteDiario);
  const custoAnual = employees * ticketValue * daysPerMonth * months;
  const custoIsento = employees * isentoDiario * daysPerMonth * months;
  const custoExcedente = Math.max(0, custoAnual - custoIsento);
  // tributavelDiario já é valorPago - limite quando excede; custoExcedente confere via diferença
  void tributavelDiario;
  return { custoAnual, custoIsento, custoExcedente, isentoDiario, tributavelDiario: Math.max(0, ticketValue - limiteDiario) };
}
