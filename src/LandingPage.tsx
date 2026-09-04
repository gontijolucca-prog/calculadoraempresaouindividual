import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight, Calculator, FileText, FileSignature, Layers, ShieldCheck,
  Clock, Sparkles, ChevronDown, Check, BadgeCheck, Building2, BookOpen,
  LayoutDashboard, CheckSquare, CalendarClock, Lock, Database, ListChecks, Scale, Receipt,
  Printer, Users, Calendar, Mail,
} from 'lucide-react';

interface Props {
  onEnter: () => void;
  onCreateAccount?: () => void;
}

export default function LandingPage({ onEnter, onCreateAccount }: Props) {
  const goSignup = onCreateAccount || onEnter;
  return (
    <div className="min-h-screen w-full bg-white text-[#0B1D2D] overflow-x-hidden">
      <NavBar onLogin={onEnter} onSignup={goSignup} />
      <Hero onLogin={onEnter} onSignup={goSignup} />
      <Strip />
      <HowItWorks />
      <Catalog />
      <Package />
      <Gabinete />
      <Novidades />
      <Compliance />
      <Pricing onSignup={goSignup} onLogin={onEnter} />
      <FinalCTA onSignup={goSignup} />
      <Footer />
    </div>
  );
}

function NavBar({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-black/[0.06]">
      <div className="max-w-[1120px] mx-auto px-5 md:px-6 h-[60px] flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5">
          <BrandMark size={28} />
          <span className="brand-sans text-[14px] font-[800] tracking-[-0.2px]">ESTUDO<span className="text-[#0677FF]">360°</span></span>
        </a>
        <nav className="hidden md:flex items-center gap-6 text-[13px] font-[500] text-black/60">
          <a href="#funciona" className="hover:text-black">Como funciona</a>
          <a href="#simuladores" className="hover:text-black">Simuladores</a>
          <a href="#gabinete" className="hover:text-black">Gabinete</a>
          <a href="#pacote" className="hover:text-black">Pacote</a>
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={onLogin} className="hidden sm:inline-flex text-[13px] font-[600] px-4 py-2 rounded-full hover:bg-black/[0.04]">Entrar</button>
          <button onClick={onSignup} className="inline-flex items-center gap-1.5 text-[13px] font-[700] text-white bg-[#0B1D2D] px-4 py-2 rounded-full hover:bg-black">Criar conta <ArrowRight className="w-3.5 h-3.5" /></button>
          <button onClick={() => setOpen(o=>!o)} aria-label="Abrir menu" aria-expanded={open} className="md:hidden w-8 h-8 grid place-items-center rounded-full border border-black/10"><ChevronDown className={`w-4 h-4 transition-transform ${open?'rotate-180':''}`} /></button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-black/5 px-5 py-4 space-y-3 text-[14px]">
          <a href="#funciona" onClick={()=>setOpen(false)} className="block">Como funciona</a>
          <a href="#simuladores" onClick={()=>setOpen(false)} className="block">Simuladores</a>
          <a href="#gabinete" onClick={()=>setOpen(false)} className="block">Gabinete</a>
          <button onClick={onLogin} className="block w-full text-left">Entrar</button>
          <button onClick={onSignup} className="block w-full text-left font-[700]">Criar conta</button>
        </div>
      )}
    </header>
  );
}

