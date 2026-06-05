import React, { useState } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import {
  ArrowRight, Calculator, FileText, FileSignature, Layers, ShieldCheck,
  Clock, Sparkles, ChevronDown, Check, BadgeCheck, Building2, BookOpen,
} from 'lucide-react';

interface Props {
  onEnter: () => void;
}

/**
 * Landing page comercial — vista pública antes do login.
 *
 * Estrutura: Hero, "como funciona em 3 minutos", catálogo de simuladores,
 * pacote do cliente (3 outputs num clique), prova social, preços e CTA final.
 * Branding: paleta Estudo 360 (#0677FF + #0B1D2D) + tipografia de pesos extremos
 * (200 ↔ 800) e jumps de tamanho 3× sobre serif display.
 */
export default function LandingPage({ onEnter }: Props) {
  const { scrollY } = useScroll();
  const heroParallax = useTransform(scrollY, [0, 600], [0, -120]);
  const heroFade = useTransform(scrollY, [0, 400], [1, 0.2]);

  return (
    <div className="min-h-screen w-full bg-[#F5F7FA] text-[#0B1D2D] overflow-x-hidden">
      <FontInjector />
      <NavBar onEnter={onEnter} />

      <Hero onEnter={onEnter} parallaxY={heroParallax} fadeOpacity={heroFade} />
      <ValueStrip />
      <HowItWorks />
      <ToolsCatalog />
      <PackageBlock />
      <Compliance />
      <Pricing onEnter={onEnter} />
      <FinalCTA onEnter={onEnter} />
      <Footer />
    </div>
  );
}

