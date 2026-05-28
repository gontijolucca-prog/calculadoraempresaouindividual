import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import ClientProfile, { defaultProfile } from './ClientProfile';
import LegalInfo from './LegalInfo';
import LoginPage from './LoginPage';
import LandingPage from './LandingPage';
import EmpresasList from './EmpresasList';
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
} from './lib/empresas';
import type { DiagnosticoState } from './DiagnosticoAutonomia';
import type { ImoveisState } from './ImoveisEmpresa';
import type { IMTState } from './IMTSimulator';
import type { SalarioState } from './SalarioLiquidoSimulator';
import { defaultIRSState, type IRSState } from './lib/irs';
import type { TicketSimulatorState } from './TicketSimulator';
import type { ClientProfile as ClientProfileType } from './ClientProfile';
import { ThemeProvider } from './ThemeContext';
import { MotionProvider, PageTransition } from './AnimatedPage';
import { parseSAFT, type SAFTParseResult } from './lib/saft';
import { LAYOUTS } from './Layouts';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './lib/firebase';
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
const UpdatesList = lazy(() => import('./UpdatesList'));
const PreviSaSimulator = lazy(() => import('./PreviSaSimulator'));
const OfficeSettingsView = lazy(() => import('./OfficeSettingsView'));
import { defaultPreviSaState } from './previSaState';
import type { PreviSaState } from './previSaState';

type ViewType =
  | 'profile' | 'tax' | 'vehicle' | 'ticket' | 'selfss'
  | 'diagnostico' | 'imoveis' | 'imt' | 'salario' | 'irs' | 'legal' | 'updates'
  | 'previsa' | 'office-settings' | 'empresas';

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
  updates: 'Checklist de Atualizações',
  previsa: 'Simulador Previsa',
  'office-settings': 'Definições do Escritório',
};

/**
 * Migração legada: a antiga view "Ficha" foi fundida no Perfil do Cliente.
 * Lê o `fichaState` antigo do localStorage (se existir), faz merge dos campos
 * de diagnóstico para o `clientProfile`, persiste e remove a chave legada.
 * Idempotente — se já não houver ficha antiga, devolve o perfil intacto.
 */
function loadProfileWithFichaMerge(): ClientProfileType {
  const loaded = loadFromStorage('clientProfile', defaultProfile);
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
}

interface VehicleSimulatorState {
  category: 'comercial' | 'passageiros'; engineType: string; price: number;
  ivaRegime: string; activity: string; maintenanceCost: number;
  insuranceCost: number; fuelCost: number; exemptTA: boolean; phevCompliant: boolean;
}


interface SSState {
  income: number; regime: 'general' | 'simplified';
  tipoRendimento: 'servicos' | 'bens'; primeiroAno: boolean;
}

const getInitialTaxState = (p: ClientProfileType): TaxSimulatorState => ({
  profSit: p.tipoEntidade === 'eni' ? 'outro' : 'tco',
  currentInc: 25000, age: p.idade || 30, isMainAct: p.tipoEntidade !== 'eni',
  monthlyNeed: 1500, isServices: p.atividadePrincipal === 'servicos',
  b2b: true, rev: p.faturaçaoAnualPrevista || 0, isSeasonal: p.isSazonal,
  invEquip: 3000, invLic: 500, invWorks: 1000, invFundo: 2000,
  fixedMo: 400, varYr: 5000, accMoLda: 200, accMoEni: 50,
  anosAtividade: p.inicioAtividade > 0 ? Math.max(0, new Date().getFullYear() - p.inicioAtividade) : 0,
  transparenciaFiscal: p.regimeContabilidade === 'transparencia_fiscal',
});

const getInitialVehicleState = (): VehicleSimulatorState => ({
  category: 'passageiros', engineType: 'diesel', price: 35000,
  ivaRegime: 'normal', activity: 'other', maintenanceCost: 1000,
  insuranceCost: 800, fuelCost: 2500, exemptTA: false, phevCompliant: true,
});

