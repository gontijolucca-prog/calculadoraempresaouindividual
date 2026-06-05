// ─────────────────────────────────────────────────────────────────────────
// Motor de cálculo de IRS 2026 (Modelo 3) — Lei 73-A/2025 (OE 2026).
// CIRS: escalões art.º 68.º, dedução específica art.º 25.º,
// IRS Jovem art.º 12.º-B, mínimo de existência art.º 70.º, deduções à coleta
// arts. 78.º a 84.º. Funções puras — sem estado, sem DOM.
// IAS 2026 = €537,13 (Portaria 480-A/2025); SMN 2026 = €920 (DL 139/2025).
// ─────────────────────────────────────────────────────────────────────────

const IAS_2026 = 537.13;
const SMN_2026 = 920;

export interface Escalao {
  ate: number;
  taxa: number;
  parcela: number;
}

// Escalões oficiais OE 2026 — Lei 73-A/2025, Art. 68º CIRS.
// Limites = limites_2025 × 1,0351 (atualização automática). Taxas 2º-5º reduzidas em 0,3 p.p.
export const ESCALOES_OFICIAL_2026: Escalao[] = [
  { ate:  8342,    taxa: 0.125, parcela:     0    },
  { ate: 12587,    taxa: 0.157, parcela:   266.94 },
  { ate: 17838,    taxa: 0.212, parcela:   959.22 },
  { ate: 23089,    taxa: 0.241, parcela:  1476.53 },
  { ate: 29397,    taxa: 0.311, parcela:  3092.76 },
  { ate: 43090,    taxa: 0.349, parcela:  4209.84 },
  { ate: 46566,    taxa: 0.431, parcela:  7743.30 },
  { ate: 86634,    taxa: 0.446, parcela:  8441.80 },
  { ate: Infinity, taxa: 0.48,  parcela: 11387.36 },
];

// Aliases retro-compatíveis para code legacy ainda a referenciar o nome antigo.
// Apontam para os escalões 2026 — não há mais um modo "demo" / "2025".
export const ESCALOES_OFICIAL_2025 = ESCALOES_OFICIAL_2026;
export const ESCALOES_DEMO = ESCALOES_OFICIAL_2026;

// Redução regional sobre as taxas do Continente, em vigor em 2026:
//   Madeira — diferencial máximo de 30% (DL Regional 8/2025/M, alargado a todos os 9 escalões).
//   Açores — redução de 20% (Despacho 1179/2026; mesma proporção em capitais 22,4% vs 28%).
// O multiplicador é (1 − redução): mais baixo = mais favorável ao residente.
const REGIOES: Record<string, number> = { continente: 1.0, acores: 0.80, madeira: 0.70 };

// Mínimo de existência 2026 — 14 × SMN (art. 70.º CIRS, OE 2026).
export const MINIMO_EXISTENCIA = 14 * SMN_2026; // 12.880,00 €
// Dedução específica Cat A — 8,54 × IAS_2026 (art. 25.º CIRS).
export const DED_ESPECIFICA_CAT_A = Math.round(8.54 * IAS_2026 * 100) / 100; // 4 587,09 €
// Limite de isenção IRS Jovem — 55 × IAS_2026 (art. 12.º-B CIRS).
const LIMITE_ISENCAO_IRS_JOVEM = 55 * IAS_2026; // 29 542,15 €

// Fração da coleta devolvida pelo município (0 a 5%) — Art.º 26.º Lei das
// Finanças Locais. Cada câmara decide anualmente; valores abaixo são os
// publicados no Portal das Finanças para o IRS de 2025 (a entregar em 2026).
//
// ⚠ Os municípios não listados ou com valor desatualizado devem ser
// confirmados em https://www.portaldasfinancas.gov.pt/pt/consultarTaxasIRSMunicipiosForm.action.
// O utilizador pode sobrepor o valor no formulário do simulador.
export const MUNICIPIOS_BM: Record<string, number> = {
  lisboa: 0.05,           // taxa 0% → devolve 5%
  porto: 0.025,           // taxa 2,5% → devolve 2,5%
  braga: 0.005,
  'vila nova de gaia': 0.025,
  matosinhos: 0.025,
  coimbra: 0.025,
  aveiro: 0.025,
  faro: 0.025,
  funchal: 0.025,
  'ponta delgada': 0.025,
  guimarães: 0.025,
  viseu: 0.025,
  leiria: 0.025,
  setúbal: 0.025,
  almada: 0.025,
  sintra: 0.025,
  cascais: 0.005,         // 2026: taxa 4,5% → devolve 0,5% (atualizado)
  oeiras: 0.003,          // 2026: taxa 4,7% → devolve 0,3% (atualizado)
  loulé: 0.05,
  alcobaça: 0.05,
  covilhã: 0.025,
  evora: 0.025,
  'viana do castelo': 0.025,
  santarém: 0.025,
  outro: 0,               // default: 0% — exige confirmação localizada
};

