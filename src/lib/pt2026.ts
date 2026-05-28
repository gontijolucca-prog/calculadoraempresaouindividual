/**
 * Cálculos Fiscais e Contributivos - Portugal 2026 (Abril)
 * Fonte: Portal das Finanças, Segurança Social, CIVA 2026
 */

// IAS 2026 (Indexante dos Apoios Sociais) — Portaria 480-A/2025
export const IAS_2026 = 537.13;

// Salário Mínimo Nacional 2026 — DL 139/2025
export const SMN_2026 = 920;

// Taxa de contribuição Patronal para Segurança Social (Empresa)
export const SS_RATE_EMPLOYER = 0.2375; // 23.75% para empresas com fins lucrativos (Lda)

// Taxa de contribuição Patronal para entidades sem fins lucrativos (IPSS, Misericórdias, etc.)
export const SS_RATE_EMPLOYER_NONPROFIT = 0.223; // 22.3%

// Taxa de contribuição do Trabalhador por Conta de Outrem (TCO) — CRCSPSS Art. 53º
export const SS_RATE_EMPLOYEE = 0.11; // 11%

// Taxa default de seguro de acidentes de trabalho (obrigatório — Lei 98/2009)
// Varia por atividade e risco; ~1% é um valor médio de referência
export const WORK_INSURANCE_DEFAULT_RATE = 0.01; // 1%

// Taxa de contribuição do Trabalhador por conta própria (ENI)
export const SS_RATE_SELF_EMPLOYED = 0.214; // 21.4% - taxa oficial 2026

