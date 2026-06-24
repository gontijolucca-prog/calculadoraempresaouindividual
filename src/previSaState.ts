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
  // ── Identificação ────────────────────────────────────────────────
  nif: string;
  designacao: string;
  regime: Regime;
  isPME: boolean;
  isStartup: boolean;
  periodo: number;
  territorio: Territorio;
  volumeNegocios: number;
  // ── Rendimentos (para calcular RAI automaticamente) ───────────────
  useRaiCalc: boolean;    // true = calcular RAI a partir dos rendimentos/gastos
  rai_711: number;        // 711 Vendas de mercadorias
  rai_712: number;        // 712 Vendas de produtos
  rai_72: number;         // 72 Prestações de serviços
  rai_74: number;         // 74 Trabalhos p/ própria entidade
  rai_75: number;         // 75 Subsídios à exploração
  rai_76: number;         // 76 Reversões
  rai_77: number;         // 77 Ganhos por aumentos de JV
  rai_78: number;         // 78 Outros Rendimentos
  rai_79: number;         // 79 Juros, Dividendos e outros
  rai_cmv: number;        // CMV — Custo das Mercadorias Vendidas
  rai_cmc: number;        // CMC — Custo das Matérias Consumidas
  rai_62: number;         // 62 FSE — Fornecimentos e serviços externos
  rai_63: number;         // 63 Gastos com Pessoal
  rai_64: number;         // 64 Depreciações e amortizações
  rai_65: number;         // 65 Perdas por imparidade
  rai_66: number;         // 66 Perdas por reduções de JV
  rai_67: number;         // 67 Provisões
  rai_68: number;         // 68 Outros gastos
  rai_69: number;         // 69 Gastos de financiamento
  rai_8122_db: number;    // 8122 Imposto diferido — Débito (+)
  rai_8122_cr: number;    // 8122 Imposto diferido — Crédito (-)
  // ── Q07 — ponto de partida c708 ──────────────────────────────────
  c701_rai: number;       // RAI (manual ou calculado)
  c702: number;           // Variações patrimoniais + (a acrescer)
  c703: number;           // Variações patrimoniais + regimes transitórios
  c805: number;           // Variações + mensuração passivos contratos seguros (OE2024)
  c704: number;           // Variações patrimoniais - (a deduzir)
  c705: number;           // Variações patrimoniais - regimes transitórios
  c806: number;           // Variações - mensuração passivos contratos seguros (OE2024)
  c706: number;           // Alteração regime contratos construção (+)
  c707: number;           // Alteração regime contratos construção (-)
  c708_override: boolean; // ignorar cálculo automático de 708
  // ── Q07 A Acrescer ───────────────────────────────────────────────
  c709: number; c710: number; c711: number; c782: number; c712: number;
  c713: number; c714: number; c715: number; c717: number; c721: number;
  c724: number; c725: number; c716: number; c731: number; c726: number;
  c783: number; c728: number; c727: number; c729: number; c730: number;
  c732: number; c733: number; c784: number; c734: number; c735: number;
  c780: number; c785: number; c802: number; c746: number; c737: number;
  c786: number; c718: number; c719: number; c720: number; c722: number;
  c723: number; c736: number; c738: number; c739: number; c740: number;
  c741: number; c742: number; c743: number; c787: number; c744: number;
  c745: number; c747: number; c748: number; c749: number; c788: number;
  c750: number; c789: number; c790: number; c751: number; c803: number;
  c779: number; c797: number; c799: number; c804: number; c752: number;
  // ── Q07 A Deduzir ────────────────────────────────────────────────
  c754: number; c755: number; c756: number; c757: number; c791: number;
  c758: number; c759: number; c760: number; c761: number; c762: number;
  c763: number; c781: number; c764: number; c765: number; c766: number;
  c792: number; c767: number; c768: number; c769: number; c770: number;
  c793: number; c771: number; c794: number; c772: number; c795: number;
  c773: number; c796: number; c774: number; c800: number; c801: number;
  c798: number; c775: number;
  // ── Q09 — Prejuízos por ano ──────────────────────────────────────
  prej_ate2017: number;   // 2014 a 2017 (agrupados)
  prej_2018: number;
  prej_2019: number;
  prej_2020: number;
  prej_2021: number;
  prej_2022: number;
  prej_2023: number;
  prej_2024: number;
  // ── Prejuízos discriminados por ano (Sandrine 11-jun 11:02) ─────────
  // Estrutura por ano de origem: apurado, já deduzido, elegível.
  // Saldo = apurado − deduzido. Mantém-se a discriminação mesmo quando o
  // painel principal mostra apenas o total.
  prej_ate2017_deduzido: number;
  prej_2018_deduzido: number;
  prej_2019_deduzido: number;
  prej_2020_deduzido: number;
  prej_2021_deduzido: number;
  prej_2022_deduzido: number;
  prej_2023_deduzido: number;
  prej_2024_deduzido: number;
  prej_2018_elegivel: boolean;
  prej_2019_elegivel: boolean;
  prej_2020_elegivel: boolean;
  prej_2021_elegivel: boolean;
  prej_2022_elegivel: boolean;
  prej_2023_elegivel: boolean;
  prej_2024_elegivel: boolean;
  prej_2018_obs: string;
  prej_2019_obs: string;
  prej_2020_obs: string;
  prej_2021_obs: string;
  prej_2022_obs: string;
  prej_2023_obs: string;
  prej_2024_obs: string;
  // ── Saldos por regime (Sandrine 11-jun: regra 3 — separar regimes) ──
  prej_regimeGeral: number;          // prejuízos regime geral
  prej_reducaoTaxa: number;          // atividade c/ redução de taxa
  prej_isencaoParcial: number;       // parcialmente isenta
  c397: number;           // Prejuízos c/ transmissão autorizada (art.15)
  limiteMaisPP: boolean;  // aumentar limite dedução p/ 75%
  beneficiosFiscais: number; // c774+c775 — benefícios fiscais Q09
  // ── TA — Tributações Autónomas ────────────────────────────────────
  viaturas: ViaturaRow[];
  ta_despNaoDocPrincipal: number;    // 50%
  ta_despNaoDocNaoPrincipal: number; // 70%
  ta_representacao: number;          // 10%
  ta_ajadasCusto: number;            // 5%
  ta_lucrosDistribuidos: number;     // 23%
  ta_offshores: number;              // 35%
  ta_indemCessacao: number;          // 35%
  ta_bonus: number;                  // 35%
  ta_retFonteArt88n12: number;       // retenções na fonte a deduzir às TA (art.88 n.12)
  agravamentoTA: boolean;            // empresa com prejuízo → +10%
  // ── Q10 — Deduções à Coleta ──────────────────────────────────────
  c353: number;           // DTJI — dupla tributação jurídica internacional (art.91)
  c375: number;           // DTEI — dupla tributação económica internacional (art.91-A)
  c355_bf: number;        // Benefícios fiscais (exceto CFEI II e IFR)
  c355_cfei: number;      // CFEI II
  c355_ifr: number;       // IFR
  c470: number;           // Adicional ao IMI (art.135-J CIMI)
  c349: number;           // Imposto a outras taxas (manual %)
  c349_taxa: number;      // taxa para c349
  // ── Q10 — Pagamentos e outros ────────────────────────────────────
  retencoesFonte: number; // c359
  pecPagamentos: number;  // c356 — PEC efetuado
  pcPagamentos: number;   // c360 — Pagamentos por conta
  pacPagamentos: number;  // c374 — Pagamentos adicionais por conta
  c363: number;           // IRC de períodos anteriores
  c372: number;           // Reposição de benefícios fiscais
  c379: number;           // DTJI CDT (países com CDT — dedução especial)
  c366: number;           // Juros compensatórios
  c369: number;           // Juros de mora
  // ── Derrama Municipal ────────────────────────────────────────────
  taxaDerramaMunicipal: number; // % (ex: 0.015 = 1,5%)
  // ── Validação RETGS / capital / métodos indiretos (CIRC) ─────────
  retgsAtiva: boolean;            // Regime especial tributação grupos sociedades (art 71.º)
  variacaoCapital50: boolean;     // >50% alteração capital social / direitos voto (aviso AT)
  metodosIndiretos: boolean;      // métodos indiretos apuramento LT (aviso AT)
  atividadesIsentas: boolean;     // atividades parcialmente isentas (limitação dedução)
}