const getInitialTicketState = (p: ClientProfileType): TicketSimulatorState => ({
  tipoTicket: 'restaurante',
  employees: p.nrFuncionarios || 0,
  ticketValue: p.valorTicket || 0,
  tipoSubsidio: 'cartao',
  daysPerMonth: 22,
  months: 12,
  valorAnualPorPessoa: 0,
  tipoVeiculo: 'passageiros',
});

const getInitialSSState = (p: ClientProfileType): SSState => ({
  income: p.rendimentoMensalEni || 0, regime: 'simplified',
  tipoRendimento: p.tipoRendimentoSs, primeiroAno: false,
});

const getInitialDiagnosticoState = (p: ClientProfileType, tax: TaxSimulatorState): DiagnosticoState => ({
  capitaisProprios: 0, ativoTotal: 0, passivoTotal: 0,
  ativoCorrente: 0, passivoCorrente: 0, disponibilidades: 0,
  custoFixoMensal: tax.fixedMo || 400, resultadoLiquido: 0,
  volumeNegocios: p.faturaçaoAnualPrevista || 0, ebitda: 'positivo',
  faturacaoMaiorCliente: 0, financiamentoExterno: 0, totalFinanciamento: 0,
  processosDefinidos: false, softwareGestao: false, equipaAutonoma: false,
  baixaDependenciaGerente: false, controlFinanceiro: false,
});

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
  salarioBruto: 2000,
  estadoCivil: p.estadoCivil === 'casado' ? 'casado_1titular' : 'solteiro',
  nrDependentes: p.nrDependentes || 0, localizacao: 'continente',
  duodecimos: false, subsidioAlimentacaoDiario: 6.15,
  tipoSubsidio: 'dinheiro', diasSubsidio: 22,
  irsJovem: p.beneficioJovem && (p.idade || 0) <= 35,
  anosAtividade: p.inicioAtividade > 0 ? Math.max(0, new Date().getFullYear() - p.inicioAtividade) : 0,
  idade: p.idade || 0,
  taxaSeguroTrabalho: 1.0,
});

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

