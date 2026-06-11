/**
 * Enquadramento fiscal 2026 — motor em DUAS camadas (desenho da contabilista):
 *
 *  1) VALIDAÇÃO JURÍDICA — determina que regimes são legalmente possíveis
 *     (IRS simplificado vs organizada; IRC normal vs simplificado; IVA
 *     isenção art. 53.º vs normal trimestral vs mensal).
 *  2) COMPARAÇÃO ECONÓMICA — para cada cenário ELEGÍVEL, quanto sobra
 *     efetivamente ao empresário (disponibilidade líquida anual), separando
 *     IRS/IRC, IVA, Segurança Social e custos administrativos.
 *
 * O IVA mensal vs trimestral NÃO é apresentado como poupança fiscal — o
 * montante anual é o mesmo; o que muda é tesouraria e carga administrativa.
 *
 * ⚠ Valores fiscais a validar pela contabilista — ver
 * docs/AUDITORIA-FISCAL-PENDENTE.md (secção "Enquadramento v3").
 */
import { calculateIRS, calculateIRC, calcDependentsDeduction } from './pt2026';
import { DED_ESPECIFICA_CAT_A_2026 } from './fiscal';

// ─── 01_Parâmetros_Legais: taxas, limites e coeficientes com vigência ─────────
// Tabela única (não espalhar números pelas fórmulas) — atualizar aqui quando a
// lei mudar, com a data de vigência.
export const PARAMS_2026 = {
  vigencia: { inicio: '2026-01-01', fim: null as string | null },

  // IRS — regime simplificado (art. 28.º/31.º CIRS)
  irsSimplificadoLimite: 200_000,        // rendimentos cat. B ano anterior
  irsSimplificadoSaltoPct: 0.25,         // ultrapassagem >25% num ano → organizada obrigatória no seguinte
  coefIRS: { vendas: 0.15, servicosProf: 0.75, outrosServicos: 0.35, restantes: 0.10 },
  // Reduções no início de atividade (art. 31.º n.º 10 — aplicam-se aos coef. 0,75 e 0,35) ⚠ confirmar
  reducaoCoefIRS: { ano1: 0.50, ano2: 0.25 },

  // IRC — regime simplificado (art. 86.º-A/86.º-B CIRC) ⚠ confirmar vigência 2026
  ircSimplificado: {
    limiteRendimentos: 200_000,
    limiteBalanco: 500_000,
    coef: { vendas: 0.04, restauracaoHotelaria: 0.04, servicosProf: 0.75, restantesServicos: 0.10, subsidiosNaoExploracao: 0.30 },
    // Redução nos coef. de vendas e restantes serviços: 50% no 1.º período, 25% no 2.º
    reducao: { ano1: 0.50, ano2: 0.25 },
  },

  // IVA
  iva: {
    isencao53Limite: 15_000,             // VN ano anterior
    saidaImediata: 18_750,               // ultrapassado no próprio ano → saída imediata
    mensalObrigatorioVN: 650_000,        // VN ano anterior ≥ → mensal obrigatório
    taxaNormal: 0.23,
  },

  // Segurança Social
  ss: {
    independente: 0.214,                  // base de incidência tem nuances ⚠
    moeEmpresa: 0.2375,                   // gerente/MOE: 23,75% empresa
    moeGerente: 0.11,                     // + 11% quotização do próprio = 34,75%
  },

  dividendos: 0.28,                       // taxa liberatória (art. 71.º CIRS)
} as const;

// ─── Inputs ────────────────────────────────────────────────────────────────────
/** Rendimentos anuais por natureza (sem IVA) — os coeficientes diferem. */
export interface RendimentosPorNatureza {
  vendas: number;            // mercadorias e produtos
  servicosProf: number;      // serviços da tabela do art. 151.º CIRS
  outrosServicos: number;
  restantes: number;         // subsídios à exploração e outros
}

export interface InputEnq2026 {
  rend: RendimentosPorNatureza;
  faturacaoAnoAnterior: number;     // base das validações (53.º, periodicidade, simplificados)
  anoAtividade: 1 | 2 | 3;          // 3 = 3.º ano ou seguinte (reduções de coeficientes)

  gastosReais: number;              // custo líquido anual SEM IVA (sem contabilidade)
  ivaDedutivelCompras: number;      // IVA suportado dedutível — separado do custo
  taManual: number;                 // tributações autónomas (€/ano) — viaturas/representação ⚠ cálculo detalhado fora da v1