export type Cenario = 'individual' | 'conjunto';
export type Regiao = 'continente' | 'acores' | 'madeira';
export type Tabela = 'demo' | 'oficial2025' | 'oficial2026';

export interface SujeitoPassivo {
  relacao: string;
  nome: string;
  rendTrabalho: number;
  contribuicoes: number;
  retencao: number;
  atividade: number;
  coefAtividade: number;
  irsJovemAno: number;
  pagamentosConta?: number;
}

export interface Despesas {
  saude: number;
  educacao: number;
  habitacao: number;
  lares: number;
  gerais: number;
  pensoes: number;
}

export interface IRSSim {
  agregado: SujeitoPassivo[];
  cenario: Cenario;
  dependentes: number;
  dep0a3: number;
  regiao: Regiao;
  concelho: string;
  despesas: Despesas;
  pagamentosConta: number;
  beneficioMunicipal: number;
  perdas: number;
}

export interface ModeloLinha {
  c: string;
  l: string;
  v: number | string;
  bold?: boolean;
  total?: boolean;
  fmt?: 'pct' | 'num' | 'txt';
}

export interface DeducoesColeta {
  saude: number;
  educacao: number;
  habitacao: number;
  lares: number;
  gerais: number;
  dependentes: number;
  pensoes: number;
  total: number;
}

export interface IRSResultado {
  linhas: ModeloLinha[];
  apurado: number;
  consignacao: number;
  taxaEfetiva: number;
  escalao: number;
  taxaNominal: number;
  coletaTotal: number;
  coletaLiquida: number;
  rendGlobal: number;
  rendColetavel: number;
  retencoes: number;
  deducoes: DeducoesColeta;
  quociente: number;
}

function quocienteFamiliar(cenario: Cenario): number {
  return cenario === 'conjunto' ? 2 : 1;
}

function isencaoIRSJovem(ano: number): number {
  if (!ano) return 0;
  if (ano === 1) return 1.0;
  if (ano <= 4) return 0.75;
  if (ano <= 7) return 0.5;
  if (ano <= 10) return 0.25;
  return 0;
}

function deducaoEspecificaCatA(_rendBruto: number, contribObrig: number): number {
  return Math.max(DED_ESPECIFICA_CAT_A, contribObrig || 0);
}

function deducoesColeta(d: {
  saude?: number;
  educacao?: number;
  habitacao?: number;
  lares?: number;
  gerais?: number;
  dependentes?: number;
  dep0a3?: number;
  pensoes?: number;
  cenario?: Cenario;
  monoparental?: boolean;
}): DeducoesColeta {
  // Tetos OE 2026 (Lei 73-A/2025):
  //   Saúde: 15%, teto €1.000
  //   Educação: 30%, teto €800 (até €1.000 quando há rendas de estudante deslocado)
  //   Habitação (rendas HPP): 15%, teto subiu para €900 em 2026 (era €700)
  //   Lares: 25%, teto €403,75
  //   Pensões de alimentos: 20%, teto €419,22
  //   Gerais e familiares: 35%, teto €250/SP (€500 em tributação conjunta);
  //     em famílias monoparentais sobe a 45% com teto €335
  const dSaude = Math.min((d.saude || 0) * 0.15, 1000);
  const dEducacao = Math.min((d.educacao || 0) * 0.3, 800);
  const dHabitacao = Math.min((d.habitacao || 0) * 0.15, 900); // OE 2026: €900 (era €700)
  const dLares = Math.min((d.lares || 0) * 0.25, 403.75);
  const taxaGerais = d.monoparental ? 0.45 : 0.35;
  const tetoGerais = d.monoparental ? 335 : (d.cenario === 'conjunto' ? 500 : 250);
  const dGerais = Math.min((d.gerais || 0) * taxaGerais, tetoGerais);
  // Dedução por dependente — Art. 78.º-A CIRS, OE 2026:
  //  €600 por dependente > 3 anos
  //  €726 1.º dependente ≤ 3 anos
  //  €900 a partir do 2.º dependente com idade ≤ 6 anos (independente da idade do 1.º)
  //
  // Limitação prática deste motor: `dep0a3` distingue só ≤3a; a regra "2.º+ ≤6a"
  // (OE 2026, alargou de ≤3 para ≤6) não pode ser totalmente aplicada sem campo
  // adicional para 4-6 anos. Aplicamos a regra exata para os filhos ≤3a (que é
  // o caso mais comum) e mantemos €600 para >3a.
  let dDependentes = 0;
  const totalDeps = d.dependentes || 0;
  const ate3 = Math.min(d.dep0a3 || 0, totalDeps);
  if (totalDeps > 0) {
    const mais3 = totalDeps - ate3;
    dDependentes = mais3 * 600;
    if (ate3 >= 1) dDependentes += 726;            // 1.º filho ≤ 3 anos
    if (ate3 >= 2) dDependentes += (ate3 - 1) * 900; // 2.º+ filhos ≤ 3 anos (e <6 por extensão)
  }
  const dPensoes = Math.min((d.pensoes || 0) * 0.2, 419.22);
  const total = dSaude + dEducacao + dHabitacao + dLares + dGerais + dDependentes + dPensoes;
  return {
    saude: dSaude,
    educacao: dEducacao,
    habitacao: dHabitacao,
    lares: dLares,
    gerais: dGerais,
    dependentes: dDependentes,
    pensoes: dPensoes,
    total,
  };
}

