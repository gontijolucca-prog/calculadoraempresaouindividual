import { motion } from 'motion/react';
import React, { useState, useId } from 'react';
import { ArrowLeft } from 'lucide-react';

interface Props {
  onLogin: () => void;
  onBack?: () => void;
}

export default function LoginPage({ onLogin, onBack }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const emailId = useId();
  const passwordId = useId();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    // NOTE: mock login — real authentication still pending.
    // Avoid re-triggering when in-flight (prevents double-submit if onLogin is async later).
    onLogin();
  };

  return (
    <motion.div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 relative" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="absolute top-5 left-5 inline-flex items-center gap-1.5 text-[12px] font-[700] text-[#64748B] hover:text-[#0F172A] px-3 py-2 rounded-[10px] hover:bg-white transition-colors"
          aria-label="Voltar à página inicial"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar
        </button>
      )}
      <div className="bg-white rounded-[24px] p-10 shadow-xl w-full max-w-sm">

        {/* Logo centrado */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-24 h-24 mb-4">
            <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
              <path d="M 70 20 A 35 35 0 1 1 35 22" stroke="#7B98B8" strokeWidth="10" strokeLinecap="round"/>
              <path d="M 60 10 L 70 20 L 60 30" stroke="#525C66" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-[26px] font-[800] tracking-[-0.5px] text-[#525C66]">Estudo <span className="text-[#7B98B8]">360</span></h1>
          <p className="text-[13px] tracking-[0.5px] text-[#7B98B8] font-[600] mt-0.5">Ferramentas Fiscais · OE 2026</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label htmlFor={emailId} className="block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-2">
              Email
            </label>
            <input
              id={emailId}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@empresa.pt"
              autoComplete="email"
              inputMode="email"
              required
              className="w-full px-4 py-3 bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[10px] text-[15px] font-[600] text-[#0F172A] focus:border-[#7B98B8] outline-none transition-all"
            />
          </div>

          <div>
            <label htmlFor={passwordId} className="block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-2">
              Palavra-passe
            </label>
            <input
              id={passwordId}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className="w-full px-4 py-3 bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[10px] text-[15px] font-[600] text-[#0F172A] focus:border-[#7B98B8] outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#7B98B8] text-white py-3.5 rounded-[10px] text-[15px] font-[700] hover:bg-[#5C7A9E] active:scale-[0.98] transition-all mt-2 shadow-md shadow-[#7B98B8]/20 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {submitting ? 'A entrar…' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-[11px] text-[#94A3B8] mt-8 font-[500]">
          Estudo 360 • Simuladores OE 2026
        </p>
      </div>
    </motion.div>
  );
}