  remGerenteMensal: number;         // remuneração do gerente na sociedade (×14)
  pctLucroDistribuido: number;      // 0..1 — o resto fica retido na empresa
  outrosRendimentos: number;        // restantes rendimentos do agregado (IRS progressivo)
  nrDependentes: number;

  totalBalanco: number;             // elegibilidade IRC simplificado
  microentidade: boolean;
  revisaoLegalContas: boolean;
  renunciouSimplificado3Anos: boolean;

  clientesParticularesPct: number;  // 0..1 — impacto comercial do IVA (alerta)
  taxaDerramaMunicipal: number;     // fração (parametrizar por concelho)
  taxaIvaMedia: number;             // default 0.23

  accMensalSimplificado: number;    // contabilidade ENI simplificado (€/mês, pode ser 0)
  accMensalOrganizada: number;      // CC obrigatório — ENI organizada E sociedade (€/mês)
}

export function defaultInputEnq2026(): InputEnq2026 {
  return {
    rend: { vendas: 0, servicosProf: 0, outrosServicos: 0, restantes: 0 },
    faturacaoAnoAnterior: 0, anoAtividade: 3,
    gastosReais: 0, ivaDedutivelCompras: 0, taManual: 0,
    remGerenteMensal: 1000, pctLucroDistribuido: 1, outrosRendimentos: 0, nrDependentes: 0,
    totalBalanco: 0, microentidade: true, revisaoLegalContas: false, renunciouSimplificado3Anos: false,
    clientesParticularesPct: 0, taxaDerramaMunicipal: 0, taxaIvaMedia: PARAMS_2026.iva.taxaNormal,
    accMensalSimplificado: 0, accMensalOrganizada: 100,
  };
}

const faturacaoTotal = (r: RendimentosPorNatureza) => r.vendas + r.servicosProf + r.outrosServicos + r.restantes;

// ─── Camada 1: validação jurídica ─────────────────────────────────────────────
export interface Elegibilidade { elegivel: boolean; motivos: string[] }
export interface ValidacaoRegimes {
  irsSimplificado: Elegibilidade;
  irsOrganizada: Elegibilidade;      // sempre possível (por opção ou obrigação)
  ircNormal: Elegibilidade;          // sempre possível
  ircSimplificado: Elegibilidade;
  ivaIsencao53: Elegibilidade;
  ivaTrimestral: Elegibilidade;
  ivaMensal: Elegibilidade;          // sempre possível (obrigatório ≥650k, opcional abaixo)
  ivaMensalObrigatorio: boolean;
}

export function validarRegimes(i: InputEnq2026): ValidacaoRegimes {
  const P = PARAMS_2026;
  const fatPrev = faturacaoTotal(i.rend);

  const irsSimpl: Elegibilidade = { elegivel: true, motivos: [] };
  if (i.faturacaoAnoAnterior > P.irsSimplificadoLimite) {
    irsSimpl.elegivel = false;
    irsSimpl.motivos.push(`Rendimentos cat. B do ano anterior acima de ${P.irsSimplificadoLimite.toLocaleString('pt-PT')} € — contabilidade organizada obrigatória.`);
  }

  const ircSimpl: Elegibilidade = { elegivel: true, motivos: [] };
  if (i.faturacaoAnoAnterior > P.ircSimplificado.limiteRendimentos) {
    ircSimpl.elegivel = false;
    ircSimpl.motivos.push(`Rendimentos do período anterior acima de ${P.ircSimplificado.limiteRendimentos.toLocaleString('pt-PT')} €.`);
  }
  if (i.totalBalanco > P.ircSimplificado.limiteBalanco) {
    ircSimpl.elegivel = false;
    ircSimpl.motivos.push(`Total do balanço acima de ${P.ircSimplificado.limiteBalanco.toLocaleString('pt-PT')} €.`);
  }
  if (i.revisaoLegalContas) {
    ircSimpl.elegivel = false;
    ircSimpl.motivos.push('Sujeita a revisão legal de contas.');
  }
  if (!i.microentidade) {
    ircSimpl.elegivel = false;
    ircSimpl.motivos.push('Não aplica o regime de normalização contabilística das microentidades.');
  }
  if (i.renunciouSimplificado3Anos) {
    ircSimpl.elegivel = false;
    ircSimpl.motivos.push('Renunciou ao regime nos 3 anos anteriores.');
  }

  const isencao53: Elegibilidade = { elegivel: true, motivos: [] };
  // Início de atividade: usa a estimativa do próprio ano (sem anualização obrigatória).
  const baseIsencao = i.anoAtividade === 1 ? fatPrev : i.faturacaoAnoAnterior;
  if (baseIsencao > P.iva.isencao53Limite) {
    isencao53.elegivel = false;
    isencao53.motivos.push(`Volume de negócios ${i.anoAtividade === 1 ? 'estimado' : 'do ano anterior'} acima de ${P.iva.isencao53Limite.toLocaleString('pt-PT')} €.`);
  }

  const mensalObrig = i.faturacaoAnoAnterior >= P.iva.mensalObrigatorioVN;
  const trimestral: Elegibilidade = { elegivel: !mensalObrig, motivos: [] };
  if (mensalObrig) trimestral.motivos.push(`Volume de negócios do ano anterior igual ou superior a ${P.iva.mensalObrigatorioVN.toLocaleString('pt-PT')} € — IVA mensal obrigatório.`);

  return {
    irsSimplificado: irsSimpl,
    irsOrganizada: { elegivel: true, motivos: [] },
    ircNormal: { elegivel: true, motivos: [] },
    ircSimplificado: ircSimpl,
    ivaIsencao53: isencao53,
    ivaTrimestral: trimestral,
    ivaMensal: { elegivel: true, motivos: [] },
    ivaMensalObrigatorio: mensalObrig,
  };
}