function aplicaEscaloes(coletavel: number, escaloes: Escalao[], regiao: Regiao = 'continente') {
  if (coletavel <= 0) return { taxaNominal: 0, parcela: 0, escalao: 0, imposto: 0 };

  let escIdx = 0;
  for (let i = 0; i < escaloes.length; i++) {
    if (coletavel <= escaloes[i].ate) {
      escIdx = i;
      break;
    }
    escIdx = i;
  }

  const e = escaloes[escIdx];
  let imposto = coletavel * e.taxa - e.parcela;
  if (regiao !== 'continente') imposto *= REGIOES[regiao] || 1;

  return {
    taxaNominal: e.taxa,
    parcela: e.parcela,
    escalao: escIdx + 1,
    imposto: Math.max(0, imposto),
  };
}

function taxaAdicional(coletavel: number): number {
  if (coletavel <= 80000) return 0;
  if (coletavel <= 250000) return (coletavel - 80000) * 0.025;
  return (250000 - 80000) * 0.025 + (coletavel - 250000) * 0.05;
}

export function simular(sim: IRSSim, opts: { tabela?: Tabela } = {}): IRSResultado {
  // Todos os "modos" apontam para os escalões oficiais 2026 (Lei 73-A/2025).
  // Mantemos o argumento para retro-compatibilidade.
  const tabela = opts.tabela || 'oficial2026';
  const escaloes = tabela === 'demo' ? ESCALOES_DEMO : ESCALOES_OFICIAL_2026;

  const ag = sim.agregado || [];
  let rendGlobalBruto = 0;
  let dedEspecifica = 0;
  let retencoes = 0;
  let pagamentosConta = 0;
  let totalIsencaoJovem = 0;

  for (const p of ag) {
    const trab = +p.rendTrabalho || 0;
    const atv = +p.atividade || 0;
    const contrib = +p.contribuicoes || 0;
    const retencao = +p.retencao || 0;
    const ppc = +(p.pagamentosConta || 0);

    const fracao = isencaoIRSJovem(+p.irsJovemAno || 0);
    const isento = Math.min(trab * fracao, LIMITE_ISENCAO_IRS_JOVEM * fracao);
    totalIsencaoJovem += isento;

    const coefB = +p.coefAtividade || 0.75;
    const atvColetavel = atv * coefB;

    rendGlobalBruto += trab - isento + atvColetavel;

    if (trab > 0) {
      dedEspecifica += deducaoEspecificaCatA(trab, contrib);
    }

    retencoes += retencao;
    pagamentosConta += ppc;
  }

  const perdas = +sim.perdas || 0;
  const coletavel = Math.max(0, rendGlobalBruto - dedEspecifica - perdas);

  const qf = quocienteFamiliar(sim.cenario);
  const baseLinha09 = coletavel + totalIsencaoJovem;
  const baseTaxa = baseLinha09 / qf;

  const escResult = aplicaEscaloes(baseTaxa, escaloes, sim.regiao || 'continente');

  const importanciaApurada = escResult.imposto * qf;
  const adicional = taxaAdicional(coletavel);

  const coletaBrutaPreJovem = importanciaApurada + adicional;

  let impostoIsento = 0;
  if (totalIsencaoJovem > 0 && baseLinha09 > 0) {
    impostoIsento = coletaBrutaPreJovem * (totalIsencaoJovem / baseLinha09);
  }

  const coletaTotal = Math.max(0, coletaBrutaPreJovem - impostoIsento);

  const ded = deducoesColeta({
    saude: +sim.despesas?.saude || 0,
    educacao: +sim.despesas?.educacao || 0,
    habitacao: +sim.despesas?.habitacao || 0,
    lares: +sim.despesas?.lares || 0,
    gerais: +sim.despesas?.gerais || 0,
    dependentes: +sim.dependentes || 0,
    dep0a3: +sim.dep0a3 || 0,
    pensoes: +sim.despesas?.pensoes || 0,
    cenario: sim.cenario,
    monoparental: (sim as { monoparental?: boolean }).monoparental,
  });

  const concelho = (sim.concelho || '').toLowerCase();
  let fracaoBM = +sim.beneficioMunicipal || 0;
  if (MUNICIPIOS_BM[concelho]) {
    fracaoBM = MUNICIPIOS_BM[concelho];
  }
  const baseBM = Math.max(0, coletaTotal - ded.total);
  const beneficioMunicipal = baseBM * Math.min(fracaoBM, 0.05);

  let impostoFinal = Math.max(0, coletaTotal - ded.total - beneficioMunicipal);

  // Mínimo de Existência — Art.º 70.º CIRS: o IRS líquido devido pelo SP nunca
  // pode reduzir o rendimento líquido abaixo do mínimo de existência (14 × SMN).
  // Aplicado apenas a agregados com rendimento de trabalho dependente; ENI puro
  // (cat. B) tem regra própria que este motor ainda não modela.
  if (rendGlobalBruto > 0 && rendGlobalBruto <= MINIMO_EXISTENCIA) {
    impostoFinal = 0;
  } else if (rendGlobalBruto > MINIMO_EXISTENCIA && (rendGlobalBruto - impostoFinal) < MINIMO_EXISTENCIA) {
    impostoFinal = Math.max(0, rendGlobalBruto - MINIMO_EXISTENCIA);
  }

  const apurado = impostoFinal - retencoes - pagamentosConta;
  const consignacao = impostoFinal > 0 ? impostoFinal * 0.01 : 0;

  const linhas: ModeloLinha[] = [
    { c: '01', l: 'Rendimento Global Bruto', v: rendGlobalBruto },
    { c: '02', l: 'Dedução específica', v: dedEspecifica },
    { c: '03', l: 'Perdas a recuperar', v: perdas },
  ];

  if (totalIsencaoJovem > 0) {
    linhas.push({ c: '04', l: 'Isenção IRS Jovem', v: totalIsencaoJovem });
  }

  linhas.push({ c: '06', l: 'Rendimento Coletável', v: coletavel, bold: true });

  if (totalIsencaoJovem > 0) {
    linhas.push({ c: '08', l: 'Rendimentos isentos englobados', v: totalIsencaoJovem });
  }

  linhas.push(
    { c: '09', l: 'Total p/ determinação da taxa', v: coletavel + totalIsencaoJovem },
    { c: '10', l: 'Quociente familiar', v: qf, fmt: 'num' },
    { c: '—', l: 'Escalão', v: `${escResult.escalao}.º`, fmt: 'txt' },
    { c: '—', l: 'Taxa nominal', v: escResult.taxaNominal, fmt: 'pct' },
    { c: '—', l: 'Parcela a abater', v: escResult.parcela },
    { c: '11', l: 'Importância apurada', v: importanciaApurada, bold: true },
    { c: '12', l: 'Parcela a abater', v: escResult.parcela * qf },
  );

  if (impostoIsento > 0) {
    linhas.push({ c: '14', l: 'Imposto correspondente a rendimentos isentos', v: impostoIsento });
  }

  if (adicional > 0) {
    linhas.push({ c: '15', l: 'Taxa adicional de solidariedade', v: adicional });
  }

  linhas.push(
    { c: '18', l: 'COLETA TOTAL', v: coletaTotal, total: true },
    { c: '19', l: 'Deduções à coleta', v: ded.total },
  );

  if (beneficioMunicipal > 0) {
    linhas.push({ c: '20', l: 'Benefício municipal', v: beneficioMunicipal });
  }

  const taxaEfetivaCorrigida = rendGlobalBruto > 0 ? impostoFinal / rendGlobalBruto : 0;
  linhas.push({
    c: '22',
    l: `Coleta líquida (taxa efetiva ${(taxaEfetivaCorrigida * 100).toFixed(2)}%)`,
    v: impostoFinal,
    bold: true,
  });

  if (pagamentosConta > 0) {
    linhas.push({ c: '23', l: 'Pagamentos por conta', v: pagamentosConta });
  }

  linhas.push({ c: '24', l: 'Retenções na fonte', v: retencoes });

  return {
    linhas,
    apurado,
    consignacao,
    taxaEfetiva: taxaEfetivaCorrigida,
    escalao: escResult.escalao,
    taxaNominal: escResult.taxaNominal,
    coletaTotal,
    coletaLiquida: impostoFinal,
    rendGlobal: rendGlobalBruto,
    rendColetavel: coletavel,
    retencoes,
    deducoes: ded,
    quociente: qf,
  };
}

