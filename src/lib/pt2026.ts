/**
 * Cálculos Fiscais e Contributivos - Portugal 2026 (Abril)
 * Fonte: Portal das Finanças, Segurança Social, CIVA 2026
 */

// IAS 2026 (Indexante dos Apoios Sociais)
export const IAS_2026 = 542.16;

// Taxa de contribuição Patronal para Segurança Social (Empresa)
export const SS_RATE_EMPLOYER = 0.2375; // 23.75% para empresas (Lda)

// Taxa de contribuição do Trabalhador por conta própria (ENI)
export const SS_RATE_SELF_EMPLOYED = 0.214; // 21.4% - taxa oficial 2026

// Escalões IRS 2026 (VALIDATED_2026_APRIL)
export const IRS_BRACKETS_2026 = [
  { limit: 8235,    rate: 0.13,  ded: 0 },
  { limit: 12301,   rate: 0.165, ded: 288.23 },
  { limit: 17540,   rate: 0.22,  ded: 964.78 },
  { limit: 22779,   rate: 0.25,  ded: 1490.98 },
  { limit: 28987,   rate: 0.32,  ded: 3085.51 },
  { limit: 42250,   rate: 0.355, ded: 4100.06 },
  { limit: 55428,   rate: 0.435, ded: 7480.06 },
  { limit: 86510,   rate: 0.45,  ded: 8311.48 },
  { limit: Infinity, rate: 0.48, ded: 10906.78 },
];

/**
 * Calcula o IRS devido segundo os escalões progressivos 2026.
 * CIRS Art. 68º
 */
export function calculateIRS(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;
  for (const bracket of IRS_BRACKETS_2026) {
    if (taxableIncome <= bracket.limit) {
      return Math.max(0, taxableIncome * bracket.rate - bracket.ded);
    }
  }
  return 0;
}

/**
 * Calcula a isenção de IRS Jovem para trabalhadores ≤35 anos.
 * CIRS Art. 12º-B (OE 2025/2026)
 *
 * Regras 2026:
 * - Aplica-se nos primeiros 5 anos de atividade profissional (após conclusão de estudos)
 * - Ano 1: isenção de 100% até 5× IAS anual (~€32.529)
 * - Anos 2-3: isenção de 75%
 * - Anos 4-5: isenção de 50%
 * - Teto máximo de isenção: 5× IAS anual = €32.529 (2026)
 *
 * @param anosAtividade anos de atividade profissional (0 = 1º ano)
 * @param rendimentoColetavel rendimento coletável total
 * @param idade idade do contribuinte
 * @returns valor de isenção a deduzir do rendimento coletável
 */
export function calcIRSJovem(
  anosAtividade: number,
  rendimentoColetavel: number,
  idade: number
): number {
  if (idade > 35) return 0;
  if (anosAtividade > 5) return 0;

  const tetoIsencao = IAS_2026 * 12 * 5; // 5× IAS anual ≈ €32.529

  let taxaIsencao = 0;
  if (anosAtividade <= 1) taxaIsencao = 1.0;
  else if (anosAtividade <= 3) taxaIsencao = 0.75;
  else if (anosAtividade <= 5) taxaIsencao = 0.5;

  return Math.min(rendimentoColetavel * taxaIsencao, tetoIsencao * taxaIsencao);
}

/**
 * Calcula a dedução por dependentes (dedução à coleta).
 * CIRS Art. 78º-A
 *
 * @param nrDependentes número de dependentes
 * @returns dedução total à coleta (€)
 */
export function calcDependentsDeduction(nrDependentes: number): number {
  if (nrDependentes <= 0) return 0;
  if (nrDependentes <= 3) return nrDependentes * 600;
  // A partir do 4º dependente: €900/dependente adicional
  return 3 * 600 + (nrDependentes - 3) * 900;
}

/**
 * Calcula o custo total para a empresa ao pagar tickets em vez de salário.
 * Mantido por compatibilidade — usar calcTicketBenefit para novos tipos.
 */
export function calcTicketSavings(
  employees: number,
  ticketValue: number,
  daysPerMonth: number,
  months: number
) {
  const ticketCost = employees * ticketValue * daysPerMonth * months;
  const salaryCost = ticketCost * (1 + SS_RATE_EMPLOYER);
  const savings = salaryCost - ticketCost;
  const custoDedutivelEmpresa = ticketCost * 0.60;

  return { ticketCost, salaryCost, savings, custoDedutivelEmpresa };
}

// ── Tickets e Benefícios Laborais — 2026 ─────────────────────────────────────

