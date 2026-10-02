import { useState } from 'react';
import { Sparkles } from 'lucide-react';
export default function MiniDock({ onAi, onGuia, showGuia, lift }: { onAi:()=>void; onGuia:()=>void; showGuia:boolean; lift?:boolean }){
  const [open,setOpen]=useState(false);
  const pos = lift ? 'bottom-40 lg:bottom-24' : 'bottom-5 lg:bottom-6';
  if(open) return (
    <div className={`no-print fixed z-[90] right-5 lg:right-6 flex flex-col gap-2 items-end ${pos}`}>
      <button onClick={()=>{setOpen(false); onAi();}} className="px-5 py-3 rounded-full bg-[#0F172A] text-white text-[13px] font-[700] shadow-xl">AI Contabilista</button>
      {showGuia && <button onClick={()=>{setOpen(false); onGuia();}} className="px-5 py-3 rounded-full text-white text-[13px] font-[700] shadow-xl" style={{background:'linear-gradient(135deg,#0B1D2D,#0677FF)'}}>Aprender esta página</button>}
      <button onClick={()=>setOpen(false)} className="text-[11px] text-slate-500">Fechar</button>
    </div>
  );
  return <button aria-label="Abrir assistentes" onClick={()=>setOpen(true)} className={`no-print fixed z-[90] right-5 lg:right-6 w-12 h-12 rounded-full flex items-center justify-center text-white shadow-xl opacity-50 hover:opacity-100 transition-opacity ${pos}`} style={{background:'linear-gradient(135deg,#0F172A,#0677FF)'}}><Sparkles className="w-6 h-6"/></button>;
}
