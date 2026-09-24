import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ChevronDown, Check, Calculator, Building2, PiggyBank, CarFront, Receipt, ShieldCheck, Home, Wallet, FileCheck, Sparkles, Table2, Users, Calendar, ListChecks, Lock } from 'lucide-react';

interface Props { onEnter: () => void; onCreateAccount?: () => void; }

export default function LandingPage({ onEnter, onCreateAccount }: Props) {
  const goSignup = onCreateAccount || onEnter;
  return (
    <div className="min-h-screen w-full bg-[#FDFBF7] text-[#1A1A18] overflow-x-hidden selection:bg-[#B06D35]/15">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Geist:wght@400;500;600&display=swap');`}</style>
      <NavBar onLogin={onEnter} onSignup={goSignup} />
      <Hero onSignup={goSignup} onLogin={onEnter} />
      <Proof />
      <Steps />
      <SimulatorsSimple />
      <GabineteSimple />
      <CalmStrip />
      <PricingSimple onSignup={goSignup} onLogin={onEnter} />
      <Final onSignup={goSignup} />
      <Footer />
    </div>
  );
}

function NavBar({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 bg-[#FDFBF7]/85 backdrop-blur-xl border-b border-[#1A1A18]/[0.06]">
      <div className="max-w-[1160px] mx-auto px-5 md:px-6 h-[64px] flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-full bg-[#1A1A18] text-[#FDFBF7] grid place-items-center text-[11px] font-[700] tracking-[0.5px]">360</span>
          <span className="text-[13px] font-[600] tracking-[-0.2px]" style={{fontFamily:'Geist'}}>estudo<span className="font-[400] text-[#B06D35]">360</span></span>
        </a>
        <nav className="hidden md:flex items-center gap-8 text-[13px] font-[500] text-[#1A1A18]/45" style={{fontFamily:'Geist'}}>
          <a href="#como" className="hover:text-[#1A1A18] transition-colors">Como funciona</a>
          <a href="#simuladores" className="hover:text-[#1A1A18] transition-colors">O que podes fazer</a>
          <a href="#gabinete" className="hover:text-[#1A1A18] transition-colors">Gabinete</a>
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={onLogin} className="hidden sm:inline-flex text-[13px] font-[500] px-4 py-2 rounded-full hover:bg-black/[0.04] transition-colors" style={{fontFamily:'Geist'}}>Entrar</button>
          <button onClick={onSignup} className="inline-flex items-center gap-1.5 text-[13px] font-[600] bg-[#1A1A18] text-[#FDFBF7] px-5 py-2.5 rounded-full hover:bg-black transition-colors" style={{fontFamily:'Geist'}}>Criar conta <ArrowRight className="w-3.5 h-3.5" /></button>
          <button onClick={()=>setOpen(o=>!o)} className="md:hidden w-9 h-9 grid place-items-center rounded-full border border-black/10"><ChevronDown className={`w-4 h-4 transition-transform ${open?'rotate-180':''}`} /></button>
        </div>
      </div>
      {open && <div className="md:hidden border-t border-black/5 px-5 py-4 space-y-3 text-[14px] bg-[#FDFBF7]"><a href="#como" onClick={()=>setOpen(false)} className="block">Como funciona</a><a href="#simuladores" onClick={()=>setOpen(false)} className="block">O que podes fazer</a><a href="#gabinete" onClick={()=>setOpen(false)} className="block">Gabinete</a><button onClick={onLogin} className="block w-full text-left">Entrar</button></div>}
    </header>
  );
}

function Hero({ onSignup, onLogin }: { onSignup: () => void; onLogin: () => void }) {
  return (
    <section id="top" className="max-w-[1160px] mx-auto px-5 md:px-6 pt-14 md:pt-22 pb-10">
      <motion.div initial={{opacity:0, y:14}} animate={{opacity:1, y:0}} transition={{duration:0.7, ease:[0.4,0,0.2,1]}} className="max-w-[720px]">
        <div className="inline-flex items-center gap-3 text-[11px] tracking-[1.6px] uppercase font-[600] text-[#1A1A18]/35" style={{fontFamily:'Geist'}}>
          <span className="w-8 h-px bg-[#B06D35]/40" /> Atualizado para 2026
        </div>
        <h1 className="mt-5 leading-[0.88] tracking-[-0.04em]" style={{fontFamily:'Cormorant Garamond, serif'}}>
          <span className="block text-[44px] md:text-[72px] font-[300]">Menos papel.</span>
          <span className="block text-[44px] md:text-[72px] font-[300] italic">Mais tempo.</span>
        </h1>
        <p className="mt-5 text-[16px] md:text-[17px] leading-[1.7] text-[#1A1A18]/55 max-w-[520px]" style={{fontFamily:'Geist'}}>
          Num só sítio vês quanto se paga, o que ainda falta e onde estão as passwords — pronto a entregar ao cliente.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button onClick={onSignup} className="inline-flex items-center gap-2 bg-[#1A1A18] text-[#FDFBF7] px-7 py-3.5 rounded-full text-[14px] font-[600] hover:bg-black transition-colors" style={{fontFamily:'Geist'}}>Criar conta grátis <ArrowRight className="w-4 h-4" /></button>
          <button onClick={onLogin} className="inline-flex items-center gap-2 bg-white border border-[#1A1A18]/10 px-7 py-3.5 rounded-full text-[14px] font-[500] hover:bg-black/[0.02] transition-colors" style={{fontFamily:'Geist'}}>Ver como fica</button>
        </div>
        <div className="mt-6 flex flex-wrap gap-4 text-[12.5px] text-[#1A1A18]/35" style={{fontFamily:'Geist'}}>
          <span>— Sem cartão</span><span>— Cada conta só vê o que é seu</span><span>— Pronto a imprimir</span>
        </div>
      </motion.div>
      <motion.div initial={{opacity:0, y:18}} animate={{opacity:1, y:0}} transition={{duration:0.8, delay:0.15, ease:[0.4,0,0.2,1]}} className="mt-12 md:mt-16 rounded-[20px] bg-white border border-[#1A1A18]/[0.06] p-3 md:p-5 shadow-[0_24px_64px_rgba(26,26,24,0.06)]">
        <div className="rounded-[14px] bg-[#F5F0E8] border border-[#1A1A18]/[0.04] h-[300px] md:h-[380px] grid place-items-center overflow-hidden">
          <div className="text-center px-6">
            <div className="text-[11px] tracking-[1.4px] uppercase font-[600] text-[#1A1A18]/25" style={{fontFamily:'Geist'}}>Pré-visualização</div>
            <div className="mt-2 text-[18px] font-[300] tracking-[-0.02em]" style={{fontFamily:'Cormorant Garamond, serif'}}>Quadro do ano · por cliente · por mês</div>
            <div className="mt-4 flex justify-center gap-1.5">
              {['JAN','FEV','MAR','ABR','MAI','JUN'].map(m=><span key={m} className="w-12 h-7 rounded-full bg-white border border-black/5 grid place-items-center text-[10px] font-[600] text-black/30">{m}</span>)}
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function Proof() {
  return (
    <div className="border-y border-[#1A1A18]/[0.06] bg-white">
      <div className="max-w-[1160px] mx-auto px-5 md:px-6 py-7 grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          ['10','formas de calcular'],
          ['312','datas de 2026 já marcadas'],
          ['7','áreas do gabinete'],
          ['1 clique','para o documento final'],
        ].map(([n,l])=>(
          <div key={l} className="">
            <div className="text-[28px] font-[300] tracking-[-0.02em]" style={{fontFamily:'Cormorant Garamond, serif'}}>{n}</div>
            <div className="text-[11px] tracking-[1.2px] uppercase font-[600] text-[#1A1A18]/30" style={{fontFamily:'Geist'}}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Steps() {
  const steps = [
    { k:'01', t:'Junta os dados', d:'Nome, NIF e como trabalha. É só preencher.' },
    { k:'02', t:'Vê as contas', d:'O sistema mostra logo quanto se paga e o que compensa.' },
    { k:'03', t:'Entrega pronto', d:'Sai um documento bonito com a tua marca, pronto a imprimir.' },
  ];
  return (
    <section id="como" className="max-w-[1160px] mx-auto px-5 md:px-6 py-16 md:py-20">
      <div className="max-w-[560px]">
        <div className="text-[11px] tracking-[1.5px] uppercase font-[600] text-[#1A1A18]/30" style={{fontFamily:'Geist'}}>Como funciona</div>
        <h2 className="mt-2 text-[28px] md:text-[38px] leading-[0.95] tracking-[-0.03em] font-[300]" style={{fontFamily:'Cormorant Garamond, serif'}}>Três passos. <span className="italic font-[400]">Sem complicar.</span></h2>
      </div>
      <div className="mt-8 grid md:grid-cols-3 gap-4">
        {steps.map(s=>(
          <div key={s.k} className="rounded-[18px] border border-[#1A1A18]/[0.06] bg-white p-6">
            <div className="text-[11px] tracking-[1.4px] font-[700] text-[#B06D35]" style={{fontFamily:'Geist'}}>{s.k}</div>
            <div className="mt-2 text-[17px] font-[600] tracking-[-0.02em]" style={{fontFamily:'Geist'}}>{s.t}</div>
            <div className="mt-1.5 text-[13.5px] leading-[1.55] text-[#1A1A18]/50" style={{fontFamily:'Geist'}}>{s.d}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SimulatorsSimple() {
  const sims = [
    ['Compensa abrir empresa?','Vê a diferença entre recibos verdes e empresa', Calculator],
    ['Quanto de IRS?','Simula o IRS do ano', Receipt],
    ['Quanto de IRC?','Para empresas', Building2],
    ['Carro da empresa?','Quanto se paga a mais', CarFront],
    ['Vales e ajudas','Quanto custam os tickets', PiggyBank],
    ['Segurança Social','Quanto descontas por mês', ShieldCheck],
    ['Casa e imóveis','Vender ou pôr na empresa?', Home],
    ['Comprar casa','Quanto de IMT e custos', Building2],
    ['Salário limpo','Quanto sobra no fim do mês', Wallet],
    ['O cliente compensa?','Vê se vale a pena aceitar', FileCheck],
  ] as const;
  return (
    <section id="simuladores" className="max-w-[1160px] mx-auto px-5 md:px-6 py-6 md:py-10 border-t border-[#1A1A18]/[0.05]">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[18px] md:text-[20px] font-[600] tracking-[-0.02em]" style={{fontFamily:'Geist'}}>O que podes calcular</h2>
        <span className="text-[11px] tracking-[1.2px] uppercase font-[600] text-[#1A1A18]/25" style={{fontFamily:'Geist'}}>10 simuladores · simples</span>
      </div>
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {sims.map(([title, desc, Icon])=>(
          <div key={title} className="group rounded-[16px] border border-[#1A1A18]/[0.06] bg-white p-4 hover:border-[#1A1A18]/10 transition-colors">
            <span className="w-8 h-8 grid place-items-center rounded-full bg-[#F5F0E8] text-[#8A6A3A] group-hover:bg-[#B06D35]/10 group-hover:text-[#B06D35] transition-colors"><Icon className="w-4 h-4" /></span>
            <div className="mt-3 text-[13px] font-[600] leading-tight" style={{fontFamily:'Geist'}}>{title}</div>
            <div className="mt-1 text-[11px] leading-[1.4] text-[#1A1A18]/45" style={{fontFamily:'Geist'}}>{desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function GabineteSimple() {
  const feats = [
    ['Quadro do ano','Vê o que já está feito e o que falta, mês a mês', Table2],
    ['Mapa da contabilidade','7 passos da contabilidade por mês', Table2],
    ['Mapa de salários','Tudo sobre salários e descontos', Users],
    ['Ficha do cliente','Todos os dados num só sítio', Calendar],
    ['Tarefas','O que há para fazer, por ordem', ListChecks],
    ['Cofre','As passwords guardadas em segurança', Lock],
    ['Equipa','Quem faz o quê', Users],
    ['Assistente','Tira dúvidas com ajuda', Sparkles],
  ] as const;
  return (
    <section id="gabinete" className="max-w-[1160px] mx-auto px-5 md:px-6 py-10 md:py-16 border-t border-[#1A1A18]/[0.05]">
      <div className="max-w-[560px]">
        <h2 className="text-[22px] md:text-[30px] font-[300] tracking-[-0.03em]" style={{fontFamily:'Cormorant Garamond, serif'}}>O gabinete. <span className="italic font-[400]">Tudo arrumado.</span></h2>
        <p className="mt-2 text-[13.5px] leading-[1.6] text-[#1A1A18]/50" style={{fontFamily:'Geist'}}>Cada conta só vê os seus clientes. Sem misturas. Sem confusão.</p>
      </div>
      <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {feats.map(([t,desc,Icon])=>(
          <div key={t} className="rounded-[16px] border border-[#1A1A18]/[0.06] bg-white p-5">
            <span className="w-8 h-8 grid place-items-center rounded-full bg-[#F5F0E8] text-[#8A6A3A]"><Icon className="w-4 h-4" /></span>
            <div className="mt-3 text-[13px] font-[600]" style={{fontFamily:'Geist'}}>{t}</div>
            <div className="mt-1 text-[12.5px] leading-[1.5] text-[#1A1A18]/50" style={{fontFamily:'Geist'}}>{desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CalmStrip() {
  return (
    <section className="max-w-[1160px] mx-auto px-5 md:px-6 py-8 border-y border-[#1A1A18]/[0.06] bg-white">
      <div className="grid md:grid-cols-3 gap-6 text-[13px]" style={{fontFamily:'Geist'}}>
        <div className="flex gap-3"><span className="w-8 h-8 grid place-items-center rounded-full bg-[#F5F0E8] shrink-0"><Check className="w-4 h-4 text-[#8A6A3A]" /></span><div><div className="font-[600]">Documento final</div><div className="text-[#1A1A18]/50">Com a tua marca. Pronto a imprimir.</div></div></div>
        <div className="flex gap-3"><span className="w-8 h-8 grid place-items-center rounded-full bg-[#F5F0E8] shrink-0"><Check className="w-4 h-4 text-[#8A6A3A]" /></span><div><div className="font-[600]">Sempre atualizado</div><div className="text-[#1A1A18]/50">Valores de 2026 já dentro.</div></div></div>
        <div className="flex gap-3"><span className="w-8 h-8 grid place-items-center rounded-full bg-[#F5F0E8] shrink-0"><Check className="w-4 h-4 text-[#8A6A3A]" /></span><div><div className="font-[600]">Privado</div><div className="text-[#1A1A18]/50">Cada conta só vê o que é seu.</div></div></div>
      </div>
    </section>
  );
}

function PricingSimple({ onSignup, onLogin }: { onSignup: () => void; onLogin: () => void }) {
  const tiers = [
    { name:'Sozinho', price:'49', note:'só para ti', feats:['Tudo para simular','Gabinete simples','Documento pronto'], hi:false },
    { name:'Equipa pequena', price:'129', note:'até 5 pessoas', feats:['Gabinete completo','Trabalham juntos','Cofre privado'], hi:true },
    { name:'Equipa grande', price:'249', note:'até 15 pessoas', feats:['Várias equipas','Mais clientes','Ajuda a começar'], hi:false },
  ];
  return (
    <section id="precos" className="max-w-[1160px] mx-auto px-5 md:px-6 py-12 md:py-16">
      <h2 className="text-[22px] md:text-[28px] font-[300] tracking-[-0.03em]" style={{fontFamily:'Cormorant Garamond, serif'}}>Quanto custa.</h2>
      <div className="mt-6 grid md:grid-cols-3 gap-4">
        {tiers.map(t=>(
          <div key={t.name} className={`rounded-[20px] border p-6 flex flex-col ${t.hi ? 'bg-[#1A1A18] text-[#FDFBF7] border-[#1A1A18]' : 'bg-white border-[#1A1A18]/[0.06]'}`}>
            <div className="text-[11px] tracking-[1.3px] uppercase font-[700] opacity-40" style={{fontFamily:'Geist'}}>{t.name} · {t.note}</div>
            <div className="mt-2 flex items-baseline gap-1"><span className="text-[34px] font-[300] tracking-tight" style={{fontFamily:'Cormorant Garamond, serif'}}>€{t.price}</span><span className="text-[12px] opacity-40" style={{fontFamily:'Geist'}}>/mês</span></div>
            <ul className="mt-4 space-y-2 flex-1">
              {t.feats.map(f=>(<li key={f} className="flex gap-2 text-[13px]" style={{fontFamily:'Geist'}}><Check className={`w-4 h-4 mt-0.5 ${t.hi ? 'text-[#FDFBF7]' : 'text-[#B06D35]'}`} /><span className={t.hi ? 'opacity-80' : 'text-[#1A1A18]/60'}>{f}</span></li>))}
            </ul>
            <button onClick={onSignup} className={`mt-6 py-3 rounded-full text-[13px] font-[600] transition-colors ${t.hi ? 'bg-[#FDFBF7] text-[#1A1A18] hover:bg-white' : 'bg-[#1A1A18] text-[#FDFBF7] hover:bg-black'}`} style={{fontFamily:'Geist'}}>Criar conta</button>
          </div>
        ))}
      </div>
      <div className="mt-4 text-center"><button onClick={onLogin} className="text-[13px] text-[#1A1A18]/40 hover:text-[#1A1A18] transition-colors" style={{fontFamily:'Geist'}}>Já tenho conta — Entrar</button></div>
    </section>
  );
}

function Final({ onSignup }: { onSignup: () => void }) {
  return (
    <section className="max-w-[1160px] mx-auto px-5 md:px-6 py-12 md:py-16 border-t border-[#1A1A18]/[0.05] text-center">
      <h2 className="text-[26px] md:text-[38px] leading-[0.95] tracking-[-0.03em] font-[300]" style={{fontFamily:'Cormorant Garamond, serif'}}>Próximo cliente,<br /><span className="italic font-[400]">tudo pronto.</span></h2>
      <button onClick={onSignup} className="mt-6 inline-flex items-center gap-2 bg-[#1A1A18] text-[#FDFBF7] px-7 py-3.5 rounded-full text-[14px] font-[600] hover:bg-black transition-colors" style={{fontFamily:'Geist'}}>Criar conta grátis <ArrowRight className="w-4 h-4" /></button>
      <div className="mt-3 text-[11px] tracking-[1.3px] uppercase font-[600] text-[#1A1A18]/30" style={{fontFamily:'Geist'}}>Sem cartão · começa já</div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-[#1A1A18]/[0.06] py-8 bg-white">
      <div className="max-w-[1160px] mx-auto px-5 md:px-6 flex flex-col md:flex-row gap-3 justify-between text-[12px] text-[#1A1A18]/30" style={{fontFamily:'Geist'}}>
        <span>© {new Date().getFullYear()} estudo360</span>
        <span className="flex gap-4"><a href="#como" className="hover:text-[#1A1A18]">Como funciona</a><a href="#simuladores" className="hover:text-[#1A1A18]">O que podes fazer</a><a href="#gabinete" className="hover:text-[#1A1A18]">Gabinete</a></span>
      </div>
    </footer>
  );
}
