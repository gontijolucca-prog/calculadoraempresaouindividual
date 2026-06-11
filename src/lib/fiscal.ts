/**
 * Motor de comparação fiscal ENI vs Lda — extraído do TaxSimulator para uma
 * função pura (testável e reutilizável). Não toca em DOM nem em estado React.
 *
 * ENI = regime simplificado (coeficiente art.31 CIRS × faturação, com a regra de
 * justificação dos 15% do n.º13) + SS de independente + IRS marginal sobre o
 * rendimento já existente do sócio.
 * Lda = remuneração do gerente (gross-up do que precisa de levantar) + IRC PME
 * 15%/19% (ou transparência fiscal art.6.º CIRC) + (novo) derrama municipal e a
 * hipótese de distribuição de dividendos (retenção 28%, CIRS art.71.º).
 *
 * ⚠ Valores fiscais a confirmar por um contabilista — ver docs/AUDITORIA-FISCAL-PENDENTE.md.
 */
import {
  calculateIRS, calcIRSJovem, calcDependentsDeduction,
  calcSelfSSContribution, SS_RATE_EMPLOYER, SS_RATE_EMPLOYEE, IAS_2026,
} from './pt2026';

// Dedução específica Cat A 2026 — 8,54 × IAS (art. 25.º CIRS).
export const DED_ESPECIFICA_CAT_A_2026 = Math.round(8.54 * IAS_2026 * 100) / 100; // 4587.09
// Limiar da regra de justificação dos 15% (art.31 n.13). Valor 2025 mantido — a
// Portaria de atualização 2026 ainda não foi publicada. ⚠ confirmar.
export const LIMIAR_JUSTIFICACAO_15PCT = 27360;
// Retenção liberatória sobre dividendos distribuídos — CIRS art.71.º.
const TAXA_DIVIDENDOS = 0.28;

export interface FiscalInput {
  profSit: string;
  currentInc: number;
  isMainAct: boolean;
  monthlyNeed: number;
  isServices: boolean;
  rev: number;
  invEquip: number;
  invLic: number;
  invWorks: number;
  invFundo: number;
  fixedMo: number;
  varYr: number;
  accMoLda: number;
  accMoEni: number;
  anosAtividade: number;
  transparenciaFiscal: boolean;
  /** Coeficiente do art.31 (do perfil); se ausente, 0,75 serviços / 0,15 bens. */
  coefArt31?: number;
  beneficioJovem: boolean;
  idade: number;
  nrDependentes: number;
  /** Taxa de derrama municipal (fração, ex. 0.015 = 1,5%). Default 0. ⚠ por município. */
  taxaDerramaMunicipal?: number;
  /** N.º de sócios/pessoas no projeto (1 = unipessoal). Afeta elegibilidades. */
  nrSocios?: number;
  /** Atividade exclusivamente profissional do art. 151.º CIRS (médicos, advogados,
   *  engenheiros, consultores…). Liga o aviso de transparência fiscal obrigatória. */
  atividadeArt151?: boolean;
}

export interface FiscalResult {
  totalInv: number;
  beEni: number;
  beLda: number;
  irsJovemDeduction: number;
  depsDeduction: number;
  ppc: number;
  retencaoFonte: number;
  transparenciaFiscal: boolean;
  transparenciaIRSOnProfit: number;
  derramaMunicipal: number;
  eni: { ss: number; irs: number; net: number; cashFlow: number; costs: number; rendColetavel: number };
  lda: {
    ssComp: number; ssEmp: number; irc: number; irs: number;
    net: number; cashFlow: number; profit: number; costs: number;
    /** Líquido se o lucro for distribuído como dividendos (−28%). */
    netDistribuido: number;
    /** Imposto sobre os dividendos distribuídos. */
    impostoDividendos: number;
  };
}

