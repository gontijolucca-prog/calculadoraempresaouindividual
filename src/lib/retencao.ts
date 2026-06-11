/**
 * Motor de retenção na fonte IRS 2026 — trabalho dependente (Categoria A).
 *
 * Base legal:
 * - CIRS Art. 99.º-F: tabelas aprovadas por despacho (Continente: Despacho SEAF
 *   de 05/01/2026; Madeira: Despacho n.º 19/2026 AT-RAM; Açores: ver nota abaixo).
 * - CIRS Art. 99.º-C n.º 5: retenção AUTÓNOMA sobre subsídios de férias e Natal.
 * - CIRS Art. 99.º-C: subsídios pagos fracionadamente (duodécimos) retêm em cada
 *   pagamento a parte proporcional do imposto calculado sobre o subsídio inteiro.
 * - Arredondamento: a retenção apurada é arredondada por defeito à unidade de
 *   euro inferior; se negativa, considera-se nula. ⚠ artigo exato a confirmar
 *   (regra consta do rodapé das tabelas oficiais).
 * - IRS Jovem (CIRS Art. 12.º-B + 99.º-F): a taxa efetiva mensal correspondente à
 *   TOTALIDADE da remuneração aplica-se apenas à parte não isenta.
 *
 * Açores: as tabelas regionais 2026 não foram localizadas em fonte oficial
 * (11/06/2026). O motor devolve uma ESTIMATIVA (método anualizado × fator
 * regional do IRS) com `oficial: false`, para a UI sinalizar. NÃO usar como
 * valor de recibo. Flag em docs/AUDITORIA-FISCAL-PENDENTE.md.
 */

import {
  TABELAS_RF_2026,
  type LinhaRetencao,
  type TabelaRetencao,
  type RegiaoRF,
} from './retencaoTabelas';

export type SituacaoFamiliarRF = 'solteiro' | 'casado_1titular' | 'casado_2titulares';

export interface ParamsRetencao {
  /** remuneração mensal sujeita (salário base + excesso tributável do subsídio de alimentação) */
  remuneracao: number;
  situacao: SituacaoFamiliarRF;
  nrDependentes: number;
  deficiente: boolean;
  regiao: RegiaoRF;
}

export interface ResultadoRetencao {
  /** retenção mensal (€, inteiro — arredondada por defeito) */
  retencao: number;
  /** id da tabela oficial aplicada (I–VII) ou null em modo estimativa */
  tabelaId: string | null;
  /** taxa efetiva mensal de retenção (retencao bruta / remuneração, antes do arredondamento) */
  taxaEfetiva: number;
  /** true = tabela oficial; false = estimativa (região sem tabelas publicadas) */
  oficial: boolean;
}

/**
 * Seleciona a tabela oficial (I–VII) segundo a situação familiar, dependentes
 * e deficiência. Mapeamento das descrições oficiais das tabelas 2026.
 */
export function tabelaAplicavel(
  situacao: SituacaoFamiliarRF,
  nrDependentes: number,
  deficiente: boolean
): string {
  const temDep = nrDependentes > 0;
  if (!deficiente) {
    if (situacao === 'casado_1titular') return 'III';
    if (situacao === 'solteiro' && temDep) return 'II';
    return 'I'; // não casado sem dependentes ou casado dois titulares (c/ ou s/ dependentes)
  }
  if (situacao === 'casado_1titular') return 'VII';
  if (situacao === 'casado_2titulares' && temDep) return 'VI';
  if (situacao === 'solteiro' && temDep) return 'V';
  return 'IV'; // não casado ou casado dois titulares, sem dependentes
}

function parcelaDaLinha(linha: LinhaRetencao, R: number): number {
  if (typeof linha.parcela === 'number') return linha.parcela;
  const { coef, mult, ref } = linha.parcela;
  return coef * mult * (ref - R);
}

function linhaAplicavel(tabela: TabelaRetencao, R: number): LinhaRetencao {
  for (const linha of tabela.linhas) {
    if (linha.ate === null || R <= linha.ate) return linha;
  }
  return tabela.linhas[tabela.linhas.length - 1];
}

