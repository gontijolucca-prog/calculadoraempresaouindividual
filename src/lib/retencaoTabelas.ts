/**
 * Tabelas oficiais de retenção na fonte IRS 2026 — trabalho dependente (Categoria A).
 * GERADO a partir das fontes oficiais — não editar à mão; ver docs/AUDITORIA-FISCAL-PENDENTE.md.
 *
 * Continente: Despacho SEAF de 05/01/2026 — extraído diretamente de
 *   https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/tabela_ret_doclib/Documents/Tabelas_RF_Continente_2026.xlsx
 * Madeira: Despacho n.º 19/2026, de 20 de janeiro (JORAM, II Série, n.º 13, 4.º Supl.) — AT-RAM,
 *   verificado contra o PDF oficial (76 amostras).
 * Açores: tabelas 2026 não localizadas em fonte oficial à data de 11/06/2026 — null
 *   (o motor aplica estimativa sinalizada na UI). Flag para validação do contabilista.
 *
 * Modelo (em vigor desde jul/2023): retenção = R × taxaMarginalMáxima − parcela − parcelaDep × n.º dependentes,
 * arredondada por defeito à unidade de euro inferior; negativa → 0.
 * Linhas iniciais têm parcela VARIÁVEL: parcela = coef × mult × (ref − R).
 */

export interface ParcelaVariavel { coef: number; mult: number; ref: number }

export interface LinhaRetencao {
  /** limite superior de remuneração mensal (€); null = último escalão */
  ate: number | null;
  /** taxa marginal máxima (decimal) */
  taxa: number;
  /** parcela a abater: constante (€) ou fórmula coef × mult × (ref − R) */
  parcela: number | ParcelaVariavel;
  /** parcela adicional a abater por dependente (€) */
  parcelaDep: number;
}

export interface TabelaRetencao { id: string; descricao: string; linhas: LinhaRetencao[] }

export type RegiaoRF = 'continente' | 'madeira' | 'acores';

