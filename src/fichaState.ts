import type { ClientProfile } from './ClientProfile';

export interface FichaState {
  identificacao: {
    nome: string;
    nif: string;
    dataNascimento: string;
    estadoCivil: string;
    dependentes: number;
    morada: string;
    telefone: string;
    email: string;
  };
  situacaoAtual: {
    tipo: 'naoIniciou' | 'eni' | 'unipessoal' | 'quotas' | 'tcoMaisIndep' | 'outra';
    outraDesc: string;
  };
  atividade: {
    descricao: string;
    caePrincipal: string;
    caeSecundarios: string;
    local: { online: boolean; fisico: boolean; cliente: boolean; misto: boolean };
  };
  faturacao: {
    ano1: number;
    ano2: number;
    ano3: number;
    clientes: { particulares: boolean; nacionais: boolean; ue: boolean; foraUe: boolean };
  };
  iva: {
    clientes: { particulares: boolean; dedutivel: boolean };
    enquadramento: { art53: boolean; normal: boolean };
    ivaSuportadoRelevante: 'sim' | 'nao' | '';
    despesas: { mercadorias: boolean; equipamentos: boolean; viaturas: boolean; servicosExternos: boolean; obras: boolean };
  };
  custos: {
    mercadorias: number; rendas: number; combustiveis: number; viaturas: number;
    equipamentos: number; servicosExternos: number; outros: number;
  };
  rh: {
    numero: number;
    tipo: { dependentes: boolean; prestadores: boolean };
    remuneracaoAnual: number;
  };
  ss: {
    situacaoSocio: 'tco' | 'desempregado' | 'estudante' | 'empresario' | 'gerente' | '';
    remuneracaoActual: number;
  };
  investimento: {
    equipamentos: number; viaturas: number; obras: number; stock: number; outro: number;
  };
  viaturas: {
    tem: 'sim' | 'nao' | '';
    tipo: { comercial: boolean; passageiros: boolean; eletrico: boolean; hibrido: boolean };
    valor: number;
  };
  societaria: {
    numeroSocios: number;
    socios: Array<{ nome: string; percentagem: number }>;
    gerencia: 'um' | 'varios' | '';
  };
  distribuicao: { salario: boolean; dividendos: boolean; reinvestir: boolean; misto: boolean };
  fiscalAtual: {
    dividasFiscais: 'sim' | 'nao' | '';
    dividasSS: 'sim' | 'nao' | '';
    execucoesFiscais: 'sim' | 'nao' | '';
  };
  objetivos: {
    menosImpostos: boolean; crescer: boolean; imobiliario: boolean;
    variasEmpresas: boolean; planeamentoFamiliar: boolean;
  };
  intencoes: {
    imoveis: boolean; viaturasEmpresa: boolean; ativosFinanceiros: boolean;
    grupoEmpresas: boolean; internacionalizar: boolean;
  };
  documentos: {
    irs: boolean; balancete: boolean; ies: boolean; modelo22: boolean;
    dec_iva: boolean; contratos: boolean; extratos: boolean;
  };
  analiseInterna: {
    eniVsLda: string;
    simplifVsOrganizada: string;
    art53VsNormal: string;
    salarioVsDividendos: string;
    planeamento: string;
    observacoes: string;
    recomendacoes: string;
  };
}

const tipoEntidadeMap: Record<string, FichaState['situacaoAtual']['tipo']> = {
  eni: 'eni',
  unipessoal: 'unipessoal',
  lda: 'quotas',
  sa: 'outra',
  socio_unico: 'unipessoal',
};

export function defaultFichaState(profile?: ClientProfile): FichaState {
  const blank: FichaState = {
    identificacao: { nome: '', nif: '', dataNascimento: '', estadoCivil: '', dependentes: 0, morada: '', telefone: '', email: '' },
    situacaoAtual: { tipo: 'naoIniciou', outraDesc: '' },
    atividade: { descricao: '', caePrincipal: '', caeSecundarios: '', local: { online: false, fisico: false, cliente: false, misto: false } },
    faturacao: { ano1: 0, ano2: 0, ano3: 0, clientes: { particulares: false, nacionais: false, ue: false, foraUe: false } },
    iva: { clientes: { particulares: false, dedutivel: false }, enquadramento: { art53: false, normal: false }, ivaSuportadoRelevante: '', despesas: { mercadorias: false, equipamentos: false, viaturas: false, servicosExternos: false, obras: false } },
    custos: { mercadorias: 0, rendas: 0, combustiveis: 0, viaturas: 0, equipamentos: 0, servicosExternos: 0, outros: 0 },
    rh: { numero: 0, tipo: { dependentes: false, prestadores: false }, remuneracaoAnual: 0 },
    ss: { situacaoSocio: '', remuneracaoActual: 0 },
    investimento: { equipamentos: 0, viaturas: 0, obras: 0, stock: 0, outro: 0 },
    viaturas: { tem: '', tipo: { comercial: false, passageiros: false, eletrico: false, hibrido: false }, valor: 0 },
    societaria: { numeroSocios: 1, socios: [{ nome: '', percentagem: 100 }], gerencia: '' },
    distribuicao: { salario: false, dividendos: false, reinvestir: false, misto: false },
    fiscalAtual: { dividasFiscais: '', dividasSS: '', execucoesFiscais: '' },
    objetivos: { menosImpostos: false, crescer: false, imobiliario: false, variasEmpresas: false, planeamentoFamiliar: false },
    intencoes: { imoveis: false, viaturasEmpresa: false, ativosFinanceiros: false, grupoEmpresas: false, internacionalizar: false },
    documentos: { irs: false, balancete: false, ies: false, modelo22: false, dec_iva: false, contratos: false, extratos: false },
    analiseInterna: { eniVsLda: '', simplifVsOrganizada: '', art53VsNormal: '', salarioVsDividendos: '', planeamento: '', observacoes: '', recomendacoes: '' },
  };

  if (!profile) return blank;

  return {
    ...blank,
    identificacao: {
      ...blank.identificacao,
      nome: profile.nomeCliente || '',
      nif: profile.nif || '',
      estadoCivil: profile.estadoCivil || '',
      dependentes: profile.nrDependentes || 0,
      morada: [profile.morada, profile.codigoPostal, profile.localidade].filter(Boolean).join(', '),
      telefone: profile.telefone || '',
      email: profile.email || '',
    },
    situacaoAtual: {
      ...blank.situacaoAtual,
      tipo: tipoEntidadeMap[profile.tipoEntidade] || 'naoIniciou',
    },
    atividade: {
      ...blank.atividade,
      descricao: profile.atividadePrincipal === 'servicos' ? 'Prestação de serviços' : profile.atividadePrincipal === 'bens' ? 'Comercialização de bens' : '',
      caePrincipal: profile.cae || '',
    },
    faturacao: { ...blank.faturacao, ano1: profile.faturaçaoAnualPrevista || 0 },
    rh: { ...blank.rh, numero: profile.nrFuncionarios || 0 },
    iva: {
      ...blank.iva,
      enquadramento: {
        art53: profile.regimeIva === 'isento',
        normal: profile.regimeIva !== 'isento',
      },
    },
  };
}
