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
    style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
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