// Continente — Despacho SEAF de 05/01/2026
export const TABELAS_RF_CONTINENTE_2026: TabelaRetencao[] = [
  { id: 'I', descricao: 'Não casado sem dependentes ou casado dois titulares', linhas: [
    { ate: 920, taxa: 0, parcela: 0.0, parcelaDep: 0 },
    { ate: 1042, taxa: 0.125, parcela: { coef: 0.125, mult: 2.6, ref: 1273.85 }, parcelaDep: 21.43 },
    { ate: 1108, taxa: 0.157, parcela: { coef: 0.157, mult: 1.35, ref: 1554.83 }, parcelaDep: 21.43 },
    { ate: 1154, taxa: 0.157, parcela: 94.71, parcelaDep: 21.43 },
    { ate: 1212, taxa: 0.212, parcela: 158.18, parcelaDep: 21.43 },
    { ate: 1819, taxa: 0.241, parcela: 193.33, parcelaDep: 21.43 },
    { ate: 2119, taxa: 0.311, parcela: 320.66, parcelaDep: 21.43 },
    { ate: 2499, taxa: 0.349, parcela: 401.19, parcelaDep: 21.43 },
    { ate: 3305, taxa: 0.3836, parcela: 487.66, parcelaDep: 21.43 },
    { ate: 5547, taxa: 0.3969, parcela: 531.62, parcelaDep: 21.43 },
    { ate: 20221, taxa: 0.4495, parcela: 823.4, parcelaDep: 21.43 },
    { ate: null, taxa: 0.4717, parcela: 1272.31, parcelaDep: 21.43 },
  ] },
  { id: 'II', descricao: 'Não casado com um ou mais dependentes', linhas: [
    { ate: 920, taxa: 0, parcela: 0.0, parcelaDep: 0 },
    { ate: 1042, taxa: 0.125, parcela: { coef: 0.125, mult: 2.6, ref: 1273.85 }, parcelaDep: 34.29 },
    { ate: 1108, taxa: 0.157, parcela: { coef: 0.157, mult: 1.35, ref: 1554.83 }, parcelaDep: 34.29 },
    { ate: 1154, taxa: 0.157, parcela: 94.71, parcelaDep: 34.29 },
    { ate: 1212, taxa: 0.212, parcela: 158.18, parcelaDep: 34.29 },
    { ate: 1819, taxa: 0.241, parcela: 193.33, parcelaDep: 34.29 },
    { ate: 2119, taxa: 0.311, parcela: 320.66, parcelaDep: 34.29 },
    { ate: 2499, taxa: 0.349, parcela: 401.19, parcelaDep: 34.29 },
    { ate: 3305, taxa: 0.3836, parcela: 487.66, parcelaDep: 34.29 },
    { ate: 5547, taxa: 0.3969, parcela: 531.62, parcelaDep: 34.29 },
    { ate: 20221, taxa: 0.4495, parcela: 823.4, parcelaDep: 34.29 },
    { ate: null, taxa: 0.4717, parcela: 1272.31, parcelaDep: 34.29 },
  ] },
  { id: 'III', descricao: 'Casado, único titular', linhas: [
    { ate: 991, taxa: 0, parcela: 0.0, parcelaDep: 0 },
    { ate: 1042, taxa: 0.125, parcela: { coef: 0.125, mult: 2.6, ref: 1372.15 }, parcelaDep: 42.86 },
    { ate: 1108, taxa: 0.125, parcela: { coef: 0.125, mult: 1.35, ref: 1677.85 }, parcelaDep: 42.86 },
    { ate: 1119, taxa: 0.125, parcela: 96.17, parcelaDep: 42.86 },
    { ate: 1432, taxa: 0.1272, parcela: 98.64, parcelaDep: 42.86 },
    { ate: 1962, taxa: 0.157, parcela: 141.32, parcelaDep: 42.86 },
    { ate: 2240, taxa: 0.1938, parcela: 213.53, parcelaDep: 42.86 },
    { ate: 2773, taxa: 0.2277, parcela: 289.47, parcelaDep: 42.86 },
    { ate: 3389, taxa: 0.257, parcela: 370.72, parcelaDep: 42.86 },
    { ate: 5965, taxa: 0.2881, parcela: 476.12, parcelaDep: 42.86 },
    { ate: 20265, taxa: 0.3843, parcela: 1049.96, parcelaDep: 42.86 },
    { ate: null, taxa: 0.4717, parcela: 2821.13, parcelaDep: 42.86 },
  ] },
  { id: 'IV', descricao: 'Não casado ou casado dois titulares sem dependentes — pessoa com deficiência', linhas: [
    { ate: 1694, taxa: 0, parcela: 0.0, parcelaDep: 0 },
    { ate: 2063, taxa: 0.212, parcela: 359.13, parcelaDep: 0 },
    { ate: 2492, taxa: 0.311, parcela: 563.37, parcelaDep: 0 },
    { ate: 4487, taxa: 0.349, parcela: 658.07, parcelaDep: 0 },
    { ate: 4753, taxa: 0.3836, parcela: 813.33, parcelaDep: 0 },
    { ate: 6687, taxa: 0.3969, parcela: 876.55, parcelaDep: 0 },
    { ate: 20468, taxa: 0.4495, parcela: 1228.29, parcelaDep: 0 },
    { ate: null, taxa: 0.4717, parcela: 1682.68, parcelaDep: 0 },
  ] },
  { id: 'V', descricao: 'Não casado com um ou mais dependentes — pessoa com deficiência', linhas: [
    { ate: 1938, taxa: 0, parcela: 0.0, parcelaDep: 0 },
    { ate: 2063, taxa: 0.2132, parcela: 413.19, parcelaDep: 42.86 },
    { ate: 2854, taxa: 0.311, parcela: 614.96, parcelaDep: 42.86 },
    { ate: 4504, taxa: 0.349, parcela: 723.42, parcelaDep: 42.86 },
    { ate: 6826, taxa: 0.3836, parcela: 879.26, parcelaDep: 42.86 },
    { ate: 7048, taxa: 0.3969, parcela: 970.05, parcelaDep: 42.86 },
    { ate: 20468, taxa: 0.4495, parcela: 1340.78, parcelaDep: 42.86 },
    { ate: null, taxa: 0.4717, parcela: 1795.17, parcelaDep: 42.86 },
  ] },
  { id: 'VI', descricao: 'Casado dois titulares com um ou mais dependentes — pessoa com deficiência', linhas: [
    { ate: 1668, taxa: 0, parcela: 0.0, parcelaDep: 0 },
    { ate: 2068, taxa: 0.2049, parcela: 341.78, parcelaDep: 21.43 },
    { ate: 2497, taxa: 0.241, parcela: 416.44, parcelaDep: 21.43 },
    { ate: 3107, taxa: 0.311, parcela: 591.23, parcelaDep: 21.43 },
    { ate: 4504, taxa: 0.349, parcela: 709.3, parcelaDep: 21.43 },
    { ate: 6826, taxa: 0.3836, parcela: 865.14, parcelaDep: 21.43 },
    { ate: 7048, taxa: 0.3969, parcela: 955.93, parcelaDep: 21.43 },
    { ate: 20468, taxa: 0.4495, parcela: 1326.66, parcelaDep: 21.43 },
    { ate: null, taxa: 0.4717, parcela: 1781.05, parcelaDep: 21.43 },
  ] },
  { id: 'VII', descricao: 'Casado, único titular — pessoa com deficiência', linhas: [
    { ate: 2325, taxa: 0, parcela: 0.0, parcelaDep: 0 },
    { ate: 3494, taxa: 0.2277, parcela: 529.41, parcelaDep: 42.86 },
    { ate: 3761, taxa: 0.257, parcela: 631.79, parcelaDep: 42.86 },
    { ate: 6687, taxa: 0.2881, parcela: 748.76, parcelaDep: 42.86 },
    { ate: 20468, taxa: 0.4244, parcela: 1660.2, parcelaDep: 42.86 },
    { ate: null, taxa: 0.4717, parcela: 2628.34, parcelaDep: 42.86 },
  ] },
];

