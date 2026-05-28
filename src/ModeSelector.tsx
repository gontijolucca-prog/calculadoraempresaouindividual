import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { UserPlus, Building2, ArrowRight, LogOut } from 'lucide-react';

export type AppMode = 'novo-cliente' | 'empresa';

interface Props {
  onSelect: (mode: AppMode) => void;
  onLogout?: () => void;
}

interface ModeCard {
  id: AppMode;
  label: string;
  tagline: string;
  description: string;
  Icon: typeof Building2;
  accent: string;
  accentSoft: string;
  shortcut: string;
}

const MODES: ModeCard[] = [
  {
    id: 'novo-cliente',
    label: 'Novo Cliente',
    tagline: 'Onboarding & Proposta',
    description: 'Preenche o perfil do cliente e gera a proposta de honorários pronta a apresentar.',
    Icon: UserPlus,
    accent: '#B45309',
    accentSoft: '#FEF3C7',
    shortcut: '1',
  },
  {
    id: 'empresa',
    label: 'Empresa',
    tagline: 'Simuladores empresariais',
    description: 'Fiscal, viaturas, tickets de refeição, imóveis, IMT, salário, diagnóstico e PreviSa (Modelo 22).',
    Icon: Building2,
    accent: '#0B1D2D',
    accentSoft: '#E2E8F0',
    shortcut: '2',
  },
];

/** Estudo 360 mark — raster orbital sphere lockup. */
function BrandMark({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt=""
      className={`${className} object-contain select-none shrink-0`}
      draggable={false}
      aria-hidden="true"
    />
  );
}

