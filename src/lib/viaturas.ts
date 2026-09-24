/**
 * Motor de cálculo de Viaturas — extraído do VehicleSimulator para uma função
 * pura (testável). IVA dedutível por motor/atividade (CIVA art.21), limites de
 * depreciação fiscal e Tributação Autónoma de ligeiros de passageiros (CIRC art.88).
 *
 * ⚠ Valores a confirmar por um contabilista — ver docs/AUDITORIA-FISCAL-PENDENTE.md.
 */

export type ViaturaEngineType = 'diesel' | 'gasoline' | 'hybrid' | 'phev' | 'electric' | 'hydrogen' | 'lpg' | 'cng';
export type ViaturaCategory = 'comercial' | 'comercial_n1' | 'passageiros' | 'moto';
export type RegimeTributario = 'irc' | 'irs';
export interface ViaturaInput {
  category: ViaturaCategory | string;
  engineType: ViaturaEngineType | string;
  price: number;
  ivaRegime: string;
  activity: string;   // other/goods/public_transport/rent_a_car/driving_school/tvde
  maintenanceCost: number;
  insuranceCost: number;
  fuelCost: number;
  exemptTA: boolean;
  phevCompliant: boolean;
  agravamentoTA?: boolean;
  co2Emissions?: number;
  autonomiaEletrica?: number;
  cilindrada?: number;
  usoPercentagem?: number;
  duracaoMeses?: number;
  valorResidual?: number;
  anoAquisicao?: number;
  euro6eBis?: boolean; // PHEV Euro 6e-bis <80g
  rentingDiscriminada?: boolean; // fatura renting separada
  regimeTributario?: RegimeTributario; // irc (empresa) vs irs (recibos verdes)
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
  ivaADevolverUsoPrivado?: number;
  regimeAplicado: RegimeTributario;
}

