import { motion } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Scale, BookOpen, Car, Ticket, Shield, AlertTriangle, CheckCircle2, Briefcase, Save, Layers, Building, Banknote, Home, ClipboardList } from 'lucide-react';
import { IRS_BRACKETS_2026, IAS_2026 } from './lib/pt2026';
import {
  loadPricing,
  savePricing,
  loadPricingFromFirestore,
  savePricingToFirestore,
  calcClientEstimate,
  type PricingConfig,
} from './lib/pricing';
import type { ClientProfile } from './ClientProfile';

interface Props {
  onBack: () => void;
  onOpenUpdates?: () => void;
  clientProfile?: ClientProfile;
  vehicleState?: { price: number };
  ticketState?: { ticketValue: number };
  initialAnchor?: string | null;
}

const ptEur = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

const SectionHeader = ({ icon: Icon, title, color = '#0677FF' }: { icon: React.ElementType; title: string; color?: string }) => (
  <div className="flex items-center gap-3 mb-5 pb-3 border-b-2" style={{ borderColor: color }}>
    <div className="p-2 rounded-[10px]" style={{ backgroundColor: `${color}15` }}>
      <Icon className="w-5 h-5" style={{ color }} />
    </div>
    <h2 className="text-[18px] font-[800] text-[#0F172A]">{title}</h2>
  </div>
);

const LegalRow = ({ label, value, note }: { label: string; value: string; note?: string }) => (
  <div className="py-[10px] border-b border-[#F1F5F9] last:border-0">
    <div className="flex justify-between items-start gap-4">
      <span className="text-[13px] font-[700] text-[#475569] shrink-0 w-[200px]">{label}</span>
      <span className="text-[13px] font-[600] text-[#0F172A] text-right flex-1">{value}</span>
    </div>
    {note && <p className="text-[11px] text-[#94A3B8] mt-1 ml-0 font-[500]">{note}</p>}
  </div>
);

const Article = ({ code, description }: { code: string; description: string }) => (
  <div className="flex gap-3 py-[8px] border-b border-[#F1F5F9] last:border-0">
    <span className="text-[11px] font-[800] text-[#0677FF] bg-[#FDF2F2] px-2 py-1 rounded-[6px] h-fit shrink-0 whitespace-nowrap">{code}</span>
    <span className="text-[13px] font-[500] text-[#334155]">{description}</span>
  </div>
);

const ptEurShort = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(v);