/**
 * Limites diários de isenção IRS/SS — subsídio de alimentação e vales 2026
 * Despacho 233-A/2026 (cartão, dinheiro) · DL 133/2024 (vale papel)
 */
export const TICKET_LIMITS_2026 = {
  cartao:          10.46,  // Cartão eletrónico (ex: Ticket Restaurant® card) — Despacho 233-A/2026
  dinheiro:         6.15,  // Dinheiro / transferência / cheque — Despacho 233-A/2026
  vale_geral:       5.00,  // Vale em papel — setor geral — DL 133/2024
  vale_hotelaria:   7.00,  // Vale em papel — hotelaria, restauração, construção — DL 133/2024
} as const;

export type TipoSubsidioRefeicao = keyof typeof TICKET_LIMITS_2026;

export type TipoTicket = 'restaurante' | 'infancia' | 'educacao' | 'saude' | 'oferta' | 'car';

/**
 * Fator de dedutibilidade IRC por tipo de ticket — CIRC Art. 43.º / Art. 23.º-A
 * restaurante : 60%   — limitação para subsídio de refeição (Art. 43.º n.º 2)
 * infancia    : 140%  — majoração 40% para creches/pré-escolar (Art. 43.º n.º 9)
 * educacao    : 100%  — gasto dedutível normal (Art. 43.º n.º 1)
 * saude       : 100%  — realização de utilidade social (Art. 43.º n.º 1)
 * oferta      :  50%  — gasto de representação (Art. 23.º-A n.º 1 h))
 * car         : 100%  — gasto com viaturas dedutível (Art. 23.º n.º 1 h)); Trib. Autónoma pode aplicar-se
 */
export const TICKET_IRC_FACTOR: Record<TipoTicket, number> = {
  restaurante: 0.60,
  infancia:    1.40,
  educacao:    1.00,
  saude:       1.00,
  oferta:      0.50,
  car:         1.00,
};

/** IVA dedutível em combustível/manutenção por tipo de viatura — CIVA Art. 21.º */
export const TICKET_CAR_IVA_RATE: Record<'passageiros' | 'misto' | 'comercial', number> = {
  passageiros: 0.00,  // Excluído — CIVA Art. 21.º n.º 1 a)
  misto:       0.50,  // 50% — CIVA Art. 21.º n.º 2
  comercial:   1.00,  // 100% — viaturas de mercadorias/comerciais
};

/**
 * Calcula a contribuição mensal da Segurança Social para trabalhadores independentes.
 *
 * Regras 2026 (CRCSPSS Art. 162º e seguintes):
 * - Taxa: 21.4% sobre o rendimento relevante
 * - Base de cálculo: 70% para prestações de serviços, 20% para venda de bens
 * - Mínimo de contribuição: €20/mês (para quem tem rendimento relevante > IAS)
 * - Pagamento trimestral (janeiro, abril, julho, outubro)
 * - Isenção no 1º ano de atividade (Art. 164º CRCSPSS)
 *
 * @param income rendimento mensal (€)
 * @param tipo "servicos" | "bens" - tipo de rendimento
 * @param primeiroAno se está no primeiro ano de atividade (isenção)
 * @returns object com mensal, trimestral, anual, baseCalculo
 */
export function calcSelfSSContribution(
  income: number,
  tipo: 'servicos' | 'bens' = 'servicos',
  primeiroAno: boolean = false
) {
  if (primeiroAno) {
    return { mensal: 0, trimestral: 0, anual: 0, baseCalculo: 0, isento: true };
  }

  const taxRate = SS_RATE_SELF_EMPLOYED;
  const baseRate = tipo === 'servicos' ? 0.70 : 0.20;
  const baseCalculo = income * baseRate;
  const mensal = Math.max(20, baseCalculo * taxRate);

  return {
    mensal,
    trimestral: mensal * 3,
    anual: mensal * 12,
    baseCalculo,
    isento: false
  };
}

/**
 * Calcula IRC para empresas (2026).
 * CIRC Art. 87º — taxa reduzida PME 15% / taxa geral 19%
 *
 * @param profit lucro tributável
 * @returns IRC a pagar
 */
export function calculateIRC(profit: number): number {
  if (profit <= 0) return 0;
  if (profit <= 50000) return profit * 0.15;
  return 50000 * 0.15 + (profit - 50000) * 0.19;
}

/**
 * Calcula o rendimento coletável ENI segundo o regime simplificado.
 * CIRS Art. 31º
 */
export function calculateTaxableIncome(
  grossIncome: number,
  isSimplifiedRegime: boolean
): number {
  if (isSimplifiedRegime) return grossIncome * 0.75;
  return grossIncome;
}
