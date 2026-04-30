import React, { useState } from 'react';
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
import type { ClientProfile as ClientProfileType } from './ClientProfile';
import { ThemeProvider, useTheme } from './ThemeContext';
import { LAYOUTS } from './Layouts';

type ViewType =
  | 'profile' | 'tax' | 'vehicle' | 'ticket' | 'selfss'
  | 'diagnostico' | 'imoveis' | 'imt' | 'salario' | 'legal';

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
  employees: number; ticketValue: number; daysPerMonth: number; months: number;
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
  employees: p.nrFuncionarios, ticketValue: p.valorTicket, daysPerMonth: 22, months: 12,
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
  irsJovem: p.beneficioJovem && p.idade <= 35,
  anosAtividade: Math.max(0, new Date().getFullYear() - p.inicioAtividade),
  idade: p.idade,
});

function AppContent() {
  const { layoutIndex, layoutName, nextLayout, prevLayout } = useTheme();
  const [loggedIn, setLoggedIn] = useState(false);
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
        <LegalInfo onBack={closeLegal} clientProfile={clientProfile} vehicleState={vehicleState} ticketState={ticketState} />
      )}
    </>
  );

  const CurrentLayout = LAYOUTS[layoutIndex].component;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* ── Layout switcher bar — always 3px tall, expands on hover ── */}
      <div className="group/bar shrink-0 relative z-[200]">
        <div className="h-[3px] group-hover/bar:h-[44px] transition-all duration-300 overflow-hidden bg-[#1C1917] flex items-center justify-center">
          <div className="opacity-0 group-hover/bar:opacity-100 transition-opacity duration-200 delay-100 flex items-center gap-5">
            <button onClick={prevLayout}
              className="text-stone-400 hover:text-white text-xl px-4 font-[700] select-none transition-colors">
              ←
            </button>
            <span className="text-[11px] font-[800] uppercase tracking-[3px] text-stone-300 whitespace-nowrap">
              Layout: {layoutName}
            </span>
            <button onClick={nextLayout}
              className="text-stone-400 hover:text-white text-xl px-4 font-[700] select-none transition-colors">
              →
            </button>
          </div>
        </div>
      </div>

      {/* ── Layout fills remaining height ── */}
      <div className="flex-1 overflow-hidden">
        <CurrentLayout
          view={view}
          setView={setView as (v: ViewType) => void}
          prevView={prevView}
          openLegal={openLegal}
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
