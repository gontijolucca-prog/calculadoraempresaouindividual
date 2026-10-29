import React, { useEffect, useState } from 'react';
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
  const [remember, setRemember] = useState(true);
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
        await signInWithEmail(email.trim(), password, remember);
      } else if (mode === 'signup') {
        await signUpWithEmail(email.trim(), password, name.trim());
        setInfo('Conta criada. Já pode entrar no gabinete.');
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
          <img src="/logo.svg" alt="" className="w-8 h-8 object-contain logo-orb" />
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
              {mode === 'login' && (
                <label className="flex items-center gap-2 text-[13px] text-[#1A1A18]/60 cursor-pointer select-none">
                  <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} className="w-4 h-4 rounded accent-[#B06D35]" />
                  Lembrar-me neste dispositivo
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
  const [cooldown, setCooldown] = useState(0);
  const [aVerificar, setAVerificar] = useState(true);

  // Contagem para o reenvio (evita emails repetidos) e verificação automática.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => window.clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    let vivo = true;
    const tentar = async () => {
      try { await onReload(); } catch { /* ainda não confirmado */ }
      finally { if (vivo) setAVerificar(false); }
    };
    const id = window.setInterval(tentar, 8000);
    return () => { vivo = false; window.clearInterval(id); };
  }, [onReload]);

  const reenviar = async () => {
    if (sending || cooldown > 0) return;
    setSending(true); setError(null); setInfo(null);
    try {
      await onResend();
      setInfo('Email reenviado. Verifique a caixa de entrada e o spam.');
      setCooldown(45);
    } catch (e: any) {
      setError(e?.message || 'Não consegui reenviar agora. Tente outra vez.');
    } finally { setSending(false); }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4 sm:p-8 relative overflow-hidden" style={{ fontFamily: 'Geist, sans-serif' }}>
      <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 h-[420px] w-[420px] rounded-full bg-[#B06D35]/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 h-[380px] w-[380px] rounded-full bg-[#0677FF]/8 blur-3xl" />

      <div className="relative w-full max-w-[980px] rounded-[26px] border border-[#1A1A18]/[0.07] bg-white shadow-[0_30px_80px_rgba(26,26,24,0.10)] overflow-hidden grid md:grid-cols-[1.02fr_1fr]">
        {/* Painel de marca */}
        <aside className="hidden md:flex flex-col justify-between bg-[#F7F2EA] p-10 border-r border-[#1A1A18]/[0.05]">
          <div>
            <div className="flex items-center gap-2.5">
              <img src="/logo.svg" alt="" className="w-9 h-9 logo-orb" />
              <div>
                <div className="text-[15px] font-[800] tracking-[-0.2px] text-[#1A1A18]">ESTUDO<span className="text-[#0677FF]">360°</span></div>
                <div className="text-[9px] font-[600] uppercase tracking-[2px] text-[#1A1A18]/35">Análise · Estratégia · Decisão</div>
              </div>
            </div>
            <h2 className="mt-10 text-[34px] leading-[1.08] text-[#1A1A18]" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>
              Um passo<br />para entrar.
            </h2>
            <p className="mt-3 text-[13.5px] leading-relaxed text-[#1A1A18]/55 max-w-[300px]">
              Confirmar o email protege a sua conta e garante que só você entra no gabinete, nos clientes e no cofre.
            </p>
          </div>
          <ul className="space-y-2.5 text-[12.5px] text-[#1A1A18]/60">
            <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#B06D35]" /> Cofre privado, cifrado no seu computador</li>
            <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#B06D35]" /> Só o link enviado para o seu email abre a conta</li>
            <li className="flex items-center gap-2"><ArrowRight className="w-4 h-4 text-[#B06D35]" /> Depois de confirmar, entra direto no gabinete</li>
          </ul>
        </aside>

        {/* Conteúdo */}
        <div className="p-6 sm:p-10">
          <div className="md:hidden flex items-center gap-2.5 mb-6">
            <img src="/logo.svg" alt="" className="w-8 h-8 logo-orb" />
            <div className="text-[14px] font-[800] text-[#1A1A18]">ESTUDO<span className="text-[#0677FF]">360°</span></div>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full bg-[#F5F0E8] px-3 py-1 text-[10.5px] font-[800] uppercase tracking-[1.2px] text-[#8A5426]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#B06D35]" /> Verificação de conta
          </span>

          <div className="mt-5 flex items-start gap-4">
            <div className="shrink-0 w-12 h-12 rounded-2xl bg-[#F5F0E8] text-[#B06D35] flex items-center justify-center"><Mail className="w-6 h-6" /></div>
            <div>
              <h1 className="text-[26px] leading-tight text-[#1A1A18]" style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 600 }}>Confirme o seu email</h1>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#1A1A18]/55">
                Enviámos um link de confirmação para{' '}
                <span className="mx-1 inline-flex max-w-full items-center rounded-md bg-[#F7F2EA] px-2 py-0.5 font-[700] text-[#1A1A18] align-middle break-all">{email}</span>
              </p>
            </div>
          </div>

          <ol className="mt-6 space-y-2.5">
            {[
              'Abra o email «Confirme o seu email no Estudo360».',
              'Carregue no botão «Confirmar email» (ou no link).',
              'Volte aqui e carregue em «Já confirmei — entrar».',
            ].map((passo, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px] leading-snug text-[#1A1A18]/70">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1A1A18] text-[10.5px] font-[800] text-[#FDFBF7]">{i + 1}</span>
                {passo}
              </li>
            ))}
          </ol>

          <div aria-live="polite">
            {info && <div role="status" className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 text-[12.5px] font-[600]">{info}</div>}
            {error && <div role="alert" className="mt-4 rounded-xl bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-[12.5px] font-[600]">{error}</div>}
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={async () => { setError(null); try { await onReload(); } catch (e: any) { setError(e?.message || 'Ainda não está confirmado. Verifique o email.'); } }}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1A1A18] px-4 py-3 text-[13.5px] font-[700] text-[#FDFBF7] hover:bg-black transition-colors"
            >
              Já confirmei — entrar <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={reenviar}
              disabled={sending || cooldown > 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#1A1A18]/12 bg-white px-4 py-3 text-[13px] font-[700] text-[#1A1A18] hover:bg-[#FDFBF7] disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Reenviar email'}
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 text-[11.5px] text-[#1A1A18]/40">
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${aVerificar ? 'bg-[#0677FF] animate-pulse' : 'bg-emerald-500'}`} />
              {aVerificar ? 'À espera da confirmação…' : 'Atualizado automaticamente'}
            </span>
            <button onClick={onLogout} className="hover:text-[#1A1A18]/70 hover:underline">Sair e usar outra conta</button>
          </div>

          <p className="mt-5 border-t border-[#1A1A18]/[0.06] pt-3 text-[11px] leading-relaxed text-[#1A1A18]/35">
            Não recebeu? Verifique o spam ou confirme que o email está bem escrito. Se continuar, fale com o dono do gabinete.
          </p>
        </div>
      </div>
    </div>
  );
}

