import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, User, Eye, EyeOff, AlertTriangle, CheckCircle, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from './lib/auth';

function mapAuthError(code: string): string {
  const c = code || '';
  if (c.includes('auth/configuration-not-found')) return 'Email e password ainda não estão ativos neste projeto — ative em Firebase Console > Authentication > Email/Password.';
  if (c.includes('auth/invalid-email')) return 'Email inválido.';
  if (c.includes('auth/user-not-found') || c.includes('auth/wrong-password') || c.includes('auth/invalid-credential')) return 'Email ou password incorretos.';
  if (c.includes('auth/email-already-in-use')) return 'Já existe conta com este email. Tente entrar.';
  if (c.includes('auth/weak-password')) return 'Password fraca — utilize pelo menos 8 caracteres.';
  if (c.includes('auth/too-many-requests')) return 'Demasiadas tentativas. Aguarde um pouco e tente novamente.';
  if (c.includes('auth/popup-closed-by-user')) return 'Janela fechada antes de concluir.';
  if (c.includes('auth/network-request-failed')) return 'Falha de rede. Verifique a ligação.';
  return 'Ocorreu um erro. Tente novamente.';
}

export default function AuthView({ initialMode = 'login', onBack }: { initialMode?: 'login' | 'signup'; onBack?: () => void }) {
  const { signInWithEmail, signUpWithEmail, resetPassword } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Indique um email válido.';
    if (mode !== 'reset' && password.length < 8) return 'Password com pelo menos 8 caracteres.';
    if (mode === 'signup' && !name.trim()) return 'Indique o seu nome.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null);
    const v = validate();
    if (v) { setError(v); return; }
    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email.trim(), password);
      } else if (mode === 'signup') {
        await signUpWithEmail(email.trim(), password, name.trim());
        setInfo('Conta criada. Verifique o seu email para ativar o acesso — enviámos um link.');
      } else if (mode === 'reset') {
        await resetPassword(email.trim());
        setInfo('Se existir conta com esse email, enviámos instruções para repor a password.');
      }
    } catch (err: any) {
      setError(mapAuthError(err?.code || err?.message || ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#FDFBF7] flex flex-col" style={{fontFamily:'Geist, sans-serif'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Geist:wght@400;500;600;700&display=swap');`}</style>
      <header className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          {onBack ? (
            <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] font-[600] px-3 py-1.5 rounded-full border border-[#1A1A18]/10 hover:bg-black/5 transition-colors">
              <ArrowRight className="w-3.5 h-3.5 rotate-180" /> Voltar
            </button>
          ) : null}
          <img src="/logo.svg" alt="" className="w-8 h-8 object-contain" />
          <span className="text-[16px] font-[700] tracking-[-0.2px] text-[#1A1A18]">estudo<span className="font-[400] text-[#B06D35]">360</span></span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[11px] font-[500] text-[#1A1A18]/40">
          <ShieldCheck className="w-4 h-4 text-[#B06D35]" /> Dados protegidos por conta
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-6xl grid lg:grid-cols-[1.05fr_0.9fr] gap-10 items-start">
          {/* Esquerda — calma, sem jargão */}
          <div className="hidden lg:block pt-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#1A1A18]/[0.06] text-[11px] font-[600] tracking-[1.2px] uppercase text-[#1A1A18]/40">
              <ShieldCheck className="w-3.5 h-3.5 text-[#B06D35]" /> Acesso seguro
            </div>
            <h1 className="mt-4 leading-[0.9] tracking-[-0.03em]" style={{fontFamily:'Cormorant Garamond, serif'}}>
              <span className="block text-[44px] font-[300] text-[#1A1A18]">Cada conta,</span>
              <span className="block text-[44px] font-[300] italic text-[#B06D35]">os seus clientes.</span>
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[#1A1A18]/50 max-w-[460px]">
              A sua conta é privada. Só vê os seus clientes e o seu cofre. Sem misturas.
            </p>
            <ul className="mt-6 space-y-3 text-[13px] text-[#1A1A18]/60">
              <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-[#B06D35] mt-0.5" /> Só vê o que é seu</li>
              <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-[#B06D35] mt-0.5" /> Cofre protegido — só abre com a sua palavra-passe</li>
              <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-[#B06D35] mt-0.5" /> Funciona em qualquer computador</li>
            </ul>
          </div>

          {/* Card */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{duration:0.5, ease:[0.4,0,0.2,1]}} className="bg-white rounded-[20px] border border-[#1A1A18]/[0.06] shadow-[0_16px_48px_rgba(26,26,24,0.06)] p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[22px] font-[600] tracking-[-0.02em] text-[#1A1A18]" style={{fontFamily:'Cormorant Garamond, serif'}}>{mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Recuperar acesso'}</h2>
              <div className="flex gap-1 bg-[#F5F0E8] p-1 rounded-full">
                <button onClick={() => { setMode('login'); setError(null); setInfo(null); }} className={`px-3.5 py-1.5 rounded-full text-[13px] font-[600] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${mode==='login' ? 'bg-white shadow text-[#1A1A18]' : 'text-[#1A1A18]/40'}`}>Entrar</button>
                <button onClick={() => { setMode('signup'); setError(null); setInfo(null); }} className={`px-3.5 py-1.5 rounded-full text-[13px] font-[600] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${mode==='signup' ? 'bg-white shadow text-[#1A1A18]' : 'text-[#1A1A18]/40'}`}>Criar</button>
              </div>
            </div>

            {error && <div className="mb-4 flex gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-xl text-[13px]"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span></div>}
            {info && <div className="mb-4 flex gap-2 bg-[#F5F0E8] border border-[#B06D35]/20 text-[#6B4A2A] px-3 py-2.5 rounded-xl text-[13px]"><CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{info}</span></div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <label className="block">
                  <span className="text-[11px] font-[600] tracking-[1px] uppercase text-[#1A1A18]/35">Nome</span>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A1A18]/25" />
                    <input value={name} onChange={e=>setName(e.target.value)} placeholder="O seu nome" className="w-full pl-9 pr-3 py-3 rounded-xl border border-[#1A1A18]/10 bg-[#FDFBF7] text-[14px] focus:bg-white focus:border-[#B06D35]/30 focus:ring-2 focus:ring-[#B06D35]/10 outline-none transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]" autoComplete="name" />
                  </div>
                </label>
              )}
              <label className="block">
                <span className="text-[11px] font-[600] tracking-[1px] uppercase text-[#1A1A18]/35">Email</span>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A1A18]/25" />
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nome@empresa.pt" className="w-full pl-9 pr-3 py-3 rounded-xl border border-[#1A1A18]/10 bg-[#FDFBF7] text-[14px] focus:bg-white focus:border-[#B06D35]/30 focus:ring-2 focus:ring-[#B06D35]/10 outline-none transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]" autoComplete="email" required />
                </div>
              </label>
              {mode !== 'reset' && (
                <label className="block">
                  <span className="text-[11px] font-[600] tracking-[1px] uppercase text-[#1A1A18]/35">Password</span>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A1A18]/25" />
                    <input type={showPass ? 'text' : 'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" className="w-full pl-9 pr-10 py-3 rounded-xl border border-[#1A1A18]/10 bg-[#FDFBF7] text-[14px] focus:bg-white focus:border-[#B06D35]/30 focus:ring-2 focus:ring-[#B06D35]/10 outline-none transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]" autoComplete={mode==='signup' ? 'new-password' : 'current-password'} required />
                    <button type="button" onClick={()=>setShowPass(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#1A1A18]/30 hover:text-[#1A1A18]/60 transition-colors">{showPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}</button>
                  </div>
                  {mode==='signup' && <p className="text-[11px] text-[#1A1A18]/30 mt-1">Utilize 8 ou mais caracteres.</p>}
                </label>
              )}

              <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center gap-2 bg-[#1A1A18] text-[#FDFBF7] py-3.5 rounded-xl text-[14px] font-[600] hover:bg-black disabled:opacity-60 transition-colors">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {mode==='login' ? 'Entrar' : mode==='signup' ? 'Criar conta' : 'Enviar instruções'}
              </button>
            </form>

            <div className="mt-4 flex justify-between text-[13px]">
              {mode !== 'reset' ? <button onClick={()=>setMode('reset')} className="text-[#B06D35] hover:underline">Esqueceu-se da password?</button> : <button onClick={()=>setMode('login')} className="text-[#B06D35] hover:underline">Voltar a entrar</button>}
              <span className="text-[#1A1A18]/25 hidden sm:inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Ligação segura</span>
            </div>
          </motion.div>
        </div>
      </div>

      <footer className="py-4 text-center text-[11px] text-[#1A1A18]/25">Ao criar conta aceita os termos. O seu cofre é privado.</footer>
    </div>
  );
}

export function VerifyEmailGate({ email, onResend, onReload, onLogout }: { email: string; onResend: () => Promise<void>; onReload: () => Promise<void>; onLogout: () => Promise<void>; }) {
  const [sending, setSending] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7] p-6" style={{fontFamily:'Geist, sans-serif'}}>
      <div className="bg-white rounded-[20px] border border-[#1A1A18]/[0.06] p-8 max-w-lg w-full text-center shadow-[0_16px_48px_rgba(26,26,24,0.06)]">
        <div className="w-12 h-12 rounded-full bg-[#F5F0E8] text-[#B06D35] flex items-center justify-center mx-auto"><Mail className="w-6 h-6" /></div>
        <h1 className="mt-4 text-[20px] font-[600] text-[#1A1A18]" style={{fontFamily:'Cormorant Garamond, serif'}}>Confirme o seu email</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#1A1A18]/50">Enviámos um link para <strong className="text-[#1A1A18]">{email}</strong>. Confirme o email antes de aceder aos seus clientes e ao cofre.</p>
        {info && <div className="mt-4 bg-[#F5F0E8] border border-[#B06D35]/20 text-[#6B4A2A] px-3 py-2 rounded-xl text-[13px]">{info}</div>}
        {error && <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-[13px]">{error}</div>}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button disabled={sending} onClick={async()=>{ setSending(true); setError(null); try{ await onResend(); setInfo('Reenviámos o email. Verifique também o spam.'); }catch(e:any){ setError(e?.message||'Erro ao reenviar'); } finally{ setSending(false); }}} className="px-5 py-3 rounded-xl bg-[#1A1A18] text-[#FDFBF7] font-[600] disabled:opacity-60">Reenviar email</button>
          <button onClick={async()=>{ setError(null); try{ await onReload(); }catch(e:any){ setError(e?.message||'Erro'); }}} className="px-5 py-3 rounded-xl bg-white border border-[#1A1A18]/10 font-[600] hover:bg-[#FDFBF7]">Já confirmei — entrar</button>
        </div>
        <button onClick={onLogout} className="mt-4 text-[13px] text-[#1A1A18]/30 hover:text-[#1A1A18]/60 hover:underline">Sair e usar outra conta</button>
      </div>
    </div>
  );
}