function AppContent() {
  const [loggedIn, setLoggedIn] = useState(() => loadFromStorage('loggedIn', false));
  const [showLogin, setShowLogin] = useState(false);
  // Mode is persisted: ao actualizar a página o utilizador continua no mesmo contexto.
  // Default = 'empresa' (CRM): após login vai directo para a Lista de Empresas. O
  // selector "Como queres trabalhar hoje?" foi removido do fluxo.
  const [mode, setMode] = useState<AppMode>(() => {
    const m = loadFromStorage<AppMode | null>('mode', null);
    return m === 'novo-cliente' || m === 'empresa' ? m : 'empresa';
  });
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastDismissedCount, setLastDismissedCount] = useState(() => loadFromStorage('lastDismissedPendingCount', 0));
  const [view, setView] = useState<ViewType>(() => {
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
  const [previSaState, setPreviSaState] = useState<PreviSaState>(() => defaultPreviSaState());
  // Carrega o perfil persistido. O perfil é o único estado de longa duração — guarda
  // o trabalho do consultor entre sessões. A antiga `fichaState` foi fundida aqui
  // via migração (loadProfileWithFichaMerge).
  const [clientProfile, setClientProfile] = useState<ClientProfileType>(() => {
    const legacy = loadProfileWithFichaMerge();
    migrateLegacyProfileIfNeeded(legacy);
    const empId = getCurrentEmpresaId();
    if (empId) {
      const emp = getEmpresa(empId);
      if (emp) return emp.profile;
    }
    return legacy;
  });
  const [taxState, setTaxState] = useState<TaxSimulatorState>(() => getInitialTaxState(clientProfile));
  const [vehicleState, setVehicleState] = useState<VehicleSimulatorState>(getInitialVehicleState);
  const [ticketState, setTicketState] = useState<TicketSimulatorState>(() => getInitialTicketState(clientProfile));
  const [ssState, setSSState] = useState<SSState>(() => getInitialSSState(clientProfile));
  const [diagnosticoState, setDiagnosticoState] = useState<DiagnosticoState>(() => getInitialDiagnosticoState(clientProfile, getInitialTaxState(clientProfile)));
  const [imoveisState, setImoveisState] = useState<ImoveisState>(() => getInitialImoveisState(clientProfile));
  const [imtState, setImtState] = useState<IMTState>(() => getInitialIMTState(clientProfile));
  const [salarioState, setSalarioState] = useState<SalarioState>(() => getInitialSalarioState(clientProfile));
  const [irsState, setIrsState] = useState<IRSState>(() => loadFromStorage('irsState', defaultIRSState()));

  // Definições do escritório (branding + honorários). Persistidas em localStorage —
  // não pertencem ao cliente activo, são definições de licenciado.
  const [officeSettings, setOfficeSettings] = useState<OfficeSettings>(() => loadOfficeSettings());
  const [honorariosConfig, setHonorariosConfig] = useState<HonorariosConfig>(() => loadHonorariosConfig());

  // Auto-save em localStorage — debounce implícito via React batching.
  useEffect(() => { saveToStorage('clientProfile', clientProfile); }, [clientProfile]);
  useEffect(() => { saveToStorage('irsState', irsState); }, [irsState]);
  useEffect(() => { saveToStorage('loggedIn', loggedIn); }, [loggedIn]);
  useEffect(() => { saveToStorage('mode', mode); }, [mode]);
  useEffect(() => { saveToStorage('lastDismissedPendingCount', lastDismissedCount); }, [lastDismissedCount]);
  useEffect(() => { saveOfficeSettings(officeSettings); }, [officeSettings]);
  useEffect(() => { saveHonorariosConfig(honorariosConfig); }, [honorariosConfig]);
  // Sincroniza alterações do perfil para a empresa actual no registry.
  useEffect(() => {
    if (currentEmpresaId) syncProfileIntoEmpresa(currentEmpresaId, clientProfile);
  }, [clientProfile, currentEmpresaId]);

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
      // Se a empresa actual foi carregada da cloud, atualiza o perfil em memória.
      if (currentEmpresaId) {
        const emp = merged.find(e => e.id === currentEmpresaId);
        if (emp) setClientProfile(emp.profile);
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
  }, [loggedIn, clientProfile, currentEmpresaId, empresasRefresh, officeSettings.nif]);

  // Sync document.title with the active view (helps history & screen readers)
  useEffect(() => {
    document.title = `${VIEW_TITLES[view]} · Estudo 360`;
  }, [view]);

  useEffect(() => {
    const main = document.getElementById('main-content');
    if (main) main.scrollTop = 0;
  }, [view]);

  useEffect(() => {
    if (!loggedIn) return;
    const unsub = onSnapshot(collection(db, 'updates'), snap => {
      const count = snap.docs.filter(d => {
        const data = d.data();
        return data.atualizado && !data.aprovado;
      }).length;
      setPendingCount(count);
      if (count === 0) {
        setLastDismissedCount(0);
      }
      if (count > 0 && count > lastDismissedCount) {
        setShowUpdateNotification(true);
      }
    });
    return unsub;
  }, [loggedIn, lastDismissedCount]);

  const dismissUpdateNotification = () => {
    setShowUpdateNotification(false);
    setLastDismissedCount(pendingCount);
  };

  // Close the update-notification modal with Escape
  useEffect(() => {
    if (!showUpdateNotification) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissUpdateNotification();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showUpdateNotification, pendingCount]);

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

  if (!loggedIn) {
    return showLogin
      ? <LoginPage onLogin={() => setLoggedIn(true)} onBack={() => setShowLogin(false)} />
      : <LandingPage onEnter={() => setShowLogin(true)} />;
  }

  // O selector "Como queres trabalhar hoje?" foi removido: após login vai-se directo
  // para a sidebar no modo `empresa` (Lista de Empresas). O utilizador troca de modo
  // via o pill no topo da sidebar.
  const backToModeSelection = () => {
    setMode('empresa');
    setView('empresas');
  };

  // Trocar de modo directamente a partir da sidebar.
  const selectMode = (m: AppMode) => {
    setMode(m);
    setView(DEFAULT_VIEW_BY_MODE[m]);
  };

  const openEmpresa = (id: string) => {
    const emp = getEmpresa(id);
    if (!emp) return;
    setCurrentEmpresaId(id);
    setCurrentEmpresaIdState(id);
    updateProfileWithSimulatorSync(emp.profile);
    setView('profile');
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

  const handleNovaEmpresa = (id: string) => {
    setCurrentEmpresaId(id);
    setCurrentEmpresaIdState(id);
    updateProfileWithSimulatorSync({ ...defaultProfile });
    setView('profile');
    setEmpresasRefresh(n => n + 1);
  };

  const handleEmpresaSAFT = (file: File, empId: string) => {
    setCurrentEmpresaId(empId);
    setCurrentEmpresaIdState(empId);
    handleSAFTUpload(file);
  };

  /** Fluxo: cria empresa nova vazia, define como activa, importa SAFT (preenche o perfil
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
        const text = reader.result as string;
        const result = parseSAFT(text);

        if (Object.keys(result.profile).length === 0) {
          setSaftModal({ open: true, filled: [], empty: result.empty ?? [], warnings: ['Nenhum campo reconhecido foi encontrado no ficheiro SAF-T.'] });
          return;
        }

        // Reset all fields to default (empty) before applying SAFT data
        const newProfile = { ...defaultProfile, ...result.profile };
        updateProfileWithSimulatorSync(newProfile);
        setView('profile');
        setSaftData(result);
        if (result.previsa && Object.keys(result.previsa).length > 0) {
          setPreviSaState(prev => ({ ...prev, ...result.previsa }));
        }

        // Guarda o SAF-T em bruto na empresa actual para poder re-exportá-lo
        // depois. Usa o id da storage (o state pode estar stale neste callback
        // assíncrono do FileReader). syncProfileIntoEmpresa espalha ...emp, por
        // isso o saftXml sobrevive às escritas seguintes do perfil.
        const empId = getCurrentEmpresaId();
        if (empId) {
          const emp = getEmpresa(empId);
          if (emp) upsertEmpresa({ ...emp, saftXml: text, saftFileName: file.name, saftImportedAt: Date.now() });
        }

        setSaftModal({
          open: true,
          filled: result.filled,
          empty: result.empty ?? [],
          warnings: result.warnings,
        });
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
    // Windows-1252 is common for Portuguese SAF-T files
    reader.readAsText(file, 'windows-1252');
  };
  const openUpdates = () => { setPrevView(view); setView('updates'); };
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

  const updateProfileWithSimulatorSync = (newProfile: ClientProfileType) => {
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

  // Current simulator content
  const content = (
    <Suspense fallback={<ViewLoading />}>
      <PageTransition pageKey={view}>
        {view === 'empresas' && (
          <EmpresasList
            refreshKey={empresasRefresh}
            onOpenEmpresa={openEmpresa}
            onNovaEmpresa={handleNovaEmpresa}
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
        {view === 'tax' && (
          <TaxSimulator initialState={taxState} onStateChange={handleTaxStateChange} profile={clientProfile} />
        )}
        {view === 'vehicle' && (
          <VehicleSimulator initialState={vehicleState} onStateChange={setVehicleState} />
        )}
        {view === 'ticket' && (
          <TicketSimulator initialState={ticketState} onStateChange={handleTicketStateChange} profile={clientProfile} />
        )}
        {view === 'selfss' && (
          <SelfEmployedSSSimulator initialState={ssState} onStateChange={handleSSStateChange} />
        )}
        {view === 'diagnostico' && (
          <DiagnosticoAutonomia initialState={diagnosticoState} onStateChange={setDiagnosticoState} />
        )}
        {view === 'imoveis' && (
          <ImoveisEmpresa initialState={imoveisState} onStateChange={setImoveisState} profile={clientProfile} />
        )}
        {view === 'imt' && (
          <IMTSimulator initialState={imtState} onStateChange={setImtState} />
        )}
        {view === 'salario' && (
          <SalarioLiquidoSimulator initialState={salarioState} onStateChange={setSalarioState} />
        )}
        {view === 'irs' && (
          <IRSSimulator initialState={irsState} onStateChange={setIrsState} />
        )}
        {view === 'legal' && (
          <LegalInfo onBack={closeLegal} onOpenUpdates={openUpdates} clientProfile={clientProfile} vehicleState={vehicleState} ticketState={ticketState} initialAnchor={legalAnchor} />
        )}
        {view === 'updates' && (
          <UpdatesList onBack={() => setView(prevView)} />
        )}
        {view === 'previsa' && (
          <PreviSaSimulator initialState={previSaState} onStateChange={setPreviSaState} />
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
    </Suspense>
  );

  const CurrentLayout = LAYOUTS[0].component;

  return (
    <div className="h-screen flex flex-col overflow-hidden">

      {/* Skip link for keyboard users */}
      <a href="#main-content" className="skip-link">Saltar para conteúdo principal</a>

      {/* ── Pending updates notification modal ── */}
      {showUpdateNotification && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="update-modal-title"
          className="fixed inset-0 z-[1000] flex items-center justify-center p-6"
        >
          <button
            type="button"
            aria-label="Fechar diálogo"
            onClick={() => setShowUpdateNotification(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
          />
          <div className="relative bg-white rounded-[28px] shadow-2xl max-w-md w-full overflow-hidden">
            {/* Accent bar */}
            <div className="h-1.5 bg-gradient-to-r from-amber-400 to-amber-500 w-full" />
            <div className="p-10 flex flex-col items-center text-center gap-5">
              {/* Icon */}
              <div className="w-20 h-20 rounded-full bg-amber-50 border-4 border-amber-100 flex items-center justify-center">
                <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none" aria-hidden="true" focusable="false">
                  <path d="M20 8L20 22" stroke="#D97706" strokeWidth="3" strokeLinecap="round"/>
                  <circle cx="20" cy="30" r="2" fill="#D97706"/>
                  <path d="M6 34L20 8L34 34H6Z" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              {/* Text */}
              <div>
                <h2 id="update-modal-title" className="text-[22px] font-[800] text-[#0F172A] leading-tight">
                  Atualização pendente
                </h2>
                <p className="text-[14px] text-[#64748B] mt-3 font-[500] leading-relaxed">
                  Foi efetuada uma atualização no site que aguarda aprovação.
                  <br />
                  Aceda à <strong className="text-[#0F172A]">Checklist de Atualizações</strong> para rever e aprovar.
                </p>
              </div>
              {/* Actions */}
              <div className="flex gap-3 w-full mt-2">
                <button
                  type="button"
                  onClick={dismissUpdateNotification}
                  className="flex-1 py-3.5 rounded-[12px] text-[14px] font-[700] bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] transition-all"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => { dismissUpdateNotification(); openUpdates(); }}
                  className="flex-1 py-3.5 rounded-[12px] text-[14px] font-[700] bg-amber-500 text-white hover:bg-amber-600 active:scale-[0.98] transition-all shadow-lg shadow-amber-500/30"
                >
                  Ver checklist
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Persistent pending-updates banner ── */}
      {pendingCount > 0 && (
        <button
          type="button"
          onClick={openUpdates}
          aria-live="polite"
          className="shrink-0 w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 transition-colors flex items-center justify-center gap-2.5 py-[5px] z-[150]"
        >
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" aria-hidden="true" />
          <span className="text-[11px] font-[800] text-white uppercase tracking-[1.5px]">
            {pendingCount} atualização{pendingCount !== 1 ? 'ões' : ''} por aprovar
          </span>
          <span className="text-[10px] font-[700] bg-white/25 text-white px-2 py-0.5 rounded-full">
            Ver →
          </span>
        </button>
      )}

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
          openUpdates={openUpdates}
          onSAFTUpload={handleSAFTUpload}
          onLogout={handleLogout}
          hasSaftData={saftData !== null}
          onOpenSaftViewer={() => setShowSaftViewer(true)}
          mode={mode}
          onBackToModeSelection={backToModeSelection}
          onSelectMode={selectMode}
        >
          {content}
        </CurrentLayout>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MotionProvider>
        <AppContent />
      </MotionProvider>
    </ThemeProvider>
  );
}
