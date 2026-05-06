import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import ClientProfile, { defaultProfile } from './ClientProfile';
import LegalInfo from './LegalInfo';
import LoginPage from './LoginPage';
import { defaultFichaState, type FichaState } from './fichaState';
import type { DiagnosticoState } from './DiagnosticoAutonomia';
import type { ImoveisState } from './ImoveisEmpresa';
import type { IMTState } from './IMTSimulator';
import type { SalarioState } from './SalarioLiquidoSimulator';
import type { TicketSimulatorState } from './TicketSimulator';
import type { ClientProfile as ClientProfileType } from './ClientProfile';
import { ThemeProvider } from './ThemeContext';
import { parseSAFT } from './lib/saft';
import { LAYOUTS } from './Layouts';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './lib/firebase';

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
  currentInc: 25000, age: p.idade, isMainAct: p.tipoEntidade !== 'eni',
  monthlyNeed: 1500, isServices: p.atividadePrincipal === 'servicos',
  b2b: true, rev: p.faturaçaoAnualPrevista, isSeasonal: p.isSazonal,
  invEquip: 3000, invLic: 500, invWorks: 1000, invFundo: 2000,
  fixedMo: 400, varYr: 5000, accMoLda: 200, accMoEni: 50,
  anosAtividade: Math.max(0, new Date().getFullYear() - p.inicioAtividade),
  transparenciaFiscal: p.regimeContabilidade === 'transparencia_fiscal',
});

const getInitialVehicleState = (): VehicleSimulatorState => ({
  category: 'passageiros', engineType: 'diesel', price: 35000,
  ivaRegime: 'normal', activity: 'other', maintenanceCost: 1000,
  insuranceCost: 800, fuelCost: 2500, exemptTA: false, phevCompliant: true,
});

const getInitialTicketState = (p: ClientProfileType): TicketSimulatorState => ({
  tipoTicket: 'restaurante',
  employees: p.nrFuncionarios,
  ticketValue: p.valorTicket,
  tipoSubsidio: 'cartao',
  daysPerMonth: 22,
  months: 12,
  valorAnualPorPessoa: 0,
});

const getInitialSSState = (p: ClientProfileType): SSState => ({
  income: p.rendimentoMensalEni, regime: p.regimeSs,
  tipoRendimento: p.tipoRendimentoSs, primeiroAno: false,
});

const getInitialDiagnosticoState = (p: ClientProfileType, tax: TaxSimulatorState): DiagnosticoState => ({
  capitaisProprios: 0, ativoTotal: 0, passivoTotal: 0,
  ativoCorrente: 0, passivoCorrente: 0, disponibilidades: 0,
  custoFixoMensal: tax.fixedMo, resultadoLiquido: 0,
  volumeNegocios: p.faturaçaoAnualPrevista, ebitda: 'positivo',
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
  primeiraHabitacao: true, idadeComprador: p.idade,
});

