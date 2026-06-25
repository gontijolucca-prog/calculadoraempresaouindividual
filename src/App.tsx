import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Loader2, Save, Calculator, ArrowLeft } from 'lucide-react';
import ClientProfile, { defaultProfile } from './ClientProfile';
import { UpdateNotification } from './components/UpdateNotification';
import { useUnsavedEdits } from './hooks/useUnsavedEdits';
import { initVersionChecker, stopVersionChecker } from './lib/version-checker';
import LegalInfo from './LegalInfo';
import LandingPage from './LandingPage';
import EmpresasList from './EmpresasList';
import SimIntro, { SIM_INTROS } from './SimIntro';
import ClientHub from './ClientHub';
import ExportarRelatorio from './ExportarRelatorio';
import type { AppMode } from './ModeSelector';
import {
  getCurrentEmpresaId,
  setCurrentEmpresaId,
  getEmpresa,
  syncProfileIntoEmpresa,
  migrateLegacyProfileIfNeeded,
  upsertEmpresa,
  newId as newEmpresaId,
  syncEmpresasFromFirestore,
  saveEmpresasToFirestore,
  listEmpresas,
  deleteEmpresa,
  addSimulacao,
  upsertAutoSimulacao,
  SAFT_REPARSE_REV,
} from './lib/empresas';
import type { SimulationRecord, EmpresaRecord } from './lib/empresas';
import type { DiagnosticoState } from './DiagnosticoAutonomia';
import type { ImoveisState } from './ImoveisEmpresa';
import type { IMTState } from './IMTSimulator';
import type { SalarioState } from './SalarioLiquidoSimulator';
import { defaultIRSState, type IRSState } from './lib/irs';
import type { TicketSimulatorState } from './TicketSimulator';
import {
  getInitialTaxState, getInitialVehicleState, getInitialTicketState, getInitialSSState,
} from './lib/simDefaults';
import type { ClientProfile as ClientProfileType } from './ClientProfile';
import { ThemeProvider } from './ThemeContext';
import { MotionProvider, PageTransition } from './AnimatedPage';
import { parseSAFT, decodeSaftText, normalizeXmlEncodingToUtf8, type SAFTParseResult } from './lib/saft';
import { enforceProfileRules } from './lib/profileRules';
import { DOC_TYPES, downloadAsWord } from './lib/wordDocs';
import { downloadPrevisaExcel } from './lib/previsaExcel';
import { LAYOUTS } from './Layouts';
import { loadFromStorage, saveToStorage, clearStorage } from './lib/storage';
import { loadOfficeSettings, saveOfficeSettings, type OfficeSettings } from './lib/officeSettings';
import { loadHonorariosConfig, saveHonorariosConfig, type HonorariosConfig } from './lib/honorarios';

// Code-split heavy simulators — keeps the initial bundle small.
const TaxSimulator = lazy(() => import('./TaxSimulator'));
const VehicleSimulator = lazy(() => import('./VehicleSimulator'));
const TicketSimulator = lazy(() => import('./TicketSimulator'));
const SelfEmployedSSSimulator = lazy(() => import('./SelfEmployedSSSimulator'));
const DiagnosticoAutonomia = lazy(() => import('./DiagnosticoAutonomia'));
const ImoveisEmpresa = lazy(() => import('./ImoveisEmpresa'));
const IMTSimulator = lazy(() => import('./IMTSimulator'));
const SalarioLiquidoSimulator = lazy(() => import('./SalarioLiquidoSimulator'));
const IRSSimulator = lazy(() => import('./IRSSimulator'));
const PreviSaSimulator = lazy(() => import('./PreviSaSimulator'));
const OfficeSettingsView = lazy(() => import('./OfficeSettingsView'));
import { defaultPreviSaState } from './previSaState';
import type { PreviSaState } from './previSaState';
import { SIM_LABELS, isSimView, summarizeSimulacao, simHasData, detailSimulacao, type SimView } from './lib/simSummary';
import { resultSimulacao } from './lib/simResults';
import { requestOpenPackage, requestFlowToggle } from './lib/profileIntent';
import { SimulacaoSaveProvider, type SimSaveCtx } from './SimulacaoSave';
import { setByPath } from './ai/actions';
import type { BotBridge } from './ai/AIContabilista';
import SuggestionsAdmin from './ai/SuggestionsAdmin';
const SimulacoesHistory = lazy(() => import('./SimulacoesHistory'));
const AIContabilista = lazy(() => import('./ai/AIContabilista'));

type ViewType =
  | 'profile' | 'tax' | 'vehicle' | 'ticket' | 'selfss'
  | 'diagnostico' | 'imoveis' | 'imt' | 'salario' | 'irs' | 'legal'
  | 'previsa' | 'office-settings' | 'empresas' | 'historico' | 'exportar' | 'hub';

// Default landing view when the user picks a mode.
const DEFAULT_VIEW_BY_MODE: Record<AppMode, ViewType> = {
  'novo-cliente': 'profile',
  empresa: 'empresas',
};

const VIEW_TITLES: Record<ViewType, string> = {
  empresas: 'Lista de Empresas',
  profile: 'Perfil do Cliente',
  tax: 'Simulador Fiscal',
  vehicle: 'Simulador de Viaturas',
  ticket: 'Tickets de Refeição',
  selfss: 'SS de Independente',
  diagnostico: 'Diagnóstico de Autonomia',
  imoveis: 'Imóveis na Empresa',
  imt: 'Simulador IMT',
  salario: 'Salário Líquido',
  irs: 'Simulador de IRS',
  legal: 'Base Legal & Referências',
  previsa: 'Simulador Previsa',
  'office-settings': 'Definições do Escritório',
  historico: 'Histórico de Simulações',
  exportar: 'Relatórios',
  hub: 'Menu do Cliente',
};

/**
 * Migração legada: a antiga view "Ficha" foi fundida no Perfil do Cliente.
 * Lê o `fichaState` antigo do localStorage (se existir), faz merge dos campos
 * de diagnóstico para o `clientProfile`, persiste e remove a chave legada.
 * Idempotente — se já não houver ficha antiga, devolve o perfil intacto.
 */
/**
 * Garante que um perfil (vindo do localStorage, de uma empresa guardada ou da
 * cloud) tem TODOS os objetos aninhados que a aplicação assume existirem. Perfis
 * legados podiam não trazer `custos`, `contabilidade`, `societaria`, etc., e a
 * vista de Perfil rebentava com "Cannot read properties of undefined" ao ler, p.
 * ex., `profile.custos.mercadorias`. Preenche o que faltar a partir do default.
 */
export function normalizeProfile(p?: Partial<ClientProfileType> | null): ClientProfileType {
  const b = (p ?? {}) as ClientProfileType;
  const vd = (b.viaturasDiag ?? {}) as ClientProfileType['viaturasDiag'];
  return {
    ...defaultProfile,
    ...b,
    custos:         { ...defaultProfile.custos,         ...(b.custos ?? {}) },
    investimento:   { ...defaultProfile.investimento,   ...(b.investimento ?? {}) },
    viaturasDiag:   { ...defaultProfile.viaturasDiag,   ...vd, tipo: { ...defaultProfile.viaturasDiag.tipo, ...(vd?.tipo ?? {}) } },
    societaria:     { ...defaultProfile.societaria,     ...(b.societaria ?? {}) },
    contabilidade:  { ...defaultProfile.contabilidade,  ...(b.contabilidade ?? {}) },
    distribuicao:   { ...defaultProfile.distribuicao,   ...(b.distribuicao ?? {}) },
    fiscalAtual:    { ...defaultProfile.fiscalAtual,    ...(b.fiscalAtual ?? {}) },
    objetivos:      { ...defaultProfile.objetivos,      ...(b.objetivos ?? {}) },
    intencoes:      { ...defaultProfile.intencoes,      ...(b.intencoes ?? {}) },
    documentos:     { ...defaultProfile.documentos,     ...(b.documentos ?? {}) },
    analiseInterna: { ...defaultProfile.analiseInterna, ...(b.analiseInterna ?? {}) },
  };
}

function loadProfileWithFichaMerge(): ClientProfileType {
  const loaded = normalizeProfile(loadFromStorage('clientProfile', defaultProfile));
  if (typeof window === 'undefined' || !window.localStorage) return loaded;
  try {
    // Lê a ficha; se a chave nova estiver vazia, recupera da antiga (pré-rebrand)
    // para o utilizador não perder a ficha guardada.
    const raw = window.localStorage.getItem('estudo360:v1:fichaState')
      || window.localStorage.getItem('recofatima:v1:fichaState');
    if (!raw) return loaded;
    const parsed = JSON.parse(raw);
    const f = parsed?.data;
    if (!f) {
      window.localStorage.removeItem('estudo360:v1:fichaState');
      window.localStorage.removeItem('recofatima:v1:fichaState');
      return loaded;
    }
    const merged: ClientProfileType = {
      ...loaded,
      custos:          f.custos          ?? loaded.custos,
      investimento:    f.investimento    ?? loaded.investimento,
      viaturasDiag:    f.viaturas        ?? loaded.viaturasDiag,
      societaria:      f.societaria      ?? loaded.societaria,
      distribuicao:    f.distribuicao    ?? loaded.distribuicao,
      fiscalAtual:     f.fiscalAtual     ?? loaded.fiscalAtual,
      objetivos:       f.objetivos       ?? loaded.objetivos,
      intencoes:       f.intencoes       ?? loaded.intencoes,
      documentos:      f.documentos      ?? loaded.documentos,
      analiseInterna:  f.analiseInterna  ?? loaded.analiseInterna,
    };
    saveToStorage('clientProfile', merged);
    window.localStorage.removeItem('estudo360:v1:fichaState');
    window.localStorage.removeItem('recofatima:v1:fichaState');
    return merged;
  } catch {
    return loaded;
  }
}

