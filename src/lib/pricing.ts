import type { ClientProfile } from '../ClientProfile';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { loadFromStorage, saveToStorage } from './storage';
import { getActiveGabineteId } from './gabinetes';

const META_DOC = 'pricing';
const LEGACY_STORAGE_KEY = 'recofa_pricing';

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

function storageKey(): string {
  let gabineteId = '';
  try { gabineteId = getActiveGabineteId() || ''; } catch { /* sessão ainda a arrancar */ }
  return `gabinete:pricing:${gabineteId}`;
}

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
    if (!getActiveGabineteId()) {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      return raw ? { ...defaultPricing(), ...JSON.parse(raw) } : defaultPricing();
    }
    const scoped = loadFromStorage<PricingConfig | null>(storageKey(), null);
    if (scoped) return { ...defaultPricing(), ...scoped };
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        const legado = JSON.parse(raw) as Partial<PricingConfig>;
        const migrado = { ...defaultPricing(), ...legado };
        saveToStorage(storageKey(), migrado);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return migrado;
      }
    } catch {}
    return defaultPricing();
  } catch {
    return defaultPricing();
  }
}

export function savePricing(p: PricingConfig): void {
  if (!getActiveGabineteId()) {
    try { localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(p)); } catch {}
    return;
  }
  saveToStorage(storageKey(), p);
  try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch {}
}

export async function loadPricingFromFirestore(): Promise<PricingConfig | null> {
  const gabineteId = getActiveGabineteId();
  if (!gabineteId) return null;
  try {
    const snap = await getDoc(doc(db, 'gabinetes', gabineteId, 'settings', META_DOC));
    if (snap.exists()) return { ...defaultPricing(), ...snap.data() } as PricingConfig;
    return null;
  } catch {
    return null;
  }
}

export async function savePricingToFirestore(p: PricingConfig): Promise<boolean> {
  const gabineteId = getActiveGabineteId();
  if (!gabineteId) return false;
  try {
    await setDoc(doc(db, 'gabinetes', gabineteId, 'settings', META_DOC), p, { merge: true });
    return true;
  } catch {
    return false;
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