// Madeira — Despacho n.º 19/2026, de 20 de janeiro (JORAM)
export const TABELAS_RF_MADEIRA_2026: TabelaRetencao[] = [
  { id: 'I', descricao: 'Não casado sem dependentes ou casado dois titulares', linhas: [
    { ate: 980, taxa: 0, parcela: 0.0, parcelaDep: 0 },
    { ate: 1028, taxa: 0.0872, parcela: { coef: 0.0872, mult: 2.6, ref: 1356.92 }, parcelaDep: 21.43 },
    { ate: 1099, taxa: 0.1204, parcela: { coef: 0.1204, mult: 1.35, ref: 1696.78 }, parcelaDep: 21.43 },
    { ate: 1201, taxa: 0.1204, parcela: 97.17, parcelaDep: 21.43 },
    { ate: 1623, taxa: 0.1763, parcela: 164.31, parcelaDep: 21.43 },
    { ate: 2332, taxa: 0.223, parcela: 240.11, parcelaDep: 21.43 },
    { ate: 3203, taxa: 0.2242, parcela: 242.91, parcelaDep: 21.43 },
    { ate: 3614, taxa: 0.237, parcela: 283.91, parcelaDep: 21.43 },
    { ate: 6585, taxa: 0.3028, parcela: 521.72, parcelaDep: 21.43 },
    { ate: 6954, taxa: 0.2802, parcela: 372.9, parcelaDep: 21.43 },
    { ate: 21411, taxa: 0.2924, parcela: 457.74, parcelaDep: 21.43 },
    { ate: null, taxa: 0.3278, parcela: 1215.69, parcelaDep: 21.43 },
  ] },
  { id: 'II', descricao: 'Não casado com um ou mais dependentes', linhas: [
    { ate: 980, taxa: 0, parcela: 0.0, parcelaDep: 0 },
    { ate: 1028, taxa: 0.0872, parcela: { coef: 0.0872, mult: 2.6, ref: 1356.92 }, parcelaDep: 34.29 },
    { ate: 1099, taxa: 0.1204, parcela: { coef: 0.1204, mult: 1.35, ref: 1696.78 }, parcelaDep: 34.29 },
    { ate: 1201, taxa: 0.1204, parcela: 97.17, parcelaDep: 34.29 },
    { ate: 1623, taxa: 0.1763, parcela: 164.31, parcelaDep: 34.29 },
    { ate: 2332, taxa: 0.223, parcela: 240.11, parcelaDep: 34.29 },
    { ate: 3203, taxa: 0.2242, parcela: 242.91, parcelaDep: 34.29 },
    { ate: 3614, taxa: 0.237, parcela: 283.91, parcelaDep: 34.29 },
    { ate: 6585, taxa: 0.3028, parcela: 521.72, parcelaDep: 34.29 },
    { ate: 6954, taxa: 0.2802, parcela: 372.9, parcelaDep: 34.29 },
    { ate: 21411, taxa: 0.2924, parcela: 457.74, parcelaDep: 34.29 },
    { ate: null, taxa: 0.3278, parcela: 1215.69, parcelaDep: 34.29 },
  ] },
  { id: 'III', descricao: 'Casado, único titular', linhas: [
    { ate: 997, taxa: 0, parcela: 0.0, parcelaDep: 0 },
    { ate: 1099, taxa: 0.0872, parcela: { coef: 0.0872, mult: 1.35, ref: 1819.64 }, parcelaDep: 42.86 },
    { ate: 1141, taxa: 0.0872, parcela: 84.84, parcelaDep: 42.86 },
    { ate: 1857, taxa: 0.1033, parcela: 103.22, parcelaDep: 42.86 },
    { ate: 2485, taxa: 0.1091, parcela: 114.0, parcelaDep: 42.86 },
    { ate: 3331, taxa: 0.1236, parcela: 150.04, parcelaDep: 42.86 },
    { ate: 3895, taxa: 0.1404, parcela: 206.01, parcelaDep: 42.86 },
    { ate: 6673, taxa: 0.1595, parcela: 280.41, parcelaDep: 42.86 },
    { ate: 6878, taxa: 0.2213, parcela: 692.81, parcelaDep: 42.86 },
    { ate: 21411, taxa: 0.2493, parcela: 885.4, parcelaDep: 42.86 },
    { ate: null, taxa: 0.3278, parcela: 2566.17, parcelaDep: 42.86 },
  ] },
  { id: 'IV', descricao: 'Não casado ou casado dois titulares sem dependentes - Pessoa com deficiência', linhas: [
    { ate: 2053, taxa: 0, parcela: 0.0, parcelaDep: 0 },
    { ate: 2591, taxa: 0.149, parcela: 305.9, parcelaDep: 0 },
    { ate: 3622, taxa: 0.1863, parcela: 402.55, parcelaDep: 0 },
    { ate: 4668, taxa: 0.2289, parcela: 556.85, parcelaDep: 0 },
    { ate: 7066, taxa: 0.2616, parcela: 709.5, parcelaDep: 0 },
    { ate: 7168, taxa: 0.2752, parcela: 805.6, parcelaDep: 0 },
    { ate: 21625, taxa: 0.3058, parcela: 1024.95, parcelaDep: 0 },
    { ate: null, taxa: 0.3278, parcela: 1500.7, parcelaDep: 0 },
  ] },
  { id: 'V', descricao: 'Não casado com um ou mais dependentes - Pessoa com deficiência', linhas: [
    { ate: 2345, taxa: 0, parcela: 0.0, parcelaDep: 0 },
    { ate: 2591, taxa: 0.1382, parcela: 324.08, parcelaDep: 42.86 },
    { ate: 3622, taxa: 0.1863, parcela: 448.71, parcelaDep: 42.86 },
    { ate: 4668, taxa: 0.2289, parcela: 603.01, parcelaDep: 42.86 },
    { ate: 7066, taxa: 0.2616, parcela: 755.66, parcelaDep: 42.86 },
    { ate: 7168, taxa: 0.2752, parcela: 851.76, parcelaDep: 42.86 },
    { ate: 21625, taxa: 0.3058, parcela: 1071.11, parcelaDep: 42.86 },
    { ate: null, taxa: 0.3278, parcela: 1546.86, parcelaDep: 42.86 },
  ] },
  { id: 'VI', descricao: 'Casado dois titulares com um ou mais dependentes - Pessoa com deficiência', linhas: [
    { ate: 2019, taxa: 0, parcela: 0.0, parcelaDep: 0 },
    { ate: 2528, taxa: 0.1566, parcela: 316.18, parcelaDep: 21.43 },
    { ate: 3049, taxa: 0.1768, parcela: 367.25, parcelaDep: 21.43 },
    { ate: 4272, taxa: 0.1781, parcela: 371.22, parcelaDep: 21.43 },
    { ate: 5734, taxa: 0.228, parcela: 584.4, parcelaDep: 21.43 },
    { ate: 7066, taxa: 0.2595, parcela: 765.03, parcelaDep: 21.43 },
    { ate: 7550, taxa: 0.2752, parcela: 875.97, parcelaDep: 21.43 },
    { ate: 21625, taxa: 0.3058, parcela: 1107.0, parcelaDep: 21.43 },
    { ate: null, taxa: 0.3278, parcela: 1582.75, parcelaDep: 21.43 },
  ] },
  { id: 'VII', descricao: 'Casado, único titular - Pessoa com deficiência', linhas: [
    { ate: 3061, taxa: 0, parcela: 0.0, parcelaDep: 0 },
    { ate: 4668, taxa: 0.0883, parcela: 270.29, parcelaDep: 42.86 },
    { ate: 7066, taxa: 0.1334, parcela: 480.82, parcelaDep: 42.86 },
    { ate: 7168, taxa: 0.2503, parcela: 1306.84, parcelaDep: 42.86 },
    { ate: 21625, taxa: 0.281, parcela: 1526.9, parcelaDep: 42.86 },
    { ate: null, taxa: 0.3278, parcela: 2538.95, parcelaDep: 42.86 },
  ] },
];

// Açores 2026: sem fonte oficial localizada — null ativa o modo estimativa no motor.
export const TABELAS_RF_ACORES_2026: TabelaRetencao[] | null = null;

export const TABELAS_RF_2026: Record<RegiaoRF, TabelaRetencao[] | null> = {
  continente: TABELAS_RF_CONTINENTE_2026,
  madeira: TABELAS_RF_MADEIRA_2026,
  acores: TABELAS_RF_ACORES_2026,
};