// Escalões IRS 2026 — Lei n.º 73-A/2025 (OE 2026), Art. 68º CIRS.
// Cross-validado contra Economia e Finanças, Cofidis e Jornal de Negócios
// (publicações pós-aprovação OE 2026). Limites = limites_2025 × 1,0351 (factor
// automático de atualização). Taxas marginais reduzidas em 0,5 p.p. no 1º
// escalão e 0,3-0,4 p.p. nos 2º-8º. Parcelas a abater calculadas por
// `parcela_n = limite_n-1 × (taxa_n − taxa_n-1) + parcela_n-1`,
// validadas por re-cálculo escalão-a-escalão (erro < €0,10).
export const IRS_BRACKETS_2026 = [
  { limit:  8342,    rate: 0.125, ded:     0    },
  { limit: 12587,    rate: 0.157, ded:   266.94 },
  { limit: 17838,    rate: 0.212, ded:   959.22 },
  { limit: 23089,    rate: 0.241, ded:  1476.53 },
  { limit: 29397,    rate: 0.311, ded:  3092.76 },
  { limit: 43090,    rate: 0.349, ded:  4209.84 },
  { limit: 46566,    rate: 0.431, ded:  7743.30 },
  { limit: 86634,    rate: 0.446, ded:  8441.80 },
  { limit: Infinity, rate: 0.48,  ded: 11387.36 },
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
 * CIRS Art. 12º-B (regime alargado pela Lei 45-A/2024, mantido no OE 2026).
 *
 * Regras OE 2026:
 * - Aplica-se nos primeiros 10 anos de atividade profissional, até aos 35 anos.
 * - Ano 1:        100%
 * - Anos 2 a 4:    75%
 * - Anos 5 a 7:    50%
 * - Anos 8 a 10:   25%
 * - Teto de rendimentos abrangidos: 55 × IAS mensal = €29.542,15 (IAS 2026 €537,13).
 *   (€29.377,15 era o teto 2025; em 2026 sobe pela atualização do IAS.)
 *
 * @param anosAtividade anos completos de atividade (0 = 1º ano, 9 = 10º ano)
 * @param rendimentoColetavel rendimento coletável da categoria A/B
 * @param idade idade do contribuinte
 * @returns valor de isenção a deduzir do rendimento coletável
 */
export function calcIRSJovem(
  anosAtividade: number,
  rendimentoColetavel: number,
  idade: number
): number {
  if (idade > 35 || anosAtividade < 0 || anosAtividade > 9) return 0;

  const tetoIsencao = IAS_2026 * 55; // ≈ €29.542,15

  let taxaIsencao = 0;
  if (anosAtividade < 1)      taxaIsencao = 1.00; // 1º ano
  else if (anosAtividade < 4) taxaIsencao = 0.75; // anos 2-4
  else if (anosAtividade < 7) taxaIsencao = 0.50; // anos 5-7
  else                        taxaIsencao = 0.25; // anos 8-10

  return Math.min(rendimentoColetavel, tetoIsencao) * taxaIsencao;
}

/**
 * Calcula a dedução à coleta por dependentes (CIRS Art. 78º-A, OE 2026).
 *
 * Regras OE 2026 (Lei 73-A/2025):
 *  - Dependente com mais de 6 anos: €600
 *  - 1.º dependente com idade ≤ 3 anos: €726
 *  - A partir do 2.º dependente com idade ≤ 6 anos: €900
 *    (regra alargada de ≤3 para ≤6 anos — independente da idade do 1.º)
 *
 * Aceita três formatos:
 *  - `number`: legacy — assume todos com mais de 6 anos.
 *  - `{ total, ate3Anos?, ate6Anos? }`: distingue por faixa etária.
 *
 * `ate6Anos` representa filhos com idade entre 4 e 6 anos (exclui ≤3, que já estão em `ate3Anos`).
 *
 * @returns dedução total à coleta (€)
 */
export function calcDependentsDeduction(
  arg: number | { total: number; ate3Anos?: number; ate6Anos?: number }
): number {
  const total = typeof arg === 'number' ? arg : arg.total;
  const ate3 = typeof arg === 'number' ? 0 : (arg.ate3Anos ?? 0);
  const entre4e6 = typeof arg === 'number' ? 0 : (arg.ate6Anos ?? 0);

  if (total <= 0) return 0;
  if (ate3 < 0 || ate3 > total) return 0;
  if (entre4e6 < 0 || (ate3 + entre4e6) > total) return 0;

  const mais6 = total - ate3 - entre4e6;
  let deducao = mais6 * 600;

  // 1.º filho ≤ 3 anos: €726
  // 2.º+ filho ≤ 6 anos (independente da idade do 1.º): €900
  let usadosNoBonus900 = 0;
  if (ate3 >= 1) {
    deducao += 726;
    if (ate3 >= 2) {
      // restantes filhos ≤3a recebem €900
      deducao += (ate3 - 1) * 900;
      usadosNoBonus900 = ate3 - 1;
    }
    // todos os 4-6 anos beneficiam de €900 (são 2.º+ por definição se há 1.º ≤3)
    deducao += entre4e6 * 900;
    usadosNoBonus900 += entre4e6;
  } else if (entre4e6 >= 1) {
    // Sem filhos ≤3 mas há 4-6 anos: o 1.º "≤6 anos" tem direito a €726
    // (interpretação conservadora: a Lei 73-A/2025 estendeu a faixa €726 apenas
    // ao ≤3a; aqui mantemos €600 para o 1.º e €900 a partir do 2.º ≤6a)
    deducao += entre4e6 * 600;
    if (entre4e6 >= 2) {
      // Bonus: 2.º+ filho ≤6a passa a €900
      deducao += (entre4e6 - 1) * (900 - 600);
      usadosNoBonus900 = entre4e6 - 1;
    }
  }

  void usadosNoBonus900;
  return deducao;
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
 * Despacho 233-A/2026 (cartão eletrónico, dinheiro)
 */
export const TICKET_LIMITS_2026 = {
  cartao:          10.46,  // Cartão eletrónico (ex: Ticket Restaurant® card) — Despacho 233-A/2026
  dinheiro:         6.15,  // Dinheiro / transferência / cheque — Despacho 233-A/2026
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
 * Coeficientes do art.º 31.º CIRS (regime simplificado) — em vigor 2026.
 *
 * 0,15 — vendas de mercadorias e produtos; restauração e similares; hotelaria;
 *        operações com criptoativos (exceto mining).
 * 0,35 — prestações de serviços não compreendidas nas categorias específicas.
 * 0,75 — atividades profissionais listadas na tabela anexa ao art.º 151.º
 *        (médicos, advogados, engenheiros, designers, consultores, etc.).
 * 0,95 — mining de criptoativos e outros rendimentos específicos.
 */
export type TipoAtividadeCAE =
  | 'vendas_restauracao'   // 0,15
  | 'servicos_outros'      // 0,35
  | 'servicos_listados'    // 0,75
  | 'mining_cripto'        // 0,95
  ;

export const COEFICIENTES_ART31_2026: Record<TipoAtividadeCAE, number> = {
  vendas_restauracao: 0.15,
  servicos_outros:    0.35,
  servicos_listados:  0.75,
  mining_cripto:      0.95,
};

export const COEFICIENTES_ART31_LABELS: Record<TipoAtividadeCAE, string> = {
  vendas_restauracao: 'Vendas, restauração ou hotelaria (15%)',
  servicos_outros:    'Outros serviços (35%)',
  servicos_listados:  'Profissionais do art.º 151.º — médicos, advogados, etc. (75%)',
  mining_cripto:      'Mining de criptoativos (95%)',
};

export function coefAtividade(tipo: TipoAtividadeCAE): number {
  return COEFICIENTES_ART31_2026[tipo] ?? 0.75;
}

/**
 * Mapeia o valor armazenado em `profile.atividadePrincipal` (que aceita os
 * códigos legacy 'servicos'/'bens' E os novos códigos do art.º 31.º) para o
 * coeficiente correto. Usado por simuladores que ainda dependem do binário.
 */
export function coefFromProfile(
  atividade: 'servicos' | 'bens' | TipoAtividadeCAE | string
): number {
  switch (atividade) {
    case 'vendas_restauracao': return 0.15;
    case 'servicos_outros':    return 0.35;
    case 'servicos_listados':  return 0.75;
    case 'mining_cripto':      return 0.95;
    // legacy fallbacks
    case 'bens':               return 0.15;
    case 'servicos':           return 0.75;
    default:                   return 0.75;
  }
}

/**
 * Calcula o rendimento coletável ENI segundo o regime simplificado.
 * CIRS Art. 31º.
 *
 * Aceita `coef` explícito (preferido) ou cai para `0,75` por retro-compatibilidade.
 */
export function calculateTaxableIncome(
  grossIncome: number,
  isSimplifiedRegime: boolean,
  coef: number = 0.75
): number {
  if (isSimplifiedRegime) return grossIncome * coef;
  return grossIncome;
}
