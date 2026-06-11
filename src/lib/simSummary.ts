/**
 * Histórico de simulações — metadados e resumos (Funcionalidade D).
 *
 * Os simuladores são controlados pelo App (cada um recebe `initialState` +
 * `onStateChange`), por isso o estado de qualquer simulação vive no App e pode
 * ser fotografado (snapshot) para o histórico do cliente sem tocar nos
 * componentes. Este módulo concentra:
 *   • SIM_VIEWS / SIM_LABELS — que views são simuladores e o seu nome legível;
 *   • summarizeSimulacao() — uma frase-resumo derivada do estado, para a lista
 *     do histórico ser reconhecível mesmo sem o resultado calculado.
 *
 * Um simulador pode publicar um resumo MAIS preciso (o resultado calculado) via
 * useReportResumo() em SimulacaoSave.tsx; quando o faz, esse resumo tem
 * prioridade sobre o derivado aqui.
 */

export const SIM_VIEWS = [
  'tax', 'vehicle', 'ticket', 'selfss', 'diagnostico',
  'imoveis', 'imt', 'salario', 'irs', 'previsa',
] as const;

export type SimView = typeof SIM_VIEWS[number];

export const SIM_LABELS: Record<SimView, string> = {
  tax: 'Simulador Fiscal',
  vehicle: 'Simulador de Viaturas',
  ticket: 'Tickets de Refeição',
  selfss: 'SS de Independente',
  diagnostico: 'Diagnóstico de Autonomia',
  imoveis: 'Imóveis na Empresa',
  imt: 'Simulador IMT',
  salario: 'Salário Líquido',
  irs: 'Simulador de IRS',
  previsa: 'Simulador Previsa',
};

export function isSimView(v: string): v is SimView {
  return (SIM_VIEWS as readonly string[]).includes(v);
}

const eur = (n: unknown): string => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v);
};

const pick = <T,>(map: Record<string, T>, key: unknown, fallback: T): T =>
  (typeof key === 'string' && key in map ? map[key] : fallback);

/**
 * Resumo de uma linha derivado do estado do simulador. Não recalcula o
 * resultado (a lógica vive em cada componente) — destila os inputs-chave numa
 * frase que torna a simulação reconhecível na lista do histórico.
 */
export function summarizeSimulacao(tipo: string, state: unknown): string {
  const s = (state ?? {}) as Record<string, any>;
  switch (tipo) {
    case 'tax':
      return `${eur(s.rev)} de faturação · ${s.isServices ? 'serviços' : 'bens'} · ENI vs Lda`;
    case 'vehicle':
      return `${pick({ passageiros: 'Ligeiro de passageiros', comercial: 'Comercial' }, s.category, 'Viatura')} · ` +
        `${pick({ diesel: 'gasóleo', gasolina: 'gasolina', eletrico: 'elétrico', hibrido: 'híbrido', phev: 'híbrido plug-in' }, s.engineType, String(s.engineType ?? ''))} · ${eur(s.price)}`;
    case 'ticket':
      return `${s.employees ?? 0} colaborador${(s.employees ?? 0) === 1 ? '' : 'es'} · ` +
        `subsídio ${eur(s.ticketValue)}/dia`;
    case 'selfss':
      return `Rendimento ${eur(s.income)}/mês · ${pick({ servicos: 'serviços', bens: 'bens' }, s.tipoRendimento, 'serviços')}`;
    case 'diagnostico':
      return `Volume de negócios ${eur(s.volumeNegocios)} · ${pick({ positivo: 'EBITDA positivo', negativo: 'EBITDA negativo' }, s.ebitda, 'diagnóstico')}`;
    case 'imoveis':
      return `Imóvel ${eur(s.valorImovel)} · ${pick({ comercial: 'uso comercial', habitacao: 'habitação', misto: 'uso misto' }, s.tipoUso, 'uso comercial')}`;
    case 'imt':
      return `${pick({ hpp: 'Habitação própria', habitacao: 'Habitação', terreno: 'Terreno', outros: 'Outros prédios', rustico: 'Prédio rústico' }, s.tipo, 'Imóvel')} · ` +
        `${eur(s.valor)} · ${pick({ continente: 'continente', madeira: 'Madeira', acores: 'Açores' }, s.localizacao, 'continente')}`;
    case 'salario':
      return `Bruto ${eur(s.salarioBruto)}/mês · ` +
        `${pick({ solteiro: 'solteiro', casado_1titular: 'casado (1 titular)', casado_2titulares: 'casado (2 titulares)' }, s.estadoCivil, 'solteiro')} · ` +
        `${s.nrDependentes ?? 0} dep.`;
    case 'irs': {
      const ag = Array.isArray(s.agregado) ? s.agregado : [];
      const rend = ag.reduce((t: number, p: any) => t + (Number(p?.rendTrabalho) || 0), 0);
      return `${s.cenario === 'conjunto' ? 'Tributação conjunta' : 'Tributação individual'} · ` +
        `${ag.length} titular${ag.length === 1 ? '' : 'es'} · rendimento ${eur(rend)}`;
    }
    case 'previsa': {
      const nome = (s.designacao || '').trim();
      return `IRC Modelo 22${s.periodo ? ` · ${s.periodo}` : ''}${nome ? ` · ${nome}` : ''} · VN ${eur(s.volumeNegocios)}`;
    }
    default:
      return 'Simulação guardada';
  }
}

