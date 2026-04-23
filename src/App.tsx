import React, { useState } from 'react';
import { Calculator, Car } from 'lucide-react';
import TaxSimulator from './TaxSimulator';
import VehicleSimulator from './VehicleSimulator';
import { cn } from './lib/utils';

export default function App() {
  const [view, setView] = useState<'tax' | 'vehicle'>('tax');

  return (
    <div className="h-screen w-full flex bg-[#F8FAFC] overflow-hidden text-slate-900 relative">
      
      {/* Absolute Sidebar - expands on group-hover OVER the content */}
      <div className="group absolute top-0 left-0 h-full z-50 flex shadow-2xl">
        <nav className="w-[64px] group-hover:w-[260px] h-full bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden">
          
          <div className="h-20 flex items-center px-4 w-[260px] shrink-0 border-b border-slate-100">
             <div className="w-8 h-8 flex items-center justify-center shrink-0 mr-4">
                <svg viewBox="0 0 100 80" className="w-8 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Curve Logo */}
                  <path d="M 45 10 A 30 30 0 0 0 45 70" stroke="#333333" strokeWidth="2.5" strokeLinecap="round"/>
                  {/* Checkmark */}
                  <path d="M 30 45 L 42 58 L 65 25" stroke="#781D1D" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
             </div>
             <div className="flex-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                 <h1 className="text-[17px] font-[800] tracking-[-0.5px] text-[#333333]">RECOFATIMA</h1>
                 <p className="text-[11px] tracking-[0.5px] text-[#781D1D] mt-[-2px] font-[600] capitalize">Contabilidade</p>
             </div>
          </div>

          <div className="flex flex-col gap-2 p-3 w-[260px] pt-4">
            <button onClick={() => setView('tax')} className={cn("flex items-center gap-3 px-3 py-3 rounded-[12px] transition-colors", view === 'tax' ? "bg-[#781D1D] text-white shadow-md shadow-[#781D1D]/20" : "text-[#475569] hover:text-[#781D1D] hover:bg-[#781D1D]/10")}>
              <div className="w-4 h-4 flex items-center justify-center shrink-0">
                <Calculator className="w-[18px] h-[18px] shrink-0" />
              </div>
              <span className="text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">IRS / IRC / SS</span>
            </button>
            <button onClick={() => setView('vehicle')} className={cn("flex items-center gap-3 px-3 py-3 rounded-[12px] transition-colors", view === 'vehicle' ? "bg-[#781D1D] text-white shadow-md shadow-[#781D1D]/20" : "text-[#475569] hover:text-[#781D1D] hover:bg-[#781D1D]/10")}>
              <div className="w-4 h-4 flex items-center justify-center shrink-0">
                <Car className="w-[18px] h-[18px] shrink-0" />
              </div>
              <span className="text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Viaturas Ligeiras</span>
            </button>
          </div>

          <div className="mt-auto p-4 w-[260px] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
             <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-[10px] text-slate-500 font-medium leading-relaxed">
                As simulações estão atualizadas face às propostas do <strong>OE 2026</strong>.
             </div>
          </div>
        </nav>
      </div>

      {/* Main Content pushed by the constant collapsed width (64px) */}
      <main className="flex-1 h-full w-full ml-[64px] bg-[#F8FAFC] flex flex-col overflow-hidden relative">
        {view === 'tax' ? <TaxSimulator /> : <VehicleSimulator />}
      </main>
    </div>
  );
}
