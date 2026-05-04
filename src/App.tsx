import React, { useState, useEffect, useRef } from 'react';
import TaxSimulator from './TaxSimulator';
import VehicleSimulator from './VehicleSimulator';
import TicketSimulator from './TicketSimulator';
import SelfEmployedSSSimulator from './SelfEmployedSSSimulator';
import DiagnosticoAutonomia, { type DiagnosticoState } from './DiagnosticoAutonomia';
import ImoveisEmpresa, { type ImoveisState } from './ImoveisEmpresa';
import IMTSimulator, { type IMTState } from './IMTSimulator';
import SalarioLiquidoSimulator, { type SalarioState } from './SalarioLiquidoSimulator';
import ClientProfile, { defaultProfile } from './ClientProfile';
import LegalInfo from './LegalInfo';
import LoginPage from './LoginPage';
import UpdatesList from './UpdatesList';
import type { ClientProfile as ClientProfileType } from './ClientProfile';
import { ThemeProvider, useTheme } from './ThemeContext';
import { LAYOUTS } from './Layouts';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './lib/firebase';

type ViewType =
  | 'profile' | 'tax' | 'vehicle' | 'ticket' | 'selfss'
  | 'diagnostico' | 'imoveis' | 'imt' | 'salario' | 'legal' | 'updates';

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

interface TicketSimulatorState {
  employees: number; ticketValue: number; daysPerMonth: number; months: number; ticketType: string;
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
  employees: p.nrFuncionarios, ticketValue: p.valorTicket, daysPerMonth: 22, months: 12, ticketType: 'alimentacao',
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

const getInitialImoveisState = (p: ClientProfileType): ImoveisState => ({
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
  ticketRefeicaoDiario: 0, ticketRefeicaoDias: 0,
  irsJovem: p.beneficioJovem && p.idade <= 35,
  anosAtividade: Math.max(0, new Date().getFullYear() - p.inicioAtividade),
  idade: p.idade,
});

function AppContent() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const notificationShown = useRef(false);

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
  const [view, setView] = useState<ViewType>('profile');
  const [prevView, setPrevView] = useState<ViewType>('profile');
  const [clientProfile, setClientProfile] = useState<ClientProfileType>(defaultProfile);
  const [taxState, setTaxState] = useState<TaxSimulatorState>(() => getInitialTaxState(defaultProfile));
  const [vehicleState, setVehicleState] = useState<VehicleSimulatorState>(getInitialVehicleState);
  const [ticketState, setTicketState] = useState<TicketSimulatorState>(() => getInitialTicketState(defaultProfile));
  const [ssState, setSSState] = useState<SSState>(() => getInitialSSState(defaultProfile));
  const [diagnosticoState, setDiagnosticoState] = useState<DiagnosticoState>(() => getInitialDiagnosticoState(defaultProfile, getInitialTaxState(defaultProfile)));
  const [imoveisState, setImoveisState] = useState<ImoveisState>(() => getInitialImoveisState(defaultProfile));
  const [imtState, setImtState] = useState<IMTState>(() => getInitialIMTState(defaultProfile));
  const [salarioState, setSalarioState] = useState<SalarioState>(() => getInitialSalarioState(defaultProfile));

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />;
  }

  const openLegal = () => { setPrevView(view); setView('legal'); };
  const closeLegal = () => setView(prevView);
  const openUpdates = () => { setPrevView(view); setView('updates'); };

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
    <>
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
      {view === 'legal' && (
        <LegalInfo onBack={closeLegal} onOpenUpdates={openUpdates} clientProfile={clientProfile} vehicleState={vehicleState} ticketState={ticketState} />
      )}
      {view === 'updates' && (
        <UpdatesList onBack={() => setView(prevView)} />
      )}
    </>
  );

  const CurrentLayout = LAYOUTS[0].component;

  return (
    <div className="h-screen flex flex-col overflow-hidden">

      {/* ── Pending updates notification modal ── */}
      {showUpdateNotification && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-white rounded-[28px] shadow-2xl max-w-md w-full overflow-hidden">
            {/* Accent bar */}
            <div className="h-1.5 bg-gradient-to-r from-amber-400 to-amber-500 w-full" />
            <div className="p-10 flex flex-col items-center text-center gap-5">
              {/* Icon */}
              <div className="w-20 h-20 rounded-full bg-amber-50 border-4 border-amber-100 flex items-center justify-center">
                <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
                  <path d="M20 8L20 22" stroke="#D97706" strokeWidth="3" strokeLinecap="round"/>
                  <circle cx="20" cy="30" r="2" fill="#D97706"/>
                  <path d="M6 34L20 8L34 34H6Z" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              {/* Text */}
              <div>
                <h2 className="text-[22px] font-[800] text-[#0F172A] leading-tight">
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
                  onClick={() => setShowUpdateNotification(false)}
                  className="flex-1 py-3.5 rounded-[12px] text-[14px] font-[700] bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] transition-all"
                >
                  Fechar
                </button>
                <button
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
          onClick={openUpdates}
          className="shrink-0 w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 transition-colors flex items-center justify-center gap-2.5 py-[5px] z-[150]"
        >
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-[11px] font-[800] text-white uppercase tracking-[1.5px]">
            {pendingCount} atualização{pendingCount !== 1 ? 'ões' : ''} por aprovar
          </span>
          <span className="text-[10px] font-[700] bg-white/25 text-white px-2 py-0.5 rounded-full">
            Ver →
          </span>
        </button>
      )}

      {/* ── Layout fills remaining height ── */}
      <div className="flex-1 overflow-hidden">
        <CurrentLayout
          view={view}
          setView={setView as (v: ViewType) => void}
          prevView={prevView}
          openLegal={openLegal}
          openUpdates={openUpdates}
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