export interface EnquadramentoInfo {
  id: string;
  nome: string;
  /** 'simulado' aparece nos cartões com números; 'info' é orientação qualitativa. */
  tipo: 'simulado' | 'info';
  quando: string;
  nota?: string;
}

export interface EnquadramentosResult extends FiscalResult {
  /** ENI em CONTABILIDADE ORGANIZADA: lucro real em vez de coeficiente. */
  eniOrganizada: { ss: number; irs: number; net: number; rendColetavel: number; custosConsiderados: number };
  /** Simplificado indisponível acima de 200 k€ (art. 86.º-A — aplica a ENI; ⚠ confirmar). */
  eniSimplificadoDisponivel: boolean;
  /** Avisos de enquadramento gerados pelos inputs (transparência obrigatória, IVA, SA…). */
  avisos: string[];
  /** Outros enquadramentos a considerar (qualitativos, sem números inventados). */
  outros: EnquadramentoInfo[];
}

/**
 * Comparação alargada de enquadramentos: ENI simplificado + ENI organizada +
 * Sociedade (Lda/Unipessoal/SA — fiscalmente idênticas no essencial) com
 * avisos de elegibilidade e os enquadramentos especiais em modo informativo.
 * ⚠ Regras qualitativas a validar pela contabilista (ver AUDITORIA-FISCAL-PENDENTE.md).
 */
export function compararEnquadramentos(i: FiscalInput): EnquadramentosResult {
  const base = compararEniLda(i);
  const nrSocios = Math.max(1, i.nrSocios ?? 1);

  // ── ENI em contabilidade organizada: lucro real (rev − custos documentados −
  // depreciação aceite, mesma convenção do cálculo da sociedade) ──
  const fixedYr = i.fixedMo * 12;
  const accYrEni = i.accMoEni * 12;
  const custosConsiderados = fixedYr + i.varYr + accYrEni + (i.invEquip + i.invLic + i.invWorks) * 0.25;
  let orgRC = Math.max(0, i.rev - custosConsiderados);
  if (i.beneficioJovem && i.idade <= 35) {
    orgRC = Math.max(0, orgRC - calcIRSJovem(i.anosAtividade, orgRC, i.idade));
  }
  const orgIRS = Math.max(0,
    calculateIRS(i.currentInc + orgRC) - calculateIRS(i.currentInc) - calcDependentsDeduction(i.nrDependentes));
  // SS de independente igual ao simplificado (a base de incidência tem nuances — ⚠ confirmar).
  const orgSS = base.eni.ss;
  const orgNet = i.rev - (fixedYr + i.varYr + accYrEni) - orgSS - orgIRS;
  const eniOrganizada = { ss: orgSS, irs: orgIRS, net: orgNet, rendColetavel: orgRC, custosConsiderados };

  // ── Avisos de enquadramento ──
  const avisos: string[] = [];
  const eniSimplificadoDisponivel = i.rev <= 200_000;
  if (!eniSimplificadoDisponivel) {
    avisos.push('Faturação acima de 200 000 € — o regime simplificado deixa de estar disponível: como ENI terias de passar a contabilidade organizada (compara com a coluna ENI organizada).');
  }
  if (i.atividadeArt151 && nrSocios >= 2) {
    avisos.push('Sociedade de profissionais (atividade do art. 151.º): pode cair OBRIGATORIAMENTE no regime de transparência fiscal (art. 6.º CIRC) — o lucro é tributado em IRS na esfera dos sócios. Liga a opção "Transparência fiscal" para veres esse cenário e confirma com a contabilista.');
  }
  if (i.rev > 0 && i.rev <= 15_000) {
    avisos.push('Faturação até 15 000 € — possível isenção de IVA (art. 53.º CIVA), em qualquer dos enquadramentos.');
  }

  // ── Outros enquadramentos (informativos — sem números inventados) ──
  const outros: EnquadramentoInfo[] = [
    {
      id: 'sa', nome: 'Sociedade Anónima (SA)', tipo: 'info',
      quando: 'Projetos com vários investidores, entrada de capital externa ou necessidade de transmitir ações livremente. Fiscalmente o IRC é o mesmo da Lda — a diferença está nos requisitos (capital mínimo 50 000 €, órgãos sociais e custos de contexto maiores).',
      nota: nrSocios >= 5 ? 'Com 5+ pessoas no projeto, a SA é uma alternativa real à Lda.' : 'Em regra exige 5 acionistas (ou 1, se for uma sociedade) — com menos pessoas, a Lda costuma servir melhor.',
    },
    {
      id: 'cooperativa', nome: 'Cooperativa', tipo: 'info',
      quando: 'Projetos coletivos (mín. 3 cooperadores) onde os membros são simultaneamente donos e utilizadores — produção, serviços, habitação, agrícolas. Tem regime fiscal próprio (Código Cooperativo) com benefícios nas operações com os membros.',
      nota: 'Regras fiscais específicas — avaliar caso a caso com a contabilista.',
    },
    {
      id: 'associacao', nome: 'Associação / IPSS', tipo: 'info',
      quando: 'Fins não lucrativos (culturais, sociais, desportivos). Só os rendimentos comerciais são tributados em IRC; quotas e donativos têm tratamento próprio. Não serve para distribuir lucros aos fundadores.',
    },
    {
      id: 'ace', nome: 'ACE / AEIE', tipo: 'info',
      quando: 'Agrupamento de empresas JÁ existentes para um fim comum (consórcio estável, partilha de custos). Não é um veículo para começar uma atividade nova.',
    },
    {
      id: 'heranca', nome: 'Herança indivisa', tipo: 'info',
      quando: 'Continuação da atividade de um empresário falecido pelos herdeiros, enquanto a partilha não é feita. Tributação em IRS na esfera de cada herdeiro (Cat. B).',
    },
    {
      id: 'eirl', nome: 'EIRL', tipo: 'info',
      quando: 'Já NÃO é possível constituir (extinto para novas constituições). Quem procura responsabilidade limitada a título individual usa a Sociedade Unipessoal por Quotas.',
      nota: '⚠ Data/diploma da extinção a confirmar pela contabilista.',
    },
  ];

  return { ...base, eniOrganizada, eniSimplificadoDisponivel, avisos, outros };
}

