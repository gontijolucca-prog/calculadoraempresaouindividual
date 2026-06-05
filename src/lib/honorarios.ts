/**
 * Configuração de Honorários do Escritório.
 *
 * Lógica:
 *   1. Mensalidade base depende do tipo de entidade do cliente (ENI, Lda, SA…).
 *   2. Acrescenta-se um valor por cada funcionário acima do incluído.
 *   3. Aplica-se majoração por escalão de faturação prevista.
 *   4. Somam-se serviços extra ativados (vales refeição, SAFT, PMP, etc.).
 *
 * A função `calcularProposta` é pura — não toca em DOM nem storage.
 */

import { loadFromStorage, saveToStorage } from './storage';
import type { ClientProfile } from '../ClientProfile';

export type TipoEntidadeCliente = 'eni' | 'lda' | 'unipessoal' | 'sa' | 'socio_unico';

export interface EscalaoFaturacao {
  minFaturacao: number;
  acrescimoMensal: number;
  descricao: string;
}

export interface ServicoExtra {
  id: string;
  nome: string;
  descricao: string;
  precoMensal: number;
  /** Se está ativo por defeito quando se gera proposta nova. */
  ativoPorDefeito: boolean;
}

export interface HonorariosConfig {
  /** Mensalidade base por tipo de entidade (€/mês). */
  baseMensal: Record<TipoEntidadeCliente, number>;

  /** Nº de funcionários incluídos no valor base (a partir daqui acresce). */
  funcionariosIncluidos: number;

  /** Valor mensal por cada funcionário extra (acima dos incluídos). */
  acrescimoPorFuncionario: number;

  /** Escalões de faturação anual (€) com majoração mensal. Ordenados ascendente. */
  escaloesFaturacao: EscalaoFaturacao[];

  /** Catálogo de serviços extra que podem ser adicionados às propostas. */
  servicosExtra: ServicoExtra[];

  /** Taxa IVA aplicada à fatura final (normalmente 23%). */
  taxaIVA: number;

  /** Valor mínimo aceite de mensalidade (nunca cobrar abaixo disto). */
  minimoMensal: number;
}

export const defaultHonorariosConfig: HonorariosConfig = {
  baseMensal: {
    eni:         100,
    unipessoal:  150,
    socio_unico: 150,
    lda:         200,
    sa:          350,
  },
  funcionariosIncluidos: 1,
  acrescimoPorFuncionario: 15,
  escaloesFaturacao: [
    { minFaturacao:      0, acrescimoMensal:   0, descricao: 'Até €50.000/ano' },
    { minFaturacao:  50000, acrescimoMensal:  25, descricao: '€50.000 – €100.000/ano' },
    { minFaturacao: 100000, acrescimoMensal:  60, descricao: '€100.000 – €250.000/ano' },
    { minFaturacao: 250000, acrescimoMensal: 120, descricao: '€250.000 – €500.000/ano' },
    { minFaturacao: 500000, acrescimoMensal: 250, descricao: 'Acima de €500.000/ano' },
  ],
  servicosExtra: [
    { id: 'saft',           nome: 'Comunicação SAF-T',                 descricao: 'Comunicação mensal/anual à AT.', precoMensal: 15, ativoPorDefeito: true  },
    { id: 'rh',             nome: 'Processamento Salarial (até 5 col.)', descricao: 'Recibos, DMR, segurança social.', precoMensal: 40, ativoPorDefeito: false },
    { id: 'iva',            nome: 'Apuramento e Entrega de IVA',        descricao: 'Declarações periódicas de IVA.',  precoMensal: 25, ativoPorDefeito: true  },
    { id: 'modelo22',       nome: 'Modelo 22 + IES anual',              descricao: 'Encerramento de contas anual.',   precoMensal: 30, ativoPorDefeito: true  },
    { id: 'consultoria',    nome: 'Consultoria Fiscal Avançada',        descricao: 'Reuniões trimestrais e planeamento fiscal.', precoMensal: 80, ativoPorDefeito: false },
    { id: 'representacao',  nome: 'Representação Fiscal junto da AT',   descricao: 'Inspeções, justificações, reclamações.',    precoMensal: 50, ativoPorDefeito: false },
  ],
  taxaIVA: 0.23,
  minimoMensal: 75,
};