export function calcViatura(s: ViaturaInput): ViaturaResult {
  const { category, engineType, price, ivaRegime, activity, maintenanceCost, insuranceCost, fuelCost, exemptTA, phevCompliant: phevCompliantRaw, co2Emissions, autonomiaEletrica, euro6eBis, rentingDiscriminada, regimeTributario, usoPercentagem } = s;
  const regime: RegimeTributario = regimeTributario === 'irs' ? 'irs' : 'irc';
  // PHEV Euro 6e-bis 2026: <50g +50km OU (<80g + Euro6e-bis)
  const phevAuto = co2Emissions != null && autonomiaEletrica != null ? ((co2Emissions < 50 && autonomiaEletrica >= 50) || !!(euro6eBis && co2Emissions < 80)) : undefined;
  const phevCompliant = phevAuto ?? phevCompliantRaw;
  const isGnv = engineType === 'cng';
  const isMoto = category === 'moto';
  const isComercialN1 = category === 'comercial_n1';
  const isComercialIsento = category === 'comercial' && !isMoto && !isComercialN1; // 2-3 lugares caixa fechada/Tabela B
  const isTvde = activity === 'tvde';

  const maintBase = maintenanceCost / 1.23;
  const maintIva = maintenanceCost - maintBase;

  const fuelBase = fuelCost / 1.23;
  const fuelIva = fuelCost - fuelBase;

  const isExemptActivityIva = ['public_transport', 'rent_a_car', 'driving_school', 'tvde'].includes(activity) || (activity === 'tvde');
  // TVDE: aquisição é dedutível (objeto de atividade), mas combustível segue regra geral

  let ivaAquisicaoDedRate = 0;
  const totalIvaAquisicao = price * 0.23;

  if (ivaRegime === 'normal') {
    if (isExemptActivityIva) {
      ivaAquisicaoDedRate = 1;
    } else if (category === 'passageiros' || isComercialN1 || isMoto) {
      if (engineType === 'electric' || engineType === 'hydrogen') ivaAquisicaoDedRate = price <= 62500 ? 1 : 0;
      else if (engineType === 'phev' && phevCompliant) ivaAquisicaoDedRate = price <= 50000 ? 1 : 0;
      else if (isGnv || engineType === 'lpg') ivaAquisicaoDedRate = price <= 37500 ? 0.5 : 0;
    } else if (isComercialIsento) {
      if (['electric', 'hydrogen', 'phev', 'lpg', 'cng'].includes(engineType)) ivaAquisicaoDedRate = 1;
      else if (engineType === 'diesel') ivaAquisicaoDedRate = 0.5;
    }
  }
  // Renting: se fatura não discriminada, nada é dedutível
  if (ivaRegime === 'leasing' && rentingDiscriminada === false) ivaAquisicaoDedRate = 0;
  const ivaAquisicaoDedutivel = totalIvaAquisicao * ivaAquisicaoDedRate;

  let maintIvaDedRate = 0;
  if (isExemptActivityIva || isComercialIsento) {
    maintIvaDedRate = 1;
  } else if (isTvde) {
    maintIvaDedRate = 1; // TVDE objeto de atividade
  }
  if (ivaRegime === 'leasing' && rentingDiscriminada === false) maintIvaDedRate = 0;
  const ivaRecupManutencao = maintIva * maintIvaDedRate;

  let fuelIvaDedRate = 0;
  const isExemptFuel = ['public_transport'].includes(activity) || (activity === 'goods' && isComercialIsento);
  if (isExemptFuel) {
    fuelIvaDedRate = 1;
  } else if (isTvde) {
    // TVDE: gasóleo/GPL 50%, gasolina 0%, elétrico 100%
    if (engineType === 'electric' || engineType === 'hydrogen') fuelIvaDedRate = 1;
    else if (['diesel', 'lpg', 'cng'].includes(engineType)) fuelIvaDedRate = 0.5;
    else fuelIvaDedRate = 0;
  } else {
    if (engineType === 'electric' || engineType === 'hydrogen') fuelIvaDedRate = 1;
    else if (['diesel', 'lpg', 'cng'].includes(engineType)) fuelIvaDedRate = 0.5;
    else if (engineType === 'phev') fuelIvaDedRate = 0;
  }
  const ivaRecupCombustivel = fuelIva * fuelIvaDedRate;

  const ivaTotalDedutivel = ivaAquisicaoDedutivel + ivaRecupManutencao + ivaRecupCombustivel;

  let limit = 25000;
  const phevValid = engineType === 'phev' && phevCompliant;

  if (engineType === 'electric' || engineType === 'hydrogen') limit = 62500;
  else if (phevValid) limit = 50000;
  else if (isGnv || engineType === 'lpg') limit = 37500;

  const isExemptTAActivity = ['public_transport', 'rent_a_car', 'driving_school'].includes(activity);
  if (isExemptTAActivity) limit = Infinity;
  if (isComercialIsento) limit = Infinity;

  const depAnualTotal = price * 0.25;
  const depAceite = limit === Infinity ? depAnualTotal : Math.min(price, limit) * 0.25;
  const depNaoAceite = Math.max(0, depAnualTotal - depAceite);

  let taRate = 0;
  let taValue = 0;

  const maintCustoFinal = maintenanceCost - ivaRecupManutencao;
  const insCustoFinal = insuranceCost;
  const fuelCustoFinal = fuelCost - ivaRecupCombustivel;
  const totalEncsTA = depAnualTotal + maintCustoFinal + insCustoFinal + fuelCustoFinal;
  const usoFactor = (usoPercentagem ?? 100) / 100;
  const totalEncsTAUso = totalEncsTA * usoFactor;
  const ivaADevolverUsoPrivado = totalIvaAquisicao * (1 - usoFactor) * 0.23; // simplificado: IVA proporcional ao uso privado

  const isTASubject = category === 'passageiros' || isComercialN1 || isMoto;
  if (isTASubject) {
    if (exemptTA || isComercialIsento) {
      taRate = 0;
    } else if (regime === 'irs') {
      // IRS categoria B: 2 escalões, elétrico sempre isento, GPL e GNV mesma taxa reduzida
      if (engineType === 'electric' || engineType === 'hydrogen') {
        taRate = 0;
      } else if (phevValid) {
        taRate = price < 30000 ? 0.05 : 0.10;
      } else if (isGnv || engineType === 'lpg') {
        taRate = price < 30000 ? 0.075 : 0.15;
      } else {
        taRate = price < 30000 ? 0.10 : 0.20;
      }
    } else {
      // IRC: 3 escalões; PHEV e GNV reduzidas; elétrico 10% acima 62.5k
      if (engineType === 'electric' || engineType === 'hydrogen') {
        taRate = price > 62500 ? 0.10 : 0;
      } else if (phevValid || isGnv) {
        taRate = price < 37500 ? 0.025 : (price < 45000 ? 0.075 : 0.15);
      } else {
        taRate = price < 37500 ? 0.08 : (price < 45000 ? 0.25 : 0.32);
      }
      if (s.agravamentoTA && taRate > 0) taRate += 0.10;
    }
    taValue = totalEncsTAUso * taRate;
  } else if (!isComercialIsento) {
    taValue = 0;
  }

  const isElecTaxed = (engineType === 'electric' || engineType === 'hydrogen') && price > 62500 && !exemptTA && regime === 'irc';
  return {
    ivaAquisicaoDedutivel,
    ivaRecupManutencao,
    ivaRecupCombustivel,
    ivaTotalDedutivel,
    taRate,
    taValue,
    depNaoAceite,
    limit,
    totalEncsTA: totalEncsTAUso,
    isElecTaxed,
    ivaADevolverUsoPrivado: usoFactor < 1 ? ivaADevolverUsoPrivado : 0,
    regimeAplicado: regime,
  };
}
