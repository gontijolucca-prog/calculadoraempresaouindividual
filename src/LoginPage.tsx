import React, { useState, useId } from 'react';

interface Props {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: Props) {
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
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="bg-white rounded-[24px] p-10 shadow-xl w-full max-w-sm">

        {/* Logo centrado */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-24 h-20 mb-4">
            <svg viewBox="0 0 100 80" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
              <path d="M 45 10 A 30 30 0 0 0 45 70" stroke="#333333" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M 30 45 L 42 58 L 65 25" stroke="#781D1D" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-[26px] font-[800] tracking-[-0.5px] text-[#333333]">RECOFATIMA</h1>
          <p className="text-[13px] tracking-[0.5px] text-[#781D1D] font-[600] mt-0.5">Contabilidade</p>
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
              className="w-full px-4 py-3 bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[10px] text-[15px] font-[600] text-[#0F172A] focus:border-[#781D1D] outline-none transition-all"
            />
          </div>

          <div>
            <label htmlFor={passwordId} className="block text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-2">
              Password
            </label>
            <input
              id={passwordId}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className="w-full px-4 py-3 bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[10px] text-[15px] font-[600] text-[#0F172A] focus:border-[#781D1D] outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#781D1D] text-white py-3.5 rounded-[10px] text-[15px] font-[700] hover:bg-[#5A1313] active:scale-[0.98] transition-all mt-2 shadow-md shadow-[#781D1D]/20 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {submitting ? 'A entrar…' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-[11px] text-[#94A3B8] mt-8 font-[500]">
          Recofatima Contabilidade • Simuladores OE 2026
        </p>
      </div>
    </div>
  );
}
