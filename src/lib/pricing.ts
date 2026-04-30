import type { ClientProfile } from '../ClientProfile';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const FIRESTORE_DOC = 'pricing';
const FIRESTORE_COL = 'config';

export interface PricingConfig {
  // Contabilidade mensal base (€/mês)
  contabilidadeEni: number;
  contabilidadeLda: number;
  contabilidadeSA: number;

  // Salários (€ por funcionário/mês)
  salarioPorFuncionario: number;

  // IVA (€ por declaração)
  ivaDeclaracaoTrimestral: number;
  ivaDeclaracaoMensal: number;

  // Declarações anuais (€/ano)
  irsAnualEni: number;
  ircAnualLda: number;
  daiIES: number;

  // Viaturas (€ por viatura/mês)
  gestaoPorViatura: number;

  // Tickets de refeição (€/mês fixo)
  processamentoTickets: number;

  // Serviços pontuais (€, valor único)
  constituicaoEmpresa: number;
  registoEni: number;

  // Consultoria (€/hora)
  consultoriaHora: number;
}

export interface ClientEstimate {
  baseMonthly: number;
  salarios: number;
  iva: number;
  anuaisAmortizados: number;
  viaturas: number;
  tickets: number;
  totalMensal: number;
  totalAnual: number;
  entityLabel: string;
}

const STORAGE_KEY = 'recofa_pricing';

export function defaultPricing(): PricingConfig {
  return {
    contabilidadeEni: 80,
    contabilidadeLda: 150,
    contabilidadeSA: 300,
    salarioPorFuncionario: 20,
    ivaDeclaracaoTrimestral: 30,
    ivaDeclaracaoMensal: 50,
    irsAnualEni: 150,
    ircAnualLda: 300,
    daiIES: 100,
    gestaoPorViatura: 25,
    processamentoTickets: 20,
    constituicaoEmpresa: 500,
    registoEni: 150,
    consultoriaHora: 75,
  };
}

export function loadPricing(): PricingConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPricing();
    return { ...defaultPricing(), ...JSON.parse(raw) };
  } catch {
    return defaultPricing();
  }
}

export function savePricing(p: PricingConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export async function loadPricingFromFirestore(): Promise<PricingConfig | null> {
  try {
    const snap = await getDoc(doc(db, FIRESTORE_COL, FIRESTORE_DOC));
    if (snap.exists()) return { ...defaultPricing(), ...snap.data() } as PricingConfig;
    return null;
  } catch {
    return null;
  }
}

export async function savePricingToFirestore(p: PricingConfig): Promise<void> {
  try {
    await setDoc(doc(db, FIRESTORE_COL, FIRESTORE_DOC), p);
  } catch {
    // silently fail — localStorage still has the data
  }
}

export function calcClientEstimate(
  p: PricingConfig,
  profile: ClientProfile,
  vehicleState?: { price: number },
  ticketState?: { ticketValue: number }
): ClientEstimate {
  const isEni = profile.tipoEntidade === 'eni';
  const isSA = profile.tipoEntidade === 'sa';

  let baseMonthly: number;
  let entityLabel: string;
  if (isEni) {
    baseMonthly = p.contabilidadeEni;
    entityLabel = 'ENI / Trabalhador Independente';
  } else if (isSA) {
    baseMonthly = p.contabilidadeSA;
    entityLabel = 'Sociedade Anónima (SA)';
  } else {
    baseMonthly = p.contabilidadeLda;
    const labels: Record<string, string> = {
      lda: 'Lda.',
      unipessoal: 'Unipessoal Lda.',
      socio_unico: 'Sócio Único',
    };
    entityLabel = labels[profile.tipoEntidade] ?? 'Empresa';
  }

  const salarios = profile.nrFuncionarios * p.salarioPorFuncionario;

  let iva = 0;
  if (profile.regimeIva === 'normal_trimestral' || profile.regimeIva === 'pequenos_retalhistas') {
    iva = p.ivaDeclaracaoTrimestral / 3;
  } else if (profile.regimeIva === 'normal_mensal') {
    iva = p.ivaDeclaracaoMensal;
  }

  const anuaisAmortizados = isEni
    ? p.irsAnualEni / 12
    : (p.ircAnualLda + p.daiIES) / 12;

  const hasVehicle = vehicleState && vehicleState.price > 0;
  const viaturas = hasVehicle ? p.gestaoPorViatura : 0;

  const hasTickets =
    profile.nrFuncionarios > 0 &&
    ((ticketState && ticketState.ticketValue > 0) || profile.valorTicket > 0);
  const tickets = hasTickets ? p.processamentoTickets : 0;

  const totalMensal = baseMonthly + salarios + iva + anuaisAmortizados + viaturas + tickets;

  return {
    baseMonthly,
    salarios,
    iva,
    anuaisAmortizados,
    viaturas,
    tickets,
    totalMensal,
    totalAnual: totalMensal * 12,
    entityLabel,
  };
}