// Estado persistido do simulador de IRS (Modelo 3) — um agregado familiar.
// Vive aqui (sem dependências React) para que o App o possa inicializar sem
// puxar o componente para o bundle inicial (mantém o code-splitting).
export interface IRSState {
  cenario: Cenario;
  regiao: Regiao;
  concelho: string;
  dependentes: number;
  dep0a3: number;
  beneficioMunicipal: number;
  pagamentosConta: number;
  perdas: number;
  tabela: Tabela;
  agregado: SujeitoPassivo[];
  despesas: { saude: number; educacao: number; habitacao: number; lares: number; gerais: number; pensoes: number };
  // What-if (simulação rápida)
  wifRend: number;
  wifDep: number;
  wifPpr: number;
}

export function defaultIRSState(): IRSState {
  return {
    cenario: 'individual',
    regiao: 'continente',
    concelho: 'outro',
    dependentes: 0,
    dep0a3: 0,
    beneficioMunicipal: 0,
    pagamentosConta: 0,
    perdas: 0,
    tabela: 'oficial2026',
    agregado: [
      { relacao: 'Sujeito Passivo A', nome: '', rendTrabalho: 0, contribuicoes: 0, retencao: 0, atividade: 0, coefAtividade: 0.75, irsJovemAno: 0, pagamentosConta: 0 },
    ],
    despesas: { saude: 0, educacao: 0, habitacao: 0, lares: 0, gerais: 0, pensoes: 0 },
    wifRend: 0,
    wifDep: 0,
    wifPpr: 0,
  };
}

