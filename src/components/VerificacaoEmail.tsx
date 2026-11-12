import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, MailCheck, X } from 'lucide-react';
import { useAuth } from '../lib/auth';

const DISPENSADO = 'estudo360:v1:aviso-email-dispensado';

/**
 * Aviso de email por confirmar.
 *
 * Aparece só a contas com email (o dono do gabinete e quem se registou). Os
 * acessos de colaborador usam username + password técnica, sem email, e são
 * repostos pelo gabinete — para esses não há nada a confirmar.
 *
 * Não bloqueia a app: se o email cair em spam, a pessoa continua a trabalhar e
 * pode reenviar aqui. Fechar vale só para a sessão do browser.
 */
export function VerificacaoEmail() {
  const { user, resendVerification, reloadUser } = useAuth();
  const [estado, setEstado] = useState<'idle' | 'a-enviar' | 'enviado' | 'erro'>('idle');
  const [erro, setErro] = useState('');
  const [fechado, setFechado] = useState(() => {
    try { return sessionStorage.getItem(DISPENSADO) === '1'; } catch { return false; }
  });
  const parametroLido = useRef(false);

  // Voltou do link de confirmação (?email=verificado) — relê o utilizador para
  // o aviso desaparecer sem novo login.
  useEffect(() => {
    if (parametroLido.current) return;
    parametroLido.current = true;
    let params: URLSearchParams;
    try { params = new URLSearchParams(window.location.search); } catch { return; }
    if (params.get('email') !== 'verificado') return;
    void reloadUser();
    params.delete('email');
    const qs = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
  }, [reloadUser]);

  if (!user?.email || user.emailVerified || fechado) return null;

  const reenviar = async () => {
    setEstado('a-enviar');
    setErro('');
    try {
      await resendVerification();
      setEstado('enviado');
    } catch (e) {
      const code = String((e as { code?: string })?.code || '');
      setErro(code.includes('too-many-requests')
        ? 'Já pediu há pouco. Aguarde alguns minutos.'
        : 'Não foi possível reenviar agora. Tente daqui a pouco.');
      setEstado('erro');
    }
  };

  const fechar = () => {
    setFechado(true);
    try { sessionStorage.setItem(DISPENSADO, '1'); } catch { /* sem storage */ }
  };

  return (
    <div role="status" className="shrink-0 no-print border-b border-[#BFDBFE] bg-[#EFF6FF] px-3 sm:px-6 py-2.5 flex items-center gap-3">
      <MailCheck className="w-4 h-4 text-[#1D4ED8] shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 text-[12px] leading-snug text-[#1E3A8A]">
        <strong className="font-[800]">Confirme o seu email.</strong>{' '}
        <span className="font-[500]">
          Enviámos um link para {user.email}. Sem confirmar, não conseguimos recuperar a conta se perder a password.
        </span>
        {estado === 'enviado' && (
          <span className="inline-flex items-center gap-1 font-[700] text-emerald-700 ml-1">
            <Check className="w-3.5 h-3.5" /> Email reenviado — veja a entrada e o spam.
          </span>
        )}
        {estado === 'erro' && <span className="font-[700] text-red-700 ml-1">{erro}</span>}
      </div>
      <button
        type="button"
        onClick={reenviar}
        disabled={estado === 'a-enviar' || estado === 'enviado'}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[#1D4ED8] px-3 py-1.5 text-[11.5px] font-[700] text-white hover:bg-[#1E40AF] disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {estado === 'a-enviar' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {estado === 'enviado' ? 'Enviado' : 'Reenviar email'}
      </button>
      <button type="button" onClick={fechar} aria-label="Fechar aviso" className="shrink-0 p-1 text-[#1D4ED8]/70 hover:text-[#1D4ED8]">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