const STORAGE_KEY = 'honorariosConfig';

export function loadHonorariosConfig(): HonorariosConfig {
  return loadFromStorage<HonorariosConfig>(STORAGE_KEY, defaultHonorariosConfig);
}

export function saveHonorariosConfig(c: HonorariosConfig): void {
  saveToStorage(STORAGE_KEY, c);
}

// ─── Cálculo de proposta ────────────────────────────────────────────────────

export interface PropostaItem {
  descricao: string;
  valorMensal: number;
}

export interface PropostaResultado {
  itens: PropostaItem[];
  mensalSemIVA: number;
  iva: number;
  mensalComIVA: number;
  anualSemIVA: number;
  anualComIVA: number;
  /** Lista de IDs dos serviços extra incluídos. */
  servicosExtraIncluidos: string[];
}

const TIPO_LABELS: Record<TipoEntidadeCliente, string> = {
  eni:         'ENI / Recibos Verdes',
  unipessoal:  'Unipessoal Lda',
  socio_unico: 'Unipessoal Lda (Sócio Único)',
  lda:         'Sociedade por Quotas (Lda)',
  sa:          'Sociedade Anónima (SA)',
};

/**
 * Calcula a proposta baseada no perfil do cliente + configuração de honorários.
 * `servicosExtraIds` (opcional): override do default — se null, usa os `ativoPorDefeito`.
 */
export function calcularProposta(
  profile: ClientProfile,
  config: HonorariosConfig,
  servicosExtraIds?: string[]
): PropostaResultado {
  const itens: PropostaItem[] = [];

  // 1. Base por tipo de entidade
  const tipo = profile.tipoEntidade as TipoEntidadeCliente;
  const base = config.baseMensal[tipo] ?? config.baseMensal.eni;
  itens.push({
    descricao: `Mensalidade base — ${TIPO_LABELS[tipo] ?? tipo} (até ${config.funcionariosIncluidos} func.)`,
    valorMensal: base,
  });

  // 2. Acréscimo por funcionários extra
  const funcExtra = Math.max(0, (profile.nrFuncionarios || 0) - config.funcionariosIncluidos);
  if (funcExtra > 0) {
    itens.push({
      descricao: `${funcExtra} funcionário(s) adicional(ais) × ${eur(config.acrescimoPorFuncionario)}`,
      valorMensal: funcExtra * config.acrescimoPorFuncionario,
    });
  }

  // 3. Escalão de faturação
  const faturacao = profile.faturaçaoAnualPrevista || 0;
  const escalao = [...config.escaloesFaturacao]
    .sort((a, b) => b.minFaturacao - a.minFaturacao)
    .find(e => faturacao >= e.minFaturacao);
  if (escalao && escalao.acrescimoMensal > 0) {
    itens.push({
      descricao: `Majoração por volume — ${escalao.descricao}`,
      valorMensal: escalao.acrescimoMensal,
    });
  }

  // 4. Serviços extra
  const ids = servicosExtraIds ?? config.servicosExtra.filter(s => s.ativoPorDefeito).map(s => s.id);
  const idsSet = new Set(ids);
  for (const s of config.servicosExtra) {
    if (idsSet.has(s.id)) {
      itens.push({ descricao: s.nome, valorMensal: s.precoMensal });
    }
  }

  // 5. Aplicar mínimo
  let mensalSemIVA = itens.reduce((sum, i) => sum + i.valorMensal, 0);
  if (mensalSemIVA < config.minimoMensal) {
    itens.push({
      descricao: `Ajuste ao mínimo contratual (${eur(config.minimoMensal)})`,
      valorMensal: config.minimoMensal - mensalSemIVA,
    });
    mensalSemIVA = config.minimoMensal;
  }

  const iva = mensalSemIVA * config.taxaIVA;
  const mensalComIVA = mensalSemIVA + iva;
  const anualSemIVA = mensalSemIVA * 12;
  const anualComIVA = mensalComIVA * 12;

  return {
    itens,
    mensalSemIVA,
    iva,
    mensalComIVA,
    anualSemIVA,
    anualComIVA,
    servicosExtraIncluidos: ids,
  };
}

const eur = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);