/* ───────── Web fonts via Google Fonts CSS (respects banned-fonts rule) ───────── */
function FontInjector() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,200;9..144,400;9..144,700;9..144,900&family=JetBrains+Mono:wght@500;700&display=swap');
      .display-serif { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; }
      .mono { font-family: 'JetBrains Mono', monospace; }
      .brand-sans { font-family: 'Montserrat', 'Helvetica Neue', sans-serif; }
      html, body, #root { background: #F5F7FA; }
    `}</style>
  );
}

/* ───────── NavBar ───────── */
function NavBar({ onEnter }: { onEnter: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 bg-[#F5F7FA]/85 backdrop-blur-xl border-b border-[#0B1D2D]/8">
      <div className="max-w-7xl mx-auto px-5 md:px-8 h-[64px] flex items-center justify-between">
        <a href="#top" className="flex items-center gap-3 group">
          <BrandMark size={36} />
          <div className="leading-none">
            <div className="brand-sans text-[16px] font-[800] tracking-[-0.2px] text-[#0B1D2D]">ESTUDO<span className="text-[#0677FF]">360°</span></div>
            <div className="text-[9px] mono uppercase tracking-[2.5px] text-[#6B7280] mt-[3px]">Análise · Estratégia · Decisão</div>
          </div>
        </a>

        <nav className="hidden md:flex items-center gap-7 text-[13px] font-[600] text-[#0B1D2D]/70">
          <a href="#funciona" className="hover:text-[#0B1D2D] transition-colors">Como funciona</a>
          <a href="#simuladores" className="hover:text-[#0B1D2D] transition-colors">Simuladores</a>
          <a href="#pacote" className="hover:text-[#0B1D2D] transition-colors">Pacote do cliente</a>
          <a href="#precos" className="hover:text-[#0B1D2D] transition-colors">Preços</a>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEnter}
            className="hidden sm:inline-flex items-center gap-1.5 text-[12px] font-[700] text-[#0B1D2D]/75 hover:text-[#0B1D2D] px-3 py-2 rounded-[10px] border border-[#0B1D2D]/10 hover:bg-[#0B1D2D]/5 transition-all"
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={onEnter}
            className="inline-flex items-center gap-1.5 text-[12px] font-[800] text-white bg-[#0B1D2D] hover:bg-[#26323f] px-4 py-2 rounded-[10px] transition-all"
          >
            Pedir demo <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-label="Menu"
            className="md:hidden w-9 h-9 inline-flex items-center justify-center rounded-[10px] border border-[#0B1D2D]/10 hover:bg-[#0B1D2D]/5"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-[#0B1D2D]/8 px-5 py-4 space-y-3 text-[14px] font-[600] text-[#0B1D2D]/75">
          <a onClick={() => setOpen(false)} href="#funciona" className="block">Como funciona</a>
          <a onClick={() => setOpen(false)} href="#simuladores" className="block">Simuladores</a>
          <a onClick={() => setOpen(false)} href="#pacote" className="block">Pacote do cliente</a>
          <a onClick={() => setOpen(false)} href="#precos" className="block">Preços</a>
          <button type="button" onClick={onEnter} className="block w-full text-left text-[#0B1D2D]">Entrar</button>
        </div>
      )}
    </header>
  );
}

/* ───────── Hero ───────── */
function Hero({ onEnter, parallaxY, fadeOpacity }: { onEnter: () => void; parallaxY: any; fadeOpacity: any }) {
  return (
    <section id="top" className="relative pt-16 pb-28 md:pt-24 md:pb-36 overflow-hidden">
      {/* Atmospheric backdrop — layered gradients + noise */}
      <motion.div
        style={{ y: parallaxY, opacity: fadeOpacity }}
        aria-hidden="true"
        className="absolute inset-0 -z-10"
      >
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(60% 50% at 80% 10%, rgba(6,119,255,0.35) 0%, transparent 60%), radial-gradient(50% 40% at 10% 60%, rgba(11,29,45,0.45) 0%, transparent 70%), linear-gradient(180deg, #F5F7FA 0%, #F5F7FA 100%)',
        }} />
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#F5F7FA_85%)]" />
      </motion.div>

      <div className="max-w-7xl mx-auto px-5 md:px-8 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.05, ease: [0.32, 0.72, 0, 1] }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#0B1D2D]/10 bg-white backdrop-blur-sm text-[11px] mono uppercase tracking-[2.5px] text-[#0B1D2D]/70"
          >
            <Sparkles className="w-3 h-3 text-[#0677FF]" /> Atualizado · OE 2026
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12, ease: [0.32, 0.72, 0, 1] }}
            className="display-serif mt-6 text-[44px] leading-[0.98] sm:text-[64px] md:text-[84px] lg:text-[96px] tracking-[-0.04em] font-[200]"
          >
            Recebe o cliente.
            <br />
            Sai com <span className="italic font-[700] text-[#0677FF]">tudo</span> pronto.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-6 text-[16px] md:text-[18px] leading-[1.55] text-[#0B1D2D]/65 font-[400] max-w-xl"
          >
            Ferramenta para escritórios de contabilidade em Portugal. Enquanto o cliente fala,
            preenche o perfil. Um clique gera <strong className="text-[#0B1D2D]">simulação fiscal, proposta
            de honorários e minuta de contrato</strong> — com a sua marca.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.38 }}
            className="mt-9 flex flex-col sm:flex-row gap-3"
          >
            <button
              type="button"
              onClick={onEnter}
              className="group inline-flex items-center justify-center gap-2 bg-[#0B1D2D] text-white px-6 py-4 rounded-[14px] text-[14px] font-[800] tracking-tight hover:bg-[#26323f] ative:scale-[0.98] transition-all"
            >
              Experimentar agora
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              type="button"
              onClick={onEnter}
              className="inline-flex items-center justify-center gap-2 border border-[#0B1D2D]/12 bg-[#0B1D2D]/[0.03] text-[#0B1D2D]/80 hover:bg-[#0B1D2D]/[0.07] px-6 py-4 rounded-[14px] text-[14px] font-[700] transition-all"
            >
              Ver demo de 3 minutos
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.55 }}
            className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 text-[11px] mono uppercase tracking-[2px] text-[#0B1D2D]/50"
          >
            <span className="flex items-center gap-2"><Check className="w-3 h-3 text-[#0677FF]" /> Sem cartão</span>
            <span className="flex items-center gap-2"><Check className="w-3 h-3 text-[#0677FF]" /> Demo guiada</span>
            <span className="flex items-center gap-2"><Check className="w-3 h-3 text-[#0677FF]" /> CIRS/CIRC 2026</span>
          </motion.div>
        </div>

        {/* Side mockup card — asymmetric, oversized stat */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
          className="relative hidden lg:block"
        >
          <div className="relative">
            <div
              className="absolute -inset-6 rounded-[36px] blur-3xl opacity-60"
              style={{ background: 'linear-gradient(135deg, rgba(6,119,255,0.35) 0%, rgba(11,29,45,0.4) 100%)' }}
              aria-hidden="true"
            />
            <div className="relative bg-white text-[#0B1D2D] rounded-[26px] shadow-2xl border border-[#0B1D2D]/10 overflow-hidden">
              <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                </div>
                <div className="text-[10px] mono uppercase tracking-[1.5px] text-slate-400">pacote.pdf</div>
              </div>
              <div className="p-7">
                <div className="text-[10px] mono uppercase tracking-[2px] text-slate-400">Recomendação</div>
                <div className="display-serif text-[44px] leading-none mt-3 font-[800] tracking-tight">
                  Lda
                </div>
                <div className="text-[11px] font-[700] text-emerald-700 mt-1">+ €4.820/ano vs ENI</div>

                <div className="grid grid-cols-2 gap-3 mt-7">
                  <MiniStat label="IRC" value="15%" sub="primeiros €50k" />
                  <MiniStat label="Honorários" value="170€" sub="/mês s/IVA" />
                </div>
                <div className="mt-6 border-t border-slate-100 pt-5 flex items-center gap-3 text-[11px] font-[700] text-slate-500">
                  <DocPill icon={Calculator} label="Simulação" />
                  <DocPill icon={FileText} label="Proposta" />
                  <DocPill icon={FileSignature} label="Minuta" />
                </div>
              </div>
            </div>
            {/* Floating chip */}
            <div className="absolute -bottom-6 -left-6 bg-[#0677FF] text-white rounded-[14px] px-4 py-3 shadow-xl flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <div className="leading-tight">
                <div className="text-[10px] mono uppercase tracking-[1.5px] opacity-70">tempo médio</div>
                <div className="text-[16px] font-[800] mono">3 min 42s</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-slate-50 rounded-[12px] p-3">
      <div className="text-[9px] mono uppercase tracking-[1.5px] text-slate-400">{label}</div>
      <div className="display-serif text-[26px] font-[800] mt-1 leading-none">{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5 font-[600]">{sub}</div>
    </div>
  );
}

function DocPill({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-[#0677FF]/10 text-[#0B1D2D] px-2.5 py-1.5 rounded-[8px]">
      <Icon className="w-3 h-3" />
      <span>{label}</span>
    </div>
  );
}

/* ───────── Value Strip ───────── */
function ValueStrip() {
  const items = [
    ['10', 'Simuladores fiscais'],
    ['3', 'Documentos num clique'],
    ['OE 2026', 'Sempre atualizado'],
    ['100%', 'Sob a sua marca'],
  ];
  return (
    <section className="border-y border-[#0B1D2D]/8 bg-white/70">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-10 grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4">
        {items.map(([n, l]) => (
          <div key={l} className="text-left">
            <div className="display-serif text-[34px] md:text-[44px] font-[800] leading-none tracking-tight">{n}</div>
            <div className="mt-2 text-[10px] md:text-[11px] mono uppercase tracking-[2px] text-[#0B1D2D]/50">{l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────── How It Works ───────── */
function HowItWorks() {
  const steps = [
    {
      step: '01',
      title: 'O cliente liga.',
      body: 'Abre o Perfil. Vai escrevendo enquanto ele fala — em 6 passos guiados. O sistema avisa de NIF inválido, regime IVA errado, escalão acima do limite.',
    },
    {
      step: '02',
      title: 'A simulação corre sozinha.',
      body: 'ENI ou Lda? IRS Jovem? Tickets de refeição? Salário líquido? Tudo recalcula em tempo real à medida que escreve. Sem folhas Excel paralelas.',
    },
    {
      step: '03',
      title: 'Um clique → pacote pronto.',
      body: 'Simulação fiscal + proposta de honorários + minuta de contrato OCC, todos com a sua marca. Edita diretamente na página, imprime ou guarda em PDF.',
    },
  ];
  return (
    <section id="funciona" className="py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <SectionLabel>Como funciona</SectionLabel>
        <h2 className="display-serif mt-4 text-[36px] md:text-[56px] lg:text-[68px] leading-[1] tracking-[-0.03em] font-[200] max-w-3xl">
          Do telefonema ao <span className="italic font-[800] text-[#0677FF]">PDF assinado</span> em três passos.
        </h2>
        <div className="mt-14 grid md:grid-cols-3 gap-6 md:gap-8">
          {steps.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.32, 0.72, 0, 1] }}
              className="relative bg-white border border-[#0B1D2D]/10 rounded-[20px] p-7 hover:bg-[#EAF0F5] hover:border-[#0B1D2D]/12 transition-all"
            >
              <div className="mono text-[40px] md:text-[52px] font-[700] text-[#0677FF] leading-none">{s.step}</div>
              <div className="display-serif text-[22px] md:text-[26px] font-[800] mt-4 leading-tight">{s.title}</div>
              <p className="text-[14px] mt-3 text-[#0B1D2D]/65 leading-[1.6]">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── Tools Catalog ───────── */
function ToolsCatalog() {
  const tools = [
    { label: 'Fiscal', sub: 'ENI vs Lda', Icon: Calculator },
    { label: 'Viaturas', sub: 'IVA + TA', Icon: Layers },
    { label: 'Tickets', sub: 'Vales refeição', Icon: BadgeCheck },
    { label: 'SS Indep.', sub: 'Contribuições', Icon: ShieldCheck },
    { label: 'Diagnóstico', sub: 'Autonomia', Icon: Building2 },
    { label: 'Imóveis', sub: 'Arrendar vs entrada', Icon: Building2 },
    { label: 'IMT', sub: 'Aquisição', Icon: BookOpen },
    { label: 'Salário', sub: 'Líquido + custo', Icon: BadgeCheck },
    { label: 'Previsa', sub: 'Modelo 22/IRC', Icon: Calculator },
    { label: 'Base Legal', sub: '30+ fontes', Icon: BookOpen },
  ];
  return (
    <section id="simuladores" className="py-24 md:py-32 border-t border-[#0B1D2D]/8">
      <div className="max-w-7xl mx-auto px-5 md:px-8 grid lg:grid-cols-[0.9fr_1.1fr] gap-12 lg:gap-20 items-start">
        <div className="lg:sticky lg:top-32">
          <SectionLabel>Catálogo</SectionLabel>
          <h2 className="display-serif mt-4 text-[34px] md:text-[52px] leading-[1.02] tracking-[-0.03em] font-[200]">
            <span className="italic font-[800]">10</span> simuladores.
            <br />
            Um cliente, todos os ângulos.
          </h2>
          <p className="mt-5 text-[15px] text-[#0B1D2D]/65 leading-[1.6] max-w-lg">
            Construídos para contabilistas certificados, com base na legislação portuguesa em vigor.
            Cada simulador é independente, mas todos partilham o mesmo perfil — preenche uma vez,
            usa em todo o lado.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
          {tools.map((t, i) => (
            <motion.div
              key={t.label}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
              className="group bg-white border border-[#0B1D2D]/10 rounded-[16px] p-4 md:p-5 hover:bg-[#E7EDF3] hover:border-[#0677FF]/40 transition-all"
            >
              <t.Icon className="w-5 h-5 text-[#0677FF]" />
              <div className="display-serif text-[18px] md:text-[20px] font-[800] mt-3 leading-tight">{t.label}</div>
              <div className="text-[11px] mono uppercase tracking-[1.5px] text-[#0B1D2D]/45 mt-1">{t.sub}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── Package Block ───────── */
function PackageBlock() {
  const docs = [
    { Icon: Calculator,    label: 'Simulação Fiscal', body: 'Comparativo ENI vs Lda, IRS Jovem, escalões, IRC, deduções. Páginas editáveis em-linha.' },
    { Icon: FileText,      label: 'Proposta de Honorários', body: 'Carta com cabeçalho do escritório, tabela de serviços, mensalidade calculada por escalão de faturação.' },
    { Icon: FileSignature, label: 'Minuta de Contrato', body: 'Modelo OCC pré-preenchido com os dados do cliente, escritório e honorários acordados. Saltável.' },
  ];
  return (
    <section id="pacote" className="py-24 md:py-32 relative overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0 -z-10" style={{
        background: 'radial-gradient(50% 60% at 50% 40%, rgba(6,119,255,0.18) 0%, transparent 70%)',
      }} />
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <div className="max-w-4xl">
          <SectionLabel>Pacote do cliente</SectionLabel>
          <h2 className="display-serif mt-4 text-[36px] md:text-[60px] lg:text-[72px] leading-[0.98] tracking-[-0.03em] font-[200]">
            Três documentos.
            <br />
            <span className="italic font-[800] text-[#0677FF]">Um clique.</span>
          </h2>
          <p className="mt-6 text-[15px] md:text-[17px] text-[#0B1D2D]/65 leading-[1.6] max-w-2xl">
            Em vez de copiar dados entre Word, Excel e PDF, o Estudo 360 puxa tudo do mesmo perfil.
            Define uma vez o logo e a tabela de honorários — depois exporta o pacote completo por cada cliente.
          </p>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-5">
          {docs.map((d, i) => (
            <motion.div
              key={d.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative bg-gradient-to-br from-white to-[#F4F8FB] border border-[#0B1D2D]/10 rounded-[22px] p-7 md:p-8 overflow-hidden"
            >
              <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-[#0677FF]/15 blur-2xl" aria-hidden="true" />
              <div className="relative">
                <div className="w-11 h-11 rounded-[12px] bg-[#0677FF]/15 border border-[#0677FF]/30 flex items-center justify-center">
                  <d.Icon className="w-5 h-5 text-[#0677FF]" />
                </div>
                <div className="display-serif text-[24px] font-[800] mt-5 leading-tight">{d.label}</div>
                <p className="text-[13.5px] mt-3 text-[#0B1D2D]/60 leading-[1.6]">{d.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── Compliance ───────── */
function Compliance() {
  return (
    <section className="py-24 md:py-32 border-t border-[#0B1D2D]/8">
      <div className="max-w-7xl mx-auto px-5 md:px-8 grid lg:grid-cols-2 gap-10 lg:gap-20 items-center">
        <div>
          <SectionLabel>Conformidade</SectionLabel>
          <h2 className="display-serif mt-4 text-[34px] md:text-[52px] leading-[1.02] tracking-[-0.03em] font-[200]">
            Sempre alinhado com o
            <br />
            <span className="italic font-[800]">Orçamento do Estado.</span>
          </h2>
          <p className="mt-5 text-[15px] text-[#0B1D2D]/65 leading-[1.6] max-w-xl">
            Escalões de IRS, taxas de IRC, IRS Jovem, IMT, tributação autónoma de viaturas,
            limites de tickets de refeição — todos validados contra a legislação publicada e
            cruzados com fontes profissionais. Quando algo muda, a aplicação é atualizada.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            ['CIRS', 'Escalões 2026'],
            ['CIRC', 'PME 15% / 19%'],
            ['CIVA', 'Regimes e isenções'],
            ['CIMT', 'HPP, jovens, escalões'],
            ['Lei 73-A/2025', 'OE 2026 final'],
            ['EOCC', 'Estatuto da Ordem'],
          ].map(([k, v]) => (
            <div key={k} className="bg-white border border-[#0B1D2D]/10 rounded-[14px] p-4">
              <div className="mono text-[11px] uppercase tracking-[1.5px] text-[#0677FF]">{k}</div>
              <div className="text-[14px] font-[700] mt-1 text-[#0B1D2D]/90">{v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── Pricing ───────── */
function Pricing({ onEnter }: { onEnter: () => void }) {
  const tiers = [
    {
      name: 'Solo',
      tag: 'CC a título individual',
      price: '49',
      features: ['1 utilizador', 'Logo + dados no PDF', 'Todos os 10 simuladores', 'Pacote do cliente', 'Suporte por email'],
      featured: false,
    },
    {
      name: 'Escritório',
      tag: 'Mais usado',
      price: '129',
      features: ['Até 5 utilizadores', 'Branding completo', 'Tabela de honorários partilhada', 'Histórico por cliente', 'Suporte prioritário'],
      featured: true,
    },
    {
      name: 'Sociedade',
      tag: 'PJ + Sociedade C.C.',
      price: '249',
      features: ['Até 15 utilizadores', 'Multi-marca', 'Importação SAF-T', 'API privada (em breve)', 'Onboarding dedicado'],
      featured: false,
    },
  ];
  return (
    <section id="precos" className="py-24 md:py-32 border-t border-[#0B1D2D]/8">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <SectionLabel>Preços</SectionLabel>
          <h2 className="display-serif mt-4 text-[36px] md:text-[56px] leading-[1] tracking-[-0.03em] font-[200]">
            Justo para o tamanho do escritório.
          </h2>
          <p className="mt-5 text-[15px] text-[#0B1D2D]/65 leading-[1.6]">
            Mensal. Sem fidelização. Sem custo por cliente.
          </p>
        </div>

        <div className="mt-14 grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={[
                'relative rounded-[22px] p-7 md:p-8 flex flex-col',
                t.featured
                  ? 'bg-gradient-to-br from-[#0677FF] to-[#0B1D2D] text-white border border-white/20 shadow-2xl shadow-[#0677FF]/30 md:scale-[1.03]'
                  : 'bg-white border border-[#0B1D2D]/10 text-[#0B1D2D]',
              ].join(' ')}
            >
              {t.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white text-[#0B1D2D] text-[10px] mono uppercase tracking-[2px] font-[800]">
                  Mais escolhido
                </div>
              )}
              <div className="text-[11px] mono uppercase tracking-[2px] opacity-70">{t.tag}</div>
              <div className="display-serif text-[28px] font-[800] mt-1">{t.name}</div>
              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="display-serif text-[64px] font-[200] leading-none tracking-tight">€{t.price}</span>
                <span className="text-[12px] opacity-70 font-[600]">/mês</span>
              </div>
              <ul className="mt-7 space-y-2.5 text-[13.5px] flex-1">
                {t.features.map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className={`w-4 h-4 mt-0.5 shrink-0 ${t.featured ? 'text-white' : 'text-[#0677FF]'}`} />
                    <span className={t.featured ? 'opacity-95' : 'text-[#0B1D2D]/70'}>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={onEnter}
                className={[
                  'mt-7 inline-flex items-center justify-center gap-2 py-3.5 rounded-[12px] text-[13px] font-[800] transition-all',
                  t.featured
                    ? 'bg-white text-[#0B1D2D] hover:bg-[#E2E8F0]'
                    : 'border border-[#0B1D2D]/12 hover:bg-[#0B1D2D]/[0.05] text-[#0B1D2D]',
                ].join(' ')}
              >
                Começar agora <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── Final CTA ───────── */
function FinalCTA({ onEnter }: { onEnter: () => void }) {
  return (
    <section className="py-24 md:py-36">
      <div className="max-w-5xl mx-auto px-5 md:px-8 text-center">
        <h2 className="display-serif text-[42px] md:text-[72px] lg:text-[88px] leading-[0.98] tracking-[-0.03em] font-[200]">
          Próximo cliente que ligar:
          <br />
          <span className="italic font-[800] text-[#0677FF]">desligue com tudo pronto.</span>
        </h2>
        <button
          type="button"
          onClick={onEnter}
          className="mt-10 inline-flex items-center gap-2 bg-[#0B1D2D] text-white px-7 py-4 rounded-[14px] text-[14px] font-[800] hover:bg-[#26323f] ative:scale-[0.98] transition-all"
        >
          Experimentar o Estudo 360 <ArrowRight className="w-4 h-4" />
        </button>
        <p className="mt-4 text-[11px] mono uppercase tracking-[2.5px] text-[#0B1D2D]/45">
          Sem cartão · acesso imediato
        </p>
      </div>
    </section>
  );
}

/* ───────── Footer ───────── */
function Footer() {
  return (
    <footer className="border-t border-[#0B1D2D]/8 py-12">
      <div className="max-w-7xl mx-auto px-5 md:px-8 flex flex-col md:flex-row gap-6 md:gap-10 md:items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandMark size={24} />
          <div className="text-[12px] text-[#0B1D2D]/55">© {new Date().getFullYear()} Estudo 360 · Ferramentas para contabilistas certificados</div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-[#0B1D2D]/55">
          <a href="#funciona" className="hover:text-[#0B1D2D] transition-colors">Como funciona</a>
          <a href="#simuladores" className="hover:text-[#0B1D2D] transition-colors">Simuladores</a>
          <a href="#pacote" className="hover:text-[#0B1D2D] transition-colors">Pacote</a>
          <a href="#precos" className="hover:text-[#0B1D2D] transition-colors">Preços</a>
        </div>
      </div>
    </footer>
  );
}

/* ───────── Atoms ───────── */
function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/logo.svg"
      alt=""
      width={size}
      height={size}
      className="object-contain select-none shrink-0"
      style={{ width: size, height: size }}
      draggable={false}
      aria-hidden="true"
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 text-[11px] mono uppercase tracking-[2.5px] text-[#0677FF] font-[700]">
      <span className="w-6 h-px bg-[#0677FF]" /> {children}
    </div>
  );
}
