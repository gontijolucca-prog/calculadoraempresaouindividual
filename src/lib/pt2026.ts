/**
 * Cálculos Fiscais e Contributivos - Portugal 2026 (Abril)
 * Fonte: Portal das Finanças, Segurança Social, CIVA 2026
 */

// Taxa de IRS (aplicável a salários e pensões)
export const IRS_RATE = 0.28;

// Taxa de contribuição Patronal para Segurança Social (Empresa)
export const SS_RATE_EMPLOYER = 0.2375; // 23.75% para empresas (Lda)

// Taxa de contribuição do Trabalhador por conta própria (ENI)
export const SS_RATE_SELF_EMPLOYED = 0.214; // 21.4% - taxa oficial 2026

/**
 * Calcula o custo total para a empresa ao pagar tickets em vez de salário.
 *
 * Regras 2026:
 * - Tickets de refeição: limite máximo dedutível de 60% para a empresa
 * - Valor máximo diário: 5€ (ou 7€ em alguns setores)
 * - SS sobre benefícios em espécie: NÃO aplicável até ao limite legal
 * - A empresa POUPAA diferença da SS Patronal ao dar tickets em vez de salário
 *
 * @param employees número de trabalhadores
 * @param ticketValue valor diário do ticket (€)
 * @param daysPerMonth dias úteis por mês
 * @param months número de meses por ano (geralmente 12)
 * @returns object com ticketCost, salaryCost, savings
 */
export function calcTicketSavings(
  employees: number,
  ticketValue: number,
  daysPerMonth: number,
  months: number
) {
  // Custo total dos tickets (valor nominal)
  const ticketCost = employees * ticketValue * daysPerMonth * months;

  // Custo que a empresa teria se pagasse o mesmo valor em salário bruto
  // (inclui SS Patronal de 23.75%)
  const salaryCost = ticketCost * (1 + SS_RATE_EMPLOYER);

  // Economia = a empresa POUPAA este valor em SS Patronal
  // ao dar tickets em vez de salário
  const savings = salaryCost - ticketCost;

  return { ticketCost, salaryCost, savings };
}

/**
 * Calcula a contribuição mensal da Segurança Social para trabalhadores independentes.
 *
 * Regras 2026:
 * - Taxa: 21.4% sobre o rendimento relevante
 * - Base de cálculo: 70% para prestações de serviços, 20% para venda de bens
 * - Mínimo de contribuição: 20€ (para quem tem rendimento > 628.14€)
 *
 * @param income rendimento mensal (€)
 * @param tipo "servicos" | "bens" - tipo de rendimento
 * @returns contribuição mensal (€)
 */
export function calcSelfSSContribution(
  income: number,
  tipo: 'servicos' | 'bens' = 'servicos'
) {
  // Em 2026, a taxa é sempre 21.4%
  const taxRate = 0.214;

  // Base de cálculo conforme tipo de atividade:
  // - Prestações de serviços: 70% do rendimento
  // - Venda de bens: 20% do rendimento
  const baseRate = tipo === 'servicos' ? 0.70 : 0.20;
  const baseCalculation = income * baseRate;

  // Mínimo de contribuição: 20€ (para quem tem rendimento relevante > 628.14€)
  const contribution = baseCalculation * taxRate;

  return Math.max(20, contribution);
}

/**
 * Calcula o rendimento coletável para IRS (após deduções)
 * @param grossIncome rendimento bruto anual
 * @param isSimplifiedRegime se está no regime simplificado (25% dedução automática)
 * @returns rendimento coletável
 */
export function calculateTaxableIncome(
  grossIncome: number,
  isSimplifiedRegime: boolean
): number {
  if (isSimplifiedRegime) {
    // Regime simplificado:dedução automática de 25% das despesas
    return grossIncome * 0.75;
  }
  return grossIncome;
}

/**
 * Calcula IRC para empresas (2026)
 * @param profit lucro tributável
 * @returns IRC a pagar
 */
export function calculateIRC(profit: number): number {
  if (profit <= 0) return 0;

  // Taxa reduzida PME: 15% para primeiros 50.000€ de lucro
  // Taxa geral: 19% para lucro acima de 50.000€
  if (profit <= 50000) {
    return profit * 0.15;
  }
  return (50000 * 0.15) + ((profit - 50000) * 0.19);
}