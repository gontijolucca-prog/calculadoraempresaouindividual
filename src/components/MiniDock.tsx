import { useState } from 'react';
export default function MiniDock({ onAi, onGuia, showGuia, lift }: { onAi:()=>void; onGuia:()=>void; showGuia:boolean; lift?:boolean }){
  const [open,setOpen]=useState(false);
  const pos = lift ? 'bottom-40 lg:bottom-24' : 'bottom-5 lg:bottom-6';
  if(open) return (
    <div className={`no-print fixed z-[90] right-5 lg:right-6 flex flex-col gap-2 items-end ${pos} animate-[dockIn_.22s_ease]`}>
      <button onClick={()=>{setOpen(false); onAi();}} className="px-5 py-3 rounded-full bg-[#0F172A] text-white text-[13px] font-[700] shadow-xl hover:scale-[1.02] transition-transform">AI Contabilista</button>
      {showGuia && <button onClick={()=>{setOpen(false); onGuia();}} className="px-5 py-3 rounded-full text-white text-[13px] font-[700] shadow-xl hover:scale-[1.02] transition-transform" style={{background:'linear-gradient(135deg,#0B1D2D,#0677FF)'}}>Aprender esta página</button>}
      <button onClick={()=>setOpen(false)} className="text-[11px] text-slate-500 px-2">Fechar</button>
      <style>{`@keyframes dockIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
  return <button aria-label="Falar com o assistente" onClick={()=>setOpen(true)} className={`no-print fixed z-[90] right-5 lg:right-6 w-12 h-12 rounded-full flex items-center justify-center text-white shadow-xl opacity-60 hover:opacity-100 hover:scale-105 transition-all ${pos}`} style={{background:'linear-gradient(135deg,#0F172A,#0677FF)'}}>
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M4.5 20c.6-3.7 3.6-5.6 7.5-5.6s6.9 1.9 7.5 5.6" />
      <path d="M18.5 8.2a6.6 6.6 0 0 0-13 0" opacity=".55" />
    </svg>
  </button>;
}
