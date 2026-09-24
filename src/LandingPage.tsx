import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight, Calculator, FileText, FileSignature, ShieldCheck, Sparkles, ChevronDown, Check, Building2, BookOpen,
  LayoutDashboard, CheckSquare, Lock, Users, Calendar, Table2, Eye,
} from 'lucide-react';

interface Props { onEnter: () => void; onCreateAccount?: () => void; }

export default function LandingPage({ onEnter, onCreateAccount }: Props) {
  const goSignup = onCreateAccount || onEnter;
  return (
    <div className="min-h-screen w-full bg-[#FCFCFC] text-[#0B1D2D] overflow-x-hidden selection:bg-[#0677FF]/10">
      <NavBar onLogin={onEnter} onSignup={goSignup} />
      <Hero onSignup={goSignup} onLogin={onEnter} />
      <Metrics />
      <HowItWorks />
      <Simulators />
      <GabineteSection />
      <PackageStrip />
      <Pricing onSignup={goSignup} onLogin={onEnter} />
      <FinalCTA onSignup={goSignup} />
      <Footer />
    </div>
  );
}

function NavBar({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 bg-[#FCFCFC]/80 backdrop-blur-xl border-b border-black/[0.04]">
      <div className="max-w-[1160px] mx-auto px-5 md:px-6 h-[64px] flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5">
          <BrandMark size={26} />
          <span className="text-[13px] font-[800] tracking-[-0.3px]">ESTUDO<span className="text-[#0677FF]">360°</span></span>
        </a>
        <nav className="hidden md:flex items-center gap-7 text-[13px] font-[500] text-black/40">
          <a href="#simuladores" className="hover:text-black transition-colors">Simuladores</a>
          <a href="#gabinete" className="hover:text-black transition-colors">Gabinete</a>
          <a href="#precos" className="hover:text-black transition-colors">Preços</a>
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={onLogin} className="hidden sm:inline-flex text-[13.5px] font-[600] px-4 py-2 rounded-full hover:bg-black/[0.04] transition-colors">Entrar</button>
          <button onClick={onSignup} className="inline-flex items-center gap-1.5 text-[13.5px] font-[700] text-white bg-[#0B1D2D] px-5 py-2.5 rounded-full hover:bg-black transition-colors">Criar conta <ArrowRight className="w-3.5 h-3.5" /></button>
          <button onClick={() => setOpen(o=>!o)} className="md:hidden w-9 h-9 grid place-items-center rounded-full border border-black/10 ml-1"><ChevronDown className={`w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${open?'rotate-180':''}`} /></button>
        </div>
      </div>
      {open && (
        <motion.div initial={{opacity:0, y:-6}} animate={{opacity:1, y:0}} className="md:hidden border-t border-black/5 px-5 py-4 space-y-3 text-[14px] bg-white">
          <a href="#simuladores" onClick={()=>setOpen(false)} className="block py-1">Simuladores</a>
          <a href="#gabinete" onClick={()=>setOpen(false)} className="block py-1">Gabinete</a>
          <a href="#precos" onClick={()=>setOpen(false)} className="block py-1">Preços</a>
          <button onClick={onLogin} className="block w-full text-left py-1">Entrar</button>
        </motion.div>
      )}
    </header>
  );
}

function Hero({ onSignup, onLogin }: { onSignup: () => void; onLogin: () => void }) {
  return (
    <section id="top" className="max-w-[1160px] mx-auto px-5 md:px-6 pt-16 md:pt-24 pb-10">
      <motion.div initial={{opacity:0, y:12}} animate={{opacity:1, y:0}} transition={{duration:0.6, ease:[0.4,0,0.2,1]}} className="max-w-[760px]">
        <div className="inline-flex items-center gap-2 text-[11px] tracking-[1.4px] uppercase font-[700] text-black/40">
          <span className="w-7 h-px bg-black/15" /> OE 2026 · CIRS · CIRC · CIVA
        </div>
        <h1 className="mt-5 text-[42px] md:text-[68px] leading-[0.9] tracking-[-0.04em] font-[300]">
          O escritório<br />
          <span className="font-[700] tracking-[-0.03em]">sem papel.</span>
        </h1>
        <p className="mt-5 text-[16px] md:text-[17px] leading-[1.65] text-black/50 max-w-[520px]">
          10 simuladores fiscais + gabinete completo. Quadro de obrigações, mapas de controlo e RH, cofre e tarefas — tudo isolado por conta.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button onClick={onSignup} className="inline-flex items-center gap-2 bg-[#0B1D2D] text-white px-7 py-3.5 rounded-full text-[14px] font-[700] hover:bg-black transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]">Criar conta grátis <ArrowRight className="w-4 h-4" /></button>
          <button onClick={onLogin} className="inline-flex items-center gap-2 bg-white border border-black/10 px-7 py-3.5 rounded-full text-[14px] font-[600] hover:bg-black/[0.03] transition-colors">Ver demonstração</button>
        </div>
        <div className="mt-7 flex flex-wrap gap-5 text-[12.5px] text-black/40">
          <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Sem cartão</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Dados isolados por conta</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> A4 pronto</span>
        </div>
      </motion.div>
      {/* minimal mock */}
      <motion.div initial={{opacity:0, y:16}} animate={{opacity:1, y:0}} transition={{duration:0.7, delay:0.15, ease:[0.4,0,0.2,1]}} className="mt-12 md:mt-14 rounded-[20px] border border-black/[0.06] bg-white p-3 md:p-4 shadow-[0_20px_60px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="h-[280px] md:h-[360px] rounded-[14px] bg-[#F8FAFC] border border-black/[0.04] grid place-items-center text-black/20 text-[12px] tracking-[1px] uppercase font-[600]">
          Pré-visualização · Quadro JAN–DEZ · Mapa de Controlo
        </div>
      </motion.div>
    </section>
  );
}

function Metrics() {
  const items: [string,string][] = [
    ['10','simuladores fiscais'],
    ['312','obrigações 2026'],
    ['7','funções de gabinete'],
    ['∞','clientes por conta'],
  ];
  return (
    <div className="border-y border-black/[0.04] bg-white">
      <div className="max-w-[1160px] mx-auto px-5 md:px-6 py-7 grid grid-cols-2 md:grid-cols-4 gap-6">
        {items.map(([n,l])=>(
          <div key={l} className="flex flex-col">
            <span className="text-[30px] font-[300] tracking-tight leading-none">{n}</span>
            <span className="mt-1 text-[10.5px] tracking-[1.3px] uppercase font-[700] text-black/30">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { k:'01', t:'Perfil', d:'NIF, CAE, regime IVA e colaboradores. Validação instantânea.' },
    { k:'02', t:'Simula', d:'ENI vs Lda, IRS, IVA e SS recalculam em tempo real.' },
    { k:'03', t:'Entrega', d:'Pacote com tua marca — proposta + minuta em A4, um clique.' },
  ];
  return (
    <section className="max-w-[1160px] mx-auto px-5 md:px-6 py-16 md:py-22">
      <div className="max-w-[560px]">
        <div className="text-[11px] tracking-[1.4px] uppercase font-[700] text-black/30">Como funciona</div>
        <h2 className="mt-2 text-[28px] md:text-[36px] leading-[0.95] tracking-[-0.03em] font-[300]">Do telefonema ao <span className="font-[700]">PDF</span>.</h2>
      </div>
      <div className="mt-8 grid md:grid-cols-3 gap-4">
        {steps.map(s=>(
          <div key={s.k} className="rounded-[18px] border border-black/[0.06] bg-white p-6">
            <div className="text-[11px] tracking-[1.4px] font-[700] text-[#0677FF]">{s.k}</div>
            <div className="mt-2 text-[16px] font-[700] tracking-[-0.2px]">{s.t}</div>
            <div className="mt-1.5 text-[13.5px] leading-[1.5] text-black/50">{s.d}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Simulators() {
  const sims = [
    ['ENI vs Lda','Fiscal',Calculator], ['IRS','Modelo 3',BookOpen], ['IRC','Previsa',Calculator], ['Viatura','IVA + TA',Building2],
    ['Ticket','Vales',Building2], ['SS Indep.','Contribuições',ShieldCheck], ['Imóveis','Empresa vs pessoal',Building2], ['IMT','Aquisição',BookOpen],
    ['Salário','Líquido',Calculator], ['Apoio','Diagnóstico',Sparkles],
  ] as const;
  return (
    <section id="simuladores" className="max-w-[1160px] mx-auto px-5 md:px-6 py-6 md:py-10 border-t border-black/[0.04]">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[18px] md:text-[20px] font-[700] tracking-[-0.02em]">Simuladores</h2>
        <span className="text-[11px] tracking-[1.2px] uppercase font-[600] text-black/30">10 · sempre atualizados</span>
      </div>
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {sims.map(([label,sub,Icon])=>(
          <div key={label} className="group rounded-[16px] border border-black/[0.06] bg-white p-4 hover:border-black/10 transition-colors">
            <span className="w-8 h-8 grid place-items-center rounded-full bg-black/[0.04] group-hover:bg-[#0677FF]/10 text-black/70 group-hover:text-[#0677FF] transition-colors"><Icon className="w-4 h-4" /></span>
            <div className="mt-3 text-[13px] font-[700] leading-none">{label}</div>
            <div className="text-[11px] text-black/40">{sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function GabineteSection() {
  const feats = [
    ['Quadro', 'JAN–DEZ · v/✕', Table2, 'Obrigações por cliente e mês com dropdown e expand.'],
    ['Mapa Controlo','7 pilares', Table2, 'Gestão doc., vendas, compras, salários, AFT, banco, balancete.'],
    ['Mapa RH','6 pilares', Users, 'Salários, ticket, IRS, DMR-AT/SS e encargos.'],
    ['Visão Geral','Ficha 360', LayoutDashboard, 'Contactos, assuntos, alertas e histórico.'],
    ['Tarefas','Lista', CheckSquare, 'Prioridade, estado e vencimento por cliente.'],
    ['Cofre','Acessos', Lock, 'Segredos só da tua conta com auditoria.'],
    ['Equipa','Colaboradores', Users, 'Convites e cargos por gabinete.'],
    ['Assistente','IA', Sparkles, 'Chat com contexto dos simuladores.'],
  ] as const;
  return (
    <section id="gabinete" className="max-w-[1160px] mx-auto px-5 md:px-6 py-10 md:py-16 border-t border-black/[0.04]">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] md:text-[28px] font-[300] tracking-[-0.03em]">Gabinete. <span className="font-[700]">Tudo num sítio.</span></h2>
          <p className="mt-1.5 text-[13.5px] text-black/50 max-w-[520px]">Quadro, mapas com dropdown bezier e cofre isolado por conta. Cada gabinete vê só os seus dados.</p>
        </div>
        <span className="text-[11px] tracking-[1.2px] uppercase font-[700] text-black/25">Isolado por gabineteId</span>
      </div>
      <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {feats.map(([t,s,Icon,desc])=>(
          <div key={t} className="rounded-[16px] border border-black/[0.06] bg-white p-5">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 grid place-items-center rounded-full bg-[#0677FF]/10 text-[#0677FF]"><Icon className="w-4 h-4" /></span>
              <div><div className="text-[13px] font-[700] leading-none">{t}</div><div className="text-[11px] text-black/40">{s}</div></div>
            </div>
            <div className="mt-3 text-[12.5px] leading-[1.45] text-black/50">{desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PackageStrip() {
  return (
    <section className="max-w-[1160px] mx-auto px-5 md:px-6 py-8 border-y border-black/[0.04] bg-white">
      <div className="grid md:grid-cols-3 gap-6 text-[13px]">
        <div className="flex gap-3"><span className="w-8 h-8 grid place-items-center rounded-full bg-black/[0.04] shrink-0"><Calculator className="w-4 h-4" /></span><div><div className="font-[700]">Simulação</div><div className="text-black/50">ENI vs Lda com IRS Jovem e IRC.</div></div></div>
        <div className="flex gap-3"><span className="w-8 h-8 grid place-items-center rounded-full bg-black/[0.04] shrink-0"><FileText className="w-4 h-4" /></span><div><div className="font-[700]">Proposta</div><div className="text-black/50">Com a tua marca e honorários.</div></div></div>
        <div className="flex gap-3"><span className="w-8 h-8 grid place-items-center rounded-full bg-black/[0.04] shrink-0"><FileSignature className="w-4 h-4" /></span><div><div className="font-[700]">Minuta</div><div className="text-black/50">Contrato OCC pré-preenchido.</div></div></div>
      </div>
    </section>
  );
}

function Pricing({ onSignup, onLogin }: { onSignup: () => void; onLogin: () => void }) {
  const tiers = [
    { name:'Solo', price:'49', note:'1 utilizador', feats:['Simuladores + guias','Gabinete essencial','Pacote A4'], hi:false },
    { name:'Escritório', price:'129', note:'Até 5', feats:['Gabinete completo','Live + offline','Cofre por conta','Excel honorários'], hi:true },
    { name:'Sociedade', price:'249', note:'Até 15', feats:['Multi-gabinete','SAF-T','Multi-marca','Onboarding'], hi:false },
  ];
  return (
    <section id="precos" className="max-w-[1160px] mx-auto px-5 md:px-6 py-12 md:py-16">
      <h2 className="text-[22px] md:text-[28px] font-[300] tracking-[-0.03em]">Preço por tamanho.</h2>
      <div className="mt-6 grid md:grid-cols-3 gap-4">
        {tiers.map(t=>(
          <div key={t.name} className={`rounded-[20px] border p-6 flex flex-col ${t.hi ? 'bg-[#0B1D2D] text-white border-black' : 'bg-white border-black/[0.06]'}`}>
            <div className="text-[11px] tracking-[1.3px] uppercase font-[700] opacity-50">{t.name} · {t.note}</div>
            <div className="mt-2 flex items-baseline gap-1"><span className="text-[34px] font-[300] tracking-tight">€{t.price}</span><span className="text-[12px] opacity-50">/mês</span></div>
            <ul className="mt-4 space-y-2 flex-1">
              {t.feats.map(f=>(<li key={f} className="flex gap-2 text-[13px]"><Check className={`w-4 h-4 mt-0.5 ${t.hi ? 'text-white' : 'text-[#0677FF]'}`} /><span className={t.hi ? 'opacity-90' : 'text-black/60'}>{f}</span></li>))}
            </ul>
            <button onClick={onSignup} className={`mt-6 py-3 rounded-full text-[13px] font-[700] transition-colors ${t.hi ? 'bg-white text-black hover:bg-black/5' : 'bg-[#0B1D2D] text-white hover:bg-black'}`}>Criar conta</button>
          </div>
        ))}
      </div>
      <div className="mt-4 text-center"><button onClick={onLogin} className="text-[13px] text-black/40 hover:text-black transition-colors">Já tenho conta — Entrar</button></div>
    </section>
  );
}

function FinalCTA({ onSignup }: { onSignup: () => void }) {
  return (
    <section className="max-w-[1160px] mx-auto px-5 md:px-6 py-12 md:py-16 border-t border-black/[0.04] text-center">
      <h2 className="text-[26px] md:text-[36px] leading-[0.95] tracking-[-0.03em] font-[300]">Próximo cliente,<br /><span className="font-[700]">tudo pronto.</span></h2>
      <button onClick={onSignup} className="mt-6 inline-flex items-center gap-2 bg-[#0B1D2D] text-white px-7 py-3.5 rounded-full text-[14px] font-[700] hover:bg-black transition-colors">Criar conta grátis <ArrowRight className="w-4 h-4" /></button>
      <div className="mt-3 text-[11px] tracking-[1.3px] uppercase font-[600] text-black/30">Sem cartão · acesso imediato</div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-black/[0.04] py-8">
      <div className="max-w-[1160px] mx-auto px-5 md:px-6 flex flex-col md:flex-row gap-3 justify-between text-[12px] text-black/30">
        <span className="inline-flex items-center gap-2"><BrandMark size={18} /> © {new Date().getFullYear()} Estudo 360</span>
        <span className="flex gap-4"><a href="#simuladores" className="hover:text-black">Simuladores</a><a href="#gabinete" className="hover:text-black">Gabinete</a><a href="#precos" className="hover:text-black">Preços</a></span>
      </div>
    </footer>
  );
}

function BrandMark({ size=26 }: { size?: number }) {
  return <img src="/logo.svg" alt="" width={size} height={size} className="object-contain shrink-0" style={{width:size,height:size}} draggable={false} aria-hidden="true" />;
}
