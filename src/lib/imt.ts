/**
 * IMT — Imposto Municipal sobre Transmissões Onerosas de Imóveis
 * CIMT (Código do IMT) — valores actualizados OE 2026
 * Imposto de Selo: TGIS verba 1.1 — 0.8% sobre o valor
 */

export type TipoImovel =
  | 'hpp'           // Habitação Própria e Permanente
  | 'habitacao'     // Habitação (secundária/investimento)
  | 'urbano_outros' // Prédios Urbanos - outros fins
  | 'rustico'       // Prédios Rústicos
  | 'outros';       // Outros / genérico

export type Localizacao = 'continente' | 'madeira' | 'acores';

export interface IMTEscalao {
  limite: number;
  taxa: number;
  deducao: number | null; // null = taxa plana (sem escalão progressivo)
}

export interface IMTResult {
  imt: number;
  impostoSelo: number;
  total: number;
  taxaAplicada: number;
  isento: boolean;
  isentoJovem: boolean;
  descricao: string;
}

// HPP — Habitação Própria e Permanente (Continente) — CIMT Art. 17º, OE 2026
const IMT_HPP_CONTINENTE: IMTEscalao[] = [
  { limite: 106346,   taxa: 0,     deducao: 0 },
  { limite: 145470,   taxa: 0.02,  deducao: 2126.92 },
  { limite: 198347,   taxa: 0.05,  deducao: 6491.02 },
  { limite: 330539,   taxa: 0.07,  deducao: 10457.96 },
  { limite: 660982,   taxa: 0.08,  deducao: 13763.35 },
  { limite: 1150853,  taxa: 0.06,  deducao: null },
  { limite: Infinity, taxa: 0.075, deducao: null },
];

// Habitação Secundária / Arrendamento / Outros fins não-HPP (Continente) — CIMT Art. 17º
const IMT_HABITACAO_SECUNDARIA: IMTEscalao[] = [
  { limite: 97064,    taxa: 0.01,  deducao: 0 },
  { limite: 132774,   taxa: 0.02,  deducao: 971.18 },
  { limite: 181034,   taxa: 0.05,  deducao: 4954.55 },
  { limite: 301688,   taxa: 0.07,  deducao: 8578.41 },
  { limite: 603289,   taxa: 0.08,  deducao: 11594.88 },
  { limite: 1050400,  taxa: 0.06,  deducao: null },
  { limite: Infinity, taxa: 0.075, deducao: null },
];

// Multiplicadores regionais (Madeira e Açores têm limites 25% superiores)
const MULTIPLICADOR_REGIONAL: Record<Localizacao, number> = {
  continente: 1.0,
  madeira: 1.25,
  acores: 1.25,
};

function calcIMTProgressivo(valor: number, tabela: IMTEscalao[]): number {
  for (const escalao of tabela) {
    if (valor <= escalao.limite) {
      if (escalao.deducao === null) {
        // taxa plana
        return valor * escalao.taxa;
      }
      return Math.max(0, valor * escalao.taxa - escalao.deducao);
    }
  }
  return 0;
}

function ajustarTabela(tabela: IMTEscalao[], mult: number): IMTEscalao[] {
  return tabela.map(e => ({
    ...e,
    limite: e.limite === Infinity ? Infinity : e.limite * mult,
  }));
}

/**
 * Calcula o IMT e Imposto de Selo sobre a aquisição de um imóvel.
 *
 * @param valor Valor de aquisição (€)
 * @param tipo Tipo de imóvel
 * @param localizacao Continente, Madeira ou Açores
 * @param primeiraHabitacao Se é a primeira habitação do comprador (HPP)
 * @param idadeComprador Idade do comprador (para IMT Jovem)
 * @returns IMTResult
 */