interface TaxSimulatorState {
  profSit: string; currentInc: number; age: number; isMainAct: boolean;
  monthlyNeed: number; isServices: boolean; b2b: boolean; rev: number;
  isSeasonal: boolean; invEquip: number; invLic: number; invWorks: number;
  invFundo: number; fixedMo: number; varYr: number; accMoLda: number;
  accMoEni: number; anosAtividade: number; transparenciaFiscal: boolean;
  taxaDerramaMunicipal?: number;
}

interface VehicleSimulatorState {
  category: 'comercial' | 'passageiros'; engineType: string; price: number;
  ivaRegime: string; activity: string; maintenanceCost: number;
  insuranceCost: number; fuelCost: number; exemptTA: boolean; phevCompliant: boolean;
  agravamentoTA?: boolean;
}


interface SSState {
  income: number; regime: 'general' | 'simplified';
  tipoRendimento: 'servicos' | 'bens'; primeiroAno: boolean;
}

// Estados iniciais dos simuladores (Tax/Vehicle/Ticket/SS) vivem em
// src/lib/simDefaults.ts — partilhados com a vista "Exportar documentos" para
// não divergirem. Os restantes (Diagnóstico/Imóveis/IMT/Salário) ficam aqui.

const getInitialDiagnosticoState = (p: ClientProfileType, tax: TaxSimulatorState): DiagnosticoState => {
  // Balanço da contabilidade (SAF-T/perfil) preenche os pilares financeiros —
  // não voltar a pedir o que a app já sabe. Pilar 5 (operacional) fica manual.
  const k = (p.contabilidade ?? {}) as Partial<ClientProfileType['contabilidade']>;
  const n = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const ativoCorrente = n(k.inventarios) + n(k.clientes) + n(k.estadoOutrosAtivo) + n(k.outrosAtivosCorrentes) + n(k.caixaDepositos);
  const ativoTotal = ativoCorrente + n(k.ativoFixoTangivel) + n(k.ativoIntangivel) + n(k.investimentosFinanceiros);
  const passivoCorrente = n(k.fornecedores) + n(k.estadoOutrosPassivo) + n(k.outrosPassivos);
  const passivoTotal = passivoCorrente + n(k.financiamentosObtidos);
  const capitaisProprios = n(k.capitalRealizado) + n(k.reservasResultadosTransitados) + n(k.resultadoLiquido) + n(k.outrasVariacoesCapital);
  const rl = n(k.resultadoLiquido);
  return {
    capitaisProprios, ativoTotal, passivoTotal,
    ativoCorrente, passivoCorrente, disponibilidades: n(k.caixaDepositos),
    custoFixoMensal: tax.fixedMo || 0, resultadoLiquido: rl,
    volumeNegocios: p.faturaçaoAnualPrevista || 0,
    ebitda: rl < 0 ? 'negativo' : 'positivo',
    faturacaoMaiorCliente: n(k.vendasMaiorCliente),
    financiamentoExterno: n(k.financiamentosObtidos),
    // "Total de fontes de financiamento" inclui externos + capital dos sócios.
    totalFinanciamento: n(k.financiamentosObtidos) + n(k.capitalRealizado),
    processosDefinidos: false, softwareGestao: false, equipaAutonoma: false,
    baixaDependenciaGerente: false, controlFinanceiro: false,
  };
};

const getInitialImoveisState = (_p: ClientProfileType): ImoveisState => ({
  valorImovel: 0, tipoUso: 'comercial', temApoiosPT2030: false,
  horizonteInvestimento: 'longo', precisaLiquidezMensal: false,
  precisaReforcoCE: false, tipoAtividade: 'geral',
});

const getInitialIMTState = (p: ClientProfileType): IMTState => ({
  valor: 0, tipo: 'hpp', localizacao: 'continente',
  primeiraHabitacao: true, idadeComprador: p.idade || 0,
});

const getInitialSalarioState = (p: ClientProfileType): SalarioState => ({
  salarioBruto: 0,
  estadoCivil: p.estadoCivil === 'casado' ? 'casado_1titular' : 'solteiro',
  nrDependentes: p.nrDependentes || 0, localizacao: 'continente',
  duodecimos: false, subsidioAlimentacaoDiario: 0,
  tipoSubsidio: 'dinheiro', diasSubsidio: 22,
  irsJovem: p.beneficioJovem && (p.idade || 0) <= 35,
  anosAtividade: p.inicioAtividade > 0 ? Math.max(0, new Date().getFullYear() - p.inicioAtividade) : 0,
  idade: p.idade || 0,
  taxaSeguroTrabalho: 1.0,
  deficiente: false,
});

// IRS (Modelo 3) — pré-preenche o que o Perfil já sabe, sem inventar rendimentos.
// Casado / união de facto → tributação conjunta com 2 sujeitos passivos (o
// quociente familiar só fica correto com os dois no agregado). Rendimentos a 0.
const getInitialIRSState = (p: ClientProfileType): IRSState => {
  const base = defaultIRSState();
  const conjunto = p.estadoCivil === 'casado' || p.estadoCivil === 'uniao_facto';
  return {
    ...base,
    cenario: conjunto ? 'conjunto' : 'individual',
    dependentes: p.nrDependentes || 0,
    agregado: conjunto
      ? [
          base.agregado[0],
          { relacao: 'Sujeito Passivo B', nome: '', rendTrabalho: 0, contribuicoes: 0, retencao: 0, atividade: 0, coefAtividade: 0.75, irsJovemAno: 0, pagamentosConta: 0 },
        ]
      : base.agregado,
  };
};

// Collapsible section for the Ver SAFT modal
function SaftSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(true);
  return (
    <div className="border border-slate-200 rounded-[10px] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left gap-2"
      >
        <span className="text-[11px] font-[700] text-[#0F172A] uppercase tracking-[0.5px]">{title}</span>
        <span className="text-[10px] font-[600] text-slate-400 ml-auto mr-2">{count}</span>
        <svg viewBox="0 0 16 16" className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && <div className="px-3 py-1">{children}</div>}
    </div>
  );
}

// Inline fallback while a lazy chunk loads
function ViewLoading() {
  return (
    <div role="status" aria-live="polite" className="h-full flex items-center justify-center bg-[#F5F7FA]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-[#0677FF] animate-spin" aria-hidden="true" />
        <p className="text-[12px] font-[600] text-[#94A3B8]">A carregar…</p>
      </div>
    </div>
  );
}