// Explicações de cada linha do Modelo 3 (PT-PT, simplificadas) — para tooltips.
export const EXPLICACOES_M3: Record<string, string> = {
  '01': 'Soma dos rendimentos sujeitos a tributação (trabalho + atividade). No IRS Jovem mostra já o tributável (sem a parcela isenta).',
  '02': 'Dedução automática do art.º 25.º do CIRS: 8,54 × IAS = 4 587,09 € (ou as contribuições obrigatórias, se forem superiores).',
  '03': 'Perdas declaradas em anos anteriores que podem ser reportadas (até 5 anos).',
  '04': 'Parcela isenta ao abrigo do IRS Jovem (art.º 12.º-B, renumerado pela Lei 45-A/2024). Não tributa mas continua a contar para a taxa marginal.',
  '06': 'Base coletável: rendimento global menos dedução específica e perdas. É o valor a que se aplicam os escalões.',
  '08': 'Rendimentos isentos re-englobados apenas para determinar a taxa marginal aplicável.',
  '09': 'Total considerado para escolher o escalão (rendimento coletável + isentos englobados).',
  '10': 'Quociente familiar — 1 para tributação individual, 2 para tributação conjunta.',
  '11': 'Imposto bruto antes da parcela a abater (taxa marginal aplicada à linha 09).',
  '12': 'Valor fixo subtraído por escalão (assegura a progressividade — art.º 68.º do CIRS).',
  '14': 'Parte do imposto da linha 11 que corresponde aos rendimentos isentos (IRS Jovem). É subtraída.',
  '15': 'Taxa adicional de solidariedade (2,5% entre 80 k€ e 250 k€; 5% acima).',
  '18': 'Coleta total — imposto antes das deduções à coleta.',
  '19': 'Soma das deduções à coleta (saúde, educação, despesas gerais, dependentes, etc.).',
  '20': 'Devolução do município (até 5% da coleta, conforme decisão da câmara municipal).',
  '22': 'Coleta líquida = coleta total − deduções − benefício municipal. É o IRS final.',
  '23': 'Pagamentos por conta já efetuados (categoria B).',
  '24': 'Retenções na fonte feitas pela entidade pagadora ao longo do ano.',
};