function Hero({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  return (
    <section id="top" className="max-w-[1120px] mx-auto px-5 md:px-6 pt-14 md:pt-20 pb-12 md:pb-16">
      <div className="max-w-[720px]">
        <div className="inline-flex items-center gap-2 text-[11px] tracking-[1.6px] uppercase font-[700] text-[#6B7280]">
          <span className="w-6 h-px bg-[var(--brand-bordeaux-neon)]" /> OE 2026 · CIRS/CIRC/CIVA atualizados
        </div>
        <h1 className="display-serif mt-4 text-[40px] md:text-[64px] leading-[0.95] tracking-[-0.03em] font-[200]">
          Recebe o cliente.<br />
          Sai com <span className="italic font-[800] text-[#0677FF]">tudo</span> pronto.
        </h1>
        <p className="mt-5 text-[15px] leading-[1.6] text-black/60 max-w-[560px]">
          Perfil, simulação fiscal, proposta e contrato — com a tua marca. Gabinete, cofre e calendário fiscal incluídos. Cada conta vê só os seus clientes.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button onClick={onSignup} className="inline-flex items-center gap-2 bg-[#0B1D2D] text-white px-6 py-3.5 rounded-full text-[14px] font-[700] hover:bg-black">Criar conta grátis <ArrowRight className="w-4 h-4" /></button>
          <button onClick={onLogin} className="inline-flex items-center gap-2 bg-white border border-black/10 px-6 py-3.5 rounded-full text-[14px] font-[600] hover:bg-black/[0.03]">Entrar</button>
        </div>
        <div className="mt-6 flex flex-wrap gap-4 text-[12px] text-[#6B7280]">
          <span className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Sem cartão</span>
          <span className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Cofre privado</span>
          <span className="inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Impressão A4</span>
        </div>
      </div>
    </section>
  );
}

function Strip() {
  const items: [string,string][] = [
    ['10', 'simuladores'],
    ['312', 'obrigações 2026'],
    ['9', 'funções de gabinete'],
    ['A4', 'impressão pronta'],
  ];
  return (
    <div className="border-y border-black/5">
      <div className="max-w-[1120px] mx-auto px-5 md:px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
        {items.map(([n,l])=>(
          <div key={l} className="flex items-baseline gap-3">
            <span className="display-serif text-[28px] font-[800] tracking-tight">{n}</span>
            <span className="text-[11px] tracking-[1.4px] uppercase font-[600] text-[#6B7280]">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { k:'01', t:'O cliente fala.', d:'Preenche o perfil em 6 passos. Valida NIF, regime e limites.' },
    { k:'02', t:'A simulação corre.', d:'ENI vs Lda, IRS, IVA, SS — tudo recalcula em tempo real.' },
    { k:'03', t:'Um clique, pacote.', d:'Simulação + proposta + minuta com a tua marca. Imprime em A4.' },
  ];
  return (
    <section id="funciona" className="max-w-[1120px] mx-auto px-5 md:px-6 py-14 md:py-20">
      <div className="text-[11px] tracking-[1.6px] uppercase font-[700] text-[#6B7280]">Como funciona</div>
      <h2 className="display-serif mt-2 text-[28px] md:text-[40px] leading-[0.95] tracking-[-0.02em] font-[200]">Do telefonema ao <span className="italic font-[800] text-[#0677FF]">PDF</span> em 3 passos.</h2>
      <div className="mt-8 grid md:grid-cols-3 gap-4">
        {steps.map(s=>(
          <div key={s.k} className="rounded-2xl border border-black/5 p-6 bg-white">
            <div className="text-[12px] tracking-[1.4px] uppercase font-[700] text-[#0677FF]">{s.k}</div>
            <div className="mt-2 text-[16px] font-[700]">{s.t}</div>
            <div className="mt-2 text-[13px] leading-[1.5] text-black/60">{s.d}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Catalog() {
  const tools = [
    ['Fiscal','ENI vs Lda',Calculator], ['IRS','Modelo 3',Receipt], ['Previsa','Modelo 22',Calculator], ['Viaturas','IVA + TA',Layers],
    ['Tickets','Vales',BadgeCheck], ['SS Indep.','Contribuições',ShieldCheck], ['Diagnóstico','Autonomia',Building2], ['Imóveis','Decisão',Building2],
    ['IMT','Aquisição',BookOpen], ['Salário','Líquido',BadgeCheck], ['Gabinete','Gestão',LayoutDashboard], ['Cofre','Zero-knowledge',Lock],
  ] as const;
  return (
    <section id="simuladores" className="max-w-[1120px] mx-auto px-5 md:px-6 py-10 md:py-14 border-t border-black/5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="display-serif text-[22px] md:text-[28px] font-[200] tracking-[-0.02em]"><span className="italic font-[800]">12</span> simuladores + gabinete</h2>
        <span className="hidden md:inline text-[12px] text-[#6B7280]">Guias incluídos</span>
      </div>
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {tools.map(([label,sub,Icon])=>(
          <div key={label} className="flex items-center gap-3 rounded-2xl border border-black/5 p-4 bg-white">
            <span className="w-8 h-8 grid place-items-center rounded-full bg-[#0677FF]/10 text-[#0677FF]"><Icon className="w-4 h-4" /></span>
            <div className="min-w-0">
              <div className="text-[13px] font-[700] leading-none">{label}</div>
              <div className="text-[11px] text-[#6B7280]">{sub}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Package() {
  const items = [
    { t:'Simulação fiscal', d:'ENI vs Lda com IRS Jovem, escalões e IRC.', Icon: Calculator },
    { t:'Proposta', d:'Com a tua marca e honorários por escalão.', Icon: FileText },
    { t:'Minuta', d:'Contrato OCC pré-preenchido.', Icon: FileSignature },
  ];
  return (
    <section id="pacote" className="max-w-[1120px] mx-auto px-5 md:px-6 py-10 md:py-14 border-t border-black/5">
      <h2 className="display-serif text-[22px] md:text-[28px] font-[200] tracking-[-0.02em]">Três documentos. <span className="italic font-[800] text-[#0677FF]">Um clique.</span></h2>
      <div className="mt-6 grid md:grid-cols-3 gap-4">
        {items.map(({t,d,Icon})=>(
          <div key={t} className="rounded-2xl border border-black/5 p-6 bg-white">
            <span className="w-8 h-8 grid place-items-center rounded-full bg-black/[0.04]"><Icon className="w-4 h-4" /></span>
            <div className="mt-3 text-[14px] font-[700]">{t}</div>
            <div className="mt-1 text-[13px] text-black/60">{d}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Gabinete() {
  const feats = [
    ['Dashboard','Do dia',LayoutDashboard], ['Agenda','Mês',CalendarClock], ['Clientes 360','Fichas',Users],
    ['Tarefas','Kanban',CheckSquare], ['Obrigações','Mês como tarefas',Calendar], ['Comunicação','Modelos',Mail],
  ] as const;
  return (
    <section id="gabinete" className="max-w-[1120px] mx-auto px-5 md:px-6 py-10 md:py-14 border-t border-black/5">
      <h2 className="display-serif text-[22px] md:text-[28px] font-[200] tracking-[-0.02em]">Gabinete. <span className="italic font-[800] text-[#0677FF]">Tudo num sítio.</span></h2>
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3">
        {feats.map(([t,s,Icon])=>(
          <div key={t} className="rounded-2xl border border-black/5 p-4 bg-white flex items-center gap-3">
            <span className="w-8 h-8 grid place-items-center rounded-full bg-[#0677FF]/10 text-[#0677FF]"><Icon className="w-4 h-4" /></span>
            <div><div className="text-[13px] font-[700] leading-none">{t}</div><div className="text-[11px] text-[#6B7280]">{s}</div></div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-black/50">
        <span className="inline-flex items-center gap-1.5"><Check className="w-3 h-3" /> Galeria + cartão por função</span>
        <span className="inline-flex items-center gap-1.5"><Check className="w-3 h-3" /> Calendário fiscal 2026</span>
        <span className="inline-flex items-center gap-1.5"><Check className="w-3 h-3" /> Impressão A4</span>
      </div>
    </section>
  );
}

function Novidades() {
  return (
    <section className="max-w-[1120px] mx-auto px-5 md:px-6 py-10 md:py-14 border-t border-black/5">
      <div className="rounded-2xl border border-black/5 p-6 md:p-8 bg-[#F8FAFC] border-t-[3px] border-t-[var(--brand-bordeaux-neon)]/30">
        <div className="text-[11px] tracking-[1.4px] uppercase font-[700] text-[#6B7280]">Novidades</div>
        <div className="mt-2 grid md:grid-cols-3 gap-6">
          <div><div className="text-[14px] font-[700] flex items-center gap-2"><Lock className="w-4 h-4 text-[#0677FF]" /> Contas privadas</div><div className="mt-1 text-[13px] text-black/60">Cada conta vê só os seus clientes. Cofre por conta.</div></div>
          <div><div className="text-[14px] font-[700] flex items-center gap-2"><Database className="w-4 h-4 text-[#0677FF]" /> Calendário fiscal</div><div className="mt-1 text-[13px] text-black/60">312 obrigações de 2026 já no gabinete. Mês atual como tarefas.</div></div>
          <div><div className="text-[14px] font-[700] flex items-center gap-2"><Printer className="w-4 h-4 text-[#0677FF]" /> Impressão A4</div><div className="mt-1 text-[13px] text-black/60">Qualquer simulação sai bem formatada em A4.</div></div>
        </div>
      </div>
    </section>
  );
}

function Compliance() {
  return (
    <section className="max-w-[1120px] mx-auto px-5 md:px-6 py-10 border-t border-black/5">
      <div className="flex flex-wrap gap-2">
        {['CIRS 2026','CIRC PME 15%','CIVA','CIMT HPP','OE 2026','EOCC'].map(k=>(
          <span key={k} className="text-[11px] tracking-[1px] uppercase font-[600] px-3 py-1.5 rounded-full bg-white border border-black/10 text-black/60">{k}</span>
        ))}
      </div>
    </section>
  );
}

function Pricing({ onSignup, onLogin }: { onSignup: () => void; onLogin: () => void }) {
  const tiers = [
    { name:'Solo', price:'49', note:'1 utilizador', feats:['Simuladores + guias','Gabinete essencial','Pacote A4'] },
    { name:'Escritório', price:'129', note:'Até 5 utilizadores', feats:['Gabinete completo','Live + offline','Cofre por conta','Excel honorários'], hi:true },
    { name:'Sociedade', price:'249', note:'Até 15', feats:['Multi-colaborador','SAF-T','Multi-marca','Onboarding'] },
  ];
  return (
    <section id="precos" className="max-w-[1120px] mx-auto px-5 md:px-6 py-12 md:py-16 border-t border-black/5">
      <h2 className="display-serif text-[24px] md:text-[32px] font-[200] tracking-[-0.02em]">Preço por tamanho de escritório.</h2>
      <div className="mt-6 grid md:grid-cols-3 gap-4">
        {tiers.map(t=>(
          <div key={t.name} className={`relative rounded-2xl border p-6 flex flex-col ${t.hi ? 'bg-[#0B1D2D] text-white border-black' : 'bg-white border-black/5'}`}>
            {t.hi && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] tracking-[1.4px] uppercase font-[700] px-2.5 py-1 rounded-full bg-[var(--brand-bordeaux-neon)] text-white" style={{ boxShadow: '0 4px 12px var(--brand-bordeaux-glow)' }}>Mais usado</span>}
            <div className="text-[11px] tracking-[1.4px] uppercase font-[700] opacity-60">{t.name} · {t.note}</div>
            <div className="mt-2 flex items-baseline gap-1"><span className="text-[36px] font-[200] tracking-tight">€{t.price}</span><span className="text-[12px] opacity-60">/mês</span></div>
            <ul className="mt-4 space-y-2 flex-1">
              {t.feats.map(f=>(<li key={f} className="flex gap-2 text-[13px]"><Check className={`w-4 h-4 mt-0.5 ${t.hi ? 'text-white' : 'text-[#0677FF]'}`} /><span className={t.hi ? 'opacity-90' : 'text-black/70'}>{f}</span></li>))}
            </ul>
            <button onClick={onSignup} className={`mt-6 py-3 rounded-full text-[13px] font-[700] ${t.hi ? 'bg-white text-black' : 'bg-[#0B1D2D] text-white'}`}>Criar conta</button>
          </div>
        ))}
      </div>
      <div className="mt-4 text-center"><button onClick={onLogin} className="text-[13px] text-black/50 hover:text-black">Já tenho conta — Entrar</button></div>
    </section>
  );
}

function FinalCTA({ onSignup }: { onSignup: () => void }) {
  return (
    <section className="max-w-[1120px] mx-auto px-5 md:px-6 py-12 md:py-16 border-t border-black/5 text-center">
      <h2 className="display-serif text-[28px] md:text-[40px] leading-[0.95] tracking-[-0.02em] font-[200]">Próximo cliente que ligar,<br /><span className="italic font-[800] text-[#0677FF]">desligue com tudo pronto.</span></h2>
      <button onClick={onSignup} className="mt-6 inline-flex items-center gap-2 bg-[#0B1D2D] text-white px-6 py-3.5 rounded-full text-[14px] font-[700] hover:bg-black">Criar conta grátis <ArrowRight className="w-4 h-4" /></button>
      <div className="mt-3 text-[11px] tracking-[1.4px] uppercase font-[600] text-[#6B7280]">Sem cartão · acesso imediato</div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-black/5 py-8">
      <div className="max-w-[1120px] mx-auto px-5 md:px-6 flex flex-col md:flex-row gap-4 justify-between text-[12px] text-[#6B7280]">
        <span className="inline-flex items-center gap-2"><BrandMark size={20} /> © {new Date().getFullYear()} Estudo 360</span>
        <span className="flex gap-4"><a href="#funciona" className="hover:text-black">Como funciona</a><a href="#simuladores" className="hover:text-black">Simuladores</a><a href="#gabinete" className="hover:text-black">Gabinete</a></span>
      </div>
    </footer>
  );
}

function BrandMark({ size=28 }: { size?: number }) {
  return <img src="/logo.svg" alt="" width={size} height={size} className="object-contain shrink-0" style={{width:size,height:size}} draggable={false} aria-hidden="true" />;
}