export default function ModeSelector({ onSelect, onLogout }: Props) {
  const firstCardRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstCardRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when focus is inside an editable element
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      if (e.key === '1') { e.preventDefault(); onSelect('novo-cliente'); }
      else if (e.key === '2') { e.preventDefault(); onSelect('empresa'); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onSelect]);

  return (
    <div
      className="min-h-screen relative overflow-hidden flex flex-col"
      style={{
        background:
          'radial-gradient(ellipse 70% 60% at 80% 0%, rgba(6, 119, 255, 0.18) 0%, transparent 60%), ' +
          'radial-gradient(ellipse 65% 50% at 10% 100%, rgba(11, 29, 45, 0.10) 0%, transparent 60%), ' +
          'linear-gradient(180deg, #FCFCFD 0%, #F5F7FA 100%)',
      }}
    >
      {/* Subtle noise overlay for atmospheric depth */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="relative shrink-0 px-8 sm:px-12 pt-8 flex items-center justify-between">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3"
        >
          <BrandMark className="w-10 h-10" />
          <div className="leading-none">
            <div className="text-[15px] font-[800] text-[#0B1D2D] tracking-[-0.2px]">
              ESTUDO<span className="text-[#0677FF]">360°</span>
            </div>
            <div className="text-[10px] font-[600] text-[#6B7280] uppercase tracking-[2px] mt-1">
              Análise · Estratégia · Decisão
            </div>
          </div>
        </motion.div>

        {onLogout && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 text-[12px] font-[600] text-[#94A3B8] hover:text-[#0B1D2D] transition-colors px-3 py-2 rounded-[8px] hover:bg-white"
            aria-label="Terminar sessão"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            Sair
          </motion.button>
        )}
      </header>

      {/* ── Main hero & cards ─────────────────────────────────────── */}
      <main className="relative flex-1 flex flex-col justify-center items-center px-6 sm:px-12 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center max-w-2xl mb-14"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 mb-6 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0677FF] animate-pulse" aria-hidden="true" />
            <span className="text-[10px] font-[800] uppercase tracking-[2px] text-[#64748B]">
              Escolhe uma área
            </span>
          </div>
          <h1 className="text-[44px] sm:text-[56px] font-[200] text-[#0F172A] leading-[0.95] tracking-[-1.5px]">
            Como queres
            <br />
            <span className="font-[800] text-[#0B1D2D]">
              trabalhar <span className="italic font-[700] text-[#0677FF]">hoje?</span>
            </span>
          </h1>
          <p className="text-[14px] sm:text-[15px] font-[500] text-[#64748B] mt-5 max-w-xl mx-auto leading-relaxed">
            Cada área filtra os simuladores que fazem sentido para esse contexto.
            Podes trocar de modo a qualquer momento.
          </p>
        </motion.div>

        {/* ── 3 cards ── */}
        <div
          role="group"
          aria-label="Seleção de modo de trabalho"
          className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          {MODES.map((mode, idx) => (
            <ModeCardButton
              key={mode.id}
              ref={idx === 0 ? firstCardRef : undefined}
              mode={mode}
              index={idx}
              onSelect={onSelect}
            />
          ))}
        </div>

        {/* ── Keyboard hint ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 1.1 }}
          className="mt-10 flex items-center gap-2 text-[11px] font-[600] text-[#94A3B8]"
        >
          <span>Atalho:</span>
          <kbd className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] shadow-sm">1</kbd>
          <kbd className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono text-[10px] shadow-sm">2</kbd>
          <span>para escolher</span>
        </motion.div>
      </main>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────── */

interface CardProps {
  mode: ModeCard;
  index: number;
  onSelect: (m: AppMode) => void;
}

const ModeCardButton = React.forwardRef<HTMLButtonElement, CardProps>(
  ({ mode, index, onSelect }, ref) => {
    const { id, label, tagline, description, Icon, accent, accentSoft, shortcut } = mode;

    return (
      <motion.button
        ref={ref}
        type="button"
        onClick={() => onSelect(id)}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 + index * 0.1, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ y: -6 }}
        whileTap={{ scale: 0.98 }}
        className="group relative text-left bg-white rounded-[20px] p-7 overflow-hidden border border-slate-200 shadow-sm transition-shadow hover:shadow-2xl"
        aria-label={`${label} — ${tagline} (atalho ${shortcut})`}
      >
        {/* Accent strip top */}
        <div
          aria-hidden="true"
          className="absolute top-0 left-0 right-0 h-[3px] transition-all duration-300 group-hover:h-[6px]"
          style={{ background: accent }}
        />

        {/* Soft accent corner glow on hover */}
        <div
          aria-hidden="true"
          className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-0 group-hover:opacity-60 transition-opacity duration-500 blur-2xl"
          style={{ background: accent }}
        />

        {/* Shortcut chip */}
        <div className="absolute top-5 right-5 w-7 h-7 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-[11px] font-[800] text-[#64748B] group-hover:bg-white group-hover:border-slate-300 transition-all">
          {shortcut}
        </div>

        {/* Icon */}
        <div
          className="w-14 h-14 rounded-[14px] flex items-center justify-center mb-7 transition-all duration-300 group-hover:scale-110"
          style={{ background: accentSoft }}
        >
          <Icon className="w-7 h-7" style={{ color: accent }} strokeWidth={2.25} aria-hidden="true" />
        </div>

        {/* Text */}
        <div className="mb-7">
          <h2 className="text-[24px] font-[800] text-[#0F172A] leading-tight tracking-[-0.4px]">
            {label}
          </h2>
          <p
            className="text-[11px] font-[700] uppercase tracking-[1.5px] mt-1.5"
            style={{ color: accent }}
          >
            {tagline}
          </p>
          <p className="text-[13px] font-[500] text-[#64748B] mt-4 leading-relaxed">
            {description}
          </p>
        </div>

        {/* CTA */}
        <div
          className="flex items-center gap-2 text-[13px] font-[700] transition-all group-hover:gap-3"
          style={{ color: accent }}
        >
          <span>Entrar</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </div>
      </motion.button>
    );
  }
);

ModeCardButton.displayName = 'ModeCardButton';