export function compararEniLda(i: FiscalInput): FiscalResult {
  const totalInv = i.invEquip + i.invLic + i.invWorks + i.invFundo;
  const invCapex = i.invEquip + i.invLic + i.invWorks;
  const fixedYr = i.fixedMo * 12;
  const accYrLda = i.accMoLda * 12;
  const accYrEni = i.accMoEni * 12;
  const dpNaoAceite = invCapex * 0.25;
  const costsLdaOutPocket = fixedYr + i.varYr + accYrLda;
  const costsEniOutPocket = fixedYr + i.varYr + accYrEni;

  // ── ENI ──
  let eniSS = 0;
  if (i.profSit === 'tco' && !i.isMainAct && i.rev <= 20000) {
    eniSS = 0; // ENI complementar isento (art. 168.º-A CRCSPSS)
  } else {
    eniSS = calcSelfSSContribution(i.rev / 12, i.isServices ? 'servicos' : 'bens', false).anual;
  }

  const coefArt31 = i.coefArt31 ?? (i.isServices ? 0.75 : 0.15);
  let eniRendColetavel = i.rev * coefArt31;
  const aplicaJustificacao = coefArt31 === 0.75 || coefArt31 === 0.35;
  if (aplicaJustificacao && i.rev > LIMIAR_JUSTIFICACAO_15PCT) {
    const requiredJustDocs = i.rev * 0.15;
    const justDocsPresented = costsEniOutPocket + DED_ESPECIFICA_CAT_A_2026;
    if (justDocsPresented < requiredJustDocs) {
      eniRendColetavel += (requiredJustDocs - justDocsPresented);
    }
  }

  let irsJovemDeduction = 0;
  if (i.beneficioJovem && i.idade <= 35) {
    irsJovemDeduction = calcIRSJovem(i.anosAtividade, eniRendColetavel, i.idade);
    eniRendColetavel = Math.max(0, eniRendColetavel - irsJovemDeduction);
  }

  const eniIRS_Total = calculateIRS(i.currentInc + eniRendColetavel);
  const eniIRS_Current = calculateIRS(i.currentInc);
  const depsDeduction = calcDependentsDeduction(i.nrDependentes);
  const eniIRS = Math.max(0, eniIRS_Total - eniIRS_Current - depsDeduction);

  const ppc = eniIRS * 0.25;
  const retencaoFonte = i.isServices ? i.rev * 0.115 : 0;
  const eniNet = i.rev - costsEniOutPocket - eniSS - eniIRS;
  const eniCashFlow = eniNet - totalInv;

  // ── Lda ──
  const rawGross = i.monthlyNeed / 0.70;
  const grossSalaryYr = rawGross * 14;
  const ldaSSCompany = grossSalaryYr * SS_RATE_EMPLOYER; // 23,75%
  const ldaSSManager = grossSalaryYr * SS_RATE_EMPLOYEE; // 11%
  const ldaIRSManager = calculateIRS(grossSalaryYr);
  const profit = i.rev - costsLdaOutPocket - dpNaoAceite - grossSalaryYr - ldaSSCompany;

  let irc = 0;
  let transparenciaIRSOnProfit = 0;
  let derramaMunicipal = 0;
  if (i.transparenciaFiscal) {
    if (profit > 0) {
      transparenciaIRSOnProfit = Math.max(0, calculateIRS(grossSalaryYr + profit) - calculateIRS(grossSalaryYr));
    }
  } else if (profit > 0) {
    irc = profit <= 50000 ? profit * 0.15 : (50000 * 0.15) + ((profit - 50000) * 0.19);
    derramaMunicipal = profit * (i.taxaDerramaMunicipal ?? 0); // ⚠ taxa por município
  }

  const companyNetEarnings = profit - irc - derramaMunicipal - transparenciaIRSOnProfit;
  const ldaBusinessNet = companyNetEarnings + (i.monthlyNeed * 12);
  const ldaCashFlow = (companyNetEarnings + dpNaoAceite) - totalInv;

  // Hipótese: lucro retido vs distribuído como dividendos (retenção 28%).
  const impostoDividendos = Math.max(0, companyNetEarnings) * TAXA_DIVIDENDOS;
  const ldaNetDistribuido = (Math.max(0, companyNetEarnings) - impostoDividendos) + (i.monthlyNeed * 12);

  const varMargin = i.rev > 0 ? (i.rev - i.varYr) / i.rev : 0.01;
  const beEni = varMargin > 0 ? (fixedYr + accYrEni) / varMargin : 0;
  const beLda = varMargin > 0 ? (fixedYr + accYrLda + grossSalaryYr + ldaSSCompany) / varMargin : 0;

  return {
    totalInv, beEni, beLda, irsJovemDeduction, depsDeduction, ppc, retencaoFonte,
    transparenciaFiscal: i.transparenciaFiscal, transparenciaIRSOnProfit, derramaMunicipal,
    eni: { ss: eniSS, irs: eniIRS, net: eniNet, cashFlow: eniCashFlow, costs: costsEniOutPocket, rendColetavel: eniRendColetavel },
    lda: {
      ssComp: ldaSSCompany, ssEmp: ldaSSManager, irc, irs: ldaIRSManager,
      net: ldaBusinessNet, cashFlow: ldaCashFlow, profit: companyNetEarnings, costs: costsLdaOutPocket,
      netDistribuido: ldaNetDistribuido, impostoDividendos,
    },
  };
}
