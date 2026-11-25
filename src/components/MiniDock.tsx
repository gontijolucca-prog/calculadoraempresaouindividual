import { useState } from 'react';
export default function MiniDock({ onAi, onGuia, showGuia, lift }: { onAi:()=>void; onGuia:()=>void; showGuia:boolean; lift?:boolean }){
  const [open,setOpen]=useState(false);
  const pos = lift ? 'bottom-40 lg:bottom-24' : 'bottom-5 lg:bottom-6';
  if(open) return (
    <div className={`no-print fixed z-[90] right-5 lg:right-6 flex flex-col gap-2 items-end ${pos} animate-[dockIn_.22s_ease]`}>
      <button onClick={()=>{setOpen(false); onAi();}} className="px-5 py-3 rounded-full bg-[#0F172A] text-white text-[13px] font-[700] shadow-xl hover:scale-[1.02] transition-transform">AI Contabilista</button>
      {showGuia && <button onClick={()=>{setOpen(false); onGuia();}} className="px-5 py-3 rounded-full text-white text-[13px] font-[700] shadow-xl hover:scale-[1.02] transition-transform" style={{background:'linear-gradient(135deg,#0B1D2D,var(--accent))'}}>Aprender esta página</button>}
      <button onClick={()=>setOpen(false)} className="text-[11px] text-slate-500 px-2">Fechar</button>
      <style>{`@keyframes dockIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
  return <button aria-label="Abrir a ajuda" onClick={()=>setOpen(true)} className={`no-print fixed z-[90] right-5 lg:right-6 flex items-center gap-2 h-12 rounded-full pl-3 pr-3 sm:pr-4 text-white shadow-xl hover:scale-105 active:scale-[0.98] transition-all ${pos}`}
    style={{background:'linear-gradient(135deg,#0F172A,var(--accent))', boxShadow:'0 10px 26px -10px rgba(6,119,255,0.75), 0 0 0 1px rgba(255,255,255,0.14)'}}>
    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/15 shrink-0">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="3.4" />
        <path d="M4.5 20c.6-3.7 3.6-5.6 7.5-5.6s6.9 1.9 7.5 5.6" />
        <path d="M18.5 8.2a6.6 6.6 0 0 0-13 0" opacity=".55" />
      </svg>
    </span>
    <span className="hidden sm:inline text-[13px] font-[800] whitespace-nowrap">Ajuda</span>
  </button>;
}
