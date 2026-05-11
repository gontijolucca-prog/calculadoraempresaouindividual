import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import ClientProfile, { defaultProfile } from './ClientProfile';
import LegalInfo from './LegalInfo';
import LoginPage from './LoginPage';
import { defaultFichaState, applyProfileToFicha, type FichaState } from './fichaState';
import type { DiagnosticoState } from './DiagnosticoAutonomia';
import type { ImoveisState } from './ImoveisEmpresa';
import type { IMTState } from './IMTSimulator';
import type { SalarioState } from './SalarioLiquidoSimulator';
import type { TicketSimulatorState } from './TicketSimulator';
import type { ClientProfile as ClientProfileType } from './ClientProfile';
import { ThemeProvider } from './ThemeContext';
import { MotionProvider, PageTransition } from './AnimatedPage';
import { parseSAFT } from './lib/saft';
import { LAYOUTS } from './Layouts';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './lib/firebase';
import { loadFromStorage, saveToStorage, clearStorage } from './lib/storage';

// Code-split heavy simulators — keeps the initial bundle small.
const TaxSimulator = lazy(() => import('./TaxSimulator'));
const VehicleSimulator = lazy(() => import('./VehicleSimulator'));
const TicketSimulator = lazy(() => import('./TicketSimulator'));
const SelfEmployedSSSimulator = lazy(() => import('./SelfEmployedSSSimulator'));
const DiagnosticoAutonomia = lazy(() => import('./DiagnosticoAutonomia'));
const ImoveisEmpresa = lazy(() => import('./ImoveisEmpresa'));
const IMTSimulator = lazy(() => import('./IMTSimulator'));
const SalarioLiquidoSimulator = lazy(() => import('./SalarioLiquidoSimulator'));
const FichaDiagnostico = lazy(() => import('./FichaDiagnostico'));
const UpdatesList = lazy(() => import('./UpdatesList'));

type ViewType =
  | 'profile' | 'tax' | 'vehicle' | 'ticket' | 'selfss'
  | 'diagnostico' | 'imoveis' | 'imt' | 'salario' | 'ficha' | 'legal' | 'updates';

const VIEW_TITLES: Record<ViewType, string> = {
  profile: 'Perfil do Cliente',
  tax: 'Simulador Fiscal',
  vehicle: 'Simulador de Viaturas',
  ticket: 'Tickets de Refeição',
  selfss: 'SS de Independente',
  diagnostico: 'Diagnóstico de Autonomia',
  imoveis: 'Imóveis na Empresa',
  imt: 'Simulador IMT',
  salario: 'Salário Líquido',
  ficha: 'Ficha de Diagnóstico',
  legal: 'Base Legal & Referências',
  updates: 'Checklist de Atualizações',
};

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

// Inline fallback while a lazy chunk loads
function ViewLoading() {
  return (
    <div role="status" aria-live="polite" className="h-full flex items-center justify-center bg-[#F8FAFC]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-[#781D1D] animate-spin" aria-hidden="true" />
        <p className="text-[12px] font-[600] text-[#94A3B8]">A carregar…</p>
      </div>
    </div>
  );
}

function AppContent() {
  const [loggedIn, setLoggedIn] = useState(() => loadFromStorage('loggedIn', false));
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastDismissedCount, setLastDismissedCount] = useState(() => loadFromStorage('lastDismissedPendingCount', 0));
  const [view, setView] = useState<ViewType>('profile');
  const [prevView, setPrevView] = useState<ViewType>('profile');
  const [legalAnchor, setLegalAnchor] = useState<string | null>(null);
  const [saftModal, setSaftModal] = useState<{
    open: boolean;
    filled: string[];
    empty: string[];
    warnings: string[];
  } | null>(null);
  // Carrega o perfil persistido (se existir) — clientProfile e fichaState são os
  // dois estados que justificam persistência: representam o trabalho do consultor
  // que não pode ser perdido a um refresh acidental.
  const [clientProfile, setClientProfile] = useState<ClientProfileType>(() => loadFromStorage('clientProfile', defaultProfile));
  const [taxState, setTaxState] = useState<TaxSimulatorState>(() => getInitialTaxState(clientProfile));
  const [vehicleState, setVehicleState] = useState<VehicleSimulatorState>(getInitialVehicleState);
  const [ticketState, setTicketState] = useState<TicketSimulatorState>(() => getInitialTicketState(clientProfile));
  const [ssState, setSSState] = useState<SSState>(() => getInitialSSState(clientProfile));
  const [diagnosticoState, setDiagnosticoState] = useState<DiagnosticoState>(() => getInitialDiagnosticoState(clientProfile, getInitialTaxState(clientProfile)));
  const [imoveisState, setImoveisState] = useState<ImoveisState>(() => getInitialImoveisState(clientProfile));
  const [imtState, setImtState] = useState<IMTState>(() => getInitialIMTState(clientProfile));
  const [salarioState, setSalarioState] = useState<SalarioState>(() => getInitialSalarioState(clientProfile));
  const [fichaState, setFichaState] = useState<FichaState>(() => loadFromStorage('fichaState', defaultFichaState(clientProfile)));

  // Auto-save em localStorage — debounce implícito via React batching.
  useEffect(() => { saveToStorage('clientProfile', clientProfile); }, [clientProfile]);
  useEffect(() => { saveToStorage('fichaState', fichaState); }, [fichaState]);
  useEffect(() => { saveToStorage('loggedIn', loggedIn); }, [loggedIn]);
  useEffect(() => { saveToStorage('lastDismissedPendingCount', lastDismissedCount); }, [lastDismissedCount]);

  // Sync document.title with the active view (helps history & screen readers)
  useEffect(() => {
    document.title = `${VIEW_TITLES[view]} · Recofatima Simuladores`;
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

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />;
  }

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
    clearStorage('loggedIn');
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
    setFichaState(prev => applyProfileToFicha(newProfile, prev));
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
        {view === 'profile' && (
          <ClientProfile profile={clientProfile} onChange={updateProfileWithSimulatorSync}
            taxState={taxState} vehicleState={vehicleState} ticketState={ticketState} ssState={ssState} />
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
        {view === 'ficha' && (
          <FichaDiagnostico initialState={fichaState} onStateChange={setFichaState} openLegalAt={openLegalAt} clientProfile={clientProfile} />
        )}
        {view === 'legal' && (
          <LegalInfo onBack={closeLegal} onOpenUpdates={openUpdates} clientProfile={clientProfile} vehicleState={vehicleState} ticketState={ticketState} initialAnchor={legalAnchor} />
        )}
        {view === 'updates' && (
          <UpdatesList onBack={() => setView(prevView)} />
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

      {/* Close SAFT modal with Escape */}
      {(() => {
        useEffect(() => {
          if (!saftModal?.open) return;
          const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSaftModal(null); };
          document.addEventListener('keydown', onKey);
          return () => document.removeEventListener('keydown', onKey);
        }, [saftModal?.open]);
        return null;
      })()}

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