const PriceInput = ({
  label,
  description,
  value,
  suffix = '€/mês',
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  suffix?: string;
  onChange: (v: number) => void;
}) => (
  <div className="flex flex-col gap-1">
    <label className="text-[12px] font-[700] text-[#0F172A]">{label}</label>
    <p className="text-[11px] text-[#94A3B8] font-[500]">{description}</p>
    <div className="flex items-center gap-2 mt-1">
      <input
        type="number"
        min={0}
        step={5}
        value={value === 0 ? '' : value}
        placeholder="0"
        onChange={e => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
        className="w-28 px-3 py-2 bg-[#F5F7FA] border-2 border-[#E2E8F0] rounded-[8px] text-[14px] font-[700] text-[#0F172A] focus:border-[#0677FF] outline-none"
      />
      <span className="text-[12px] text-[#64748B] font-[500]">{suffix}</span>
    </div>
  </div>
);

type LegalSectionEntry = {
  id: string;
  label: string;
  Icon: React.ElementType;
  color: string;
  parentId?: string;
};

const LEGAL_SECTIONS: LegalSectionEntry[] = [
  { id: 'legal-regimes',    label: 'Regimes Contab. & IVA', Icon: Layers,    color: '#334155' },
  { id: 'legal-cae',        label: 'CAE & Art.9 CIVA',     Icon: ClipboardList, color: '#334155', parentId: 'legal-regimes' },
  { id: 'legal-docs',       label: 'Documentos obrig.',    Icon: ClipboardList, color: '#334155', parentId: 'legal-regimes' },
  { id: 'legal-irs',        label: 'IRS',                  Icon: BookOpen,  color: '#0677FF' },
  { id: 'legal-distribuicao', label: 'Salário vs Dividendos', Icon: Banknote, color: '#0677FF', parentId: 'legal-irs' },
  { id: 'legal-irc',        label: 'IRC',                  Icon: Scale,     color: '#334155' },
  { id: 'legal-csc',        label: 'Estrutura Societária', Icon: Building,  color: '#334155', parentId: 'legal-irc' },
  { id: 'legal-iva',        label: 'IVA',                  Icon: Scale,     color: '#1D4ED8' },
  { id: 'legal-ss',         label: 'Segurança Social',     Icon: Shield,    color: '#059669' },
  { id: 'legal-dividas',    label: 'Dívidas Fiscais & SS', Icon: AlertTriangle, color: '#059669', parentId: 'legal-ss' },
  { id: 'legal-tickets',    label: 'Tickets / Benefícios', Icon: Ticket,    color: '#7C3AED' },
  { id: 'legal-imt',        label: 'IMT & Imposto Selo',   Icon: Building,  color: '#7C3AED' },
  { id: 'legal-salario',    label: 'Salário Líquido TCO',  Icon: Banknote,  color: '#0369A1' },
  { id: 'legal-imoveis',    label: 'Imóveis na Empresa',   Icon: Home,      color: '#065F46' },
  { id: 'legal-indice',     label: 'Índice Legislativo',   Icon: BookOpen,  color: '#475569' },
  { id: 'legal-fontes',     label: 'Fontes Web',           Icon: BookOpen,  color: '#475569' },
];

// Honour user motion preferences for in-page anchor scrolling.
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function LegalSidebar() {
  const [activeId, setActiveId] = useState<string>(LEGAL_SECTIONS[0].id);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .map(e => e.target.id)
          .filter(id => LEGAL_SECTIONS.some(s => s.id === id));
        if (visible.length === 0) return;
        const first = LEGAL_SECTIONS
          .map(s => s.id)
          .find(id => visible.includes(id));
        if (first) setActiveId(first);
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 }
    );
    LEGAL_SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const handleClick = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
    setActiveId(id);
  };

  return (
    <nav className="space-y-0.5" aria-label="Índice da página legal">
      <p className="text-[10px] font-[800] uppercase tracking-[1.5px] text-[#94A3B8] mb-3 px-3">Índice Legal</p>
      {LEGAL_SECTIONS.map(({ id, label, Icon, color, parentId }) => {
        const isActive = activeId === id;
        const indent = parentId ? 'pl-7' : 'pl-3';
        return (
          <button
            key={id}
            type="button"
            onClick={() => handleClick(id)}
            aria-current={isActive ? 'true' : undefined}
            className={
              `w-full flex items-center gap-2 ${indent} pr-3 py-1.5 rounded-[8px] text-[12px] font-[600] transition-all text-left border-l-2 ` +
              (isActive
                ? 'bg-[#FDF2F2] text-[#0677FF] border-[#0677FF] font-[700]'
                : 'border-transparent text-slate-600 hover:text-[#0F172A] hover:bg-slate-50')
            }
          >
            <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: isActive ? '#0677FF' : color }} aria-hidden="true" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default function LegalInfo({ onBack, onOpenUpdates, clientProfile, vehicleState, ticketState, initialAnchor }: Props) {
  const [pricing, setPricing] = useState<PricingConfig>(loadPricing);
  const [saved, setSaved] = useState(false);

  // On mount: load from Firestore (overrides localStorage if cloud data exists)
  useEffect(() => {
    loadPricingFromFirestore().then(cloud => {
      if (cloud) {
        setPricing(cloud);
        savePricing(cloud); // keep localStorage in sync
      }
    });
  }, []);

  // If a deep-link anchor was supplied (from Ficha → "Base Legal →"),
  // scroll to it after the section DOM mounts. Two rAFs to ensure layout settled.
  useEffect(() => {
    if (!initialAnchor) return;
    let cancelled = false;
    const tryScroll = () => {
      if (cancelled) return;
      const el = document.getElementById(initialAnchor);
      if (el) {
        el.scrollIntoView({
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          block: 'start',
        });
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(tryScroll));
    return () => { cancelled = true; };
  }, [initialAnchor]);

  const update = (field: keyof PricingConfig, value: number) => {
    const next = { ...pricing, [field]: value };
    setPricing(next);
    savePricing(next);           // localStorage — instant
    savePricingToFirestore(next); // Firestore — cloud
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const estimate =
    clientProfile && clientProfile.nomeCliente
      ? calcClientEstimate(pricing, clientProfile, vehicleState, ticketState)
      : null;

  return (
    <motion.div className="h-full bg-[#F5F7FA] overflow-y-auto" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] px-6 md:px-10 py-4 flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[13px] font-[700] text-[#475569] hover:text-[#0677FF] transition-colors px-3 py-2 rounded-[8px] hover:bg-[#FDF2F2]"
        >
          <ArrowLeft size={16} />
          Voltar
        </button>
        <div className="h-6 w-px bg-[#E2E8F0]" />
        <div>
          <h1 className="text-[18px] font-[800] text-[#0F172A]">Base Legal & Referências</h1>
          <p className="text-[11px] font-[600] text-[#0677FF] uppercase tracking-[1px]">Legislação • Taxas • Limites • OE 2026</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11px] font-[700] bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full">
            ✓ Atualizado Maio 2026
          </span>
          {onOpenUpdates && (
            <button
              onClick={onOpenUpdates}
              className="flex items-center gap-2 text-[13px] font-[700] text-white bg-[#0677FF] hover:bg-[#0556CC] px-4 py-2 rounded-[10px] transition-all active:scale-[0.98] shadow-sm shadow-[#0677FF]/20"
            >
              <ClipboardList size={15} />
              Checklist
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-10 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-10">
          <aside className="hidden lg:block sticky top-[80px] self-start max-h-[calc(100vh-100px)] overflow-y-auto pr-2">
            <LegalSidebar />
          </aside>
          <div className="min-w-0 max-w-4xl space-y-12">

        {/* Aviso */}
        <div className="bg-amber-50 border border-amber-200 rounded-[16px] p-5 flex gap-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[13px] text-amber-900 font-[500] leading-relaxed">
            <strong>Nota:</strong> Esta página apresenta a legislação em que os cálculos dos simuladores se baseiam, com dados válidos para <strong>maio de 2026</strong>. A lei fiscal pode sofrer alterações. Este simulador não substitui o aconselhamento de um <strong>contabilista certificado (OCC)</strong>.
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* REGIMES DE CONTABILIDADE & IVA                             */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="legal-regimes" className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0] scroll-mt-24">
          <SectionHeader icon={Layers} title="Regimes de Contabilidade & IVA em Portugal" color="#334155" />

          <p className="text-[13px] text-[#64748B] font-[500] mb-6 leading-relaxed">
            O enquadramento contabilístico e fiscal de um cliente depende do tipo de entidade, volume de faturação, natureza da atividade e opções exercidas. Abaixo resumem-se todos os regimes em vigor.
          </p>

          {/* ── Regimes de Apuramento do Rendimento ── */}
          <h3 className="text-[14px] font-[800] text-[#0F172A] mb-4 mt-2 uppercase tracking-[0.5px]">Regimes de Apuramento do Rendimento</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">

            {/* 1 - Regime Simplificado */}
            {(() => {
              const isActive = clientProfile?.regimeContabilidade === 'simplificado';
              return (
                <div className={`rounded-[16px] border-2 p-5 ${isActive ? 'border-[#0677FF] bg-[#FDF2F2]' : 'border-[#E2E8F0] bg-[#F5F7FA]'}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <span className="text-[11px] font-[800] text-[#0677FF] bg-[#FDF2F2] border border-[#F8B4B4] px-2 py-0.5 rounded-full">Art. 28.º CIRS / Art. 86.º-A CIRC</span>
                      <h4 className="text-[15px] font-[800] text-[#0F172A] mt-2">Regime Simplificado</h4>
                    </div>
                    {isActive && <span className="shrink-0 text-[10px] font-[800] bg-[#0677FF] text-white px-2 py-1 rounded-full uppercase">Cliente Atual</span>}
                  </div>
                  <div className="space-y-1.5 text-[13px]">
                    <p className="text-[#475569] font-[500]"><strong className="text-[#0F172A]">Para quem:</strong> ENI (Cat. B) e pequenas sociedades com faturação até <strong>€200.000/ano</strong>.</p>
                    <p className="text-[#475569] font-[500]"><strong className="text-[#0F172A]">Como funciona:</strong> Não apura lucro real. Usa coeficientes sobre as receitas.</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="bg-white rounded-[8px] border border-[#E2E8F0] p-2 text-center">
                        <div className="text-[11px] text-[#94A3B8] font-[600]">Serviços</div>
                        <div className="text-[18px] font-[800] text-[#0677FF]">75%</div>
                        <div className="text-[10px] text-[#94A3B8]">rendimento coletável</div>
                      </div>
                      <div className="bg-white rounded-[8px] border border-[#E2E8F0] p-2 text-center">
                        <div className="text-[11px] text-[#94A3B8] font-[600]">Mercadorias</div>
                        <div className="text-[18px] font-[800] text-[#0677FF]">15%</div>
                        <div className="text-[10px] text-[#94A3B8]">rendimento coletável</div>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#94A3B8] font-[500] mt-1">Vantagem: menos obrigações contabilísticas. Obriga a Contabilidade Organizada acima de €200k.</p>
                  </div>
                </div>
              );
            })()}

            {/* 2 - Contabilidade Organizada */}
            {(() => {
              const isActive = clientProfile?.regimeContabilidade === 'organizada';
              return (
                <div className={`rounded-[16px] border-2 p-5 ${isActive ? 'border-[#0F172A] bg-slate-50' : 'border-[#E2E8F0] bg-[#F5F7FA]'}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <span className="text-[11px] font-[800] text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">SNC + CIRS/CIRC</span>
                      <h4 className="text-[15px] font-[800] text-[#0F172A] mt-2">Contabilidade Organizada</h4>
                    </div>
                    {isActive && <span className="shrink-0 text-[10px] font-[800] bg-[#0F172A] text-white px-2 py-1 rounded-full uppercase">Cliente Atual</span>}
                  </div>
                  <div className="space-y-1.5 text-[13px]">
                    <p className="text-[#475569] font-[500]"><strong className="text-[#0F172A]">Para quem:</strong> Sociedades (obrigatório) e ENI acima de €200k ou por opção.</p>
                    <p className="text-[#475569] font-[500]"><strong className="text-[#0F172A]">Como funciona:</strong> Apura o lucro real. Imposto = sobre <em>Rendimentos − Gastos</em>.</p>
                    <p className="text-[#475569] font-[500]">Obriga a Contabilista Certificado (OCC) e demonstrações financeiras (Balanço, DRD).</p>
                    <p className="text-[11px] text-[#94A3B8] font-[500] mt-1">ENI pode optar voluntariamente mesmo abaixo de €200k para deduzir custos reais superiores aos coeficientes.</p>
                  </div>
                </div>
              );
            })()}

            {/* 3 - Transparência Fiscal */}
            {(() => {
              const isActive = clientProfile?.regimeContabilidade === 'transparencia_fiscal';
              return (
                <div className={`rounded-[16px] border-2 p-5 ${isActive ? 'border-purple-500 bg-purple-50' : 'border-[#E2E8F0] bg-[#F5F7FA]'}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <span className="text-[11px] font-[800] text-purple-700 bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-full">Art. 6.º CIRC</span>
                      <h4 className="text-[15px] font-[800] text-[#0F172A] mt-2">Regime de Transparência Fiscal</h4>
                    </div>
                    {isActive && <span className="shrink-0 text-[10px] font-[800] bg-purple-600 text-white px-2 py-1 rounded-full uppercase">Cliente Atual</span>}
                  </div>
                  <div className="space-y-1.5 text-[13px]">
                    <p className="text-[#475569] font-[500]"><strong className="text-[#0F172A]">Para quem:</strong> Sociedades de profissionais (advogados, médicos, arquitetos, etc.).</p>
                    <p className="text-[#475569] font-[500]"><strong className="text-[#0F172A]">Como funciona:</strong> A empresa <strong>não paga IRC</strong>. O lucro é imputado aos sócios e tributado em IRS na esfera pessoal.</p>
                    <p className="text-[#475569] font-[500]">Pode ser vantajoso quando a taxa marginal de IRS do sócio é inferior à taxa de IRC.</p>
                    <p className="text-[11px] text-[#94A3B8] font-[500] mt-1">Muito usado em estruturas profissionais com sócios de rendimentos moderados. Simulável no separador de Enquadramento Fiscal.</p>
                  </div>
                </div>
              );
            })()}

            {/* 4 - RETGS */}
            {(() => {
              const isActive = clientProfile?.regimeContabilidade === 'retgs';
              return (
                <div className={`rounded-[16px] border-2 p-5 ${isActive ? 'border-blue-500 bg-blue-50' : 'border-[#E2E8F0] bg-[#F5F7FA]'}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <span className="text-[11px] font-[800] text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full">Art. 69.º CIRC</span>
                      <h4 className="text-[15px] font-[800] text-[#0F172A] mt-2">RETGS — Tributação de Grupos</h4>
                    </div>
                    {isActive && <span className="shrink-0 text-[10px] font-[800] bg-blue-600 text-white px-2 py-1 rounded-full uppercase">Cliente Atual</span>}
                  </div>
                  <div className="space-y-1.5 text-[13px]">
                    <p className="text-[#475569] font-[500]"><strong className="text-[#0F172A]">Para quem:</strong> Grupos de sociedades em que a dominante detém ≥75% do capital e direitos de voto.</p>
                    <p className="text-[#475569] font-[500]"><strong className="text-[#0F172A]">Como funciona:</strong> Resultado fiscal consolidado — lucros e prejuízos compensam-se dentro do grupo.</p>
                    <p className="text-[11px] text-[#94A3B8] font-[500] mt-1">Requer autorização prévia da AT e contabilidade consolidada. Os simuladores desta ferramenta não cobrem o RETGS.</p>
                  </div>
                </div>
              );
            })()}

            {/* 5 - Não Residentes */}
            {(() => {
              const isActive = clientProfile?.regimeContabilidade === 'nao_residente';
              return (
                <div className={`rounded-[16px] border-2 p-5 col-span-full md:col-span-1 ${isActive ? 'border-amber-500 bg-amber-50' : 'border-[#E2E8F0] bg-[#F5F7FA]'}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <span className="text-[11px] font-[800] text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">CIRS/CIRC + CDT</span>
                      <h4 className="text-[15px] font-[800] text-[#0F172A] mt-2">Regime de Não Residentes</h4>
                    </div>
                    {isActive && <span className="shrink-0 text-[10px] font-[800] bg-amber-600 text-white px-2 py-1 rounded-full uppercase">Cliente Atual</span>}
                  </div>
                  <div className="space-y-1.5 text-[13px]">
                    <p className="text-[#475569] font-[500]"><strong className="text-[#0F172A]">Para quem:</strong> Entidades estrangeiras com rendimentos obtidos em Portugal (estabelecimento estável, dividendos, royalties, etc.).</p>
                    <p className="text-[#475569] font-[500]"><strong className="text-[#0F172A]">Como funciona:</strong> Tributação específica, muitas vezes com retenção na fonte. Depende da Convenção de Dupla Tributação (CDT) aplicável.</p>
                    <p className="text-[11px] text-[#94A3B8] font-[500] mt-1">Requer análise casuística. A AT disponibiliza orientações no Portal das Finanças.</p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── Regimes de IVA ── */}
          <h3 className="text-[14px] font-[800] text-[#0F172A] mb-4 mt-6 uppercase tracking-[0.5px]">Regimes de IVA</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* IVA Art. 53 */}
            {(() => {
              const isActive = clientProfile?.regimeIva === 'isento';
              return (
                <div className={`rounded-[16px] border-2 p-4 ${isActive ? 'border-emerald-500 bg-emerald-50' : 'border-[#E2E8F0] bg-[#F5F7FA]'}`}>
                  <span className="text-[11px] font-[800] text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">Art. 53.º CIVA</span>
                  <h4 className="text-[14px] font-[800] text-[#0F172A] mt-2 mb-2 flex items-center justify-between">
                    Isenção de IVA
                    {isActive && <span className="text-[10px] font-[800] bg-emerald-600 text-white px-2 py-0.5 rounded-full">Cliente Atual</span>}
                  </h4>
                  <p className="text-[12px] text-[#475569] font-[500] mb-2">Pequenos negócios com faturação até <strong>≈ €15.000/ano</strong>. Não cobra IVA, não deduz IVA.</p>
                  <p className="text-[11px] text-[#94A3B8] font-[500]">Vantagem em B2C: preço final mais competitivo. Desvantagem: sem recuperação do IVA suportado nas compras.</p>
                </div>
              );
            })()}

            {/* IVA Trimestral */}
            {(() => {
              const isActive = clientProfile?.regimeIva === 'normal_trimestral';
              return (
                <div className={`rounded-[16px] border-2 p-4 ${isActive ? 'border-[#0F172A] bg-slate-50' : 'border-[#E2E8F0] bg-[#F5F7FA]'}`}>
                  <span className="text-[11px] font-[800] text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">CIVA Normal</span>
                  <h4 className="text-[14px] font-[800] text-[#0F172A] mt-2 mb-2 flex items-center justify-between">
                    Regime Normal Trimestral
                    {isActive && <span className="text-[10px] font-[800] bg-[#0F172A] text-white px-2 py-0.5 rounded-full">Cliente Atual</span>}
                  </h4>
                  <p className="text-[12px] text-[#475569] font-[500] mb-2">Declaração periódica de IVA a cada trimestre (4×/ano). Regra geral para faturação &lt; €650.000.</p>
                  <p className="text-[11px] text-[#94A3B8] font-[500]">Entrega até ao final do 2.º mês seguinte ao trimestre (ex: jan–mar → maio).</p>
                </div>
              );
            })()}

            {/* IVA Mensal */}
            {(() => {
              const isActive = clientProfile?.regimeIva === 'normal_mensal';
              return (
                <div className={`rounded-[16px] border-2 p-4 ${isActive ? 'border-[#0677FF] bg-[#FDF2F2]' : 'border-[#E2E8F0] bg-[#F5F7FA]'}`}>
                  <span className="text-[11px] font-[800] text-[#0677FF] bg-[#FDF2F2] border border-[#F8B4B4] px-2 py-0.5 rounded-full">CIVA Normal</span>
                  <h4 className="text-[14px] font-[800] text-[#0F172A] mt-2 mb-2 flex items-center justify-between">
                    Regime Normal Mensal
                    {isActive && <span className="text-[10px] font-[800] bg-[#0677FF] text-white px-2 py-0.5 rounded-full">Cliente Atual</span>}
                  </h4>
                  <p className="text-[12px] text-[#475569] font-[500] mb-2">Declaração periódica mensal (12×/ano). Obrigatório para faturação ≥ €650.000/ano.</p>
                  <p className="text-[11px] text-[#94A3B8] font-[500]">Entrega até ao dia 20 do 2.º mês seguinte. Mais obrigações mas cashback de IVA mais rápido.</p>
                </div>
              );
            })()}

            {/* Pequenos Retalhistas */}
            {(() => {
              const isActive = clientProfile?.regimeIva === 'pequenos_retalhistas';
              return (
                <div className={`rounded-[16px] border-2 p-4 ${isActive ? 'border-amber-500 bg-amber-50' : 'border-[#E2E8F0] bg-[#F5F7FA]'}`}>
                  <span className="text-[11px] font-[800] text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">Art. 60.º-A CIVA</span>
                  <h4 className="text-[14px] font-[800] text-[#0F172A] mt-2 mb-2 flex items-center justify-between">
                    Regime dos Pequenos Retalhistas
                    {isActive && <span className="text-[10px] font-[800] bg-amber-600 text-white px-2 py-0.5 rounded-full">Cliente Atual</span>}
                  </h4>
                  <p className="text-[12px] text-[#475569] font-[500] mb-2">Pequenos comerciantes: IVA calculado com base nas <strong>compras</strong>, não nas vendas. Taxa de 25% sobre o IVA suportado.</p>
                  <p className="text-[11px] text-[#94A3B8] font-[500]">Atualmente pouco utilizado. Simplifica o apuramento mas pode ser desvantajoso em margens elevadas.</p>
                </div>
              );
            })()}

            {/* Isenção específica */}
            <div className="rounded-[16px] border-2 border-[#E2E8F0] bg-[#F5F7FA] p-4">
              <span className="text-[11px] font-[800] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">Art. 9.º CIVA</span>
              <h4 className="text-[14px] font-[800] text-[#0F172A] mt-2 mb-2">Isenção por Natureza da Atividade</h4>
              <p className="text-[12px] text-[#475569] font-[500] mb-2">Certas atividades estão isentas por natureza: saúde, educação, seguros, serviços financeiros, etc.</p>
              <p className="text-[11px] text-[#94A3B8] font-[500]">Diferente da isenção Art. 53.º — sem limite de faturação. Sem direito à dedução do IVA suportado.</p>
            </div>
          </div>

          {/* Tabela resumo obrigações */}
          <div className="mt-8 overflow-x-auto">
            <h3 className="text-[13px] font-[800] text-[#0F172A] mb-3 uppercase tracking-[0.5px]">Resumo de Obrigações por Regime</h3>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#0F172A] text-white">
                  <th className="text-left px-4 py-2 rounded-tl-[8px]">Regime</th>
                  <th className="text-center px-3 py-2">Contabilista OCC</th>
                  <th className="text-center px-3 py-2">Declarações IVA</th>
                  <th className="text-center px-3 py-2">Modelo 22 / Mod. 3</th>
                  <th className="text-center px-3 py-2 rounded-tr-[8px]">DAI / IES</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Simplificado ENI', 'Recomendado', '0 / trimestral / mensal', 'Mod. 3 Cat. B', 'Não'],
                  ['Contab. Organizada ENI', 'Obrigatório', '0 / trimestral / mensal', 'Mod. 3 Cat. B', 'Não'],
                  ['Contab. Organizada Lda/SA', 'Obrigatório', 'Trimestral ou Mensal', 'Modelo 22 IRC', 'Sim (IES)'],
                  ['Transparência Fiscal', 'Obrigatório', 'Trimestral ou Mensal', 'Mod. 22 + Mod. 3', 'Sim (IES)'],
                  ['RETGS', 'Obrigatório', 'Trimestral ou Mensal', 'Consolidado', 'Sim (consolidado)'],
                ].map(([regime, occ, iva, imp, ies], i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-[#F5F7FA]' : 'bg-white'}>
                    <td className="px-4 py-2 font-[700] text-[#0F172A]">{regime}</td>
                    <td className="px-3 py-2 text-center">{occ}</td>
                    <td className="px-3 py-2 text-center">{iva}</td>
                    <td className="px-3 py-2 text-center">{imp}</td>
                    <td className="px-3 py-2 text-center">{ies}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── CAE & atividades isentas (Art.9 CIVA) ── */}
          <div id="legal-cae" className="mt-10 pt-8 border-t border-[#E2E8F0] scroll-mt-24">
            <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3 uppercase tracking-[0.5px]">CAE & Atividades Isentas de IVA (Art. 9.º CIVA)</h3>
            <p className="text-[13px] text-[#64748B] font-[500] mb-4 leading-relaxed">
              A Classificação Portuguesa das Atividades Económicas (CAE-Rev.3, NACE) identifica a atividade junto da AT, SS e bancos. Algumas atividades estão isentas de IVA por natureza (sem registo no Art. 53.º), o que tem implicações na (não) dedução do IVA suportado.
            </p>
            <div className="space-y-2 mb-4">
              <LegalRow label="Saúde — médicos, enfermagem, MTC" value="Isenta de IVA — CIVA Art. 9.º, n.º 1" note="Não permite deduzir IVA suportado em compras" />
              <LegalRow label="Educação e formação certificada" value="Isenta de IVA — CIVA Art. 9.º, n.º 9" note="Inclui DGERT, CITE-2, ensino reconhecido" />
              <LegalRow label="Serviços sociais" value="Isenta de IVA — CIVA Art. 9.º, n.º 7-8" />
              <LegalRow label="Cultura, museus, espetáculos sem fim lucrativo" value="Isenta de IVA — CIVA Art. 9.º, n.º 13-14" />
              <LegalRow label="Operações imobiliárias (rendas, transmissão usado)" value="Isenta de IVA — CIVA Art. 9.º, n.º 29-30" note="Possível renúncia à isenção em arrendamento empresarial (CIVA Art. 12.º)" />
              <LegalRow label="Atividade não isenta + < €15.000/ano" value="Pode optar pelo Art. 53.º (isenção PME)" note="Limite OE 2025 — passou de €14.500 para €15.000" />
              <LegalRow label="CAE principal vs secundário" value="Atividade principal define enquadramento; secundárias podem somar à mesma faturação" note="Comunicação obrigatória à AT (declaração de início/alterações)" />
            </div>
            <div className="space-y-1">
              <Article code="CIVA Art. 9.º" description="Operações isentas de IVA — saúde, educação, serviços sociais, cultura, imobiliário usado" />
              <Article code="CIVA Art. 53.º" description="Regime especial de isenção PME — volume de negócios ≤ €15.000/ano" />
              <Article code="DR n.º 381/2007" description="Classificação Portuguesa das Atividades Económicas — CAE-Rev.3" />
            </div>
          </div>

          {/* ── Documentos contabilísticos obrigatórios ── */}
          <div id="legal-docs" className="mt-10 pt-8 border-t border-[#E2E8F0] scroll-mt-24">
            <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3 uppercase tracking-[0.5px]">Documentos Contabilísticos & Prazos de Arquivo</h3>
            <p className="text-[13px] text-[#64748B] font-[500] mb-4 leading-relaxed">
              O DL 158/2009 (SNC) e o RGIT estabelecem os documentos obrigatórios e os prazos legais de conservação. A AT pode exigir o acesso a estes documentos durante o período de arquivo.
            </p>
            <div className="space-y-2 mb-4">
              <LegalRow label="Faturas, recibos, notas de crédito/débito" value="Arquivo obrigatório 10 anos" note="RGIT Art. 123.º — emissão por sistema certificado (Portaria 363/2010)" />
              <LegalRow label="Livros contabilísticos (diário, razão, inventário)" value="Arquivo obrigatório 10 anos" note="DL 158/2009 — SNC; obrigatórios em contabilidade organizada" />
              <LegalRow label="Mapas de pessoal, recibos de salário, contratos" value="Arquivo 5 anos (laboral) / 10 anos (contributivo)" note="Código do Trabalho + CRCSPSS" />
              <LegalRow label="Declarações fiscais (Mod. 22, IES, IVA, Mod. 3)" value="Arquivo 10 anos a partir do final do exercício" />
              <LegalRow label="Extratos bancários, comprovantes de pagamento" value="10 anos — comprovam fluxos contabilísticos" />
              <LegalRow label="Inventários físicos (stocks)" value="Obrigatório a 31 dez de cada exercício" note="DL 158/2009 — anexo ao Modelo 22 e IES" />
              <LegalRow label="SAF-T (PT) — ficheiro normalizado" value="Geração e envio à AT obrigatórios para empresas" note="Portaria 321-A/2007 — formato XML uniforme" />
              <LegalRow label="ENI em regime simplificado" value="Documentos justificativos das despesas isentas (mas relevantes)" note="Recomenda-se manter mesmo se não declarar custos reais" />
            </div>
            <div className="space-y-1">
              <Article code="DL 158/2009" description="Sistema de Normalização Contabilística (SNC) — obrigações de registo e arquivo" />
              <Article code="RGIT Art. 123.º" description="Conservação de livros e documentos — 10 anos" />
              <Article code="Portaria 363/2010" description="Sistemas de faturação certificados pela AT" />
              <Article code="Portaria 321-A/2007" description="SAF-T (PT) — ficheiro normalizado de auditoria fiscal" />
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 1. IRS — IMPOSTO SOBRE O RENDIMENTO DE PESSOAS SINGULARES  */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="legal-irs" className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0] scroll-mt-24">
          <SectionHeader icon={BookOpen} title="IRS — Imposto sobre o Rendimento (CIRS)" />

          <div className="space-y-6">
            {/* Escalões */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Escalões de IRS 2026 (Art. 68.º CIRS)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#0F172A] text-white">
                      <th className="text-left px-4 py-2 rounded-tl-[8px]">Rendimento Coletável</th>
                      <th className="text-right px-4 py-2">Taxa Marginal</th>
                      <th className="text-right px-4 py-2 rounded-tr-[8px]">Parcela a Abater</th>
                    </tr>
                  </thead>
                  <tbody>
                    {IRS_BRACKETS_2026.map((b, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-[#F5F7FA]' : 'bg-white'}>
                        <td className="px-4 py-2 font-[500]">
                          {i === 0 ? `Até ${ptEur(b.limit)}` :
                           b.limit === Infinity ? `Acima de ${ptEur(IRS_BRACKETS_2026[i-1].limit)}` :
                           `${ptEur(IRS_BRACKETS_2026[i-1].limit)} – ${ptEur(b.limit)}`}
                        </td>
                        <td className="px-4 py-2 text-right font-[700] text-[#0677FF]">{(b.rate * 100).toFixed(1)}%</td>
                        <td className="px-4 py-2 text-right font-mono">{ptEur(b.ded)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-[#94A3B8] mt-2 font-[500]">Fonte: OE 2026 (validado maio 2026) • Aplicável a residentes em Portugal Continental</p>
            </div>

            {/* IRS Jovem */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">IRS Jovem — Art. 12.º-B CIRS (OE 2025)</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-[12px] p-4 mb-3">
                <p className="text-[13px] text-blue-900 font-[500] leading-relaxed">
                  Aplica-se a trabalhadores até <strong>35 anos</strong>, nos primeiros 5 anos de atividade profissional. Teto máximo: <strong>5× IAS anual = {ptEur(IAS_2026 * 12 * 5)}</strong> (IAS 2026: {ptEur(IAS_2026)}).
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { ano: '1.º ano', taxa: '100%', desc: 'Isenção total do rendimento coletável' },
                  { ano: '2.º e 3.º anos', taxa: '75%', desc: 'Isenção de 75% do rendimento coletável' },
                  { ano: '4.º e 5.º anos', taxa: '50%', desc: 'Isenção de 50% do rendimento coletável' },
                ].map(({ ano, taxa, desc }) => (
                  <div key={ano} className="bg-[#F5F7FA] border border-[#E2E8F0] rounded-[12px] p-4 text-center">
                    <div className="text-[11px] font-[700] text-[#64748B] uppercase mb-1">{ano}</div>
                    <div className="text-[24px] font-[800] text-blue-600">{taxa}</div>
                    <div className="text-[11px] text-[#64748B] font-[500] mt-1">{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Regime Simplificado */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Regime Simplificado ENI — Art. 31.º CIRS</h3>
              <div className="space-y-2">
                <LegalRow label="Serviços — coeficiente" value="0,75 (rendimento coletável = 75% da faturação)" note="25% é automaticamente deduzido como despesas presumidas" />
                <LegalRow label="Bens — coeficiente" value="0,15 (rendimento coletável = 15% da faturação)" note="85% é automaticamente deduzido como custo de aquisição presumido" />
                <LegalRow label="Regra especial >€27.360 (serviços)" value="Justificação de despesas de 15% da faturação obrigatória" note="Sem justificação, o rendimento coletável é acrescido da diferença" />
              </div>
            </div>

            {/* Dependentes */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Dedução por Dependentes — Art. 78.º-A CIRS</h3>
              <div className="space-y-2">
                <LegalRow label="1.º ao 3.º dependente" value="€600 por dependente (dedução à coleta)" />
                <LegalRow label="A partir do 4.º dependente" value="€900 por dependente adicional" />
                <LegalRow label="Dependente com deficiência" value="€900 por dependente" />
              </div>
              <p className="text-[11px] text-[#94A3B8] mt-2 font-[500]">Dedução à coleta (subtrai diretamente ao imposto calculado, não ao rendimento)</p>
            </div>

            {/* Retenção na Fonte */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Retenção na Fonte — Categoria B</h3>
              <div className="space-y-2">
                <LegalRow label="Serviços profissionais (geral)" value="11,5%" note="Aplicável quando o prestador emite fatura a entidades com contabilidade organizada" />
                <LegalRow label="Direitos de autor" value="16,5%" />
                <LegalRow label="Isenção para novos ENI" value="Primeiro ano: sem retenção obrigatória (Art. 101.º CIRS)" />
              </div>
            </div>
          </div>

          {/* ── Distribuição de Resultados — Salário vs Dividendos ── */}
          <div id="legal-distribuicao" className="mt-10 pt-8 border-t border-[#E2E8F0] scroll-mt-24">
            <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3 uppercase tracking-[0.5px]">Distribuição de Resultados — Salário vs Dividendos</h3>
            <p className="text-[13px] text-[#64748B] font-[500] mb-4 leading-relaxed">
              Numa Lda./Unipessoal, o sócio-gerente pode receber rendimento como salário (Categoria A), distribuição de dividendos (Categoria E) ou misto. A escolha tem impacto significativo em IRS, IRC e SS.
            </p>
            <div className="space-y-2 mb-4">
              <LegalRow label="Salário do sócio-gerente — Cat. A" value="Tributado a escalões IRS (13–48%) + SS 11% trabalhador + 23,75% empresa" note="Custo dedutível em IRC para a empresa (Art. 23.º CIRC)" />
              <LegalRow label="Dividendos — Cat. E" value="Retenção liberatória 28% (Art. 71.º CIRS)" note="Pode optar por englobamento se mais favorável (escalões IRS) — declara-se na Mod. 3" />
              <LegalRow label="Distribuição não dedutível em IRC" value="Os lucros saem após pagamento de IRC (15%/19%) — dupla tributação económica" />
              <LegalRow label="Reinvestimento de lucros" value="Sem tributação adicional até serem distribuídos — favorece capitalização" />
              <LegalRow label="Salário mínimo de gerência (SS)" value="Base de incidência mínima ≥ 1 IAS (€537,13/mês em 2026)" note="Mesmo gerentes não remunerados pagam contribuição mínima sobre 1 IAS" />
              <LegalRow label="Rule of thumb" value="Salário até cobrir necessidades pessoais; restante reinvestir ou distribuir como dividendos" note="Comparação caso a caso depende de IRS marginal, escalão IRC e SS já paga noutros vínculos" />
            </div>
            <div className="space-y-1">
              <Article code="CIRS Art. 71.º, n.º 1" description="Retenção liberatória de 28% sobre dividendos (Cat. E)" />
              <Article code="CIRS Art. 22.º" description="Englobamento opcional de Cat. E — escolha do contribuinte" />
              <Article code="CIRC Art. 23.º" description="Salários como gasto dedutível; dividendos não" />
              <Article code="CSC Art. 217.º e 294.º" description="Distribuição de lucros — Sociedade por Quotas e SA" />
              <Article code="CRCSPSS Art. 56.º" description="Base de incidência mínima dos gerentes — 1 IAS" />
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 2. IRC — IMPOSTO SOBRE O RENDIMENTO DE PESSOAS COLETIVAS   */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="legal-irc" className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0] scroll-mt-24">
          <SectionHeader icon={Scale} title="IRC — Imposto sobre o Rendimento das Empresas (CIRC)" color="#334155" />

          <div className="space-y-6">
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Taxas IRC — Art. 87.º CIRC</h3>
              <div className="space-y-2">
                <LegalRow label="PME — primeiros €50.000" value="15% (taxa reduzida para micro, pequenas e médias empresas)" note="Aplicável a PME conforme Art. 2.º da Recomendação CE 2003/361/CE" />
                <LegalRow label="Acima de €50.000" value="19% (taxa geral)" />
                <LegalRow label="Tributação mínima" value="15% de tributação mínima para empresas com volume de negócios >€2M (OE 2024)" />
              </div>
            </div>

            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Tributação Autónoma (TA) — Art. 88.º CIRC</h3>
              <p className="text-[13px] text-[#64748B] font-[500] mb-3">Incide sobre encargos com viaturas ligeiras de passageiros. Base de cálculo: depreciação + manutenção + seguro + combustível.</p>

              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#0677FF] text-white">
                      <th className="text-left px-4 py-2 rounded-tl-[8px]">Custo Aquisição (s/ IVA)</th>
                      <th className="text-right px-4 py-2">Combustão / Híbrido</th>
                      <th className="text-right px-4 py-2">PHEV Conforme</th>
                      <th className="text-right px-4 py-2 rounded-tr-[8px]">Elétrico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { range: 'Até €37.500', gas: '8%', phev: '2,5%', elec: '0%' },
                      { range: '€37.500 – €45.000', gas: '25%', phev: '7,5%', elec: '0%' },
                      { range: 'Acima de €45.000', gas: '32%', phev: '15%', elec: '0%' },
                      { range: 'Acima de €62.500 (elétrico)', gas: '—', phev: '—', elec: '10%' },
                    ].map(({ range, gas, phev, elec }, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-[#FDF2F2]' : 'bg-white'}>
                        <td className="px-4 py-2 font-[500]">{range}</td>
                        <td className="px-4 py-2 text-right font-[700]">{gas}</td>
                        <td className="px-4 py-2 text-right font-[700] text-amber-700">{phev}</td>
                        <td className="px-4 py-2 text-right font-[700] text-emerald-700">{elec}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-[11px] text-[#94A3B8] font-[500]">PHEV Conforme: autonomia elétrica ≥50 km E emissões CO₂ &lt;50 g/km</p>
                <p className="text-[11px] text-[#94A3B8] font-[500]">Elétrico &gt;€62.500: Lei n.º 82/2023 — taxa de 10% sobre encargos (exceto atividades isentas)</p>
                <p className="text-[11px] text-[#94A3B8] font-[500]">Dispensa de TA: possível com acordo escrito de imputação de custos ao trabalhador (Art. 88.º, n.º 14)</p>
              </div>
            </div>

            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Limites de Depreciação Fiscal (DR 25/2009 + OE 2026)</h3>
              <div className="space-y-2">
                <LegalRow label="Viaturas passageiros (geral)" value={`${ptEur(25000)} por veículo`} note="Taxa de depreciação: 25%/ano. Dep. acima do limite → não aceite fiscalmente" />
                <LegalRow label="Viaturas elétricas" value={`${ptEur(62500)} por veículo`} />
                <LegalRow label="PHEV conforme" value={`${ptEur(50000)} por veículo`} />
                <LegalRow label="GPL / GNV passageiros" value={`${ptEur(37500)} por veículo`} />
                <LegalRow label="Veículos comerciais / isentos" value="Sem limite (100% dedutível)" />
              </div>
            </div>
          </div>

          {/* ── Estrutura Societária — CSC ── */}
          <div id="legal-csc" className="mt-10 pt-8 border-t border-[#E2E8F0] scroll-mt-24">
            <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3 uppercase tracking-[0.5px]">Estrutura Societária — Código das Sociedades Comerciais</h3>
            <p className="text-[13px] text-[#64748B] font-[500] mb-4 leading-relaxed">
              A escolha da forma jurídica condiciona o capital mínimo, a responsabilidade dos sócios, a estrutura de gerência e os requisitos de constituição. Resumo das formas mais comuns para PME em Portugal.
            </p>
            <div className="space-y-2 mb-4">
              <LegalRow label="Sociedade Unipessoal por Quotas (Lda.)" value="1 sócio único, capital livre (mín. €1)" note="CSC Art. 270.º-A. Responsabilidade limitada à quota" />
              <LegalRow label="Sociedade por Quotas (Lda.)" value="2+ sócios, capital livre (mín. €2)" note="CSC Art. 197.º-264.º. Cada sócio responde pela sua quota" />
              <LegalRow label="Sociedade Anónima (SA)" value="5+ acionistas, capital mínimo €50.000" note="CSC Art. 271.º. 30% capital realizado na constituição" />
              <LegalRow label="Empresário em Nome Individual (ENI)" value="Sem capital social — pessoa singular" note="Responsabilidade ilimitada com património pessoal" />
              <LegalRow label="Estabelecimento Individual de Resp. Limitada (EIRL)" value="Capital mínimo €5.000" note="DL 248/86. Património afeto isolado, mas figura em desuso" />
              <LegalRow label="Gerência" value="Lda.: 1+ gerente. SA: Conselho de Administração" note="CSC Art. 252.º (Lda.) e 405.º (SA)" />
              <LegalRow label="Responsabilidade do gerente" value="Subsidiária por dívidas fiscais e SS" note="LGT Art. 24.º — gerente responde se houver culpa funcional na falta de pagamento" />
              <LegalRow label="Pacto social — alterações" value="Escritura/registo comercial obrigatórios" note="Aumento capital, mudança gerência, dissolução: registo predial-comercial" />
              <LegalRow label="Empresa na Hora" value="Constituição em 1 dia (€360 + IRN)" note="DL 111/2005. Estatutos pré-aprovados; pacto social personalizável depois" />
            </div>
            <div className="space-y-1">
              <Article code="CSC (DL 262/86)" description="Código das Sociedades Comerciais — formas jurídicas, capital, gerência, dissolução" />
              <Article code="CSC Art. 197.º a 270.º-G" description="Sociedades por Quotas e Unipessoais" />
              <Article code="CSC Art. 271.º a 464.º" description="Sociedades Anónimas — capital, ações, conselho de administração" />
              <Article code="LGT Art. 24.º" description="Responsabilidade subsidiária dos gerentes por dívidas fiscais" />
              <Article code="DL 111/2005 (Empresa na Hora)" description="Constituição imediata de sociedade com estatutos pré-aprovados" />
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 3. IVA — IMPOSTO SOBRE O VALOR ACRESCENTADO               */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="legal-iva" className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0] scroll-mt-24">
          <SectionHeader icon={Scale} title="IVA — Imposto sobre o Valor Acrescentado (CIVA)" color="#1D4ED8" />

          <div className="space-y-6">
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Taxas de IVA em Portugal Continental</h3>
              <div className="space-y-2">
                <LegalRow label="Taxa normal" value="23%" note="Aplica-se por defeito a todos os bens e serviços" />
                <LegalRow label="Taxa intermédia" value="13%" note="Restauração, vinho, etc." />
                <LegalRow label="Taxa reduzida" value="6%" note="Bens de primeira necessidade, livros, etc." />
              </div>
            </div>

            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Isenção PME — Art. 53.º CIVA</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-[12px] p-4">
                <p className="text-[13px] text-blue-900 font-[500] leading-relaxed">
                  Isenção de IVA para sujeitos passivos com <strong>volume de negócios ≤ €15.000</strong> no ano civil anterior e que <strong>não pratiquem operações de exportação ou intracomunitárias</strong>. A isenção é geralmente recomendada apenas para negócios B2C (consumidores finais não podem deduzir IVA).
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Dedução IVA — Viaturas (Art. 21.º CIVA)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#1D4ED8] text-white">
                      <th className="text-left px-4 py-2 rounded-tl-[8px]">Tipo de Viatura / Combustível</th>
                      <th className="text-right px-4 py-2">IVA Aquisição</th>
                      <th className="text-right px-4 py-2">IVA Manutenção</th>
                      <th className="text-right px-4 py-2 rounded-tr-[8px]">IVA Combustível</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { tipo: 'Elétrico (passageiros, ≤€62.500)', aq: '100%', mant: '0%', comb: '100%' },
                      { tipo: 'PHEV conforme (passageiros, ≤€50.000)', aq: '100%', mant: '0%', comb: '0%' },
                      { tipo: 'Gasóleo (passageiros)', aq: '50%', mant: '0%', comb: '50%' },
                      { tipo: 'GPL / GNV (passageiros, ≤€37.500)', aq: '50%', mant: '0%', comb: '50%' },
                      { tipo: 'Gasolina / Híbrido não plug-in', aq: '0%', mant: '0%', comb: '0%' },
                      { tipo: 'Comercial (2/3 lugares)', aq: '100%', mant: '100%', comb: '100%' },
                      { tipo: 'Atividades isentas (táxi, TVDE, rent-a-car, esc. condução)', aq: '100%', mant: '100%', comb: '100%' },
                    ].map(({ tipo, aq, mant, comb }, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-[#EFF6FF]' : 'bg-white'}>
                        <td className="px-4 py-2 font-[500]">{tipo}</td>
                        <td className={`px-4 py-2 text-right font-[700] ${aq === '100%' ? 'text-emerald-600' : aq === '0%' ? 'text-red-500' : 'text-amber-600'}`}>{aq}</td>
                        <td className={`px-4 py-2 text-right font-[700] ${mant === '100%' ? 'text-emerald-600' : mant === '0%' ? 'text-red-500' : 'text-amber-600'}`}>{mant}</td>
                        <td className={`px-4 py-2 text-right font-[700] ${comb === '100%' ? 'text-emerald-600' : comb === '0%' ? 'text-red-500' : 'text-amber-600'}`}>{comb}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-[#94A3B8] mt-2 font-[500]">O seguro automóvel está isento de IVA em Portugal (sujeito a Imposto de Selo) — dedução de IVA = 0% por natureza.</p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 4. SEGURANÇA SOCIAL                                        */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="legal-ss" className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0] scroll-mt-24">
          <SectionHeader icon={Shield} title="Segurança Social (SS)" color="#059669" />

          <div className="space-y-6">
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">TSU — Trabalhadores por Conta de Outrem (TCO)</h3>
              <div className="space-y-2">
                <LegalRow label="Contribuição patronal (empresa)" value="23,75% sobre remuneração ilíquida" />
                <LegalRow label="Contribuição do trabalhador" value="11% sobre remuneração ilíquida" />
                <LegalRow label="Base de incidência" value="Todas as remunerações, incluindo subsídios de férias e Natal (14 meses)" />
              </div>
            </div>

            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">SS Independente — CRCSPSS Art. 162.º e ss.</h3>
              <div className="space-y-2">
                <LegalRow label="Taxa de contribuição 2026" value="21,4% sobre rendimento relevante" />
                <LegalRow label="Base — Prestação de Serviços" value="70% do rendimento mensal declarado" note="Efetivo: 14,98% do rendimento bruto" />
                <LegalRow label="Base — Venda de Bens" value="20% do rendimento mensal declarado" note="Efetivo: 4,28% do rendimento bruto" />
                <LegalRow label="Mínimo de contribuição" value={`€20,00/mês (se rendimento > IAS — ${ptEur(IAS_2026)})`} />
                <LegalRow label="Pagamento" value="Trimestral — até dia 20 de jan, abr, jul e out" />
                <LegalRow label="Isenção 1.º ano" value="Total — Art. 164.º CRCSPSS" note="Aplica-se a novos inscritos como TI. Isenção durante 12 meses." />
                <LegalRow label="Isenção TCO secundário" value="Se rendimento ≤€20.000 e atividade não é principal: isenção de SS como TI" />
              </div>
            </div>

            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Cálculo Trimestral na Prática</h3>
              <div className="bg-[#F0FDF4] border border-emerald-200 rounded-[12px] p-4">
                <p className="text-[13px] text-emerald-900 font-[500] leading-relaxed">
                  A SS calcula o <strong>rendimento relevante trimestral</strong> com base nos rendimentos do trimestre anterior (declarados na plataforma da Segurança Social Direta). A contribuição trimestral = rendimento médio mensal do trimestre anterior × base (70% ou 20%) × 21,4% × 3 meses.
                </p>
              </div>
            </div>
          </div>

          {/* ── Dívidas Fiscais & SS — planos prestacionais ── */}
          <div id="legal-dividas" className="mt-10 pt-8 border-t border-[#E2E8F0] scroll-mt-24">
            <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3 uppercase tracking-[0.5px]">Dívidas Fiscais & SS — Planos Prestacionais e Execuções</h3>
            <p className="text-[13px] text-[#64748B] font-[500] mb-4 leading-relaxed">
              Existindo dívidas à AT ou à SS, é possível requerer planos prestacionais que evitam ou suspendem execuções fiscais. Conhecer os limites legais é essencial para o diagnóstico de viabilidade do cliente.
            </p>
            <div className="space-y-2 mb-4">
              <LegalRow label="Plano prestacional AT — até €5.000 (s/garantia)" value="Até 12 prestações mensais" note="LGT Art. 196.º + DL 492/88. Pedido online via Portal Finanças" />
              <LegalRow label="Plano prestacional AT — €5.000 a €50.000" value="Até 36 prestações com garantia" note="Garantia bancária, hipoteca ou penhor" />
              <LegalRow label="Plano prestacional AT — > €50.000" value="Até 60 prestações + garantia + dispensa pode exigir comprovativo de dificuldade" />
              <LegalRow label="Plano prestacional SS" value="Até 150 prestações para valores elevados" note="DL 42/2001 + Portaria 200/2018. Pedido na Segurança Social Direta" />
              <LegalRow label="Juros de mora" value="Taxa legal definida anualmente (4,705% em 2026)" note="Aviso BdP — Aviso 2/2025 sobre taxas legais" />
              <LegalRow label="Suspensão da execução" value="Plano deferido suspende processo executivo" note="Cumprimento estrito é obrigatório — falta = caducidade do plano" />
              <LegalRow label="Certidão de dívida vs não dívida" value="Dívida em plano cumprido = situação regularizada" note="Permite candidaturas a apoios PT2030, contratação pública, etc." />
              <LegalRow label="Dívidas à SS bloqueiam apoios" value="Sem regularização: sem subsídios, sem apoios PT2030, sem contratos públicos" />
              <LegalRow label="Insolvência / PER / RERE" value="Mecanismos quando não é viável plano com a AT/SS" note="CIRE — Código da Insolvência e Recuperação de Empresas" />
            </div>
            <div className="space-y-1">
              <Article code="LGT Art. 196.º" description="Pagamento em prestações de dívidas tributárias — competência e limites" />
              <Article code="DL 492/88" description="Regime do pagamento em prestações de dívidas à AT" />
              <Article code="DL 42/2001" description="Regime executivo da Segurança Social — planos prestacionais" />
              <Article code="Portaria 200/2018" description="Atualização do regime de prestações da SS — até 150 prestações" />
              <Article code="CIRE (DL 53/2004)" description="Código da Insolvência e Recuperação de Empresas — PER, RERE, insolvência" />
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 5. TICKETS DE REFEIÇÃO                                     */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="legal-tickets" className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0] scroll-mt-24">
          <SectionHeader icon={Ticket} title="Tickets / Benefícios Laborais" color="#7C3AED" />

          <div className="space-y-8">
            <p className="text-[13px] text-[#64748B] font-[500] leading-relaxed">
              Os tickets da Ticket.pt são instrumentos de política remuneratória com tratamento fiscal privilegiado — isentos de IRS e SS para o trabalhador e dedutíveis (ou majorados) em IRC para a empresa. Base legal: DL n.º 162/2014 · Código Contributivo Art. 46.º · CIRC Art. 43.º
            </p>

            {/* Resumo comparativo */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Resumo Comparativo — Todos os Tipos</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-[#7C3AED] text-white">
                      <th className="text-left px-3 py-2 rounded-tl-[8px]">Produto</th>
                      <th className="text-center px-3 py-2">Isento IRS</th>
                      <th className="text-center px-3 py-2">Isento SS</th>
                      <th className="text-right px-3 py-2 rounded-tr-[8px]">IRC Dedutível</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { nome: 'Ticket Restaurant® — cartão eletrónico', irs: '✓ até €10,46/dia', ss: '✓ até €10,46/dia', irc: '60%', ok: true },
                      { nome: 'Ticket Infância®', irs: '✓ Isento total', ss: '✓ Isento total', irc: '140% (majoração 40%)', ok: true },
                      { nome: 'Ticket Educação®', irs: '✓ Isento total', ss: '✓ Isento total', irc: '100%', ok: true },
                      { nome: 'Ticket Saúde®', irs: '✓ Isento total', ss: '✓ Isento total', irc: '100%', ok: true },
                      { nome: 'Ticket Oferta®', irs: '✗ Não isento', ss: '✗ Não isento', irc: '0,5% VN (clientes)', ok: false },
                      { nome: 'Ticket Car®', irs: '✗ Não isento', ss: '✗ Não isento', irc: '100% + IVA recuperável', ok: false },
                    ].map(({ nome, irs, ss, irc, ok }, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-[#F5F3FF]' : 'bg-white'}>
                        <td className="px-3 py-2 font-[500]">{nome}</td>
                        <td className={`px-3 py-2 text-center font-[600] ${ok ? 'text-emerald-700' : 'text-red-600'}`}>{irs}</td>
                        <td className={`px-3 py-2 text-center font-[600] ${ok ? 'text-emerald-700' : 'text-red-600'}`}>{ss}</td>
                        <td className="px-3 py-2 text-right font-[700]">{irc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ticket Restaurant */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Ticket Restaurant® — Subsídio de Refeição</h3>
              <div className="space-y-2">
                <LegalRow label="Cartão eletrónico — limite isento" value="€10,46/dia útil" note="Despacho 233-A/2026 — suporte eletrónico (cartão refeição)" />
                <LegalRow label="Dinheiro / transferência — limite isento" value="€6,15/dia útil" note="Despacho 233-A/2026" />
                <LegalRow label="Isenção IRS e SS (trabalhador)" value="Total — até ao limite legal da modalidade" note="Excedente: sujeito a IRS e SS como remuneração normal" />
                <LegalRow label="Isenção SS patronal (empresa)" value="Não há SS sobre o valor dentro do limite — poupança de 23,75%" note="Código Contributivo Art. 46.º n.º 1 e)" />
                <LegalRow label="Dedutibilidade IRC" value="60% do custo total dos tickets" note="CIRC Art. 43.º n.º 2 — limitação específica (vs. 100% para salário)" />
              </div>
            </div>

            {/* Ticket Infância */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Ticket Infância® — Educação Pré-Escolar</h3>
              <div className="space-y-2">
                <LegalRow label="Âmbito" value="Encargos com creche e jardim de infância — crianças até 7 anos de idade" />
                <LegalRow label="Isenção IRS" value="Total — sem limite de valor" note="CIRS Art. 24.º — encargos suportados pela entidade patronal com educação pré-escolar" />
                <LegalRow label="Isenção SS (patronal + trabalhador)" value="Total — sem limite de valor" note="Código Contributivo Art. 46.º n.º 1" />
                <LegalRow label="Dedutibilidade IRC" value="140% do custo — majoração de 40% sobre o custo real" note="CIRC Art. 43.º n.º 9 — creches, lactários e jardins de infância" />
                <LegalRow label="Limite de valor" value="Sem limite específico definido na lei" note="O montante deve ser razoável, documentado e acessível a todos os trabalhadores" />
              </div>
            </div>

            {/* Ticket Educação */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Ticket Educação® — Ensino e Formação</h3>
              <div className="space-y-2">
                <LegalRow label="Âmbito" value="Ensino privado e público, livros, manuais, material escolar e centros de explicações — todos os graus de ensino" />
                <LegalRow label="Isenção IRS" value="Total — sem limite de valor ou de idade" note="CIRS Art. 24.º" />
                <LegalRow label="Isenção SS (patronal + trabalhador)" value="Total" note="Código Contributivo Art. 46.º" />
                <LegalRow label="Dedutibilidade IRC" value="100% — gasto dedutível normal" note="CIRC Art. 43.º n.º 1" />
              </div>
            </div>

            {/* Ticket Saúde */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Ticket Saúde® — Saúde e Bem-estar</h3>
              <div className="space-y-2">
                <LegalRow label="Âmbito" value="Consultas, medicamentos, fisioterapia, internamento em lares, centros de dia e apoio domiciliário — trabalhadores e familiares" />
                <LegalRow label="Isenção IRS" value="Total — sem limite de valor" note="CIRS Art. 24.º n.º 1 b) — encargos de assistência médica e medicamentosa" />
                <LegalRow label="Isenção SS (patronal + trabalhador)" value="Total" note="Código Contributivo Art. 46.º" />
                <LegalRow label="Dedutibilidade IRC" value="100% — realização de utilidade social" note="CIRC Art. 43.º n.º 1" />
                <LegalRow label="Requisito" value="Deve ser extensível a todos os trabalhadores ou a categorias homogéneas" />
              </div>
            </div>

            {/* Ticket Oferta */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Ticket Oferta® — Vale Prenda</h3>
              <div className="space-y-2">
                <LegalRow label="IRS (trabalhadores)" value="Sujeito — tratado como remuneração em espécie" note="CIRS Art. 2.º n.º 3 b) — não existe isenção específica para vales prenda a trabalhadores" />
                <LegalRow label="SS (trabalhadores)" value="Sujeito — base de incidência normal" />
                <LegalRow label="IRC (para clientes / parceiros de negócio)" value="Gasto de representação — dedutível até 0,5% do volume de negócios" note="CIRC Art. 23.º-A n.º 1 h)" />
                <LegalRow label="Uso recomendado" value="Prémios de Natal, campanhas de fidelização, reconhecimento pontual" note="Ferramenta de gestão de ofertas — sem benefício fiscal próprio" />
              </div>
            </div>

            {/* Ticket Car */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Ticket Car® — Gestão de Frota</h3>
              <div className="space-y-2">
                <LegalRow label="Âmbito" value="Combustível e despesas de assistência automóvel nas viaturas da empresa — aceite em +1.800 postos. Vales de €5, €10 e €15." />
                <LegalRow label="Isenção IRS" value="Não existe — gasto de viatura não isento para o trabalhador" note="CIRS Art. 2.º n.º 3 b) — remuneração em espécie sujeita a IRS se não for viatura da empresa" />
                <LegalRow label="Isenção SS" value="Não existe — incide contribuição normal" />
                <LegalRow label="Dedutibilidade IRC" value="100% dedutível como gasto com viaturas" note="CIRC Art. 23.º n.º 1 h) — gastos suportados com viaturas afetas à atividade" />
                <LegalRow label="IVA — Ligeiros de passageiros" value="0% de IVA dedutível em combustível e manutenção" note="CIVA Art. 21.º n.º 1 a) — exclusão total de viaturas de passageiros" />
                <LegalRow label="IVA — Ligeiros mistos / pick-up" value="50% de IVA dedutível" note="CIVA Art. 21.º n.º 2 — dedução parcial para veículos de uso misto" />
                <LegalRow label="IVA — Viaturas comerciais / mercadorias" value="100% de IVA dedutível" note="CIVA Art. 21.º — viaturas exclusivamente afetas à atividade" />
                <LegalRow label="Tributação Autónoma (TA)" value="Pode aplicar-se sobre as despesas com viaturas — taxa varia conforme o custo de aquisição e o ano" note="CIRC Art. 88.º n.º 3 — taxa de 10%, 27,5% ou 35% consoante o valor de aquisição da viatura" />
              </div>
            </div>

            {/* Poupança estimada */}
            <div className="bg-purple-50 border border-purple-200 rounded-[12px] p-5">
              <h4 className="text-[13px] font-[700] text-purple-900 mb-2">Poupança estimada: Ticket isento vs. Equivalente Salarial</h4>
              <p className="text-[13px] text-purple-800 font-[500] leading-relaxed">
                Ao atribuir um ticket isento (Infância, Educação ou Saúde) em vez de aumentar o salário, a empresa poupa 23,75% em SS patronal e o trabalhador retém 11% adicional (sem desconto de SS). Para um ticket de €3.600/ano/trabalhador, a poupança conjunta em SS é ≈ €1.250/trabalhador/ano — sem contar com o benefício adicional em IRC para o Ticket Infância (majoração de 40%).
              </p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 6. IMT — IMPOSTO MUNICIPAL SOBRE TRANSMISSÕES              */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="legal-imt" className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0] scroll-mt-24">
          <SectionHeader icon={Building} title="IMT — Imposto Municipal sobre Transmissões (CIMT)" color="#7C3AED" />

          <div className="space-y-6">
            <p className="text-[13px] text-[#64748B] font-[500] leading-relaxed">
              O IMT incide sobre a transmissão onerosa de imóveis situados em Portugal. As taxas e limites abaixo aplicam-se ao Continente (Madeira e Açores têm thresholds 25% superiores).
            </p>

            {/* Tabela HPP */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Habitação Própria e Permanente (HPP) — Continente 2026</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-[#7C3AED] text-white">
                      <th className="text-left px-4 py-2 rounded-tl-[8px]">Valor de Aquisição</th>
                      <th className="text-right px-4 py-2">Taxa Marginal</th>
                      <th className="text-right px-4 py-2 rounded-tr-[8px]">Parcela a Abater</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { range: 'Até €106.346', taxa: '0%', ded: '—' },
                      { range: '€106.346 – €145.470', taxa: '2%', ded: '€2.126,92' },
                      { range: '€145.470 – €198.347', taxa: '5%', ded: '€6.491,02' },
                      { range: '€198.347 – €330.539', taxa: '7%', ded: '€10.457,96' },
                      { range: '€330.539 – €660.982', taxa: '8%', ded: '€13.763,35' },
                      { range: '€660.982 – €1.150.853', taxa: '6% (plana)', ded: '—' },
                      { range: 'Acima de €1.150.853', taxa: '7,5% (plana)', ded: '—' },
                    ].map(({ range, taxa, ded }, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-[#F5F3FF]' : 'bg-white'}>
                        <td className="px-4 py-2 font-[500]">{range}</td>
                        <td className="px-4 py-2 text-right font-[700] text-[#7C3AED]">{taxa}</td>
                        <td className="px-4 py-2 text-right font-mono">{ded}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Outras taxas */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Outras Taxas IMT — CIMT Art. 17.º</h3>
              <div className="space-y-2">
                <LegalRow label="Habitação secundária / arrendamento" value="Escalões progressivos (1% a 7,5%)" note="Thresholds inferiores aos da HPP. Tabela própria no CIMT." />
                <LegalRow label="Prédios urbanos — outros fins" value="6,5% (taxa plana)" note="Comércio, serviços, indústria, armazéns" />
                <LegalRow label="Prédios rústicos" value="5% (taxa plana)" />
                <LegalRow label="Madeira e Açores" value="Thresholds 25% superiores ao Continente" />
              </div>
            </div>

            {/* IMT Jovem */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">IMT Jovem — CIMT Art. 11.º-A (OE 2026)</h3>
              <div className="bg-purple-50 border border-purple-200 rounded-[12px] p-4 mb-4">
                <p className="text-[13px] text-purple-900 font-[500] leading-relaxed">
                  <strong>Condições:</strong> Comprador com idade ≤ 35 anos, aquisição de HPP como primeira habitação.
                </p>
              </div>
              <div className="space-y-2">
                <LegalRow label="Até €330.539 (Continente)" value="IMT = 0 e Imposto de Selo = 0 (isenção total)" note="Medida introduzida pelo OE 2026 para facilitar acesso à habitação" />
                <LegalRow label="€330.539 – €660.982" value="IMT sobre excedente acima de €330.539" note="Cálculo: IMT_normal(valor) - IMT_normal(330.539); IS também isento" />
                <LegalRow label="Acima de €660.982" value="IMT e IS normais (sem isenção jovem)" />
              </div>
            </div>

            {/* Imposto de Selo */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Imposto de Selo — TGIS Verba 1.1</h3>
              <div className="space-y-2">
                <LegalRow label="Taxa" value="0,8% sobre o valor de transação" note="Incide sobre aquisições onerosas de imóveis. Pago pelo adquirente." />
                <LegalRow label="IMT Jovem" value="Isento até ao tecto da isenção total (€330.539)" />
                <LegalRow label="Hipotecas" value="0,6% sobre o capital mutuado (verba 17.3 TGIS)" />
              </div>
            </div>

            {/* Outros custos */}
            <div className="bg-[#F5F7FA] border border-[#E2E8F0] rounded-[12px] p-4">
              <h4 className="text-[13px] font-[700] text-[#0F172A] mb-2">Outros Custos de Aquisição (estimativas)</h4>
              <div className="space-y-1 text-[12px] text-[#64748B]">
                <div>• Escritura notarial: ~0,5% do valor de transação</div>
                <div>• Registo predial: ~0,25% do valor de transação</div>
                <div>• IMI (imposto anual): 0,3%–0,8% do VPT (Valor Patrimonial Tributário)</div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 7. SALÁRIO LÍQUIDO — TCO                                   */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="legal-salario" className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0] scroll-mt-24">
          <SectionHeader icon={Banknote} title="Salário Líquido — Trabalhador por Conta de Outrem" color="#0369A1" />

          <div className="space-y-6">
            <p className="text-[13px] text-[#64748B] font-[500] leading-relaxed">
              Cálculo do salário líquido para TCO, com descontos de SS, retenção de IRS e subsídio de alimentação. Base legal: CIRS Art. 99.º (retenção) e CRCSPSS Art. 53.º (SS).
            </p>

            {/* SS TCO */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Segurança Social — Taxas TCO (CRCSPSS Art. 53.º)</h3>
              <div className="space-y-2">
                <LegalRow label="Taxa do trabalhador" value="11% sobre remuneração ilíquida" />
                <LegalRow label="Taxa patronal (empresa — lucrativa)" value="23,75% sobre remuneração ilíquida" />
                <LegalRow label="Taxa patronal (entidade sem fins lucrativos)" value="22,3% sobre remuneração ilíquida" note="IPSS, Misericórdias, associações sem fins lucrativos" />
                <LegalRow label="Custo total" value="34,75% por mês (trabalhador + empresa lucrativa)" />
                <LegalRow label="Base de incidência" value="Todas as remunerações, exceto ajudas de custo, despesas de deslocação e subsídio de alimentação isento" />
              </div>
            </div>

            {/* Dedução específica */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Retenção na Fonte IRS — CIRS Art. 99.º</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-[12px] p-4 mb-3">
                <p className="text-[13px] text-blue-900 font-[500] leading-relaxed">
                  A retenção aproxima-se do IRS anual estimado / nº de pagamentos anuais. Fórmula simplificada utilizada no simulador (via escalões progressivos 2026).
                </p>
              </div>
              <div className="space-y-2">
                <LegalRow label="Dedução específica Cat. A — CIRS Art. 25.º" value="Maior de: €4.104 ou 72% do rendimento anual bruto" note="Subtrai ao rendimento bruto para determinar o rendimento coletável" />
                <LegalRow label="Nº de pagamentos (sem duodécimos)" value="14 pagamentos (12 × ordenado + sub. férias + sub. Natal)" />
                <LegalRow label="Nº de pagamentos (com duodécimos)" value="12 pagamentos (subsídios distribuídos mensalmente)" />
              </div>
            </div>

            {/* Subsídio alimentação */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Subsídio de Alimentação — DL 133/2024 / Despacho 233-A/2026</h3>
              <div className="space-y-2">
                <LegalRow label="Limite isento — dinheiro" value="€6,15/dia" note="Atualizado pelo Despacho 233-A/2026 (vigorou a partir de 1 jan 2026)" />
                <LegalRow label="Limite isento — cartão/vale refeição" value="€10,46/dia" note="Pagamento em suporte eletrónico (cartão refeição) tem limite superior" />
                <LegalRow label="Excedente ao limite" value="Tributável em IRS e sujeito a SS (para o trabalhador)" />
                <LegalRow label="Para a empresa" value="Custo dedutível em IRC (CIRC Art. 23.º)" note="Parte dentro do limite: não sujeita a SS patronal" />
              </div>
            </div>

            {/* Encargos obrigatórios do empregador */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Outros Encargos Obrigatórios do Empregador</h3>
              <div className="space-y-2">
                <LegalRow label="Seguro de Acidentes de Trabalho" value="~1% da remuneração (média)" note="Obrigatório por lei (Lei n.º 98/2009). Taxa varia por atividade e risco." />
                <LegalRow label="FGCT — Fundo de Garantia de Compensação do Trabalho" value="0,075% da retribuição base" note="DL 115/2023. Atualmente em suspensão de pagamento durante o Acordo de Médio Prazo." />
                <LegalRow label="Formação profissional" value="Mínimo 40 horas/ano por trabalhador" note="Código do Trabalho Art. 131.º — obrigação formativa do empregador" />
              </div>
            </div>

            {/* SMN */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Salário Mínimo Nacional 2026</h3>
              <div className="space-y-2">
                <LegalRow label="SMN 2026" value="€920/mês" note="DL n.º 139/2025, de 29 de dezembro 2025" />
                <LegalRow label="SMN anual (14 meses)" value="€12.880" />
                <LegalRow label="Custo empresa SMN" value="~€1.138,50/mês (SMN + 23,75% SS patronal)" />
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* 8. IMÓVEIS NA EMPRESA                                      */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="legal-imoveis" className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0] scroll-mt-24">
          <SectionHeader icon={Home} title="Imóveis na Empresa — Enquadramento Fiscal" color="#065F46" />

          <div className="space-y-6">
            <p className="text-[13px] text-[#64748B] font-[500] leading-relaxed">
              A decisão de colocar um imóvel em nome da empresa (entrada em espécie) ou mantê-lo em nome pessoal e arrendar/ceder à empresa tem implicações fiscais significativas. Resumem-se abaixo os principais pontos legais.
            </p>

            {/* Arrendamento */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Arrendamento / Comodato — Regime Fiscal</h3>
              <div className="space-y-2">
                <LegalRow label="IRS — Categoria F (rendas)" value="Taxa de 28% sobre rendas recebidas" note="CIRS Art. 8.º — opção de englobamento pode ser mais favorável em escalões baixos" />
                <LegalRow label="Isenção de IVA sobre rendas" value="Rendas de imóveis isentas de IVA por natureza (CIVA Art. 9.º, n.º 29)" />
                <LegalRow label="IMI" value="Continua em nome do titular (não há transmissão)" />
                <LegalRow label="Comodato" value="Cedência gratuita. Sem IRS na esfera do sócio, mas a empresa não pode deduzir renda" note="Diferente do arrendamento oneroso. A AT pode contestar subavaliações." />
                <LegalRow label="Gasto dedutível na empresa" value="Sim, se arrendamento oneroso (Art. 23.º CIRC)" note="A renda paga é custo fiscal da empresa" />
              </div>
            </div>

            {/* Entrada em Espécie */}
            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Entrada em Espécie — Regime Fiscal</h3>
              <div className="space-y-2">
                <LegalRow label="IMT" value="Aplicável — taxa depende do tipo de imóvel (ver secção IMT)" note="Base de incidência: maior entre valor de transação e VPT (CIMT Art. 12.º)" />
                <LegalRow label="Imposto de Selo" value="0,8% sobre o valor de transação (TGIS verba 1.1)" />
                <LegalRow label="Escritura notarial" value="Obrigatória — honorários ~0,5-1% do valor" />
                <LegalRow label="IVA na transmissão" value="Geralmente isento — imóveis usados (CIVA Art. 9.º, n.º 30)" note="Exceto imóveis novos ou reabilitados — sujeitos a IVA 23%" />
                <LegalRow label="Depreciação fiscal" value="2%/ano sobre valor de aquisição (DR 25/2009)" note="CIRC Art. 31.º — imóveis afetos à atividade podem ser depreciados fiscalmente" />
                <LegalRow label="Mais-valias na venda futura" value="IRC sobre mais-valia (valor venda - valor líquido contabilístico)" note="Reinvestimento pode beneficiar de exclusão tributária — CIRC Art. 48.º" />
                <LegalRow label="Reavaliação IMI" value="Transmissão implica reavaliação do VPT. Taxa IMI sobre novo VPT." />
              </div>
            </div>

            {/* ENI específico */}
            <div className="bg-amber-50 border border-amber-200 rounded-[12px] p-4">
              <h4 className="text-[13px] font-[700] text-amber-900 mb-2">ENI — Afetação do Imóvel à Atividade</h4>
              <p className="text-[13px] text-amber-800 font-[500] leading-relaxed mb-2">
                Para ENIs (Categoria B), a afetação parcial de um imóvel à atividade (ex: home office) é possível mas mais complexa:
              </p>
              <div className="space-y-1 text-[12px] text-amber-700">
                <div>• Dedução da proporção das despesas (percentagem afeta à atividade)</div>
                <div>• Não há "transmissão" — apenas afetação contabilística</div>
                <div>• Desafetação posterior pode implicar tributação de mais-valias latentes</div>
                <div>• CIRS Art. 3.º, n.º 2, alínea d) — afetação de bens a atividade</div>
              </div>
            </div>

            <div>
              <h3 className="text-[14px] font-[800] text-[#0F172A] mb-3">Artigos de Referência</h3>
              <div className="space-y-1">
                <Article code="CIRS Art. 8.º" description="Rendimentos da categoria F — rendas e arrendamento" />
                <Article code="CIVA Art. 9.º, n.º 29-30" description="Isenção de IVA em operações imobiliárias" />
                <Article code="CIRC Art. 23.º" description="Gastos dedutíveis — incluindo rendas pagas pela empresa" />
                <Article code="CIRC Art. 29.º e 31.º" description="Depreciações e amortizações fiscais de imóveis" />
                <Article code="CIRC Art. 48.º" description="Exclusão de tributação de mais-valias por reinvestimento" />
                <Article code="CIMT Art. 12.º" description="Base tributável IMT — maior de VPT vs valor de contrato" />
                <Article code="DR 25/2009" description="Taxas de depreciação — imóveis afetos à atividade: 2%/ano" />
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* REFERÊNCIAS LEGISLATIVAS COMPLETAS                         */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="legal-indice" className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0] scroll-mt-24">
          <SectionHeader icon={BookOpen} title="Índice de Referências Legislativas" color="#475569" />

          <div className="space-y-1">
            <Article code="CIRS Art. 12.º-B" description="IRS Jovem — Isenção progressiva para trabalhadores ≤35 anos nos primeiros 10 anos de atividade (100% / 75% anos 2-4 / 50% anos 5-7 / 25% anos 8-10), teto 55×IAS = €29.542,15" />
            <Article code="CIRS Art. 28.º" description="Categorias de rendimento de atividade empresarial e profissional (Categoria B)" />
            <Article code="CIRS Art. 31.º" description="Regime Simplificado — coeficientes de 0,15 (bens) e 0,75 (serviços)" />
            <Article code="CIRS Art. 68.º" description="Taxas gerais de IRS 2026 — 9 escalões progressivos de 12,5% a 48% (Lei n.º 73-A/2025)" />
            <Article code="CIRS Art. 78.º-A" description="Dedução por dependentes — €600 (>3 anos) / €726 (1.º filho ≤3 anos) / €900 (2.º+ filho ≤3 anos)" />
            <Article code="Lei n.º 73-A/2025" description="Orçamento do Estado 2026 — atualiza escalões IRS em 3,51% e reduz taxas marginais 1.º a 5.º escalões" />
            <Article code="Lei n.º 55-A/2025" description="Alteração ao Art. 68.º CIRS — redução das taxas marginais aprovada em Julho 2025" />
            <Article code="Lei n.º 45-A/2024" description="OE 2025 — alargamento do IRS Jovem para 10 anos com escalões 100/75/50/25%" />
            <Article code="CIRS Art. 101.º" description="Retenção na fonte — Categoria B: 11,5% para serviços profissionais" />
            <Article code="CIRC Art. 87.º" description="Taxas de IRC: 15% (PME, primeiros €50k) / 19% (geral)" />
            <Article code="CIRC Art. 88.º, n.º 3" description="Tributação autónoma sobre encargos com viaturas ligeiras de passageiros" />
            <Article code="CIRC Art. 43.º" description="Dedutibilidade de encargos com vales de refeição: 60% do custo" />
            <Article code="CIVA Art. 21.º" description="Exclusões do direito à dedução de IVA — viaturas e combustíveis" />
            <Article code="CIVA Art. 53.º" description="Regime especial de isenção para PME com volume de negócios ≤€15.000" />
            <Article code="DR 25/2009" description="Tabelas de depreciações e amortizações fiscais" />
            <Article code="DL 110/2009" description="Código dos Regimes Contributivos do Sistema Previdencial (CRCSPSS)" />
            <Article code="CRCSPSS Art. 162.º" description="Base de incidência da SS para trabalhadores independentes" />
            <Article code="CRCSPSS Art. 164.º" description="Isenção de contribuições no 1.º ano de atividade independente" />
            <Article code="EBF Art. 18.º-A" description="Isenção de SS e IRS para vales de refeição até ao limite legal" />
            <Article code="DL 133/2024" description="Base legal do subsídio de alimentação — valores isentos atualizados anualmente por despacho do Governo" />
            <Article code="Lei n.º 82/2023" description="Tributação autónoma de 10% para viaturas elétricas com custo >€62.500" />
            <Article code="OE 2026" description="Orçamento do Estado para 2026 — referência principal para todos os valores desta ferramenta" />
            <Article code="CIMT Art. 11.º-A" description="IMT Jovem — isenção total de IMT e IS para compradores ≤35 anos na 1.ª habitação até €330.539 (Continente)" />
            <Article code="CIMT Art. 17.º" description="Tabela de taxas IMT — HPP, habitação secundária, prédios urbanos e rústicos" />
            <Article code="TGIS Verba 1.1" description="Imposto de Selo sobre transmissões de imóveis — 0,8% sobre o valor de aquisição" />
            <Article code="CRCSPSS Art. 53.º" description="Taxas de SS TCO: 11% (trabalhador) + 23,75% (patronal lucrativa) / 22,3% (patronal não lucrativa)" />
            <Article code="CIRS Art. 25.º" description="Dedução específica Categoria A — mínimo €4.104 ou 72% do rendimento bruto anual" />
            <Article code="Despacho 233-A/2026" description="Limites do subsídio de alimentação 2026: €6,15/dia (dinheiro), €10,46/dia (cartão)" />
            <Article code="DL n.º 139/2025" description="Salário Mínimo Nacional 2026: €920/mês" />
            <Article code="Portaria 480-A/2025" description="IAS 2026: €537,13" />
            <Article code="Lei n.º 98/2009" description="Seguro obrigatório de acidentes de trabalho" />
            <Article code="DL 115/2023" description="FGCT — Fundo de Garantia de Compensação do Trabalho (taxa 0,075%)" />
            <Article code="CIRS Art. 8.º" description="Rendimentos da Categoria F — rendas e arrendamento de imóveis" />
            <Article code="CIRC Art. 31.º" description="Depreciações de imóveis afetos à atividade empresarial — taxa de 2%/ano" />
            <Article code="DR 25/2009" description="Tabelas de depreciações — imóveis afetos à atividade" />
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* FONTES WEB CONSULTADAS — RASTREABILIDADE                   */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <section id="legal-fontes" className="bg-white rounded-[24px] p-8 shadow-sm border border-[#E2E8F0] scroll-mt-24">
          <SectionHeader icon={BookOpen} title="Fontes Web Consultadas (validação OE 2026)" color="#475569" />
          <p className="text-[13px] text-[#475569] mb-5 leading-relaxed">
            Os valores fiscais hardcoded nos simuladores foram cruzados com as fontes abaixo (Maio 2026). Antes de produção, validar contra a publicação oficial no <a href="https://info.portaldasfinancas.gov.pt" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">Portal das Finanças</a> e no <a href="https://dre.pt" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">Diário da República (dre.pt)</a>.
          </p>

          <div className="space-y-5">
            <div>
              <h3 className="text-[13px] font-[800] uppercase tracking-[1px] text-[#0F172A] mb-2">Fontes oficiais</h3>
              <ul className="space-y-1.5 text-[13px] text-[#1E293B]">
                <li>• <a href="https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cirs_rep/Pages/irs68.aspx" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">Portal das Finanças — Art. 68.º CIRS (escalões IRS)</a></li>
                <li>• <a href="https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/CIRC_2R/Pages/irc88.aspx" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">Portal das Finanças — Art. 88.º CIRC (Tributação Autónoma viaturas)</a></li>
                <li>• <a href="https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/cimt/Pages/cimt17.aspx" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">Portal das Finanças — Art. 17.º CIMT (escalões IMT)</a></li>
                <li>• <a href="https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/questoes_frequentes/Pages/faqs-00053.aspx" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">Portal das Finanças — FAQ IRS Jovem</a></li>
                <li>• <a href="https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/legislacao/Despachos_SEAF/Documents/Despacho-SEAF-2026-01-05-XXV.pdf" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">Despacho SEAF 2026 — Tabelas de Retenção na Fonte (Janeiro 2026)</a></li>
                <li>• <a href="https://www.oe.gov.pt/" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">Orçamento do Estado 2026 — Portal oficial do Governo</a></li>
                <li>• <a href="https://at.madeira.gov.pt/Ficheiros/NL/AFJaneiro2026.pdf" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">AT Madeira — Agenda Fiscal Janeiro 2026 (PDF)</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-[13px] font-[800] uppercase tracking-[1px] text-[#0F172A] mb-2">Guias profissionais (consultoras)</h3>
              <ul className="space-y-1.5 text-[13px] text-[#1E293B]">
                <li>• <a href="https://www.pwc.pt/pt/pwcinforfisco/guia-fiscal/2026/irs.html" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">PwC Portugal — Guia Fiscal 2026 (IRS)</a></li>
                <li>• <a href="https://www.pwc.pt/pt/pwcinforfisco/guia-fiscal/2026/irc.html" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">PwC Portugal — Guia Fiscal 2026 (IRC)</a></li>
                <li>• <a href="https://www.pwc.pt/pt/pwcinforfisco/guia-fiscal/2026/imt.html" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">PwC Portugal — Guia Fiscal 2026 (IMT)</a></li>
                <li>• <a href="https://www.pwc.pt/pt/pwcinforfisco/orcamentoestado/irs-e-seguranca-social/regime-de-isencao-para-jovens.html" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">PwC Portugal — IRS Jovem OE 2026</a></li>
                <li>• <a href="https://www.pwc.pt/pt/pwcinforfisco/orcamento-estado/2026/pwc-lei-orcamento-estado-2026.pdf" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">PwC — Lei OE 2026: análise completa (PDF)</a></li>
                <li>• <a href="https://www.crowe.com/pt/insights/orcamento-do-estado-para-2026" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">Crowe Portugal — Orçamento do Estado 2026</a></li>
                <li>• <a href="https://www.deloitte.com/pt/pt/services/tax/perspectives/taxlab/potencial-impacto-regulamento-euro-6e-tributacao-autonoma.html" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">Deloitte Portugal — Tributação Autónoma Euro 6e</a></li>
                <li>• <a href="https://www.occ.pt/sites/default/files/public/2025-11/Alt_IRC.pdf" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">OCC — Alteração das Taxas de IRC (Nov 2025, PDF)</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-[13px] font-[800] uppercase tracking-[1px] text-[#0F172A] mb-2">Tabelas e simuladores (validação cruzada)</h3>
              <ul className="space-y-1.5 text-[13px] text-[#1E293B]">
                <li>• <a href="https://economiafinancas.com/2025/escaloes-irs-2026/" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">Economia e Finanças — Tabela escalões IRS 2026</a></li>
                <li>• <a href="https://contasconnosco.cofidis.pt/impostos/escaloes-irs" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">Cofidis (Contas Connosco) — Escalões IRS 2026</a></li>
                <li>• <a href="https://www.coverflex.com/pt/tabelas-irs" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">Coverflex — Tabelas IRS 2026</a></li>
                <li>• <a href="https://crncontabilidade.pt/blog/escaloes-de-irs-em-2026-tabela-actualizada-e-como-calcular-o-seu-imposto/" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">CRN-Contabilidade — Escalões IRS 2026</a></li>
                <li>• <a href="https://ricavida.pt/escaloes-irs-2026-tabela-atualizada/" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">Rica Vida — Escalões IRS 2026 (retenção)</a></li>
                <li>• <a href="https://www.pwc.pt/pt/pwcinforfisco/flash/imi-imt-e-selo/imt-novas-tabelas-praticas-imt-vigorar-janeiro-2026.html" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">PwC — Tabelas práticas IMT Janeiro 2026</a></li>
                <li>• <a href="https://www.coverflex.com/pt/blog/tributacao-autonoma" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">Coverflex — Tributação Autónoma 2026</a></li>
                <li>• <a href="https://www.coverflex.com/pt/blog/irs-jovem" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">Coverflex — IRS Jovem 2026</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-[13px] font-[800] uppercase tracking-[1px] text-[#0F172A] mb-2">Imprensa (contexto e cronologia)</h3>
              <ul className="space-y-1.5 text-[13px] text-[#1E293B]">
                <li>• <a href="https://www.publico.pt/2025/10/09/economia/noticia/irs-governo-confirma-revisao-escaloes-alivio-prometido-julho-chega-2150182" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">Público — Revisão escalões IRS confirmada (9 Out 2025)</a></li>
                <li>• <a href="https://www.publico.pt/2025/10/03/economia/noticia/valores-escaloes-irs-actualizados-351-proximo-ano-2149490" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">Público — Escalões IRS sobem 3,51% em 2026</a></li>
                <li>• <a href="https://eco.sapo.pt/2025/10/09/escaloes-de-irs-sobem-351-e-taxas-descem-entre-2-o-e-5-o-escaloes/" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">ECO — Escalões IRS sobem 3,51% (taxas 2-5 descem)</a></li>
                <li>• <a href="https://www.jornaldenegocios.pt/economia/impostos/irs/detalhe/escaloes-de-irs-so-sobem-3-51-em-2026-veja-aqui-a-nova-tabela" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">Jornal de Negócios — Nova tabela IRS 2026</a></li>
                <li>• <a href="https://executivedigest.sapo.pt/irs-2026-atencao-pais-filhos-com-estas-idades-deixam-de-dar-direito-a-deducao-fiscal/" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">Executive Digest — Dedução dependentes 2026 (€600/€726/€900)</a></li>
                <li>• <a href="https://fleetmagazine.pt/tributacao-autonoma-2026/" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">Fleet Magazine — Tributação Autónoma viaturas 2026</a></li>
                <li>• <a href="https://caetano.pt/blog/tributacao-autonoma/" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">Caetano — Tributação Autónoma viaturas 2026</a></li>
                <li>• <a href="https://www.tsf.pt/brands-life/artigo/as-novidades-na-tributacao-autonoma-em-2026/18055226" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">TSF — Novidades Tributação Autónoma 2026</a></li>
                <li>• <a href="https://www.comparaja.pt/financas-pessoais/artigos/deducoes-irs" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">Comparaja — Deduções IRS 2026</a></li>
                <li>• <a href="https://www.cgd.pt/Site/Saldo-Positivo/leis-e-impostos/Pages/novidades-IRS.aspx" target="_blank" rel="noopener noreferrer" className="text-[#0677FF] font-[700] hover:underline">CGD Saldo Positivo — Novidades IRS 2026</a></li>
              </ul>
            </div>
          </div>

          <p className="text-[11px] text-[#94A3B8] mt-6 font-[500] leading-relaxed">
            Última verificação cruzada: <strong>17 de Maio de 2026</strong>. Os valores hardcoded em <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">src/lib/pt2026.ts</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">src/lib/imt.ts</code> e <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">src/lib/salario.ts</code> foram validados contra ≥2 fontes independentes e re-verificados por cálculo matemático (parcelas a abater do Art. 68.º CIRS calculadas escalão-a-escalão, erro &lt;€0,10).
          </p>
        </section>

        {/* Rodapé */}
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-full px-6 py-3 shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-[13px] font-[600] text-[#475569]">
              Informação atualizada em <strong>Maio de 2026</strong> • Estudo 360
            </span>
          </div>
          <p className="text-[12px] text-[#94A3B8] mt-3 max-w-xl mx-auto">
            Esta ferramenta é desenvolvida e mantida pela equipa Estudo 360. Para questões específicas sobre a sua situação fiscal, consulte sempre um contabilista certificado (OCC).
          </p>
        </div>
          </div>{/* /min-w-0 right column */}
        </div>{/* /grid */}
      </div>{/* /max-w-7xl */}
    </motion.div>
  );
}
