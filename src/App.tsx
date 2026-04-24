import React, { useState } from 'react';
import { Calculator, Car, Ticket, User, UserCircle } from 'lucide-react';
import TaxSimulator from './TaxSimulator';
import VehicleSimulator from './VehicleSimulator';
import TicketSimulator from './TicketSimulator';
import SelfEmployedSSSimulator from './SelfEmployedSSSimulator';
import ClientProfile, { defaultProfile } from './ClientProfile';
import type { ClientProfile as ClientProfileType } from './ClientProfile';
import { cn } from './lib/utils';

interface TaxSimulatorState {
  profSit: string;
  currentInc: number;
  age: number;
  isMainAct: boolean;
  monthlyNeed: number;
  isServices: boolean;
  b2b: boolean;
  rev: number;
  isSeasonal: boolean;
  invEquip: number;
  invLic: number;
  invWorks: number;
  invFundo: number;
  fixedMo: number;
  varYr: number;
  accMoLda: number;
  accMoEni: number;
}

interface VehicleSimulatorState {
  category: 'comercial' | 'passageiros';
  engineType: string;
  price: number;
  ivaRegime: string;
  activity: string;
  maintenanceCost: number;
  insuranceCost: number;
  fuelCost: number;
  exemptTA: boolean;
  phevCompliant: boolean;
}

interface TicketSimulatorState {
  employees: number;
  ticketValue: number;
  daysPerMonth: number;
  months: number;
}

interface SSState {
  income: number;
  regime: 'general' | 'simplified';
  tipoRendimento: 'servicos' | 'bens';
}

const getInitialTaxState = (profile: ClientProfileType): TaxSimulatorState => ({
  profSit: profile.tipoEntidade === 'eni' ? 'outro' : 'tco',
  currentInc: 25000,
  age: profile.idade,
  isMainAct: profile.tipoEntidade !== 'eni',
  monthlyNeed: 1500,
  isServices: profile.atividadePrincipal === 'servicos',
  b2b: true,
  rev: profile.faturaçaoAnualPrevista,
  isSeasonal: profile.isSazonal,
  invEquip: 3000,
  invLic: 500,
  invWorks: 1000,
  invFundo: 2000,
  fixedMo: 400,
  varYr: 5000,
  accMoLda: 200,
  accMoEni: 50
});

const getInitialVehicleState = (): VehicleSimulatorState => ({
  category: 'passageiros',
  engineType: 'diesel',
  price: 35000,
  ivaRegime: 'normal',
  activity: 'other',
  maintenanceCost: 1000,
  insuranceCost: 800,
  fuelCost: 2500,
  exemptTA: false,
  phevCompliant: true
});

const getInitialTicketState = (profile: ClientProfileType): TicketSimulatorState => ({
  employees: profile.nrFuncionarios,
  ticketValue: profile.valorTicket,
  daysPerMonth: 22,
  months: 12
});

const getInitialSSState = (profile: ClientProfileType): SSState => ({
  income: profile.rendimentoMensalEni,
  regime: profile.regimeSs,
  tipoRendimento: profile.tipoRendimentoSs
});

