import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, User, Eye, EyeOff, AlertTriangle, CheckCircle, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from './lib/auth';

// Mensagens de erro Firebase traduzidas e seguras (não revelam se email existe no reset)
function mapAuthError(code: string): string {
  const c = code || '';
  if (c.includes('auth/configuration-not-found')) return 'Email/password ainda não ativo neste projeto — ativa em Firebase Console > Authentication > Sign-in method > Email/Password > Enabled.';
  if (c.includes('auth/invalid-email')) return 'Email inválido.';
  if (c.includes('auth/user-not-found') || c.includes('auth/wrong-password') || c.includes('auth/invalid-credential')) return 'Email ou password incorretos.';
  if (c.includes('auth/email-already-in-use')) return 'Já existe conta com este email. Tenta entrar.';
  if (c.includes('auth/weak-password')) return 'Password fraca — usa pelo menos 8 caracteres.';
  if (c.includes('auth/too-many-requests')) return 'Muitas tentativas. Aguarda um pouco e tenta novamente.';
  if (c.includes('auth/popup-closed-by-user')) return 'Janela fechada antes de concluir.';
  if (c.includes('auth/network-request-failed')) return 'Falha de rede. Verifica a ligação.';
  return 'Ocorreu um erro. Tenta novamente.';
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
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Indica um email válido.';
    if (mode !== 'reset' && password.length < 8) return 'Password com pelo menos 8 caracteres.';
    if (mode === 'signup' && !name.trim()) return 'Indica o teu nome.';
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
        setInfo('Conta criada. Verifica o teu email para ativar o acesso — enviámos um link.');
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
    <div className="min-h-screen w-full bg-[#F5F7FA] flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          {onBack ? (
            <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] font-[600] px-3 py-1.5 rounded-full border border-black/10 hover:bg-black/5">
              <ArrowRight className="w-3.5 h-3.5 rotate-180" /> Voltar
            </button>
          ) : null}
          <img src="/logo.svg" alt="" className="w-8 h-8 object-contain" />
          <span className="text-[16px] font-[800] tracking-[-0.2px] text-[#0B1D2D]">ESTUDO<span className="text-[#0677FF]">360°</span></span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[11px] font-[600] text-[#6B7280]">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> Dados cifrados por conta · zero-knowledge no cofre
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-6xl grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-start">
          {/* Copy à esquerda — reassurance de segurança */}
          <div className="hidden lg:block pt-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#0B1D2D]/10 text-[11px] font-[700] tracking-[1.5px] uppercase text-[#0B1D2D]/60 bordeaux-neon-pulse">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--brand-bordeaux-neon)]" /> Acesso seguro por conta
            </div>
            <h1 className="mt-4 text-[42px] font-[800] leading-[0.95] tracking-[-1.5px] text-[#0B1D2D]">
              Cada conta,<br /><span className="text-[#0677FF]">os seus clientes.</span>
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[#475569] max-w-lg">
              A tua conta é privada. Só tu vês os teus clientes e o teu cofre.
            </p>
            <ul className="mt-6 space-y-3 text-[13px] text-[#334155]">
              <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" /> Cada conta vê só os seus clientes</li>
              <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" /> Cofre protegido — só abre com a tua palavra-passe do cofre</li>
              <li className="flex gap-2"><CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" /> Acesso seguro em todos os computadores</li>
            </ul>
          </div>

          {/* Card de auth */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-[20px] border border-[#E2E8F0] shadow-sm p-6 sm:p-8 border-t-[3px] border-t-[var(--brand-bordeaux-neon)]/25">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[22px] font-[800] text-[#0B1D2D]">{mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Repor password'}</h2>
              <div className="flex gap-1 bg-[#F5F7FA] p-1 rounded-full">
                <button onClick={() => { setMode('login'); setError(null); setInfo(null); }} className={`px-3 py-1.5 rounded-full text-[13px] font-[700] ${mode==='login' ? 'bg-white shadow text-[#0B1D2D]' : 'text-[#64748B]'}`}>Entrar</button>
                <button onClick={() => { setMode('signup'); setError(null); setInfo(null); }} className={`px-3 py-1.5 rounded-full text-[13px] font-[700] ${mode==='signup' ? 'bg-white shadow text-[#0B1D2D]' : 'text-[#64748B]'}`}>Criar</button>
              </div>
            </div>

            {error && <div className="mb-4 flex gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-xl text-[13px]"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span></div>}
            {info && <div className="mb-4 flex gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2.5 rounded-xl text-[13px]"><CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{info}</span></div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <label className="block">
                  <span className="text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B]">Nome</span>
                  <div className="relative mt-1">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                    <input value={name} onChange={e=>setName(e.target.value)} placeholder="O teu nome" className="w-full pl-9 pr-3 py-3 rounded-xl border border-[#E2E8F0] bg-[#F5F7FA] text-[14px] focus:bg-white focus:border-[#0677FF] outline-none" autoComplete="name" />
                  </div>
                </label>
              )}
              <label className="block">
                <span className="text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B]">Email</span>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="nome@empresa.pt" className="w-full pl-9 pr-3 py-3 rounded-xl border border-[#E2E8F0] bg-[#F5F7FA] text-[14px] focus:bg-white focus:border-[#0677FF] outline-none" autoComplete="email" required />
                </div>
              </label>
              {mode !== 'reset' && (
                <label className="block">
                  <span className="text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B]">Password</span>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                    <input type={showPass ? 'text' : 'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" className="w-full pl-9 pr-10 py-3 rounded-xl border border-[#E2E8F0] bg-[#F5F7FA] text-[14px] focus:bg-white focus:border-[#0677FF] outline-none" autoComplete={mode==='signup' ? 'new-password' : 'current-password'} required />
                    <button type="button" onClick={()=>setShowPass(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#64748B]">{showPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}</button>
                  </div>
                  {mode==='signup' && <p className="text-[11px] text-[#94A3B8] mt-1">Usa 8+ caracteres. Recomendado: maiúsculas, números e símbolos.</p>}
                </label>
              )}

              <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center gap-2 bg-[#0B1D2D] text-white py-3.5 rounded-xl text-[14px] font-[800] hover:bg-[#162a41] disabled:opacity-60">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {mode==='login' ? 'Entrar' : mode==='signup' ? 'Criar conta' : 'Enviar instruções'}
              </button>
            </form>

            <div className="mt-4 flex justify-between text-[13px]">
              {mode !== 'reset' ? <button onClick={()=>setMode('reset')} className="text-[#0677FF] hover:underline">Esqueci-me da password</button> : <button onClick={()=>setMode('login')} className="text-[#0677FF] hover:underline">Voltar a entrar</button>}
              <span className="text-[#94A3B8] hidden sm:inline flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Ligação cifrada (HTTPS)</span>
            </div>
          </motion.div>
        </div>
      </div>

      <footer className="py-4 text-center text-[11px] text-[#94A3B8]">Ao criar conta aceitas os termos. Cofre privado e protegido.</footer>
    </div>
  );
}

export function VerifyEmailGate({ email, onResend, onReload, onLogout }: { email: string; onResend: () => Promise<void>; onReload: () => Promise<void>; onLogout: () => Promise<void>; }) {
  const [sending, setSending] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F7FA] p-6">
      <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-8 max-w-lg w-full text-center">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto"><Mail className="w-6 h-6" /></div>
        <h1 className="mt-4 text-[20px] font-[800] text-[#0B1D2D]">Verifica o teu email</h1>
        <p className="mt-2 text-[14px] text-[#475569]">Enviámos um link para <strong>{email}</strong>. Precisas confirmar o email antes de aceder aos clientes e ao cofre.</p>
        {info && <div className="mt-4 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-xl text-[13px]">{info}</div>}
        {error && <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-[13px]">{error}</div>}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button disabled={sending} onClick={async()=>{ setSending(true); setError(null); try{ await onResend(); setInfo('Reenviámos o email. Verifica spam também.'); }catch(e:any){ setError(e?.message||'Erro ao reenviar'); } finally{ setSending(false); }}} className="px-5 py-3 rounded-xl bg-[#0677FF] text-white font-[700] disabled:opacity-60">Reenviar email</button>
          <button onClick={async()=>{ setError(null); try{ await onReload(); }catch(e:any){ setError(e?.message||'Erro'); }}} className="px-5 py-3 rounded-xl bg-white border border-[#E2E8F0] font-[700]">Já verifiquei — entrar</button>
        </div>
        <button onClick={onLogout} className="mt-4 text-[13px] text-[#64748B] hover:underline">Sair e usar outra conta</button>
      </div>
    </div>
  );
}