// ─── Camada 2: comparação económica ───────────────────────────────────────────
export type RegimeRendimento = 'eni-simplificado' | 'eni-organizada' | 'soc-irc-normal' | 'soc-irc-simplificado';
export type RegimeIva = 'isencao53' | 'trimestral' | 'mensal';

export interface CenarioEnq {
  id: string;
  rendimento: RegimeRendimento;
  iva: RegimeIva;
  label: string;
  // decomposição (anual, €)
  ss: number;                    // SS total (independente, ou empresa+gerente)
  imposto: number;               // IRS ou IRC (sem derrama/TA)
  derramaTA: number;
  impostoDividendos: number;
  custosAdmin: number;           // contabilidade
  custoIvaNaoDeduzido: number;   // isenção 53.º: IVA suportado vira custo
  disponivel: number;            // disponibilidade líquida anual do empresário
  lucroRetido: number;           // só sociedades
  ivaSaldoAnual: number;         // liquidado − dedutível (0 na isenção)
  ivaPicoTesouraria: number;     // IVA acumulado por entregar no pico do ciclo
  obrigacoes: number;            // n.º estimado de obrigações declarativas/ano
}

const ANO_RED = (ano: 1 | 2 | 3, r1: number, r2: number) => (ano === 1 ? 1 - r1 : ano === 2 ? 1 - r2 : 1);

/** Coeficientes IRS simplificado com reduções de início de atividade (0,75 e 0,35). */
export function rendColetavelIrsSimplificado(rend: RendimentosPorNatureza, ano: 1 | 2 | 3, gastosReais: number): { rc: number; acrescimo15: number } {
  const P = PARAMS_2026;
  const f = ANO_RED(ano, P.reducaoCoefIRS.ano1, P.reducaoCoefIRS.ano2);
  let rc = rend.vendas * P.coefIRS.vendas
    + rend.servicosProf * P.coefIRS.servicosProf * f
    + rend.outrosServicos * P.coefIRS.outrosServicos * f
    + rend.restantes * P.coefIRS.restantes;
  // Regra dos 15% (art. 31.º n.º 13): parte da dedução presumida nos serviços
  // (coef. 0,75/0,35) exige despesas efetivas justificadas. ⚠ confirmar mecânica.
  const servicos = rend.servicosProf + rend.outrosServicos;
  let acrescimo15 = 0;
  if (servicos > 0) {
    const exigido = servicos * 0.15;
    const justificado = gastosReais + DED_ESPECIFICA_CAT_A_2026;
    if (justificado < exigido) { acrescimo15 = exigido - justificado; rc += acrescimo15; }
  }
  return { rc, acrescimo15 };
}

/** Matéria coletável IRC simplificado com reduções (vendas e restantes serviços). */
export function materiaColetavelIrcSimplificado(rend: RendimentosPorNatureza, ano: 1 | 2 | 3): number {
  const P = PARAMS_2026.ircSimplificado;
  const f = ANO_RED(ano, P.reducao.ano1, P.reducao.ano2);
  return rend.vendas * P.coef.vendas * f
    + rend.servicosProf * P.coef.servicosProf
    + (rend.outrosServicos + rend.restantes) * P.coef.restantesServicos * f;
}