export default function App() {
  const [view, setView] = useState<'profile' | 'tax' | 'vehicle' | 'ticket' | 'selfss'>('tax');

  const [clientProfile, setClientProfile] = useState<ClientProfileType>(defaultProfile);
  const [taxState, setTaxState] = useState<TaxSimulatorState>(() => getInitialTaxState(defaultProfile));
  const [vehicleState, setVehicleState] = useState<VehicleSimulatorState>(getInitialVehicleState);
  const [ticketState, setTicketState] = useState<TicketSimulatorState>(() => getInitialTicketState(defaultProfile));
  const [ssState, setSSState] = useState<SSState>(() => getInitialSSState(defaultProfile));

  const updateProfileWithSimulatorSync = (newProfile: ClientProfileType) => {
    setClientProfile(newProfile);
    setTaxState(prev => ({
      ...prev,
      age: newProfile.idade,
      isMainAct: newProfile.tipoEntidade !== 'eni',
      isServices: newProfile.atividadePrincipal === 'servicos',
      rev: newProfile.faturaçaoAnualPrevista,
      isSeasonal: newProfile.isSazonal
    }));
    setTicketState(prev => ({
      ...prev,
      employees: newProfile.nrFuncionarios,
      ticketValue: newProfile.valorTicket
    }));
    setSSState(prev => ({
      ...prev,
      income: newProfile.rendimentoMensalEni,
      regime: newProfile.regimeSs,
      tipoRendimento: newProfile.tipoRendimentoSs
    }));
  };

  const handleTaxStateChange = (newState: TaxSimulatorState) => {
    setTaxState(newState);
    setClientProfile(prev => ({
      ...prev,
      idade: newState.age,
      atividadePrincipal: newState.isServices ? 'servicos' : 'bens',
      faturaçaoAnualPrevista: newState.rev,
      isSazonal: newState.isSeasonal
    }));
  };

  const handleTicketStateChange = (newState: TicketSimulatorState) => {
    setTicketState(newState);
    setClientProfile(prev => ({
      ...prev,
      nrFuncionarios: newState.employees,
      valorTicket: newState.ticketValue
    }));
  };

  const handleSSStateChange = (newState: SSState) => {
    setSSState(newState);
    setClientProfile(prev => ({
      ...prev,
      rendimentoMensalEni: newState.income,
      regimeSs: newState.regime,
      tipoRendimentoSs: newState.tipoRendimento
    }));
  };

  return (
    <div className="h-screen w-full flex bg-[#F8FAFC] overflow-hidden text-slate-900 relative">
      <div className="group absolute top-0 left-0 h-full z-50 flex shadow-2xl">
        <nav className="w-[64px] group-hover:w-[260px] h-full bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden">
          <div className="h-20 flex items-center px-4 w-[260px] shrink-0 border-b border-slate-100">
             <div className="w-8 h-8 flex items-center justify-center shrink-0 mr-4">
                <svg viewBox="0 0 100 80" className="w-8 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M 45 10 A 30 30 0 0 0 45 70" stroke="#333333" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M 30 45 L 42 58 L 65 25" stroke="#781D1D" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
             </div>
             <div className="flex-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                 <h1 className="text-[17px] font-[800] tracking-[-0.5px] text-[#333333]">RECOFATIMA</h1>
                 <p className="text-[11px] tracking-[0.5px] text-[#781D1D] mt-[-2px] font-[600] capitalize">Contabilidade</p>
             </div>
          </div>

          <div className="flex flex-col gap-2 p-3 w-[260px] pt-4">
            <button onClick={() => setView('profile')} className={cn("flex items-center gap-3 px-3 py-3 rounded-[12px] transition-colors", view === 'profile' ? "bg-[#0F172A] text-white shadow-md shadow-[#0F172A]/20" : "text-[#475569] hover:text-[#0F172A] hover:bg-[#0F172A]/10")}>
              <div className="w-4 h-4 flex items-center justify-center shrink-0">
                <UserCircle className="w-[18px] h-[18px] shrink-0" />
              </div>
              <span className="text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Perfil Cliente</span>
            </button>

            <div className="border-t border-slate-200 my-2"></div>

            <button onClick={() => setView('tax')} className={cn("flex items-center gap-3 px-3 py-3 rounded-[12px] transition-colors", view === 'tax' ? "bg-[#781D1D] text-white shadow-md shadow-[#781D1D]/20" : "text-[#475569] hover:text-[#781D1D] hover:bg-[#781D1D]/10")}>
              <div className="w-4 h-4 flex items-center justify-center shrink-0">
                <Calculator className="w-[18px] h-[18px] shrink-0" />
              </div>
              <span className="text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Enquadramento Fiscal</span>
            </button>
            <button onClick={() => setView('vehicle')} className={cn("flex items-center gap-3 px-3 py-3 rounded-[12px] transition-colors", view === 'vehicle' ? "bg-[#781D1D] text-white shadow-md shadow-[#781D1D]/20" : "text-[#475569] hover:text-[#781D1D] hover:bg-[#781D1D]/10")}>
              <div className="w-4 h-4 flex items-center justify-center shrink-0">
                <Car className="w-[18px] h-[18px] shrink-0" />
              </div>
              <span className="text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Viaturas Ligeiras</span>
            </button>
            <button onClick={() => setView('ticket')} className={cn("flex items-center gap-3 px-3 py-3 rounded-[12px] transition-colors", view === 'ticket' ? "bg-[#781D1D] text-white shadow-md shadow-[#781D1D]/20" : "text-[#475569] hover:text-[#781D1D] hover:bg-[#781D1D]/10")}>
              <div className="w-4 h-4 flex items-center justify-center shrink-0">
                <Ticket className="w-[18px] h-[18px] shrink-0" />
              </div>
              <span className="text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Ticket (Benefícios)</span>
            </button>
            <button onClick={() => setView('selfss')} className={cn("flex items-center gap-3 px-3 py-3 rounded-[12px] transition-colors", view === 'selfss' ? "bg-[#781D1D] text-white shadow-md shadow-[#781D1D]/20" : "text-[#475569] hover:text-[#781D1D] hover:bg-[#781D1D]/10")}>
              <div className="w-4 h-4 flex items-center justify-center shrink-0">
                <User className="w-[18px] h-[18px] shrink-0" />
              </div>
              <span className="text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300">Segurança Social Independente</span>
            </button>
          </div>

          <div className="mt-auto p-4 w-[260px] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
             <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-[10px] text-slate-500 font-medium leading-relaxed">
                Dados atualizados conforme <strong>OE 2026</strong> aprovado • Abril 2026
             </div>
          </div>
        </nav>
      </div>

      <main className="flex-1 h-full w-full ml-[64px] bg-[#F8FAFC] flex flex-col overflow-hidden relative">
        {view === 'profile' && (
          <ClientProfile
            profile={clientProfile}
            onChange={updateProfileWithSimulatorSync}
            taxState={taxState}
            vehicleState={vehicleState}
            ticketState={ticketState}
            ssState={ssState}
          />
        )}

        {view === 'tax' && (
          <TaxSimulator
            initialState={taxState}
            onStateChange={handleTaxStateChange}
            profile={clientProfile}
          />
        )}

        {view === 'vehicle' && (
          <VehicleSimulator
            initialState={vehicleState}
            onStateChange={setVehicleState}
          />
        )}

        {view === 'ticket' && (
          <TicketSimulator
            initialState={ticketState}
            onStateChange={handleTicketStateChange}
            profile={clientProfile}
          />
        )}

        {view === 'selfss' && (
          <SelfEmployedSSSimulator
            initialState={ssState}
            onStateChange={handleSSStateChange}
          />
        )}
      </main>
    </div>
  );
}