const num = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

/**
 * O simulador tem dados reais introduzidos? Evita guardar automaticamente
 * simulações vazias (campos todos a zero) no histórico.
 */
export function simHasData(tipo: string, state: unknown): boolean {
  const s = (state ?? {}) as Record<string, any>;
  switch (tipo) {
    case 'tax':        return num(s.rev) > 0 || num(s.currentInc) > 0 || num(s.monthlyNeed) > 0;
    case 'vehicle':    return num(s.price) > 0;
    case 'ticket':     return num(s.employees) > 0 && num(s.ticketValue) > 0;
    case 'selfss':     return num(s.income) > 0;
    case 'diagnostico':return num(s.volumeNegocios) > 0 || num(s.custoFixoMensal) > 0;
    case 'imoveis':    return num(s.valorImovel) > 0;
    case 'imt':        return num(s.valor) > 0;
    case 'salario':    return num(s.salarioBruto) > 0;
    case 'irs': {
      const ag = Array.isArray(s.agregado) ? s.agregado : [];
      return ag.some((p: any) => num(p?.rendTrabalho) > 0 || num(p?.rendEmpresarial) > 0);
    }
    case 'previsa':
      return num(s.volumeNegocios) > 0 || !!(s.designacao || '').trim() ||
        ['rai_711','rai_712','rai_72','rai_74','rai_75','rai_76','rai_77','rai_78','rai_79','c701_rai']
          .some(k => num(s[k]) > 0);
    default: return false;
  }
}

/**
 * Detalhes-chave (label→valor) de uma simulação, para comparar no histórico
 * sem ter de a reabrir. Destila os inputs/pressupostos mais relevantes por tipo.
 */
export function detailSimulacao(tipo: string, state: unknown): { label: string; valor: string }[] {
  const s = (state ?? {}) as Record<string, any>;
  const out: { label: string; valor: string }[] = [];
  const add = (label: string, valor: string | number) => out.push({ label, valor: typeof valor === 'number' ? eur(valor) : valor });
  switch (tipo) {
    case 'tax':
      add('Faturação', num(s.rev));
      add('Atividade', s.isServices ? 'Serviços' : 'Bens');
      add('Mercado', s.b2b ? 'B2B' : 'B2C');
      add('Necessidade mensal', num(s.monthlyNeed));
      if (num(s.invEquip) + num(s.invLic) + num(s.invWorks) + num(s.invFundo) > 0)
        add('Investimento', num(s.invEquip) + num(s.invLic) + num(s.invWorks) + num(s.invFundo));
      break;
    case 'vehicle':
      add('Preço', num(s.price));
      add('Categoria', pick({ passageiros: 'Passageiros', comercial: 'Comercial' }, s.category, '—'));
      add('Motor', String(s.engineType ?? '—'));
      add('Regime IVA', String(s.ivaRegime ?? '—'));
      break;
    case 'ticket':
      add('Colaboradores', String(num(s.employees)));
      add('Valor/dia', num(s.ticketValue));
      add('Dias/mês', String(num(s.daysPerMonth)));
      add('Meses', String(num(s.months)));
      break;
    case 'selfss':
      add('Rendimento/mês', num(s.income));
      add('Tipo', pick({ servicos: 'Serviços', bens: 'Bens' }, s.tipoRendimento, '—'));
      add('Regime', pick({ general: 'Geral', simplified: 'Simplificado' }, s.regime, '—'));
      break;
    case 'salario':
      add('Bruto/mês', num(s.salarioBruto));
      add('Estado civil', String(s.estadoCivil ?? '—').replace(/_/g, ' '));
      add('Dependentes', String(num(s.nrDependentes)));
      add('Subs. alimentação', num(s.subsidioAlimentacaoDiario));
      break;
    case 'imt':
      add('Valor', num(s.valor));
      add('Tipo', String(s.tipo ?? '—'));
      add('Localização', String(s.localizacao ?? '—'));
      break;
    case 'imoveis':
      add('Valor imóvel', num(s.valorImovel));
      add('Uso', String(s.tipoUso ?? '—'));
      break;
    case 'irs': {
      const ag = Array.isArray(s.agregado) ? s.agregado : [];
      const rend = ag.reduce((t: number, p: any) => t + num(p?.rendTrabalho), 0);
      add('Cenário', s.cenario === 'conjunto' ? 'Conjunta' : 'Individual');
      add('Titulares', String(ag.length));
      add('Rendimento trabalho', rend);
      break;
    }
    case 'previsa':
      if ((s.designacao || '').trim()) add('Empresa', String(s.designacao).trim());
      if (s.periodo) add('Período', String(s.periodo));
      add('Volume de negócios', num(s.volumeNegocios));
      add('Regime', String(s.regime ?? '—'));
      add('Território', String(s.territorio ?? '—'));
      break;
  }
  return out.filter(d => d.valor !== '' && d.valor !== '—' && d.valor !== eur(0));
}
