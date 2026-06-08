/**
 * Motor de cálculo de Viaturas — extraído do VehicleSimulator para uma função
 * pura (testável). IVA dedutível por motor/atividade (CIVA art.21), limites de
 * depreciação fiscal e Tributação Autónoma de ligeiros de passageiros (CIRC art.88).
 *
 * ⚠ Valores a confirmar pela Sandrine — ver docs/AUDITORIA-FISCAL-PENDENTE.md.
 */

export interface ViaturaInput {
  category: 'comercial' | 'passageiros';
  engineType: string; // diesel/gasoline/hybrid/phev/electric/lpg/cng
  price: number;
  ivaRegime: string;  // normal/second_hand/leasing
  activity: string;   // other/goods/public_transport/rent_a_car/driving_school
  maintenanceCost: number;
  insuranceCost: number;
  fuelCost: number;
  exemptTA: boolean;
  phevCompliant: boolean;
  /** Empresa com prejuízo fiscal → TA agravada em +10 p.p. (CIRC art.88 n.14). */
  agravamentoTA?: boolean;
}

export interface ViaturaResult {
  ivaAquisicaoDedutivel: number;
  ivaRecupManutencao: number;
  ivaRecupCombustivel: number;
  ivaTotalDedutivel: number;
  taRate: number;
  taValue: number;
  depNaoAceite: number;
  limit: number;
  totalEncsTA: number;
  isElecTaxed: boolean;
}

export function calcViatura(s: ViaturaInput): ViaturaResult {
  const { category, engineType, price, ivaRegime, activity, maintenanceCost, insuranceCost, fuelCost, exemptTA, phevCompliant } = s;

  const maintBase = maintenanceCost / 1.23;
  const maintIva = maintenanceCost - maintBase;

  const fuelBase = fuelCost / 1.23;
  const fuelIva = fuelCost - fuelBase;

  const isExemptActivity = ['public_transport', 'rent_a_car', 'driving_school'].includes(activity);

  let ivaAquisicaoDedRate = 0;
  const totalIvaAquisicao = price * 0.23;

  if (ivaRegime === 'normal') {
    if (isExemptActivity) {
      ivaAquisicaoDedRate = 1;
    } else if (category === 'passageiros') {
      if (engineType === 'electric') ivaAquisicaoDedRate = price <= 62500 ? 1 : 0;
      else if (engineType === 'phev' && phevCompliant) ivaAquisicaoDedRate = price <= 50000 ? 1 : 0;
      else if (['lpg', 'cng'].includes(engineType)) ivaAquisicaoDedRate = price <= 37500 ? 0.5 : 0;
    } else if (category === 'comercial') {
      if (['electric', 'phev', 'lpg', 'cng'].includes(engineType)) ivaAquisicaoDedRate = 1;
      else if (engineType === 'diesel') ivaAquisicaoDedRate = 0.5;
    }
  }
  const ivaAquisicaoDedutivel = totalIvaAquisicao * ivaAquisicaoDedRate;

  let maintIvaDedRate = 0;
  if (isExemptActivity || category === 'comercial') {
    maintIvaDedRate = 1;
  }
  const ivaRecupManutencao = maintIva * maintIvaDedRate;

  let fuelIvaDedRate = 0;
  if (isExemptActivity || (activity === 'goods' && category === 'comercial')) {
    fuelIvaDedRate = 1;
  } else {
    if (engineType === 'electric') fuelIvaDedRate = 1;
    else if (['diesel', 'lpg', 'cng'].includes(engineType)) fuelIvaDedRate = 0.5;
    else if (engineType === 'phev') fuelIvaDedRate = 0;
  }
  const ivaRecupCombustivel = fuelIva * fuelIvaDedRate;

  const ivaTotalDedutivel = ivaAquisicaoDedutivel + ivaRecupManutencao + ivaRecupCombustivel;

  let limit = 25000;
  const phevValid = engineType === 'phev' && phevCompliant;

  if (engineType === 'electric') limit = 62500;
  else if (phevValid) limit = 50000;
  else if (['lpg', 'cng'].includes(engineType)) limit = 37500;

  if (isExemptActivity) limit = Infinity;

  const depAnualTotal = price * 0.25;
  const depAceite = limit === Infinity ? depAnualTotal : Math.min(price, limit) * 0.25;
  const depNaoAceite = Math.max(0, depAnualTotal - depAceite);

  let taRate = 0;
  let taValue = 0;

  const maintCustoFinal = maintenanceCost - ivaRecupManutencao;
  const insCustoFinal = insuranceCost;
  const fuelCustoFinal = fuelCost - ivaRecupCombustivel;
  const totalEncsTA = depAnualTotal + maintCustoFinal + insCustoFinal + fuelCustoFinal;

  if (category === 'passageiros') {
    if (exemptTA) {
      taRate = 0;
    } else {
      // Tributação Autónoma — viaturas ligeiras de passageiros (CIRC Art. 88º n.os 3-4, OE 2026).
      // Limites de aquisição €37.500 e €45.000. Convencionais 8/25/32%; PHEV 2,5/7,5/15%;
      // elétricos isentos até €62.500 e 10% acima.
      if (engineType === 'electric') {
        taRate = price >= 62500 ? 0.10 : 0;
      } else if (phevValid) {
        taRate = price < 37500 ? 0.025 : (price < 45000 ? 0.075 : 0.15);
      } else {
        taRate = price < 37500 ? 0.08 : (price < 45000 ? 0.25 : 0.32);
      }
      // Agravamento de +10 pontos percentuais com prejuízo fiscal (CIRC art.88 n.14).
      if (s.agravamentoTA && taRate > 0) taRate += 0.10;
    }
    taValue = totalEncsTA * taRate;
  }

  return {
    ivaAquisicaoDedutivel,
    ivaRecupManutencao,
    ivaRecupCombustivel,
    ivaTotalDedutivel,
    taRate,
    taValue,
    depNaoAceite,
    limit,
    totalEncsTA,
    isElecTaxed: engineType === 'electric' && price >= 62500 && !exemptTA,
  };
}