const getInitialSalarioState = (p: ClientProfileType): SalarioState => ({
  salarioBruto: 2000,
  estadoCivil: p.estadoCivil === 'casado' ? 'casado_1titular' : 'solteiro',
  nrDependentes: p.nrDependentes, localizacao: 'continente',
  duodecimos: false, subsidioAlimentacaoDiario: 6.15,
  tipoSubsidio: 'dinheiro', diasSubsidio: 22,
  irsJovem: p.beneficioJovem && p.idade <= 35,
  anosAtividade: Math.max(0, new Date().getFullYear() - p.inicioAtividade),
  idade: p.idade,
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
  const [loggedIn, setLoggedIn] = useState(false);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const notificationShown = useRef(false);
  const [view, setView] = useState<ViewType>('profile');
  const [prevView, setPrevView] = useState<ViewType>('profile');
  const [legalAnchor, setLegalAnchor] = useState<string | null>(null);
  const [saftToast, setSaftToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const saftToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [clientProfile, setClientProfile] = useState<ClientProfileType>(defaultProfile);
  const [taxState, setTaxState] = useState<TaxSimulatorState>(() => getInitialTaxState(defaultProfile));
  const [vehicleState, setVehicleState] = useState<VehicleSimulatorState>(getInitialVehicleState);
  const [ticketState, setTicketState] = useState<TicketSimulatorState>(() => getInitialTicketState(defaultProfile));
  const [ssState, setSSState] = useState<SSState>(() => getInitialSSState(defaultProfile));
  const [diagnosticoState, setDiagnosticoState] = useState<DiagnosticoState>(() => getInitialDiagnosticoState(defaultProfile, getInitialTaxState(defaultProfile)));
  const [imoveisState, setImoveisState] = useState<ImoveisState>(() => getInitialImoveisState(defaultProfile));
  const [imtState, setImtState] = useState<IMTState>(() => getInitialIMTState(defaultProfile));
  const [salarioState, setSalarioState] = useState<SalarioState>(() => getInitialSalarioState(defaultProfile));
  const [fichaState, setFichaState] = useState<FichaState>(() => defaultFichaState(defaultProfile));

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
      if (count > 0 && !notificationShown.current) {
        setShowUpdateNotification(true);
        notificationShown.current = true;
      }
    });
    return unsub;
  }, [loggedIn]);

  // Close the update-notification modal with Escape
  useEffect(() => {
    if (!showUpdateNotification) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowUpdateNotification(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showUpdateNotification]);

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />;
  }

  const openLegal = () => { setPrevView(view); setLegalAnchor(null); setView('legal'); };
  const closeLegal = () => setView(prevView);

  const showSaftToast = (ok: boolean, msg: string) => {
    if (saftToastTimer.current) clearTimeout(saftToastTimer.current);
    setSaftToast({ ok, msg });
    saftToastTimer.current = setTimeout(() => setSaftToast(null), 6000);
  };

  const handleSAFTUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const result = parseSAFT(text);

        if (Object.keys(result.profile).length === 0) {
          showSaftToast(false, 'Ficheiro SAF-T lido mas nenhum campo reconhecido foi encontrado.');
          return;
        }

        updateProfileWithSimulatorSync({ ...clientProfile, ...result.profile });
        setView('profile');

        const summary = `Campos preenchidos: ${result.filled.join(', ')}.`;
        const warn = result.warnings.length ? `\n⚠ ${result.warnings.join('\n⚠ ')}` : '';
        showSaftToast(true, summary + warn);
      } catch (err) {
        showSaftToast(false, err instanceof Error ? err.message : 'Erro ao processar o ficheiro SAF-T.');
      }
    };
    reader.onerror = () => showSaftToast(false, 'Não foi possível ler o ficheiro.');
    // Windows-1252 is common for Portuguese SAF-T files
    reader.readAsText(file, 'windows-1252');
  };
  const openUpdates = () => { setPrevView(view); setView('updates'); };
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
    setSSState(prev => ({ ...prev, income: newProfile.rendimentoMensalEni, regime: newProfile.regimeSs, tipoRendimento: newProfile.tipoRendimentoSs }));
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
    setClientProfile(prev => ({ ...prev, rendimentoMensalEni: newState.income, regimeSs: newState.regime, tipoRendimentoSs: newState.tipoRendimento }));
  };

  // Current simulator content
  const content = (
    <Suspense fallback={<ViewLoading />}>
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
                  onClick={() => setShowUpdateNotification(false)}
                  className="flex-1 py-3.5 rounded-[12px] text-[14px] font-[700] bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] transition-all"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => { setShowUpdateNotification(false); openUpdates(); }}
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

      {/* ── SAF-T import toast ── */}
      {saftToast && (
        <div
          role="status"
          aria-live="polite"
          className={`shrink-0 w-full flex items-start gap-2.5 px-4 py-2.5 z-[150] text-[12px] font-[600] leading-snug ${
            saftToast.ok
              ? 'bg-emerald-50 border-b border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-b border-red-200 text-red-800'
          }`}
        >
          <span aria-hidden="true">{saftToast.ok ? '✓' : '✕'}</span>
          <span className="flex-1 whitespace-pre-wrap">{saftToast.msg}</span>
          <button
            type="button"
            aria-label="Fechar notificação"
            onClick={() => setSaftToast(null)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity leading-none"
          >
            ×
          </button>
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
      <AppContent />
    </ThemeProvider>
  );
}