/**
 * Retenção mensal bruta (antes do arredondamento) segundo a tabela oficial.
 * Fórmula oficial: R × taxa − parcela a abater − parcela por dependente × n.º dependentes.
 */
function retencaoBruta(tabelas: TabelaRetencao[], p: ParamsRetencao): { valor: number; tabelaId: string } {
  const id = tabelaAplicavel(p.situacao, p.nrDependentes, p.deficiente);
  const tabela = tabelas.find(t => t.id === id);
  if (!tabela) throw new Error(`Tabela de retenção ${id} em falta`);
  const linha = linhaAplicavel(tabela, p.remuneracao);
  const valor =
    p.remuneracao * linha.taxa -
    parcelaDaLinha(linha, p.remuneracao) -
    linha.parcelaDep * p.nrDependentes;
  return { valor: Math.max(0, valor), tabelaId: id };
}

/**
 * Retenção mensal na fonte segundo as tabelas oficiais 2026.
 *
 * @param isencaoJovemPct fração da remuneração ISENTA por IRS Jovem (0–1).
 *   Aplicação oficial: a taxa efetiva da remuneração total incide só sobre a
 *   parte não isenta.
 */
export function calcRetencaoMensal(p: ParamsRetencao, isencaoJovemPct = 0): ResultadoRetencao {
  const R = p.remuneracao;
  if (R <= 0) return { retencao: 0, tabelaId: null, taxaEfetiva: 0, oficial: true };

  const tabelas = TABELAS_RF_2026[p.regiao];
  if (!tabelas) {
    // Região sem tabelas oficiais publicadas (Açores 2026) — modo estimativa.
    return estimativaRegional(p, isencaoJovemPct);
  }

  const { valor, tabelaId } = retencaoBruta(tabelas, p);
  const fracaoNaoIsenta = Math.min(1, Math.max(0, 1 - isencaoJovemPct));
  const retencao = Math.floor(valor * fracaoNaoIsenta);
  return { retencao, tabelaId, taxaEfetiva: valor / R, oficial: true };
}

/**
 * Estimativa para regiões sem tabelas publicadas: aplica a tabela do Continente
 * e multiplica pelo fator regional dos escalões de IRS (Açores 0,80 — redução
 * regional aproximada). Marcada `oficial: false` para a UI avisar. ⚠ Substituir
 * pelas tabelas oficiais da região assim que publicadas/localizadas.
 */
const FATOR_ESTIMATIVA_REGIONAL: Partial<Record<RegiaoRF, number>> = { acores: 0.80 };

function estimativaRegional(p: ParamsRetencao, isencaoJovemPct: number): ResultadoRetencao {
  const base = calcRetencaoMensal({ ...p, regiao: 'continente' }, isencaoJovemPct);
  const fator = FATOR_ESTIMATIVA_REGIONAL[p.regiao] ?? 1;
  return {
    retencao: Math.floor(base.retencao * fator),
    tabelaId: null,
    taxaEfetiva: base.taxaEfetiva * fator,
    oficial: false,
  };
}

/**
 * Retenção autónoma sobre um subsídio (férias/Natal) pago por inteiro —
 * CIRS Art. 99.º-C n.º 5: o subsídio é tributado autonomamente pela mesma
 * tabela, sem somar à remuneração do mês.
 */
export function calcRetencaoSubsidio(
  valorSubsidio: number,
  p: Omit<ParamsRetencao, 'remuneracao'>,
  isencaoJovemPct = 0
): ResultadoRetencao {
  return calcRetencaoMensal({ ...p, remuneracao: valorSubsidio }, isencaoJovemPct);
}

/**
 * Retenção mensal sobre duodécimos dos subsídios: parte proporcional (1/12)
 * do imposto que seria retido sobre cada subsídio pago por inteiro.
 * `nrSubsidios` = quantos subsídios estão em duodécimos (normalmente 2).
 */
export function calcRetencaoDuodecimos(
  valorSubsidio: number,
  nrSubsidios: number,
  p: Omit<ParamsRetencao, 'remuneracao'>,
  isencaoJovemPct = 0
): number {
  const porSubsidio = calcRetencaoSubsidio(valorSubsidio, p, isencaoJovemPct).retencao;
  return (porSubsidio * nrSubsidios) / 12;
}