export function defaultPreviSaState(): PreviSaState {
  return {
    nif: '', designacao: '', regime: 'geral', isPME: true, isStartup: false,
    periodo: new Date().getFullYear() - 1, territorio: 'continental', volumeNegocios: 0,
    // Rendimentos
    useRaiCalc: false,
    rai_711: 0, rai_712: 0, rai_72: 0, rai_74: 0, rai_75: 0, rai_76: 0,
    rai_77: 0, rai_78: 0, rai_79: 0,
    rai_cmv: 0, rai_cmc: 0, rai_62: 0, rai_63: 0, rai_64: 0, rai_65: 0,
    rai_66: 0, rai_67: 0, rai_68: 0, rai_69: 0,
    rai_8122_db: 0, rai_8122_cr: 0,
    // Q07 base
    c701_rai: 0, c702: 0, c703: 0, c805: 0, c704: 0, c705: 0, c806: 0,
    c706: 0, c707: 0, c708_override: false,
    // Q07 acrescer
    c709: 0, c710: 0, c711: 0, c782: 0, c712: 0, c713: 0, c714: 0,
    c715: 0, c717: 0, c721: 0, c724: 0, c725: 0, c716: 0, c731: 0,
    c726: 0, c783: 0, c728: 0, c727: 0, c729: 0, c730: 0, c732: 0,
    c733: 0, c784: 0, c734: 0, c735: 0, c780: 0, c785: 0, c802: 0,
    c746: 0, c737: 0, c786: 0, c718: 0, c719: 0, c720: 0, c722: 0,
    c723: 0, c736: 0, c738: 0, c739: 0, c740: 0, c741: 0, c742: 0,
    c743: 0, c787: 0, c744: 0, c745: 0, c747: 0, c748: 0, c749: 0,
    c788: 0, c750: 0, c789: 0, c790: 0, c751: 0, c803: 0, c779: 0,
    c797: 0, c799: 0, c804: 0, c752: 0,
    // Q07 deduzir
    c754: 0, c755: 0, c756: 0, c757: 0, c791: 0, c758: 0, c759: 0,
    c760: 0, c761: 0, c762: 0, c763: 0, c781: 0, c764: 0, c765: 0,
    c766: 0, c792: 0, c767: 0, c768: 0, c769: 0, c770: 0, c793: 0,
    c771: 0, c794: 0, c772: 0, c795: 0, c773: 0, c796: 0, c774: 0,
    c800: 0, c801: 0, c798: 0, c775: 0,
    // Q09
    prej_ate2017: 0, prej_2018: 0, prej_2019: 0, prej_2020: 0, prej_2021: 0,
    prej_2022: 0, prej_2023: 0, prej_2024: 0, c397: 0,
    prej_ate2017_deduzido: 0,
    prej_2018_deduzido: 0, prej_2019_deduzido: 0, prej_2020_deduzido: 0,
    prej_2021_deduzido: 0, prej_2022_deduzido: 0, prej_2023_deduzido: 0, prej_2024_deduzido: 0,
    prej_2018_elegivel: true, prej_2019_elegivel: true, prej_2020_elegivel: true,
    prej_2021_elegivel: true, prej_2022_elegivel: true, prej_2023_elegivel: true, prej_2024_elegivel: true,
    prej_2018_obs: '', prej_2019_obs: '', prej_2020_obs: '', prej_2021_obs: '',
    prej_2022_obs: '', prej_2023_obs: '', prej_2024_obs: '',
    prej_regimeGeral: 0, prej_reducaoTaxa: 0, prej_isencaoParcial: 0,
    limiteMaisPP: false, beneficiosFiscais: 0,
    // TA
    viaturas: [],
    ta_despNaoDocPrincipal: 0, ta_despNaoDocNaoPrincipal: 0, ta_representacao: 0,
    ta_ajadasCusto: 0, ta_lucrosDistribuidos: 0, ta_offshores: 0,
    ta_indemCessacao: 0, ta_bonus: 0, ta_retFonteArt88n12: 0,
    agravamentoTA: false,
    // Q10 deduções coleta
    c353: 0, c375: 0, c355_bf: 0, c355_cfei: 0, c355_ifr: 0, c470: 0,
    c349: 0, c349_taxa: 0.2,
    // Q10 pagamentos
    retencoesFonte: 0, pecPagamentos: 0, pcPagamentos: 0, pacPagamentos: 0,
    c363: 0, c372: 0, c379: 0, c366: 0, c369: 0,
    // Derrama Municipal
    taxaDerramaMunicipal: 0,
    // Validação
    retgsAtiva: false, variacaoCapital50: false, metodosIndiretos: false, atividadesIsentas: false,
  };
}