/** SS de independente: base 70% serviços + 20% vendas × 21,4% (⚠ nuances da base). */
export function ssIndependente(rend: RendimentosPorNatureza): number {
  const servicos = rend.servicosProf + rend.outrosServicos + rend.restantes;
  return (servicos * 0.70 + rend.vendas * 0.20) * PARAMS_2026.ss.independente;
}

/** IRS marginal sobre o rendimento da atividade, dado o resto do agregado. */
function irsMarginal(rcAtividade: number, outros: number, nrDep: number): number {
  return Math.max(0, calculateIRS(outros + rcAtividade) - calculateIRS(outros) - calcDependentsDeduction(nrDep));
}

export interface ResultadoEnq2026 {
  validacao: ValidacaoRegimes;
  cenarios: CenarioEnq[];                      // só os elegíveis, ordenados por disponível desc
  excluidos: { label: string; motivos: string[] }[];
  alertas: string[];
  recomendacao: { melhor: CenarioEnq; diferencaVsSegundo: number; motivo: string } | null;
}

const LABEL_REND: Record<RegimeRendimento, string> = {
  'eni-simplificado': 'ENI · IRS simplificado',
  'eni-organizada': 'ENI · contabilidade organizada',
  'soc-irc-normal': 'Sociedade · IRC normal',
  'soc-irc-simplificado': 'Sociedade · IRC simplificado',
};
const LABEL_IVA: Record<RegimeIva, string> = {
  isencao53: 'IVA isento (art. 53.º)',
  trimestral: 'IVA trimestral',
  mensal: 'IVA mensal',
};

// Obrigações declarativas estimadas por ano (ordem de grandeza, não exaustivo):
// ENI: Mod. 3 (1) + declarações trimestrais SS (4) [+ IES se organizada] + IVA (0/4/12)
// SOC: Mod. 22 (1) + IES (1) + DMR (12) + retenções/DMR SS (12 agregadas em 12) + IVA
function contarObrigacoes(rendimento: RegimeRendimento, iva: RegimeIva): number {
  const ivaN = iva === 'isencao53' ? 0 : iva === 'trimestral' ? 4 : 12;
  if (rendimento === 'eni-simplificado') return 1 + 4 + ivaN;
  if (rendimento === 'eni-organizada') return 1 + 4 + 1 + ivaN;
  return 1 + 1 + 12 + ivaN; // sociedade: Mod22 + IES + DMR mensais
}