export function calcIMT(
  valor: number,
  tipo: TipoImovel,
  localizacao: Localizacao,
  primeiraHabitacao: boolean,
  idadeComprador: number
): IMTResult {
  if (valor <= 0) {
    return { imt: 0, impostoSelo: 0, total: 0, taxaAplicada: 0, isento: false, isentoJovem: false, descricao: '' };
  }

  const mult = MULTIPLICADOR_REGIONAL[localizacao];
  const jovem = idadeComprador <= 35 && primeiraHabitacao && tipo === 'hpp';

  // Prédios rústicos: taxa plana 5%
  if (tipo === 'rustico') {
    const imt = valor * 0.05;
    const impostoSelo = valor * 0.008;
    return {
      imt, impostoSelo, total: imt + impostoSelo,
      taxaAplicada: 0.05, isento: false, isentoJovem: false,
      descricao: 'Prédio rústico — taxa plana 5% (CIMT Art. 17º)',
    };
  }

  // Prédios urbanos outros fins: taxa plana 6.5%
  if (tipo === 'urbano_outros') {
    const imt = valor * 0.065;
    const impostoSelo = valor * 0.008;
    return {
      imt, impostoSelo, total: imt + impostoSelo,
      taxaAplicada: 0.065, isento: false, isentoJovem: false,
      descricao: 'Prédio urbano (outros fins) — taxa plana 6,5% (CIMT Art. 17º)',
    };
  }

  // Outros
  if (tipo === 'outros') {
    const imt = valor * 0.065;
    const impostoSelo = valor * 0.008;
    return {
      imt, impostoSelo, total: imt + impostoSelo,
      taxaAplicada: 0.065, isento: false, isentoJovem: false,
      descricao: 'Outros — taxa plana 6,5% (CIMT Art. 17º)',
    };
  }

  // HPP — Habitação Própria e Permanente
  if (tipo === 'hpp') {
    const tabela = ajustarTabela(IMT_HPP_CONTINENTE, mult);
    const limiteIsencaoJovem = 330539 * mult;
    const limiteReducaoJovem = 660982 * mult;

    if (jovem) {
      // IMT Jovem — CIMT Art. 11º-A (OE 2026)
      if (valor <= limiteIsencaoJovem) {
        // Total isenção
        return {
          imt: 0, impostoSelo: 0, total: 0,
          taxaAplicada: 0, isento: true, isentoJovem: true,
          descricao: `Isento IMT Jovem — valor ≤ ${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(limiteIsencaoJovem)} (CIMT Art. 11º-A)`,
        };
      }
      if (valor <= limiteReducaoJovem) {
        // IMT só sobre o excedente a €330.539 × mult, à taxa do escalão correspondente
        const excedente = valor - limiteIsencaoJovem;
        const imt = Math.max(0, excedente * 0.08 - (limiteIsencaoJovem * 0.08 - 13763.35 * mult));
        const imtFinal = Math.max(0, excedente * 0.08 - (13763.35 * mult - limiteIsencaoJovem * 0));
        // Simplified: IMT = (valor - limiteIsencao) × 8% - (deducao_proporcional)
        // Mais correcto: IMT_total(valor) - IMT_total(limiteIsencao) mas IMT(limiteIsencao)=0
        const imtNormal = calcIMTProgressivo(valor, tabela);
        const imtLimite = calcIMTProgressivo(limiteIsencaoJovem, tabela);
        const imtJovem = Math.max(0, imtNormal - imtLimite);
        return {
          imt: imtJovem, impostoSelo: 0, total: imtJovem,
          taxaAplicada: 0.08, isento: false, isentoJovem: true,
          descricao: `IMT Jovem — redução parcial (excedente a ${new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(limiteIsencaoJovem)}). IS também isento.`,
        };
      }
      // Acima do tecto jovem: IMT e IS normais
    }

    const imt = calcIMTProgressivo(valor, tabela);
    const impostoSelo = jovem ? 0 : valor * 0.008;
    const taxaEscalao = tabela.find(e => valor <= e.limite);
    return {
      imt, impostoSelo, total: imt + impostoSelo,
      taxaAplicada: taxaEscalao?.taxa ?? 0,
      isento: imt === 0,
      isentoJovem: jovem,
      descricao: primeiraHabitacao ? 'HPP — Habitação Própria e Permanente (CIMT Art. 17º, n.º 1)' : 'HPP — escalões progressivos',
    };
  }

  // Habitação secundária / arrendamento
  const tabela = ajustarTabela(IMT_HABITACAO_SECUNDARIA, mult);
  const imt = calcIMTProgressivo(valor, tabela);
  const impostoSelo = valor * 0.008;
  const taxaEscalao = tabela.find(e => valor <= e.limite);
  return {
    imt, impostoSelo, total: imt + impostoSelo,
    taxaAplicada: taxaEscalao?.taxa ?? 0,
    isento: false, isentoJovem: false,
    descricao: 'Habitação (secundária / investimento) — escalões progressivos (CIMT Art. 17º, n.º 2)',
  };
}
