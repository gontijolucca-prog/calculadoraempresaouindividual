import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ChevronDown, Check, Calculator, Building2, PiggyBank, CarFront, Receipt, ShieldCheck, Home, Wallet, FileCheck, Sparkles, Table2, Users, Calendar, ListChecks, Lock, ArrowUpRight, Play } from 'lucide-react';

interface Props { onEnter: () => void; onCreateAccount?: () => void; }

export default function LandingPage({ onEnter, onCreateAccount }: Props) {
  const goSignup = onCreateAccount || onEnter;
  return (
    <div className="min-h-screen w-full bg-[#FDFBF7] text-[#1A1A18] overflow-x-hidden selection:bg-[#B06D35]/15">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Geist:wght@400;500;600;700&display=swap');`}</style>
      <NavBar onLogin={onEnter} onSignup={goSignup} />
      <HeroSplit onSignup={goSignup} onLogin={onEnter} />
      <Ticker />
      <StepsTimeline />
      <SimulatorsBento />
      <GabineteShowcase />
      <PackageBento />
      <PricingSimple onSignup={goSignup} onLogin={onEnter} />
      <Final onSignup={goSignup} />
      <Footer />
    </div>
  );
}

function NavBar({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 bg-[#FDFBF7]/80 backdrop-blur-xl border-b border-[#1A1A18]/[0.06]">
      <div className="max-w-[1220px] mx-auto px-5 md:px-6 h-[64px] flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5">
          <BrandMark size={26} />
          <span className="text-[13px] font-[600] tracking-[-0.2px]" style={{fontFamily:'Geist'}}>estudo<span className="font-[400] text-[#B06D35]">360</span></span>
        </a>
        <nav className="hidden md:flex items-center gap-8 text-[13px] font-[500] text-[#1A1A18]/40" style={{fontFamily:'Geist'}}>
          <a href="#como" className="hover:text-[#1A1A18]">Como funciona</a>
          <a href="#simuladores" className="hover:text-[#1A1A18]">O que pode fazer</a>
          <a href="#gabinete" className="hover:text-[#1A1A18]">Gabinete</a>
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={onLogin} className="hidden sm:inline-flex text-[13px] font-[500] px-4 py-2 rounded-full hover:bg-black/[0.04]" style={{fontFamily:'Geist'}}>Entrar</button>
          <button onClick={onSignup} className="inline-flex items-center gap-1.5 text-[13px] font-[600] bg-[#1A1A18] text-[#FDFBF7] px-5 py-2.5 rounded-full hover:bg-black" style={{fontFamily:'Geist'}}>Criar conta <ArrowRight className="w-3.5 h-3.5" /></button>
          <button onClick={()=>setOpen(o=>!o)} className="md:hidden w-9 h-9 grid place-items-center rounded-full border border-black/10"><ChevronDown className={`w-4 h-4 transition-transform ${open?'rotate-180':''}`} /></button>
        </div>
      </div>
      {open && <div className="md:hidden border-t border-black/5 px-5 py-4 space-y-3 text-[14px] bg-[#FDFBF7]"><a href="#como" onClick={()=>setOpen(false)} className="block">Como funciona</a><a href="#simuladores" onClick={()=>setOpen(false)} className="block">O que pode fazer</a><a href="#gabinete" onClick={()=>setOpen(false)} className="block">Gabinete</a></div>}
    </header>
  );
}

function HeroSplit({ onSignup, onLogin }: { onSignup: () => void; onLogin: () => void }) {
  return (
    <section id="top" className="max-w-[1220px] mx-auto px-5 md:px-6 pt-8 md:pt-12 pb-10">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-6 items-start">
        <motion.div initial={{opacity:0, y:14}} animate={{opacity:1, y:0}} transition={{duration:0.6, ease:[0.4,0,0.2,1]}} className="pt-4 md:pt-8">
          <div className="inline-flex items-center gap-2 text-[11px] tracking-[1.5px] uppercase font-[600] text-[#1A1A18]/30" style={{fontFamily:'Geist'}}>
            <span className="w-8 h-px bg-[#B06D35]/40" /> Atualizado para 2026
          </div>
          <h1 className="mt-4 leading-[0.85] tracking-[-0.045em]" style={{fontFamily:'Cormorant Garamond, serif'}}>
            <span className="block text-[46px] md:text-[76px] font-[300]">Menos</span>
            <span className="block text-[46px] md:text-[76px] font-[300] italic">papel.</span>
            <span className="block text-[46px] md:text-[76px] font-[300]">Mais <span className="font-[600]">tempo.</span></span>
          </h1>
          <p className="mt-5 text-[16px] leading-[1.7] text-[#1A1A18]/55 max-w-[440px]" style={{fontFamily:'Geist'}}>
            Num só sítio vê quanto se paga, o que falta entregar e onde estão as passwords.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button onClick={onSignup} className="inline-flex items-center gap-2 bg-[#1A1A18] text-[#FDFBF7] px-6 py-3.5 rounded-full text-[14px] font-[600] hover:bg-black" style={{fontFamily:'Geist'}}>Criar conta grátis <ArrowRight className="w-4 h-4" /></button>
            <button onClick={onLogin} className="inline-flex items-center gap-2 bg-white border border-[#1A1A18]/10 px-6 py-3.5 rounded-full text-[14px] font-[500]" style={{fontFamily:'Geist'}}><Play className="w-3.5 h-3.5" /> Veja como fica</button>
          </div>
          <div className="mt-6 flex gap-6 text-[12px] text-[#1A1A18]/30" style={{fontFamily:'Geist'}}>
            <span>— Sem cartão</span><span>— Só vê o que é seu</span>
          </div>
        </motion.div>
        <motion.div initial={{opacity:0, y:18}} animate={{opacity:1, y:0}} transition={{duration:0.8, delay:0.12, ease:[0.4,0,0.2,1]}} className="relative">
          <div className="rounded-[22px] bg-white border border-[#1A1A18]/[0.06] p-3 shadow-[0_24px_64px_rgba(26,26,24,0.07)]">
            <div className="rounded-[14px] bg-[#F5F0E8] border border-[#1A1A18]/[0.04] p-4 md:p-5">
              <div className="flex items-center justify-between text-[11px] tracking-[1.2px] uppercase font-[600] text-[#1A1A18]/30" style={{fontFamily:'Geist'}}>
                <span>Quadro do ano</span><span className="px-2 py-1 rounded-full bg-white border border-black/5 text-[10px]">2026</span>
              </div>
              <div className="mt-3 grid grid-cols-6 gap-1.5">
                {['JAN','FEV','MAR','ABR','MAI','JUN'].map(m=>(
                  <div key={m} className="h-[56px] rounded-[10px] bg-white border border-black/5 grid place-items-center">
                    <span className="text-[10px] font-[700] text-black/25" style={{fontFamily:'Geist'}}>{m}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-[11px] text-[#1A1A18]/40" style={{fontFamily:'Geist'}}>
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Feito
                <span className="w-2 h-2 rounded-full bg-[#B06D35] ml-2" /> Falta
                <span className="ml-auto inline-flex items-center gap-1 text-[#B06D35] font-[600]">Abrir <ArrowUpRight className="w-3 h-3" /></span>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                ['Tarefas','12 por fazer'],
                ['Cofre','9 acessos'],
                ['Clientes','34 ativos'],
              ].map(([t,s])=>(
                <div key={t} className="rounded-[12px] bg-[#FDFBF7] border border-black/5 p-3">
                  <div className="text-[11px] tracking-[1px] uppercase font-[600] text-black/30" style={{fontFamily:'Geist'}}>{t}</div>
                  <div className="text-[13px] font-[600]" style={{fontFamily:'Geist'}}>{s}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute -bottom-4 -left-3 md:-left-6 bg-[#1A1A18] text-[#FDFBF7] rounded-[14px] px-4 py-3 shadow-xl">
            <div className="text-[11px] tracking-[1px] uppercase opacity-50" style={{fontFamily:'Geist'}}>Documento final</div>
            <div className="text-[13px] font-[600]" style={{fontFamily:'Geist'}}>Pronto a imprimir em A4</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Ticker() {
  return (
    <div className="border-y border-[#1A1A18]/[0.06] bg-white overflow-hidden">
      <div className="max-w-[1220px] mx-auto px-5 md:px-6 py-4 flex flex-wrap gap-6 text-[11px] tracking-[1.3px] uppercase font-[600] text-[#1A1A18]/25" style={{fontFamily:'Geist'}}>
        <span>10 formas de calcular</span><span className="opacity-20">·</span><span>312 datas de 2026</span><span className="opacity-20">·</span><span>Gabinete completo</span><span className="opacity-20">·</span><span>1 clique para o PDF</span>
      </div>
    </div>
  );
}

function StepsTimeline() {
  const steps = [
    { k:'01', t:'Reúna os dados', d:'Nome e NIF. O resto é só escolher.' },
    { k:'02', t:'Veja as contas', d:'Quanto se paga e o que compensa, logo à frente.' },
    { k:'03', t:'Entregue pronto', d:'Documento com a sua marca. Basta imprimir.' },
  ];
  return (
    <section id="como" className="max-w-[1220px] mx-auto px-5 md:px-6 py-14 md:py-18">
      <div className="grid md:grid-cols-[340px_1fr] gap-8 items-start">
        <div className="sticky top-[80px]">
          <div className="text-[11px] tracking-[1.5px] uppercase font-[600] text-[#1A1A18]/30" style={{fontFamily:'Geist'}}>Como funciona</div>
          <h2 className="mt-2 text-[30px] md:text-[40px] leading-[0.9] tracking-[-0.03em] font-[300]" style={{fontFamily:'Cormorant Garamond, serif'}}>Três passos.<br /><span className="italic font-[400]">Sem complicar.</span></h2>
          <p className="mt-3 text-[13.5px] leading-[1.6] text-[#1A1A18]/45" style={{fontFamily:'Geist'}}>Para quem tem pressa e dispensa manuais.</p>
        </div>
        <div className="relative pl-6 border-l border-[#1A1A18]/[0.07] space-y-6">
          {steps.map(s=>(
            <div key={s.k} className="relative">
              <span className="absolute -left-[25px] top-6 w-2.5 h-2.5 rounded-full bg-[#B06D35] border-4 border-[#FDFBF7]" />
              <div className="rounded-[18px] border border-[#1A1A18]/[0.06] bg-white p-6">
                <div className="text-[11px] tracking-[1.4px] font-[700] text-[#B06D35]" style={{fontFamily:'Geist'}}>{s.k}</div>
                <div className="mt-1 text-[17px] font-[600]" style={{fontFamily:'Geist'}}>{s.t}</div>
                <div className="mt-1 text-[13.5px] text-[#1A1A18]/50" style={{fontFamily:'Geist'}}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SimulatorsBento() {
  const sims = [
    ['Compensa abrir empresa?','Veja a diferença verdes vs empresa', Calculator, 'lg:col-span-2'],
    ['Quanto de IRS?','Simule o do ano', Receipt, ''],
    ['Quanto de IRC?','Para empresas', Building2, ''],
    ['Carro da empresa?','Quanto se paga a mais', CarFront, ''],
    ['Vales e ajudas','Tickets e apoios', PiggyBank, ''],
    ['Segurança Social','Quanto desconta por mês', ShieldCheck, ''],
    ['Casa e imóveis','Vender ou manter na empresa?', Home, ''],
    ['Comprar casa','IMT e custos', Building2, ''],
    ['Salário limpo','Quanto sobra no fim do mês', Wallet, 'lg:col-span-2'],
    ['Vale a pena?','Diagnóstico rápido', FileCheck, ''],
  ] as const;
  return (
    <section id="simuladores" className="max-w-[1220px] mx-auto px-5 md:px-6 py-6 md:py-10 border-t border-[#1A1A18]/[0.05]">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-[20px] font-[600] tracking-[-0.02em]" style={{fontFamily:'Geist'}}>O que pode calcular</h2>
        <span className="hidden md:inline text-[11px] tracking-[1.2px] uppercase font-[600] text-[#1A1A18]/25" style={{fontFamily:'Geist'}}>Arraste — 10 simuladores</span>
      </div>
      <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3 auto-rows-[120px]">
        {sims.map(([title, desc, Icon, span])=>(
          <div key={title} className={`group rounded-[18px] border border-[#1A1A18]/[0.06] bg-white p-4 flex flex-col justify-between hover:border-[#1A1A18]/10 transition-colors ${span}`}>
            <span className="w-8 h-8 grid place-items-center rounded-full bg-[#F5F0E8] text-[#8A6A3A] group-hover:bg-[#B06D35]/10 group-hover:text-[#B06D35] transition-colors"><Icon className="w-4 h-4" /></span>
            <div>
              <div className="text-[13px] font-[600] leading-tight" style={{fontFamily:'Geist'}}>{title}</div>
              <div className="text-[11px] text-[#1A1A18]/45" style={{fontFamily:'Geist'}}>{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function GabineteShowcase() {
  const feats = [
    ['Quadro do ano', Table2, 'O que está feito e o que falta, mês a mês'],
    ['Mapa da contabilidade', Table2, '7 passos por mês, com cores'],
    ['Mapa de salários', Users, 'Salários e descontos'],
    ['Ficha do cliente', Calendar, 'Tudo num só sítio'],
    ['Tarefas', ListChecks, 'Por ordem de urgência'],
    ['Cofre', Lock, 'Passwords só suas'],
    ['Equipa', Users, 'Quem faz o quê'],
    ['Assistente', Sparkles, 'Tira dúvidas'],
  ] as const;
  return (
    <section id="gabinete" className="max-w-[1220px] mx-auto px-5 md:px-6 py-10 md:py-16">
      <div className="rounded-[24px] bg-[#1A1A18] text-[#FDFBF7] p-5 md:p-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-[26px] md:text-[34px] font-[300] tracking-[-0.03em]" style={{fontFamily:'Cormorant Garamond, serif'}}>Gabinete. <span className="italic font-[400] text-[#E8C9A8]">Tudo arrumado.</span></h2>
            <p className="mt-2 text-[13.5px] text-white/55 max-w-[520px]" style={{fontFamily:'Geist'}}>Cada conta vê apenas os seus clientes. Sem misturas.</p>
          </div>
          <span className="text-[11px] tracking-[1.3px] uppercase font-[600] text-white/30" style={{fontFamily:'Geist'}}>Isolado por gabinete</span>
        </div>
        <div className="mt-7 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {feats.map(([t,Icon,desc])=>(
            <div key={t} className="rounded-[16px] bg-white/[0.06] border border-white/10 p-4">
              <span className="w-8 h-8 grid place-items-center rounded-full bg-white/10 text-white"><Icon className="w-4 h-4" /></span>
              <div className="mt-3 text-[13px] font-[600]" style={{fontFamily:'Geist'}}>{t}</div>
              <div className="mt-1 text-[12px] leading-[1.5] text-white/55" style={{fontFamily:'Geist'}}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PackageBento() {
  return (
    <section className="max-w-[1220px] mx-auto px-5 md:px-6 py-6">
      <div className="grid md:grid-cols-3 gap-3">
        {[
          ['Simulação','Quanto se paga e o que compensa'],
          ['Proposta','Com a sua marca'],
          ['Minuta','Pronta a assinar'],
        ].map(([t,d])=>(
          <div key={t} className="rounded-[18px] border border-[#1A1A18]/[0.06] bg-white p-6 text-center">
            <div className="text-[13px] font-[700]" style={{fontFamily:'Geist'}}>{t}</div>
            <div className="text-[12px] text-[#1A1A18]/45" style={{fontFamily:'Geist'}}>{d}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PricingSimple({ onSignup, onLogin }: { onSignup: () => void; onLogin: () => void }) {
  const tiers = [
    { name:'Sozinho', price:'49', note:'só para si', feats:['Tudo para simular','Gabinete simples','Documento pronto'], hi:false },
    { name:'Equipa pequena', price:'129', note:'até 5', feats:['Gabinete completo','Trabalham juntos','Cofre privado'], hi:true },
    { name:'Equipa grande', price:'249', note:'até 15', feats:['Várias equipas','Mais clientes','Ajuda a começar'], hi:false },
  ];
  return (
    <section id="precos" className="max-w-[1220px] mx-auto px-5 md:px-6 py-12 md:py-16 border-t border-[#1A1A18]/[0.05]">
      <h2 className="text-[22px] md:text-[28px] font-[300] tracking-[-0.03em]" style={{fontFamily:'Cormorant Garamond, serif'}}>Quanto custa.</h2>
      <div className="mt-6 grid md:grid-cols-3 gap-4">
        {tiers.map(t=>(
          <div key={t.name} className={`rounded-[20px] border p-6 flex flex-col ${t.hi ? 'bg-[#1A1A18] text-[#FDFBF7] border-[#1A1A18]' : 'bg-white border-[#1A1A18]/[0.06]'}`}>
            <div className="text-[11px] tracking-[1.3px] uppercase font-[700] opacity-40" style={{fontFamily:'Geist'}}>{t.name} · {t.note}</div>
            <div className="mt-2 flex items-baseline gap-1"><span className="text-[34px] font-[700] tabular-nums" style={{fontFamily:'Geist'}}>€{t.price}</span><span className="text-[12px] opacity-40" style={{fontFamily:'Geist'}}>/mês</span></div>
            <ul className="mt-4 space-y-2 flex-1">
              {t.feats.map(f=>(<li key={f} className="flex gap-2 text-[13px]" style={{fontFamily:'Geist'}}><Check className={`w-4 h-4 mt-0.5 ${t.hi ? 'text-[#FDFBF7]' : 'text-[#B06D35]'}`} /><span className={t.hi ? 'opacity-80' : 'text-[#1A1A18]/60'}>{f}</span></li>))}
            </ul>
            <button onClick={onSignup} className={`mt-6 py-3 rounded-full text-[13px] font-[600] ${t.hi ? 'bg-[#FDFBF7] text-[#1A1A18]' : 'bg-[#1A1A18] text-[#FDFBF7]'}`} style={{fontFamily:'Geist'}}>Criar conta</button>
          </div>
        ))}
      </div>
      <div className="mt-4 text-center"><button onClick={onLogin} className="text-[13px] text-[#1A1A18]/40 hover:text-[#1A1A18]" style={{fontFamily:'Geist'}}>Já tem conta — Entrar</button></div>
    </section>
  );
}

function Final({ onSignup }: { onSignup: () => void }) {
  return (
    <section className="max-w-[1220px] mx-auto px-5 md:px-6 py-12 md:py-16 border-t border-[#1A1A18]/[0.05] text-center">
      <h2 className="text-[28px] md:text-[40px] leading-[0.9] tracking-[-0.03em] font-[300]" style={{fontFamily:'Cormorant Garamond, serif'}}>Próximo cliente,<br /><span className="italic font-[400]">tudo pronto.</span></h2>
      <button onClick={onSignup} className="mt-6 inline-flex items-center gap-2 bg-[#1A1A18] text-[#FDFBF7] px-7 py-3.5 rounded-full text-[14px] font-[600]" style={{fontFamily:'Geist'}}>Criar conta grátis <ArrowRight className="w-4 h-4" /></button>
      <div className="mt-3 text-[11px] tracking-[1.3px] uppercase font-[600] text-[#1A1A18]/30" style={{fontFamily:'Geist'}}>Sem cartão · comece já</div>
    </section>
  );
}

function BrandMark({ size=26 }: { size?: number }) {
  return <img src="/logo.svg" alt="" width={size} height={size} className="object-contain shrink-0" style={{width:size,height:size}} draggable={false} aria-hidden="true" />;
}

function Footer() {
  return (
    <footer className="border-t border-[#1A1A18]/[0.06] py-8 bg-white">
      <div className="max-w-[1220px] mx-auto px-5 md:px-6 flex flex-col md:flex-row gap-3 justify-between text-[12px] text-[#1A1A18]/30" style={{fontFamily:'Geist'}}>
        <span className="inline-flex items-center gap-2"><BrandMark size={18} /> © {new Date().getFullYear()} estudo360</span>
        <span className="flex gap-4"><a href="#como" className="hover:text-[#1A1A18]">Como funciona</a><a href="#simuladores" className="hover:text-[#1A1A18]">O que pode fazer</a><a href="#gabinete" className="hover:text-[#1A1A18]">Gabinete</a></span>
      </div>
    </footer>
  );
}