export function compararEnquadramento2026(i: InputEnq2026): ResultadoEnq2026 {
  const P = PARAMS_2026;
  const v = validarRegimes(i);
  const fat = faturacaoTotal(i.rend);
  const alertas: string[] = [];

  // ── Camada económica por regime de rendimento ──
  const accSimplAno = i.accMensalSimplificado * 12;
  const accOrgAno = i.accMensalOrganizada * 12;

  type NucleoRend = { ss: number; imposto: number; derramaTA: number; impostoDividendos: number; custosAdmin: number; disponivel: number; lucroRetido: number };
  const nucleos = new Map<RegimeRendimento, NucleoRend>();

  // A. ENI — IRS simplificado
  if (v.irsSimplificado.elegivel) {
    const { rc } = rendColetavelIrsSimplificado(i.rend, i.anoAtividade, i.gastosReais);
    const ss = ssIndependente(i.rend);
    const irs = irsMarginal(rc, i.outrosRendimentos, i.nrDependentes);
    nucleos.set('eni-simplificado', {
      ss, imposto: irs, derramaTA: 0, impostoDividendos: 0, custosAdmin: accSimplAno,
      disponivel: fat - i.gastosReais - accSimplAno - ss - irs, lucroRetido: 0,
    });
  }

  // B. ENI — contabilidade organizada (gastos de contabilidade são dedutíveis)
  {
    const rc = Math.max(0, fat - i.gastosReais - accOrgAno);
    const ss = ssIndependente(i.rend); // ⚠ base no regime organizado tem nuances
    const irs = irsMarginal(rc, i.outrosRendimentos, i.nrDependentes);
    nucleos.set('eni-organizada', {
      ss, imposto: irs, derramaTA: 0, impostoDividendos: 0, custosAdmin: accOrgAno,
      disponivel: fat - i.gastosReais - accOrgAno - ss - irs, lucroRetido: 0,
    });
  }

  // C/D. Sociedade — comum: remuneração do gerente (MOE 34,75%: 23,75 empresa + 11 próprio)
  const remAnual = i.remGerenteMensal * 14;
  const ssEmpresa = remAnual * P.ss.moeEmpresa;
  const ssGerente = remAnual * P.ss.moeGerente;
  const irsGerente = irsMarginal(Math.max(0, remAnual - DED_ESPECIFICA_CAT_A_2026), i.outrosRendimentos, i.nrDependentes);
  const gerenteLiquido = remAnual - ssGerente - irsGerente;
  const lucroContab = fat - i.gastosReais - accOrgAno - remAnual - ssEmpresa;

  const nucleoSociedade = (irc: number, derrama: number): NucleoRend => {
    const aposImposto = lucroContab - irc - derrama - i.taManual;
    const distribuido = Math.max(0, aposImposto) * Math.min(1, Math.max(0, i.pctLucroDistribuido));
    const retido = Math.max(0, aposImposto) - distribuido;
    const impostoDiv = distribuido * P.dividendos;
    return {
      ss: ssEmpresa + ssGerente, imposto: irc + irsGerente, derramaTA: derrama + i.taManual,
      impostoDividendos: impostoDiv, custosAdmin: accOrgAno,
      disponivel: gerenteLiquido + (distribuido - impostoDiv) + Math.min(0, aposImposto),
      lucroRetido: retido,
    };
  };

  // C. Sociedade — IRC normal (lucro real)
  {
    const lt = Math.max(0, lucroContab);
    const irc = calculateIRC(lt);
    const derrama = lt * i.taxaDerramaMunicipal;
    nucleos.set('soc-irc-normal', nucleoSociedade(irc, derrama));
  }

  // D. Sociedade — IRC simplificado (matéria coletável por coeficientes)
  if (v.ircSimplificado.elegivel) {
    const mc = materiaColetavelIrcSimplificado(i.rend, i.anoAtividade);
    const irc = calculateIRC(mc);
    const derrama = mc * i.taxaDerramaMunicipal; // ⚠ base da derrama no simplificado a confirmar
    nucleos.set('soc-irc-simplificado', nucleoSociedade(irc, derrama));
  }

  // ── Eixo IVA (tesouraria, não poupança) ──
  const ivaLiquidado = fat * i.taxaIvaMedia; // ⚠ assume tudo à taxa média indicada
  const ivaSaldo = Math.max(0, ivaLiquidado - i.ivaDedutivelCompras);
  const regimesIva: { id: RegimeIva; ok: boolean }[] = [
    { id: 'isencao53', ok: v.ivaIsencao53.elegivel },
    { id: 'trimestral', ok: v.ivaTrimestral.elegivel },
    { id: 'mensal', ok: true },
  ];

  const cenarios: CenarioEnq[] = [];
  for (const [rg, n] of nucleos) {
    for (const rv of regimesIva) {
      if (!rv.ok) continue;
      const isento = rv.id === 'isencao53';
      // Isenção 53.º: não liquida nem deduz — o IVA suportado nas compras vira custo.
      const custoIva = isento ? i.ivaDedutivelCompras : 0;
      cenarios.push({
        id: `${rg}|${rv.id}`,
        rendimento: rg, iva: rv.id,
        label: `${LABEL_REND[rg]} + ${LABEL_IVA[rv.id]}`,
        ss: n.ss, imposto: n.imposto, derramaTA: n.derramaTA, impostoDividendos: n.impostoDividendos,
        custosAdmin: n.custosAdmin, custoIvaNaoDeduzido: custoIva,
        disponivel: n.disponivel - custoIva,
        lucroRetido: n.lucroRetido,
        ivaSaldoAnual: isento ? 0 : ivaSaldo,
        // Pico de IVA acumulado por entregar: ~3 meses no trimestral, ~1 mês no mensal
        // (entrega até dia 20 do 2.º mês seguinte). ⚠ modelo simplificado de tesouraria.
        ivaPicoTesouraria: isento ? 0 : rv.id === 'trimestral' ? ivaSaldo / 4 : ivaSaldo / 12,
        obrigacoes: contarObrigacoes(rg, rv.id),
      });
    }
  }
  cenarios.sort((a, b) => b.disponivel - a.disponivel);

  // ── Excluídos (com motivo) ──
  const excluidos: { label: string; motivos: string[] }[] = [];
  if (!v.irsSimplificado.elegivel) excluidos.push({ label: LABEL_REND['eni-simplificado'], motivos: v.irsSimplificado.motivos });
  if (!v.ircSimplificado.elegivel) excluidos.push({ label: LABEL_REND['soc-irc-simplificado'], motivos: v.ircSimplificado.motivos });
  if (!v.ivaIsencao53.elegivel) excluidos.push({ label: LABEL_IVA.isencao53, motivos: v.ivaIsencao53.motivos });
  if (!v.ivaTrimestral.elegivel) excluidos.push({ label: LABEL_IVA.trimestral, motivos: v.ivaTrimestral.motivos });

  // ── Alertas ──
  const L = P.iva;
  if (v.ivaIsencao53.elegivel && fat > L.isencao53Limite * 0.9 && fat <= L.saidaImediata) {
    alertas.push(`Faturação prevista próxima de ${L.isencao53Limite.toLocaleString('pt-PT')} € — simular a saída da isenção do art. 53.º.`);
  }
  if (v.ivaIsencao53.elegivel && fat > L.saidaImediata) {
    alertas.push(`A faturação prevista ultrapassa ${L.saidaImediata.toLocaleString('pt-PT')} € — a saída da isenção do art. 53.º é IMEDIATA durante o ano.`);
  }
  if (v.irsSimplificado.elegivel && fat > P.irsSimplificadoLimite * (1 + P.irsSimplificadoSaltoPct)) {
    alertas.push(`Faturação prevista acima de ${Math.round(P.irsSimplificadoLimite * 1.25).toLocaleString('pt-PT')} € (limite +25%) — a contabilidade organizada torna-se obrigatória no período seguinte.`);
  } else if (v.irsSimplificado.elegivel && fat > P.irsSimplificadoLimite) {
    alertas.push('Faturação prevista acima de 200 000 € — se acontecer em dois anos consecutivos, a contabilidade organizada torna-se obrigatória.');
  }
  if (v.ivaMensalObrigatorio) alertas.push('IVA mensal obrigatório (volume de negócios ≥ 650 000 €).');
  {
    const servicos = i.rend.servicosProf;
    if (servicos > 0 && i.gastosReais > faturacaoTotal(i.rend) * 0.25) {
      alertas.push('Gastos dedutíveis acima de 25% da faturação — a contabilidade organizada pode ser mais vantajosa do que a dedução presumida do simplificado.');
    }
  }
  if (i.pctLucroDistribuido >= 0.9 && lucroContab > 0) {
    alertas.push('Distribuição quase total dos lucros — os 28% sobre dividendos pesam na comparação; considerar reter parte do lucro na empresa.');
  }
  if (i.taManual === 0 && i.gastosReais > 0) {
    alertas.push('Tributações autónomas a 0 € — se existirem viaturas ou despesas de representação, validar com a contabilista.');
  }
  if (i.clientesParticularesPct >= 0.5 && !v.ivaIsencao53.elegivel) {
    alertas.push('Clientes maioritariamente particulares: o IVA liquidado encarece o preço final ou comprime a margem — avaliar o impacto comercial.');
  }

  // ── Recomendação ──
  let recomendacao: ResultadoEnq2026['recomendacao'] = null;
  if (cenarios.length >= 1) {
    const melhor = cenarios[0];
    const segundo = cenarios[1] ?? null;
    const dif = segundo ? melhor.disponivel - segundo.disponivel : 0;
    let motivo = 'Único cenário elegível.';
    if (segundo) {
      if (melhor.rendimento !== segundo.rendimento) {
        const cargaMelhor = melhor.imposto + melhor.ss + melhor.derramaTA + melhor.impostoDividendos;
        const cargaSeg = segundo.imposto + segundo.ss + segundo.derramaTA + segundo.impostoDividendos;
        motivo = cargaMelhor < cargaSeg
          ? 'Carga fiscal e contributiva total inferior à da segunda opção.'
          : 'Vantagem vem dos custos administrativos/IVA, não da carga fiscal.';
      } else {
        motivo = melhor.iva === 'isencao53'
          ? 'Mesmo regime de rendimento; a isenção do art. 53.º evita perder o IVA das compras face ao ganho de liquidar.'
          : 'Mesmo regime de rendimento; diferença é de tesouraria e carga administrativa do IVA, não de imposto.';
      }
    }
    recomendacao = { melhor, diferencaVsSegundo: dif, motivo };
  }

  return { validacao: v, cenarios, excluidos, alertas, recomendacao };
}
