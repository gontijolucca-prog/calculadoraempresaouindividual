export type Regime = 'geral' | 'madeira' | 'acores' | 'interioridade' | 'startup';
export type Territorio = 'continental' | 'madeira' | 'acores';
export type FuelType = 'convencional' | 'plug_in' | 'plug_in_5050' | 'gnv' | 'eletrico';

export interface ViaturaRow {
  id: string;
  ano: number;
  combustivel: FuelType;
  custoHistorico: number;
  encargos: number;
}

export interface PreviSaState {
  nif: string;
  designacao: string;
  regime: Regime;
  isPME: boolean;
  isStartup: boolean;
  periodo: number;
  territorio: Territorio;
  volumeNegocios: number;
  c701_rai: number;
  c702: number; c703: number; c704: number; c705: number; c706: number; c707: number;
  c708_override: boolean;
  c709: number; c710: number; c711: number; c712: number; c713: number;
  c714: number; c715: number; c716: number; c717: number; c718: number;
  c719: number; c720: number; c721: number; c722: number; c723: number;
  c724: number; c725: number; c726: number; c727: number; c728: number;
  c729: number; c730: number; c731: number; c732: number; c733: number;
  c734: number; c735: number; c736: number; c737: number; c738: number;
  c739: number; c740: number; c741: number; c742: number; c743: number;
  c744: number; c745: number; c746: number; c747: number; c748: number;
  c749: number; c750: number; c751: number; c752: number;
  c754: number; c755: number; c756: number; c757: number; c758: number;
  c759: number; c760: number; c761: number; c762: number; c763: number;
  c764: number; c765: number; c766: number; c767: number; c768: number;
  c769: number; c770: number; c771: number; c772: number; c773: number;
  c774: number; c775: number;
  prejuizosDeduzir: number;
  limiteMaisPP: boolean;
  beneficiosFiscais: number;
  viaturas: ViaturaRow[];
  ta_despNaoDocPrincipal: number;
  ta_despNaoDocNaoPrincipal: number;
  ta_representacao: number;
  ta_ajadasCusto: number;
  ta_lucrosDistribuidos: number;
  ta_offshores: number;
  ta_indemCessacao: number;
  ta_bonus: number;
  agravamentoTA: boolean;
  retencoesFonte: number;
  pecPagamentos: number;
  pcPagamentos: number;
  pagamentosAdicionais: number;
}

export function defaultPreviSaState(): PreviSaState {
  return {
    nif: '', designacao: '', regime: 'geral', isPME: true, isStartup: false,
    periodo: new Date().getFullYear() - 1, territorio: 'continental', volumeNegocios: 0,
    c701_rai: 0, c702: 0, c703: 0, c704: 0, c705: 0, c706: 0, c707: 0, c708_override: false,
    c709: 0, c710: 0, c711: 0, c712: 0, c713: 0, c714: 0, c715: 0, c716: 0, c717: 0, c718: 0,
    c719: 0, c720: 0, c721: 0, c722: 0, c723: 0, c724: 0, c725: 0, c726: 0, c727: 0, c728: 0,
    c729: 0, c730: 0, c731: 0, c732: 0, c733: 0, c734: 0, c735: 0, c736: 0, c737: 0, c738: 0,
    c739: 0, c740: 0, c741: 0, c742: 0, c743: 0, c744: 0, c745: 0, c746: 0, c747: 0, c748: 0,
    c749: 0, c750: 0, c751: 0, c752: 0,
    c754: 0, c755: 0, c756: 0, c757: 0, c758: 0, c759: 0, c760: 0, c761: 0, c762: 0, c763: 0,
    c764: 0, c765: 0, c766: 0, c767: 0, c768: 0, c769: 0, c770: 0, c771: 0, c772: 0, c773: 0,
    c774: 0, c775: 0,
    prejuizosDeduzir: 0, limiteMaisPP: false, beneficiosFiscais: 0,
    viaturas: [], ta_despNaoDocPrincipal: 0, ta_despNaoDocNaoPrincipal: 0,
    ta_representacao: 0, ta_ajadasCusto: 0, ta_lucrosDistribuidos: 0,
    ta_offshores: 0, ta_indemCessacao: 0, ta_bonus: 0, agravamentoTA: false,
    retencoesFonte: 0, pecPagamentos: 0, pcPagamentos: 0, pagamentosAdicionais: 0,
  };
}