// Funcionalidade D: os simuladores são por-cliente. Sem empresa selecionada,
// um simulador mostra este ecrã em vez de cálculos órfãos (que não poderiam ser
// guardados no histórico de ninguém).
function NoEmpresaGate({ onGo }: { onGo: () => void }) {
  return (
    <div className="h-full flex items-center justify-center bg-[#F5F7FA] px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-[#0677FF]/10 flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-7 h-7 text-[#0677FF]" aria-hidden="true" style={{ animation: 'none' }} />
        </div>
        <h2 className="text-[18px] font-[800] text-[#0F172A]">Escolhe primeiro um cliente</h2>
        <p className="text-[13px] text-[#64748B] font-[500] mt-2 leading-relaxed">
          Os simuladores trabalham sempre sobre uma empresa, para que cada simulação
          fique guardada no histórico do cliente certo.
        </p>
        <button
          type="button"
          onClick={onGo}
          className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-[12px] text-[14px] font-[800] text-white bg-gradient-to-r from-[#0677FF] to-[#044BB6] hover:brightness-105 active:scale-[0.98] transition-all shadow-lg shadow-[#0677FF]/30"
        >
          Ir para a Lista de Empresas
        </button>
      </div>
    </div>
  );
}

function AppContent() {
  const [loggedIn, setLoggedIn] = useState(() => loadFromStorage('loggedIn', false));
  // Mode is persisted: ao atualizar a página o utilizador continua no mesmo contexto.
  // Default = 'empresa' (CRM): após login vai directo para a Lista de Empresas. O
  // selector "Como queres trabalhar hoje?" foi removido do fluxo.
  const [mode, setMode] = useState<AppMode>(() => {
    const m = loadFromStorage<AppMode | null>('mode', null);
    return m === 'novo-cliente' || m === 'empresa' ? m : 'empresa';
  });
  // Auto-atualização: aviso "nova versão disponível" + deteção de edições por guardar.
  const [versionUpdate, setVersionUpdate] = useState(false);
  const getHasUnsavedEdits = useUnsavedEdits();
  const [view, setView] = useState<ViewType>(() => {
    // Restaura a vista onde o utilizador estava (refresh / auto-update não o
    // devem mandar de volta à Lista de Empresas). Valida contra a lista de
    // vistas conhecidas — um id estranho no storage cai no default do modo.
    const saved = loadFromStorage<ViewType | null>('lastView', null);
    if (saved && saved in VIEW_TITLES) return saved;
    const m = loadFromStorage<AppMode | null>('mode', null);
    const initialMode: AppMode = m === 'novo-cliente' || m === 'empresa' ? m : 'empresa';
    return DEFAULT_VIEW_BY_MODE[initialMode];
  });
  const [prevView, setPrevView] = useState<ViewType>('profile');
  // Bump para forçar refresh da Lista de Empresas após mutações (criar/eliminar/SAFT).
  const [empresasRefresh, setEmpresasRefresh] = useState(0);
  const [currentEmpresaId, setCurrentEmpresaIdState] = useState<string | null>(() => getCurrentEmpresaId());
  const [legalAnchor, setLegalAnchor] = useState<string | null>(null);
  const [saftModal, setSaftModal] = useState<{
    open: boolean;
    filled: string[];
    empty: string[];
    warnings: string[];
  } | null>(null);
  const [saftData, setSaftData] = useState<SAFTParseResult | null>(null);
  const [showSaftViewer, setShowSaftViewer] = useState(false);
  const [previSaState, setPreviSaState] = useState<PreviSaState>(() => {
    // Arranca com o Previsa da empresa ativa (se houver) — senão, limpo.
    const empId = getCurrentEmpresaId();
    const emp = empId ? getEmpresa(empId) : null;
    return { ...defaultPreviSaState(), ...(emp?.previsa ?? {}) };
  });
  // Carrega o perfil persistido. O perfil é o único estado de longa duração — guarda
  // o trabalho do consultor entre sessões. A antiga `fichaState` foi fundida aqui
  // via migração (loadProfileWithFichaMerge).
  const [clientProfile, setClientProfile] = useState<ClientProfileType>(() => {
    const legacy = loadProfileWithFichaMerge();
    migrateLegacyProfileIfNeeded(legacy);
    const empId = getCurrentEmpresaId();
    if (empId) {
      const emp = getEmpresa(empId);
      if (emp) return normalizeProfile(emp.profile);
    }
    return legacy;
  });
  // Estado inicial dos simuladores: arranca com o que está GUARDADO na empresa
  // ativa (emp.sims) — tal como o previSaState/clientProfile acima. Sem isto, o
  // efeito de persistência no mount sobreporia os dados guardados com defaults
  // vazios (perda de dados ao recarregar). Senão houver dados guardados, semeia
  // do perfil (getInitial*).
  const initSims = (() => {
    const id = getCurrentEmpresaId();
    const emp = id ? getEmpresa(id) : null;
    return (emp?.sims ?? {}) as Record<string, unknown>;
  })();
  const [taxState, setTaxState] = useState<TaxSimulatorState>(() => (initSims.tax as TaxSimulatorState) ?? getInitialTaxState(clientProfile));
  const [vehicleState, setVehicleState] = useState<VehicleSimulatorState>(() => (initSims.vehicle as VehicleSimulatorState) ?? getInitialVehicleState(clientProfile));
  const [ticketState, setTicketState] = useState<TicketSimulatorState>(() => (initSims.ticket as TicketSimulatorState) ?? getInitialTicketState(clientProfile));
  const [ssState, setSSState] = useState<SSState>(() => (initSims.selfss as SSState) ?? getInitialSSState(clientProfile));
  const [diagnosticoState, setDiagnosticoState] = useState<DiagnosticoState>(() => (initSims.diagnostico as DiagnosticoState) ?? getInitialDiagnosticoState(clientProfile, (initSims.tax as TaxSimulatorState) ?? getInitialTaxState(clientProfile)));
  const [imoveisState, setImoveisState] = useState<ImoveisState>(() => (initSims.imoveis as ImoveisState) ?? getInitialImoveisState(clientProfile));
  const [imtState, setImtState] = useState<IMTState>(() => (initSims.imt as IMTState) ?? getInitialIMTState(clientProfile));
  const [salarioState, setSalarioState] = useState<SalarioState>(() => (initSims.salario as SalarioState) ?? getInitialSalarioState(clientProfile));
  // IRS é por-cliente (carregado de emp.sims.irs ao selecionar a empresa) —
  // já NÃO usa uma chave global em localStorage, que fazia os dados de IRS
  // "vazarem" entre empresas.
  const [irsState, setIrsState] = useState<IRSState>(() => (initSims.irs as IRSState) ?? getInitialIRSState(clientProfile));

  // Funcionalidade D — guardar simulações no histórico do cliente.
  // `justSavedSim` é o feedback transitório do botão flutuante; `lastResumoRef`
  // guarda o último resumo-resultado publicado pelo simulador ativo (se algum),
  // que tem prioridade sobre o resumo derivado do estado. `reportResumo` tem
  // identidade estável (useRef) para o hook useReportResumo não disparar a cada
  // render do simulador.
  const [justSavedSim, setJustSavedSim] = useState(false);
  const lastResumoRef = useRef<string>('');
  const reportResumo = useRef((r: string) => { lastResumoRef.current = r; }).current;

  // Definições do escritório (branding + honorários). Persistidas em localStorage —
  // não pertencem ao cliente ativo, são definições de licenciado.
  const [officeSettings, setOfficeSettings] = useState<OfficeSettings>(() => loadOfficeSettings());
  const [honorariosConfig, setHonorariosConfig] = useState<HonorariosConfig>(() => loadHonorariosConfig());

  // Auto-save em localStorage — debounce implícito via React batching.
  useEffect(() => { saveToStorage('clientProfile', clientProfile); }, [clientProfile]);
  useEffect(() => { saveToStorage('loggedIn', loggedIn); }, [loggedIn]);
  useEffect(() => { saveToStorage('mode', mode); }, [mode]);
  useEffect(() => { saveToStorage('lastView', view); }, [view]);
  useEffect(() => { saveOfficeSettings(officeSettings); }, [officeSettings]);
  useEffect(() => { saveHonorariosConfig(honorariosConfig); }, [honorariosConfig]);

  // Auto-atualização: arranca o version-checker uma vez. Quando uma nova versão
  // é publicada, mostra o aviso e — se não houver edição de documento por guardar
  // — recarrega sozinho (senão fica o botão "Recarregar agora"). Assim ninguém
  // fica preso numa versão antiga. getHasUnsavedEdits tem identidade estável.
  useEffect(() => {
    initVersionChecker({
      pollIntervalMs: 20000,
      onUpdateAvailable: () => setVersionUpdate(true),
      checkUnsavedEdits: () => getHasUnsavedEdits(),
    });
    return () => stopVersionChecker();
  }, [getHasUnsavedEdits]);
  // Sincroniza alterações do perfil para a empresa atual no registry.
  useEffect(() => {
    if (currentEmpresaId) syncProfileIntoEmpresa(currentEmpresaId, clientProfile);
  }, [clientProfile, currentEmpresaId]);

  // Persiste o estado do Previsa na empresa atual (espelha o sync do perfil).
  // DEPOIS do sync do perfil de propósito: quando ambos mudam (ex.: abrir
  // empresa), este corre a seguir, lê a empresa já com o perfil novo e só
  // acrescenta `previsa` — sem sobrepor a escrita do perfil.
  useEffect(() => {
    if (!currentEmpresaId) return;
    const emp = getEmpresa(currentEmpresaId);
    if (emp) upsertEmpresa({ ...emp, previsa: previSaState });
  }, [previSaState, currentEmpresaId]);

  // Persiste o estado de TODOS os simuladores na empresa atual. É isto que dá
  // independência por cliente: cada empresa guarda os seus próprios dados de
  // simulador; ao reabri-la (selectEmpresa) carrega-se exatamente este snapshot.
  // Corre depois dos syncs de perfil/previsa para ler a empresa já atualizada.
  useEffect(() => {
    if (!currentEmpresaId) return;
    const emp = getEmpresa(currentEmpresaId);
    if (!emp) return;
    upsertEmpresa({
      ...emp,
      sims: {
        tax: taxState, vehicle: vehicleState, ticket: ticketState, selfss: ssState,
        diagnostico: diagnosticoState, imoveis: imoveisState, imt: imtState,
        salario: salarioState, irs: irsState,
      },
    });
  }, [taxState, vehicleState, ticketState, ssState, diagnosticoState, imoveisState, imtState, salarioState, irsState, currentEmpresaId]);

  // Auto-guarda no histórico do cliente a simulação ativa (quando tem dados),
  // ~1,2s após a última edição. Mantém UM só registo automático por simulador
  // (dedup em upsertAutoSimulacao) — por isso já não há botão "Guardar".
  useEffect(() => {
    if (!currentEmpresaId || !isSimView(view)) return; // narrows `view` para SimView
    const byView: Record<SimView, unknown> = {
      tax: taxState, vehicle: vehicleState, ticket: ticketState, selfss: ssState,
      diagnostico: diagnosticoState, imoveis: imoveisState, imt: imtState,
      salario: salarioState, irs: irsState, previsa: previSaState,
    };
    const state = byView[view];
    if (!simHasData(view, state)) return;
    const t = window.setTimeout(() => {
      upsertAutoSimulacao(currentEmpresaId, {
        tipo: view,
        label: SIM_LABELS[view],
        resumo: summarizeSimulacao(view, state),
        state,
        // Resultados calculados primeiro (r:true), depois os inputs-chave.
        detalhes: [
          ...resultSimulacao(view, state, clientProfile).map(d => ({ ...d, r: true })),
          ...detailSimulacao(view, state),
        ],
      });
      setEmpresasRefresh(n => n + 1);
    }, 1200);
    return () => window.clearTimeout(t);
  }, [currentEmpresaId, view, taxState, vehicleState, ticketState, ssState, diagnosticoState, imoveisState, imtState, salarioState, irsState, previSaState]);

  // ── Persistência permanente em Firestore ─────────────────────────────────
  // No arranque: faz merge com o que está na cloud (usa o NIF do escritório
  // como tenant-id, ou 'default' se ainda não estiver definido).
  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    (async () => {
      const merged = await syncEmpresasFromFirestore(officeSettings.nif);
      if (cancelled) return;
      setEmpresasRefresh(n => n + 1);
      // Se a empresa atual foi carregada da cloud, atualiza o perfil em memória.
      if (currentEmpresaId) {
        const emp = merged.find(e => e.id === currentEmpresaId);
        if (emp) loadEmpresaIntoState(emp);
      }
    })();
    return () => { cancelled = true; };
    // Intencionalmente apenas no login (não a cada mudança de office.nif para evitar
    // sync infinitos quando a UI das definições do escritório está aberta).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  // Empurra alterações ao registry para Firestore com debounce de 2s.
  useEffect(() => {
    if (!loggedIn) return;
    const t = setTimeout(() => {
      saveEmpresasToFirestore(officeSettings.nif, listEmpresas()).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [loggedIn, clientProfile, previSaState, currentEmpresaId, empresasRefresh, officeSettings.nif]);

  // Dropdown "Relatórios" da sidebar: documento a pré-selecionar na vista.
  const [relatorioDocPreselect, setRelatorioDocPreselect] = useState<string | null>(null);
  const openRelatorios = (docId: string) => { setRelatorioDocPreselect(docId); setView('exportar'); };

  // Ecrã-intro dos simuladores: ao escolher um simulador na sidebar aparece
  // primeiro um resumo da utilidade; só o botão "Simular" entra no formulário.
  // Restauros do histórico e navegação do bot entram diretos (não passam aqui).
  const [introFor, setIntroFor] = useState<ViewType | null>(null);
  useEffect(() => {
    if (introFor && view !== introFor) setIntroFor(null);
  }, [view, introFor]);

  // Aviso visível quando a sincronização cloud falha (antes falhava em silêncio
  // e os computadores divergiam sem ninguém saber). Limpa ao primeiro sucesso.
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  useEffect(() => {
    const onSync = (ev: Event) => {
      const d = (ev as CustomEvent).detail as { ok: boolean; reason?: string } | undefined;
      setCloudSyncError(d?.ok ? null : (d?.reason || 'erro desconhecido'));
    };
    window.addEventListener('estudo360:cloud-sync', onSync);
    return () => window.removeEventListener('estudo360:cloud-sync', onSync);
  }, []);

  // Sync document.title with the active view (helps history & screen readers)
  useEffect(() => {
    document.title = `${VIEW_TITLES[view]} · Estudo 360`;
  }, [view]);

  useEffect(() => {
    const main = document.getElementById('main-content');
    if (main) main.scrollTop = 0;
  }, [view]);

  // Close the SAFT modal with Escape
  useEffect(() => {
    if (!saftModal?.open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSaftModal(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [saftModal?.open]);

  // Close the SAFT viewer with Escape
  useEffect(() => {
    if (!showSaftViewer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowSaftViewer(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showSaftViewer]);

  // Input escondido que o AI Contabilista aciona para importar um SAF-T. O alvo
  // (criar cliente novo, ou substituir/importar no cliente ativo) é guardado num
  // ref antes de abrir o seletor de ficheiro. Estes refs têm de viver ANTES do
  // return condicional do login — hooks depois dele mudam a contagem entre
  // renders e crasham a app (React #310).
  const botSaftInputRef = useRef<HTMLInputElement>(null);
  const botSaftTargetRef = useRef<'novo' | 'empresa'>('novo');

  if (!loggedIn) {
    return <LandingPage onEnter={() => setLoggedIn(true)} />;
  }

  // O selector "Como queres trabalhar hoje?" foi removido: após login vai-se directo
  // para a sidebar no modo `empresa` (Lista de Empresas). O utilizador troca de modo
  // via o pill no topo da sidebar.
  const backToModeSelection = () => {
    setMode('empresa');
    setView('empresas');
  };

  // Trocar de modo directamente a partir da sidebar. "Novo Cliente" é sempre um
  // rascunho LIMPO e não ligado a nenhuma empresa — só entra na lista quando se
  // carrega em "Guardar cliente". Por isso, ao entrar nesse modo, esvaziamos o
  // perfil/Previsa e largamos a empresa ativa.
  const selectMode = (m: AppMode) => {
    setMode(m);
    if (m === 'novo-cliente') {
      setCurrentEmpresaId(null);
      setCurrentEmpresaIdState(null);
      setClientProfile({ ...defaultProfile });
      setPreviSaState(defaultPreviSaState());
    }
    setView(DEFAULT_VIEW_BY_MODE[m]);
  };

  // Seleciona o cliente ativo (perfil + Previsa) sem mudar de vista.
  const selectEmpresa = (id: string): boolean => {
    const emp = getEmpresa(id);
    if (!emp) return false;
    setCurrentEmpresaId(id);
    setCurrentEmpresaIdState(id);
    // Carrega o estado COMPLETO desta empresa (perfil + simuladores + Previsa).
    // Cada cliente tem o seu — não há herança do cliente anterior.
    loadEmpresaIntoState(emp);
    return true;
  };

  const openEmpresa = (id: string) => {
    if (selectEmpresa(id)) setView('profile');
  };

  // Navegação por cliente: usada pelos dropdowns dos cartões na Lista de Empresas.
  // Seleciona o cliente e abre directamente a vista pedida (perfil, simulador,
  // histórico…). Para "Pacote cliente" e "Vista detalhada", regista a intenção
  // que o ClientProfile consome ao montar.
  const navigateClient = (empId: string, view: string, opts?: { openPackage?: boolean; toggleFlow?: boolean; skipIntro?: boolean }) => {
    if (!selectEmpresa(empId)) return;
    setMode('empresa');
    if (opts?.openPackage) requestOpenPackage();
    if (opts?.toggleFlow) requestFlowToggle();
    // Simulador escolhido no menu → mostra primeiro o ecrã-intro ("Simular" entra).
    // Os cards da galeria do cliente já explicam o simulador → entram diretos.
    if (SIM_INTROS[view] && !opts?.skipIntro) setIntroFor(view as ViewType);
    else setIntroFor(null);
    setView(view as ViewType);
  };

  // Clique no cartão da Lista: seleciona o cliente para trabalhar e FICA na lista
  // (o dropdown do cartão mostra o histórico; perfil/simuladores via sidebar).
  const selectEmpresaParaTrabalhar = (empId: string) => {
    if (!selectEmpresa(empId)) return;
    setMode('empresa');
  };

  // Restauro de simulação a partir do dropdown da Lista de Empresas: seleciona
  // o cliente (carrega o estado dele) e só depois aplica o snapshot + navega.
  const restoreSimulacaoCliente = (empId: string, rec: SimulationRecord) => {
    if (!selectEmpresa(empId)) return;
    setMode('empresa');
    restoreSimulacao(rec);
  };

  /** Eliminação AUTORITATIVA: remove do localStorage E propaga já ao Firestore.
   *  Sem isto, o merge de arranque (união por id) ressuscitava a empresa apagada
   *  a partir da cloud ("Hydra"). Também limpa o currentEmpresaId em memória. */
  const handleDeleteEmpresa = (id: string) => {
    deleteEmpresa(id);
    if (currentEmpresaId === id) {
      setCurrentEmpresaIdState(null);
      setClientProfile({ ...defaultProfile });
    }
    setEmpresasRefresh(n => n + 1);
    // Propaga a lista já reduzida — síncrono o suficiente para o próximo arranque
    // ler o Firestore sem a empresa apagada.
    saveEmpresasToFirestore(officeSettings.nif, listEmpresas()).catch(() => {});
  };

  // "Inserir à mão": NÃO cria já a empresa. Abre um rascunho limpo no modo
  // "Novo Cliente" para o utilizador preencher; só entra na lista ao "Guardar".
  const handleNovaEmpresaManual = () => {
    setCurrentEmpresaId(null);
    setCurrentEmpresaIdState(null);
    // Rascunho limpo: perfil e simuladores do zero, sem herdar o cliente anterior.
    seedFreshFromProfile({ ...defaultProfile });
    setMode('novo-cliente');
    setView('profile');
  };

  // "Guardar cliente": cria a empresa a partir do rascunho preenchido, adiciona-a
  // à lista e abre-a no modo Empresa. O modo "Novo Cliente" volta a abrir limpo
  // na próxima vez (selectMode).
  const handleSaveNewClient = () => {
    const id = newEmpresaId();
    const now = Date.now();
    upsertEmpresa({
      id,
      nome: clientProfile.nomeCliente?.trim() || 'Cliente sem nome',
      nif: clientProfile.nif?.trim() || '',
      createdAt: now,
      updatedAt: now,
      profile: clientProfile,
      previsa: previSaState,
    });
    setCurrentEmpresaId(id);
    setCurrentEmpresaIdState(id);
    setMode('empresa');
    setView('profile');
    setEmpresasRefresh(n => n + 1);
  };

  const handleEmpresaSAFT = (file: File, empId: string) => {
    setCurrentEmpresaId(empId);
    setCurrentEmpresaIdState(empId);
    handleSAFTUpload(file);
  };

  /** Fluxo: cria empresa nova vazia, define como ativa, importa SAFT (preenche o perfil
   *  e leva à vista Perfil via handleSAFTUpload). O useEffect de sync grava os dados
   *  do SAFT na empresa recém-criada. */
  const handleNovaEmpresaFromSAFT = (file: File) => {
    const id = newEmpresaId();
    upsertEmpresa({
      id,
      nome: '',
      nif: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      profile: { ...defaultProfile },
    });
    setCurrentEmpresaId(id);
    setCurrentEmpresaIdState(id);
    setEmpresasRefresh(n => n + 1);
    handleSAFTUpload(file);
  };

  const openLegal = () => { setPrevView(view); setLegalAnchor(null); setView('legal'); };
  const closeLegal = () => setView(prevView);

  const handleSAFTUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        // Descodifica respeitando o encoding declarado no XML (UTF-8 nos SAF-T
        // recentes, Windows-1252 nos antigos) — evita acentos corrompidos como
        // "Atlântico" → "AtlÃ¢ntico".
        const text = decodeSaftText(reader.result as ArrayBuffer);
        const result = parseSAFT(text);

        if (Object.keys(result.profile).length === 0) {
          setSaftModal({ open: true, filled: [], empty: result.empty ?? [], warnings: ['Nenhum campo reconhecido foi encontrado no ficheiro SAF-T.'] });
          return;
        }

        // Reset all fields to default (empty) before applying SAFT data.
        // Semeia o estado do zero a partir do perfil do SAF-T — os simuladores
        // deste cliente não herdam dados de nenhuma importação anterior.
        const newProfile = { ...defaultProfile, ...result.profile };
        // Dados do Balanço/contabilidade extraídos do SAF-T (classes 1–5/8) —
        // preenchem o que faltava nos documentos (Balanço, imposto, caixa).
        if (result.contabilidade && Object.keys(result.contabilidade).length > 0) {
          newProfile.contabilidade = { ...defaultProfile.contabilidade, ...result.contabilidade };
        }
        // Saldos de abertura (= fecho do ano anterior) — coluna do ano anterior
        // do Balanço e posição inicial das Alterações no Capital Próprio.
        if (result.contabilidadeAbertura && Object.keys(result.contabilidadeAbertura).length > 0) {
          newProfile.contabilidadeAbertura = result.contabilidadeAbertura;
        }
        seedFreshFromProfile(newProfile);
        setView('profile');
        setSaftData(result);
        // Previsa parte de um estado LIMPO + o que o SAF-T preencheu — evita
        // herdar dados de uma empresa importada antes. Guarda-se também na empresa
        // (abaixo) para persistir e sincronizar como os outros dados do cliente.
        const newPrevisa: PreviSaState = { ...defaultPreviSaState(), ...(result.previsa ?? {}) };
        setPreviSaState(newPrevisa);

        // Guarda o SAF-T em bruto na empresa atual para poder re-exportá-lo
        // depois. Usa o id da storage (o state pode estar stale neste callback
        // assíncrono do FileReader). syncProfileIntoEmpresa espalha ...emp, por
        // isso o saftXml sobrevive às escritas seguintes do perfil.
        const empId = getCurrentEmpresaId();
        if (empId) {
          const emp = getEmpresa(empId);
          // Guarda já com a declaração normalizada a UTF-8: o texto é Unicode e
          // a re-exportação (Blob) escreve bytes UTF-8 — declaração e bytes têm
          // de coincidir para o ficheiro reimportar bem.
          // saftReprocessadoEm/Rev: este import já derivou tudo (fluxos, abertura,
          // vendas) — marca como processado na revisão atual para o re-parse
          // silencioso do Exportar não correr (e para um REimport não ficar
          // bloqueado por uma marca antiga).
          if (emp) upsertEmpresa({ ...emp, saftXml: normalizeXmlEncodingToUtf8(text), saftFileName: file.name, saftImportedAt: Date.now(), saftReprocessadoEm: Date.now(), saftReparseRev: SAFT_REPARSE_REV, previsa: newPrevisa });
        }

        // Em vez do resumo modal, abre logo o visualizador "Dados extraídos do
        // SAF-T" (mostra campos preenchidos, vazios e avisos). saftData já está
        // definido acima, por isso o visualizador tem o que mostrar.
        setShowSaftViewer(true);
      } catch (err) {
        setSaftModal({
          open: true,
          filled: [],
          empty: [],
          warnings: [err instanceof Error ? err.message : 'Erro ao processar o ficheiro SAF-T.'],
        });
      }
    };
    reader.onerror = () => setSaftModal({ open: true, filled: [], empty: [], warnings: ['Não foi possível ler o ficheiro.'] });
    // Lê os bytes em bruto; decodeSaftText() escolhe o charset pelo declarado no XML.
    reader.readAsArrayBuffer(file);
  };
  const handleLogout = () => {
    setLoggedIn(false);
    setMode('empresa');
    setView('empresas');
    clearStorage('loggedIn');
    clearStorage('mode');
  };
  // Deep-link from Ficha → Legal at a given anchor.
  // The anchor is passed via state; LegalInfo handles the scroll on mount via useEffect,
  // which avoids the previous race condition with setTimeout(50).
  const openLegalAt = (anchor: string) => {
    setPrevView(view);
    setLegalAnchor(anchor);
    setView('legal');
  };

  const updateProfileWithSimulatorSync = (rawProfile: ClientProfileType) => {
    // Guarda-rede central: impõe as regras fiscais duras (regime de IVA e de
    // contabilidade derivados da faturação) antes de qualquer escrita. Vale para
    // o formulário, o wizard e o preenchimento feito pelo AI Contabilista —
    // impossível guardar uma combinação ilegal (ex.: isento a faturar > 15.000€).
    const newProfile = enforceProfileRules(rawProfile);
    setClientProfile(newProfile);
    setTaxState(prev => ({
      ...prev,
      age: newProfile.idade,
      isMainAct: newProfile.tipoEntidade !== 'eni',
      isServices: newProfile.atividadePrincipal === 'servicos',
      rev: newProfile.faturaçaoAnualPrevista,
      isSeasonal: newProfile.isSazonal,
      anosAtividade: Math.max(0, new Date().getFullYear() - newProfile.inicioAtividade),
      transparenciaFiscal: newProfile.regimeContabilidade === 'transparencia_fiscal',
    }));
    setTicketState(prev => ({ ...prev, employees: newProfile.nrFuncionarios, ticketValue: newProfile.valorTicket }));
    setSSState(prev => ({ ...prev, income: newProfile.rendimentoMensalEni, regime: 'simplified', tipoRendimento: newProfile.tipoRendimentoSs }));
    setDiagnosticoState(prev => ({ ...prev, volumeNegocios: newProfile.faturaçaoAnualPrevista }));
    setSalarioState(prev => ({
      ...prev,
      estadoCivil: newProfile.estadoCivil === 'casado' ? 'casado_1titular' : 'solteiro',
      nrDependentes: newProfile.nrDependentes,
      irsJovem: newProfile.beneficioJovem && newProfile.idade <= 35,
      idade: newProfile.idade,
      anosAtividade: Math.max(0, new Date().getFullYear() - newProfile.inicioAtividade),
    }));
    setImtState(prev => ({ ...prev, idadeComprador: newProfile.idade }));
  };

  // Carrega o estado COMPLETO de uma empresa (perfil + todos os simuladores +
  // Previsa) a partir do seu registo. Cada cliente tem o SEU estado: ao trocar
  // de empresa carrega-se o que ficou guardado nessa empresa, ou — se ainda não
  // tiver dados de um simulador — semeia-se a partir do perfil DESSA empresa.
  // Nunca se herda o estado do cliente anterior (dados não-transversais entre
  // empresas). Dentro da mesma empresa mantêm-se transversais (derivam do perfil).
  const loadEmpresaIntoState = (emp: EmpresaRecord) => {
    const sims = (emp.sims ?? {}) as Record<string, unknown>;
    // Normaliza o perfil da empresa: perfis legados/cloud podem não trazer todos
    // os objetos aninhados (custos, contabilidade, …) e a vista de Perfil rebenta.
    const profile = normalizeProfile(emp.profile);
    const tax = (sims.tax as TaxSimulatorState) ?? getInitialTaxState(profile);
    setClientProfile(profile);
    setTaxState(tax);
    setVehicleState((sims.vehicle as VehicleSimulatorState) ?? getInitialVehicleState(profile));
    setTicketState((sims.ticket as TicketSimulatorState) ?? getInitialTicketState(profile));
    setSSState((sims.selfss as SSState) ?? getInitialSSState(profile));
    setDiagnosticoState((sims.diagnostico as DiagnosticoState) ?? getInitialDiagnosticoState(profile, tax));
    setImoveisState((sims.imoveis as ImoveisState) ?? getInitialImoveisState(profile));
    setImtState((sims.imt as IMTState) ?? getInitialIMTState(profile));
    setSalarioState((sims.salario as SalarioState) ?? getInitialSalarioState(profile));
    setIrsState((sims.irs as IRSState) ?? getInitialIRSState(profile));
    setPreviSaState({ ...defaultPreviSaState(), ...(emp.previsa ?? {}) });
    // Reconstrói os dados do SAF-T deste cliente a partir do XML guardado, para
    // que o botão "Ver dados do SAF-T" esteja SEMPRE disponível em clientes que
    // já têm SAF-T associado (não só na sessão em que foi importado).
    if (emp.saftXml) {
      try { setSaftData(parseSAFT(emp.saftXml)); }
      catch { setSaftData(null); }
    } else {
      setSaftData(null);
    }
  };

  // Semeia o estado a partir de um perfil "do zero" (cliente novo manual ou
  // import de SAF-T): perfil + todos os simuladores re-semeados a partir do
  // perfil, sem herdar nada do cliente anterior. Como os getInitial* já não têm
  // dados fantasma, os simuladores partem vazios e só ganham o que vem do perfil.
  const seedFreshFromProfile = (profile: ClientProfileType) => {
    setClientProfile(profile);
    setTaxState(getInitialTaxState(profile));
    setVehicleState(getInitialVehicleState(profile));
    setTicketState(getInitialTicketState(profile));
    setSSState(getInitialSSState(profile));
    setDiagnosticoState(getInitialDiagnosticoState(profile, getInitialTaxState(profile)));
    setImoveisState(getInitialImoveisState(profile));
    setImtState(getInitialIMTState(profile));
    setSalarioState(getInitialSalarioState(profile));
    setIrsState(getInitialIRSState(profile));
    setPreviSaState(defaultPreviSaState());
    setSaftData(null); // cliente novo / sem SAF-T ainda (o import define-o a seguir)
  };

  const handleTaxStateChange = (newState: TaxSimulatorState) => {
    setTaxState(newState);
    setClientProfile(prev => ({
      ...prev,
      idade: newState.age,
      atividadePrincipal: newState.isServices ? 'servicos' : 'bens',
      faturaçaoAnualPrevista: newState.rev,
      isSazonal: newState.isSeasonal,
      regimeContabilidade: newState.transparenciaFiscal
        ? 'transparencia_fiscal'
        : prev.regimeContabilidade === 'transparencia_fiscal' ? 'organizada' : prev.regimeContabilidade,
    }));
    setDiagnosticoState(prev => ({ ...prev, custoFixoMensal: newState.fixedMo, volumeNegocios: newState.rev }));
  };

  const handleTicketStateChange = (newState: TicketSimulatorState) => {
    setTicketState(newState);
    setClientProfile(prev => ({ ...prev, nrFuncionarios: newState.employees, valorTicket: newState.ticketValue }));
  };

  const handleSSStateChange = (newState: SSState) => {
    setSSState(newState);
    setClientProfile(prev => ({ ...prev, rendimentoMensalEni: newState.income, regimeSs: 'simplified', tipoRendimentoSs: newState.tipoRendimento }));
  };

  // ── Funcionalidade D: guardar / restaurar simulações por cliente ──────────
  // Todos os simuladores são controlados a partir daqui, por isso o estado de
  // cada um já vive no App — basta fotografá-lo. As chaves coincidem com o
  // `tipo` do SimulationRecord (= a view do simulador).
  const simStateByView: Record<SimView, unknown> = {
    tax: taxState, vehicle: vehicleState, ticket: ticketState, selfss: ssState,
    diagnostico: diagnosticoState, imoveis: imoveisState, imt: imtState,
    salario: salarioState, irs: irsState, previsa: previSaState,
  };

  const saveSimulacao = () => {
    if (!currentEmpresaId || !isSimView(view)) return;
    const state = simStateByView[view];
    const resumo = lastResumoRef.current || summarizeSimulacao(view, state);
    const rec = addSimulacao(currentEmpresaId, { tipo: view, label: SIM_LABELS[view], resumo, state });
    if (!rec) return;
    setEmpresasRefresh(n => n + 1); // dispara o push debounced para Firestore
    setJustSavedSim(true);
    window.setTimeout(() => setJustSavedSim(false), 1800);
  };

  const restoreSimulacao = (rec: SimulationRecord) => {
    const setters: Partial<Record<SimView, (s: any) => void>> = {
      tax: setTaxState, vehicle: setVehicleState, ticket: setTicketState, selfss: setSSState,
      diagnostico: setDiagnosticoState, imoveis: setImoveisState, imt: setImtState,
      salario: setSalarioState, irs: setIrsState, previsa: setPreviSaState,
    };
    if (!isSimView(rec.tipo)) return;
    const setter = setters[rec.tipo];
    if (setter && rec.state != null) setter(rec.state);
    lastResumoRef.current = ''; // a próxima gravação recalcula o resumo
    setView(rec.tipo);
  };

  const simSaveCtx: SimSaveCtx = {
    enabled: !!currentEmpresaId && isSimView(view),
    justSaved: justSavedSim,
    save: saveSimulacao,
    reportResumo,
  };

  // Current simulator content
  // Funcionalidade D: simuladores são por-cliente — sem empresa ativa mostram o gate.
  const simGate = <NoEmpresaGate onGo={() => { setMode('empresa'); setView('empresas'); }} />;

  // Rascunho de cliente novo (modo "Novo Cliente", a preencher, ainda sem empresa).
  // Mostra a barra "Guardar cliente" em baixo — tanto no perfil como na pré-visualização
  // do enquadramento fiscal (para o utilizador poder ver o simulador e voltar/guardar).
  const draftNewClient = mode === 'novo-cliente' && !currentEmpresaId && (view === 'profile' || view === 'tax');

  // ── Bridge para o AI Contabilista ─────────────────────────────────────────
  // Dá ao bot poderes de navegação + preenchimento de campos, e um contexto
  // ANONIMIZADO (sem NIF/nomes/valores — RGPD) para enviar ao modelo.
  const fillSimSetters: Record<string, React.Dispatch<React.SetStateAction<any>>> = {
    tax: setTaxState, vehicle: setVehicleState, ticket: setTicketState, selfss: setSSState,
    diagnostico: setDiagnosticoState, imoveis: setImoveisState, imt: setImtState,
    salario: setSalarioState, irs: setIrsState, previsa: setPreviSaState,
  };
  const botBridge: BotBridge = {
    currentUser: officeSettings.nome?.trim() || undefined,
    currentView: VIEW_TITLES[view],
    navigate: (v) => setView(v as ViewType),
    setMode: (m) => { if (m === 'novo-cliente') handleNovaEmpresaManual(); else selectMode('empresa'); },
    openSaftUpload: (mode = 'novo') => {
      // Para "empresa" é preciso um cliente ativo. Lê da lib (síncrono) e não do
      // estado React: o chip do bot seleciona o cliente e abre o seletor no MESMO
      // clique, antes de o estado re-renderizar.
      if (mode === 'empresa' && !getCurrentEmpresaId()) return { ok: false, reason: 'sem-cliente' };
      botSaftTargetRef.current = mode;
      botSaftInputRef.current?.click();
      return { ok: true };
    },
    listDownloadableDocs: () => [
      { id: 'previsa', label: 'Previsa (Excel Modelo 22)' },
      ...DOC_TYPES.map((d) => ({ id: d.id, label: d.label })),
    ],
    downloadDoc: async (docId) => {
      // Lê o cliente ativo da lib — fresco mesmo se acabou de ser selecionado.
      const empId = getCurrentEmpresaId();
      const emp = empId ? getEmpresa(empId) : null;
      if (!emp) return { ok: false, reason: 'sem-cliente' };
      try {
        if (docId === 'previsa') {
          await downloadPrevisaExcel(previSaState, emp.nome || emp.profile?.nomeCliente || '');
          return { ok: true, label: 'Previsa (Excel Modelo 22)' };
        }
        const def = DOC_TYPES.find((d) => d.id === docId);
        if (!def) return { ok: false, reason: 'desconhecido' };
        downloadAsWord(def.build(emp, officeSettings), def.filename(emp));
        return { ok: true, label: def.label };
      } catch (e) {
        console.error('Falha ao gerar documento para download:', e);
        return { ok: false, reason: 'erro' };
      }
    },
    applyFill: (target, fields) => {
      if (target === 'profile') {
        let np = clientProfile;
        for (const f of fields) np = setByPath(np, f.path, f.value);
        updateProfileWithSimulatorSync(np);
        setView('profile');
      } else {
        const setter = fillSimSetters[target];
        if (!setter) return;
        setter((prev: any) => { let n = prev; for (const f of fields) n = setByPath(n, f.path, f.value); return n; });
        setView(target as ViewType);
      }
    },
    listClients: () => listEmpresas().map((e) => ({ id: e.id, name: e.nome || 'Sem nome' })),
    selectClient: (name) => {
      const q = name.trim().toLowerCase();
      if (!q) return { ok: false };
      const all = listEmpresas();
      const hit = all.find((e) => (e.nome || '').toLowerCase() === q)
        ?? all.find((e) => (e.nome || '').toLowerCase().includes(q));
      if (!hit) return { ok: false };
      selectEmpresa(hit.id);
      setMode('empresa');
      return { ok: true, name: hit.nome || 'Sem nome' };
    },
    getContext: () => {
      const p = clientProfile;
      const yn = (b: boolean) => (b ? 'preenchido' : 'vazio');
      const activeName = currentEmpresaId ? (getEmpresa(currentEmpresaId)?.nome || 'Sem nome') : null;
      const all = listEmpresas();
      const lines = [
        `Modo de trabalho: ${mode === 'empresa' ? 'Empresa (CRM, lista de clientes)' : 'Novo Cliente (rascunho)'}`,
        `Vista aberta: ${VIEW_TITLES[view]}`,
        `Cliente ativo: ${activeName ? `"${activeName}"` : 'nenhum — os simuladores e os documentos precisam de um cliente ativo'}`,
        `Nº de clientes guardados: ${all.length}`,
        all.length ? `Clientes guardados (nomes): ${all.map((e) => e.nome || 'Sem nome').join('; ')}` : 'Ainda não há clientes guardados.',
        `Definições do escritório: ${officeSettings.nome?.trim() ? 'preenchidas' : 'por preencher (nome/NIF/IBAN)'}`,
      ];
      if (currentEmpresaId) {
        lines.push(
          'Estado do perfil do cliente (sem revelar valores):',
          `- Faturação anual prevista: ${yn((p.faturaçaoAnualPrevista || 0) > 0)}`,
          `- Nº de funcionários: ${yn((p.nrFuncionarios || 0) > 0)}`,
          `- Atividade principal: ${p.atividadePrincipal || 'por definir'}`,
          `- Tipo de entidade: ${p.tipoEntidade || 'por definir'}`,
        );
      }
      return lines.join('\n');
    },
  };

  const content = (
    <Suspense fallback={<ViewLoading />}>
      <PageTransition pageKey={view}>
        {introFor && view === introFor && SIM_INTROS[introFor] && (
          <SimIntro
            view={introFor}
            onSimular={() => setIntroFor(null)}
            onVoltar={() => { setIntroFor(null); setView('empresas'); }}
          />
        )}
        {view === 'hub' && (currentEmpresaId
          ? <ClientHub
              clientName={clientProfile.nomeCliente?.trim() || 'Cliente sem nome'}
              onNavigate={(v, opts) => navigateClient(currentEmpresaId, v, opts)}
            />
          : simGate)}
        {view === 'empresas' && (
          <EmpresasList
            refreshKey={empresasRefresh}
            currentEmpresaId={currentEmpresaId}
            onNavigate={navigateClient}
            onSelect={selectEmpresaParaTrabalhar}
            onRestoreSimulacao={restoreSimulacaoCliente}
            onHistoricoChanged={() => setEmpresasRefresh(n => n + 1)}
            onNovaEmpresaManual={handleNovaEmpresaManual}
            onNovaEmpresaFromSAFT={handleNovaEmpresaFromSAFT}
            onSAFTUpload={handleEmpresaSAFT}
            onDeleteEmpresa={handleDeleteEmpresa}
          />
        )}
        {view === 'profile' && (
          <ClientProfile profile={clientProfile} onChange={updateProfileWithSimulatorSync}
            taxState={taxState} vehicleState={vehicleState} ticketState={ticketState} ssState={ssState}
            office={officeSettings} honorarios={honorariosConfig}
            onGoToOfficeSettings={() => setView('office-settings')} />
        )}
        {view === 'tax' && introFor !== 'tax' && ((currentEmpresaId || mode === 'novo-cliente')
          ? <TaxSimulator initialState={taxState} onStateChange={handleTaxStateChange} profile={clientProfile} />
          : simGate)}
        {view === 'vehicle' && introFor !== 'vehicle' && (currentEmpresaId
          ? <VehicleSimulator initialState={vehicleState} onStateChange={setVehicleState} />
          : simGate)}
        {view === 'ticket' && introFor !== 'ticket' && (currentEmpresaId
          ? <TicketSimulator initialState={ticketState} onStateChange={handleTicketStateChange} profile={clientProfile} />
          : simGate)}
        {view === 'selfss' && introFor !== 'selfss' && (currentEmpresaId
          ? <SelfEmployedSSSimulator initialState={ssState} onStateChange={handleSSStateChange} />
          : simGate)}
        {view === 'diagnostico' && introFor !== 'diagnostico' && (currentEmpresaId
          ? <DiagnosticoAutonomia initialState={diagnosticoState} onStateChange={setDiagnosticoState} />
          : simGate)}
        {view === 'imoveis' && introFor !== 'imoveis' && (currentEmpresaId
          ? <ImoveisEmpresa initialState={imoveisState} onStateChange={setImoveisState} profile={clientProfile} />
          : simGate)}
        {view === 'imt' && introFor !== 'imt' && (currentEmpresaId
          ? <IMTSimulator initialState={imtState} onStateChange={setImtState} />
          : simGate)}
        {view === 'salario' && introFor !== 'salario' && (currentEmpresaId
          ? <SalarioLiquidoSimulator initialState={salarioState} onStateChange={setSalarioState} />
          : simGate)}
        {view === 'irs' && introFor !== 'irs' && (currentEmpresaId
          ? <IRSSimulator initialState={irsState} onStateChange={setIrsState} />
          : simGate)}
        {view === 'previsa' && introFor !== 'previsa' && (currentEmpresaId
          ? <PreviSaSimulator initialState={previSaState} onStateChange={setPreviSaState} />
          : simGate)}
        {view === 'historico' && (
          <SimulacoesHistory
            empresaId={currentEmpresaId}
            empresaNome={clientProfile.nomeCliente || ''}
            onRestore={restoreSimulacao}
            onChanged={() => setEmpresasRefresh(n => n + 1)}
            refreshKey={empresasRefresh}
          />
        )}
        {view === 'exportar' && (
          <ExportarRelatorio office={officeSettings} honorarios={honorariosConfig} currentEmpresaId={currentEmpresaId} initialDocId={relatorioDocPreselect} onOpenPrevisa={(empId) => navigateClient(empId, 'previsa')} onGoToOfficeSettings={() => setView('office-settings')} />
        )}
        {view === 'legal' && (
          <LegalInfo onBack={closeLegal} clientProfile={clientProfile} vehicleState={vehicleState} ticketState={ticketState} initialAnchor={legalAnchor} />
        )}
        {view === 'office-settings' && (
          <OfficeSettingsView
            office={officeSettings}
            onOfficeChange={setOfficeSettings}
            honorarios={honorariosConfig}
            onHonorariosChange={setHonorariosConfig}
          />
        )}
      </PageTransition>
      {/* Folga no fim do scroll para a barra fixa "Guardar cliente" não tapar
          os últimos campos do formulário. */}
      {draftNewClient && <div aria-hidden style={{ height: 96 }} />}
    </Suspense>
  );

  const CurrentLayout = LAYOUTS[0].component;

  return (
    <SimulacaoSaveProvider value={simSaveCtx}>
    <div className="h-screen flex flex-col overflow-hidden">

      {/* Skip link for keyboard users */}
      <a href="#main-content" className="skip-link">Saltar para conteúdo principal</a>

      {/* ── SAF-T import result modal ── */}
      {saftModal?.open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="saft-modal-title"
          className="fixed inset-0 z-[1000] flex items-center justify-center p-6"
        >
          <button
            type="button"
            aria-label="Fechar diálogo"
            onClick={() => setSaftModal(null)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
          />
          <div className="relative bg-white rounded-[28px] shadow-2xl max-w-lg w-full overflow-hidden max-h-[85vh] flex flex-col">
            {/* Accent bar */}
            <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-emerald-500 w-full" />
            <div className="p-8 flex flex-col gap-4 overflow-y-auto">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" aria-hidden="true">
                    <path d="M5 12l5 5L20 7" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h2 id="saft-modal-title" className="text-[20px] font-[800] text-[#0F172A] leading-tight">
                    Dados importados do SAF-T
                  </h2>
                  <p className="text-[13px] text-[#64748B] font-[500]">
                    {saftModal.filled.length} campo{saftModal.filled.length !== 1 ? 's' : ''} preenchido{saftModal.filled.length !== 1 ? 's' : ''} automaticamente
                  </p>
                </div>
              </div>

              {/* Filled fields */}
              {saftModal.filled.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-[12px] p-4">
                  <h3 className="text-[12px] font-[700] uppercase tracking-[0.5px] text-emerald-700 mb-2">✓ Preenchidos pelo SAF-T</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {saftModal.filled.map((f) => (
                      <span key={f} className="text-[11px] font-[600] bg-white text-emerald-700 px-2 py-1 rounded-[6px] border border-emerald-200">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty fields */}
              {saftModal.empty.length > 0 && (
                <div className="bg-slate-50 border border-slate-100 rounded-[12px] p-4">
                  <h3 className="text-[12px] font-[700] uppercase tracking-[0.5px] text-slate-500 mb-2">○ Não preenchidos (SAFT não continha estes dados)</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {saftModal.empty.map((f) => (
                      <span key={f} className="text-[11px] font-[500] bg-white text-slate-500 px-2 py-1 rounded-[6px] border border-slate-200">
                        {f}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2 font-[500]">
                    Estes campos foram deixados em vazio. Preencha manualmente no Perfil do Cliente.
                  </p>
                </div>
              )}

              {/* Warnings */}
              {saftModal.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-[12px] p-4">
                  <h3 className="text-[12px] font-[700] uppercase tracking-[0.5px] text-amber-700 mb-2">⚠ Avisos</h3>
                  <ul className="space-y-1">
                    {saftModal.warnings.map((w, i) => (
                      <li key={i} className="text-[12px] text-amber-800 font-[500]">{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 w-full pt-2">
                <button
                  type="button"
                  onClick={() => setSaftModal(null)}
                  className="flex-1 py-3 rounded-[12px] text-[14px] font-[700] bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] transition-all"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => { setSaftModal(null); setView('profile'); }}
                  className="flex-1 py-3 rounded-[12px] text-[14px] font-[700] bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-lg shadow-emerald-600/30"
                >
                  Ver Perfil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Ver SAFT modal ── */}
      {showSaftViewer && saftData && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="saft-viewer-title"
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6"
        >
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setShowSaftViewer(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
          />
          <div className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            {/* Accent bar */}
            <div className="h-1.5 bg-gradient-to-r from-[#0677FF] to-[#0B1D2D] w-full shrink-0" />

            {/* Header */}
            <div className="px-6 pt-5 pb-4 flex items-center justify-between shrink-0 border-b border-slate-100">
              <div>
                <h2 id="saft-viewer-title" className="text-[18px] font-[800] text-[#0F172A] leading-tight">
                  Dados extraídos do SAF-T
                </h2>
                <p className="text-[12px] text-[#64748B] font-[500] mt-0.5">
                  {saftData.details.length} campos · {Array.from(new Set(saftData.details.map(d => d.group))).length} secções
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSaftViewer(false)}
                aria-label="Fechar"
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" aria-hidden="true">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">

              {/* Warnings */}
              {saftData.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-[12px] p-4">
                  <h3 className="text-[11px] font-[700] uppercase tracking-[0.5px] text-amber-700 mb-2">Avisos</h3>
                  <ul className="space-y-1.5">
                    {saftData.warnings.map((w, i) => (
                      <li key={i} className="text-[12px] text-amber-800 font-[500] leading-snug">{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Grouped details — all SAF-T data */}
              {(() => {
                const groups: string[] = Array.from(new Set(saftData.details.map(d => d.group)));
                return groups.map(group => {
                  const items = saftData.details.filter(d => d.group === group);
                  return (
                    <div key={group}>
                    <SaftSection title={group} count={items.length}>
                      {items.map((d, i) => (
                        <div key={i} className="flex items-baseline gap-3 py-1.5 border-b border-slate-50 last:border-0">
                          <span className="text-[11px] font-[600] text-[#0677FF] shrink-0 w-[150px] leading-snug">{d.label}</span>
                          <span className="text-[12px] font-[500] text-[#0F172A] leading-snug break-words min-w-0">{d.value}</span>
                        </div>
                      ))}
                    </SaftSection>
                    </div>
                  );
                });
              })()}

              {/* Empty profile fields */}
              {saftData.empty.length > 0 && (
                <div className="bg-slate-50 border border-slate-100 rounded-[12px] p-4">
                  <h3 className="text-[11px] font-[700] uppercase tracking-[0.5px] text-slate-500 mb-2">
                    Campos do perfil não preenchidos pelo SAF-T
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {saftData.empty.map((f) => (
                      <span key={f} className="text-[11px] font-[500] bg-white text-slate-400 px-2 py-0.5 rounded-[6px] border border-slate-200">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 pt-3 shrink-0 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSaftViewer(false)}
                className="w-full py-3 rounded-[12px] text-[14px] font-[700] bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Layout fills remaining height (skip link target lives on <main> inside) ── */}
      <div className="flex-1 overflow-hidden">
        <CurrentLayout
          view={view}
          setView={setView as (v: ViewType) => void}
          prevView={prevView}
          openLegal={openLegal}
          onSAFTUpload={handleSAFTUpload}
          onLogout={handleLogout}
          hasSaftData={saftData !== null}
          onOpenSaftViewer={() => setShowSaftViewer(true)}
          mode={mode}
          onBackToModeSelection={backToModeSelection}
          onSelectMode={selectMode}
          onOpenRelatorios={openRelatorios}
          activeClientName={currentEmpresaId ? (clientProfile.nomeCliente?.trim() || 'Cliente sem nome') : ''}
          currentEmpresaId={currentEmpresaId}
          onNavigateClient={navigateClient}
        >
          {content}
        </CurrentLayout>
      </div>

      {/* As simulações guardam-se automaticamente no histórico do cliente
          (~1,2s após editar). Sem botão manual — ver auto-save effect acima. */}

      {/* Aviso de nova versão (auto-atualização) — recarrega sozinho se não houver
          edições de documento por guardar; caso contrário mostra botão manual. */}
      {cloudSyncError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[90] max-w-lg w-[calc(100%-2rem)] bg-red-600 text-white rounded-[12px] shadow-lg px-4 py-3 flex items-start gap-3">
          <span className="text-[16px] leading-none mt-0.5">⚠</span>
          <div className="text-[13px] font-[600] leading-snug">
            A sincronização com a cloud falhou — as alterações estão guardadas <u>só neste computador</u>.
            Verifica a ligação à internet; a app volta a tentar automaticamente na próxima alteração.
          </div>
          <button type="button" onClick={() => setCloudSyncError(null)} className="ml-auto text-white/80 hover:text-white text-[16px] leading-none" aria-label="Fechar aviso">×</button>
        </div>
      )}
      <UpdateNotification
        show={versionUpdate}
        hasUnsavedEdits={getHasUnsavedEdits()}
        onDismiss={() => setVersionUpdate(false)}
      />

      {/* Barra "Guardar cliente" — só no rascunho de cliente novo (modo Novo Cliente). */}
      {draftNewClient && (
        <div className="fixed bottom-0 right-0 left-0 md:left-64 z-[70] no-print border-t border-slate-200 bg-white/95 backdrop-blur-sm px-4 sm:px-6 py-3 flex items-center gap-3 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.25)]">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-[800] text-[#0F172A] leading-tight truncate">
              {clientProfile.nomeCliente?.trim() || 'Novo cliente'}
            </div>
            <div className="text-[11px] font-[600] text-[#64748B] leading-tight">
              {view === 'tax'
                ? 'Pré-visualização do enquadramento fiscal deste cliente · guarda para manter.'
                : 'Ainda não guardado · preenche e carrega em guardar para adicionar à lista.'}
            </div>
          </div>
          {/* Ver o simulador fiscal já preenchido com os dados deste cliente novo
              (sem ter de o guardar primeiro). Alterna com o regresso ao perfil. */}
          <button
            type="button"
            onClick={() => setView(view === 'tax' ? 'profile' : 'tax')}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-[14px] font-[700] text-[#0677FF] bg-[#0677FF]/10 hover:bg-[#0677FF]/15 active:scale-[0.98] transition-all"
          >
            {view === 'tax'
              ? <><ArrowLeft className="w-4 h-4" strokeWidth={2.5} /> Voltar ao perfil</>
              : <><Calculator className="w-4 h-4" strokeWidth={2.5} /> Ver enquadramento fiscal</>}
          </button>
          <button
            type="button"
            onClick={handleSaveNewClient}
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-[12px] text-[14px] font-[800] text-white active:scale-[0.98] transition-all"
            style={{
              background: 'linear-gradient(135deg, #0677FF 0%, #044BB6 100%)',
              boxShadow: '0 0 0 1px rgba(6,119,255,0.35), 0 8px 22px -8px rgba(6,119,255,0.6)',
            }}
          >
            <Save className="w-4 h-4" strokeWidth={2.5} /> Guardar cliente
          </button>
        </div>
      )}
      {/* Input escondido acionado pelo AI Contabilista para importar SAF-T de cliente novo */}
      <input
        ref={botSaftInputRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            if (botSaftTargetRef.current === 'empresa' && currentEmpresaId) handleEmpresaSAFT(f, currentEmpresaId);
            else handleNovaEmpresaFromSAFT(f);
          }
          e.target.value = '';
        }}
      />
      {/* AI Contabilista — assistente flutuante (grátis, OpenRouter free models) */}
      <Suspense fallback={null}>
        <AIContabilista bridge={botBridge} liftBottom={draftNewClient} />
      </Suspense>
    </div>
    </SimulacaoSaveProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MotionProvider>
        <AppContent />
        {/* Vista escondida das sugestões recolhidas pelo bot (#ai-sugestoes) */}
        <SuggestionsAdmin />
      </MotionProvider>
    </ThemeProvider>
  );
}
