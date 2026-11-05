/**
 * Barra de topo global — visível em TODAS as vistas da app.
 * Reaproveita os hooks do gabinete e o sino de notificações; não duplica
 * lógica de negócio. Escondida na impressão.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Eye, EyeOff, Loader2, LockKeyhole, X } from 'lucide-react';
import NotificacoesBell from './NotificacoesBell';
import { useGabineteClientes, useGabineteTarefas, useGabineteObrigacoes, useGabineteCofre, useGabineteAlertas } from '../lib/useGabinete';
import { getActiveGabineteId, getGabineteMeta, clearActiveGabineteAndReload } from '../lib/gabinetes';
import { subscribeSync, getSyncSnapshot } from '../lib/sync';
import { flushOutbox } from '../lib/gabinete';
import { loadOfficeSettings } from '../lib/officeSettings';
import { useAuth } from '../lib/auth';

export default function TopBarGlobal({ title, subtitle, onGo, onOpenMenu, nav, activeClientName, onClientClick }: { title?: string; subtitle?: string; onGo?: (tab: string) => void; onOpenMenu?: () => void; nav?: ReactNode; activeClientName?: string; onClientClick?: () => void }) {
  const { user, employeeProfile, changePassword } = useAuth();
  const clientes = useGabineteClientes();
  const tarefas = useGabineteTarefas();
  const obrigacoes = useGabineteObrigacoes();
  const cofre = useGabineteCofre();
  const alertas = useGabineteAlertas();
  const [sync, setSync] = useState(() => getSyncSnapshot());
  const [nome, setNome] = useState<string | null>(() => {
    try { return loadOfficeSettings()?.nome?.trim() || null; } catch { return null; }
  });
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  useEffect(() => subscribeSync(() => setSync(getSyncSnapshot())), []);
  useEffect(() => {
    let vivo = true;
    const id = getActiveGabineteId();
    if (!id) { setNome(null); return; }
    getGabineteMeta(id).then((m) => { if (vivo && m?.nome) setNome(m.nome); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const abertas = tarefas.filter((t) => t.estado !== 'done').length;
  const closePassword = () => {
    if (passwordBusy) return;
    setPasswordOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setPasswordError('');
    setPasswordSuccess('');
  };
  const submitPassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');
    if (!currentPassword) { setPasswordError('Indique a password atual.'); return; }
    if (newPassword.length < 8) { setPasswordError('A nova password deve ter pelo menos 8 caracteres.'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('As passwords novas não coincidem.'); return; }
    setPasswordBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(employeeProfile ? 'Password do acesso ao gabinete alterada.' : 'Password da conta alterada.');
    } catch (error) {
      const raw = String((error as { code?: string; message?: string })?.code || (error as Error)?.message || '');
      if (/password_atual_incorreta|auth\/wrong-password|auth\/invalid-credential/i.test(raw)) {
        setPasswordError('A password atual não está correta.');
      } else if (/auth\/weak-password/i.test(raw)) {
        setPasswordError('A nova password é demasiado fraca.');
      } else {
        setPasswordError('Não foi possível alterar a password. Tente novamente.');
      }
    } finally {
      setPasswordBusy(false);
    }
  };

  return (
    <div data-testid="topbar-global" className="sticky top-0 z-30 border-b border-zinc-200 bg-white/85 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {onOpenMenu && (
            <button type="button" onClick={onOpenMenu} aria-label="Abrir menu" className="md:hidden p-2 -ml-1 rounded-lg text-zinc-600 hover:bg-zinc-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
            </button>
          )}
          <img src="/logo.svg" alt="Estudo360" className="hidden sm:block h-8 w-8 shrink-0 select-none object-contain logo-orb" />
          <div className="min-w-0">
            <div className="truncate font-semibold leading-none text-zinc-900">{title || 'Gabinete'}</div>
            <div className="hidden truncate text-xs text-zinc-500 sm:block">{subtitle || 'Centro de operação'}</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {activeClientName && (
            <button
              type="button"
              onClick={onClientClick}
              title="A trabalhar neste cliente — clique para trocar"
              className="hidden sm:flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11.5px] font-[700] text-rose-700 hover:bg-rose-100 transition-colors max-w-[240px]"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-600" />
              </span>
              <span className="truncate">A trabalhar em {activeClientName}</span>
            </button>
          )}
          <NotificacoesBell clientes={clientes} obrigacoes={obrigacoes} alertas={alertas} onGo={onGo} />
          {user && (
            <button
              type="button"
              onClick={() => setPasswordOpen(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
              title="Alterar password"
              aria-label="Alterar password"
            >
              <LockKeyhole className="h-3.5 w-3.5" />
            </button>
          )}
          {!employeeProfile && (
            <>
              <button
                onClick={clearActiveGabineteAndReload}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                title="Trocar de gabinete"
              >
                {(nome || 'Escolher gabinete').slice(0, 28)} · Trocar
              </button>
              <button
                onClick={clearActiveGabineteAndReload}
                className="sm:hidden inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700"
                title={`Gabinete: ${nome || 'escolher'} — trocar`}
              >
                {(nome || 'Gabinete').slice(0, 12)} · Trocar
              </button>
            </>
          )}
        </div>

        <div className="hidden md:flex items-center gap-2 text-right text-xs text-zinc-500">
          <span>{clientes.length} clientes</span>
          <span className="opacity-30">•</span>
          <span>{abertas} tarefas abertas</span>
          <span className="opacity-30">•</span>
          <span>{cofre.length} acessos</span>
          <span className="opacity-30">•</span>
          {sync.queued > 0 || sync.error ? (
            <button onClick={() => flushOutbox().catch(() => {})} className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800 hover:bg-amber-100">
              {sync.queued > 0 ? `${sync.queued} por enviar — Repetir` : 'Falha — Repetir'}
            </button>
          ) : sync.pending > 0 ? (
            <span className="text-[#0677FF]">A sincronizar…</span>
          ) : (
            <span className="text-emerald-700">Sincronizado ✓</span>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden text-right text-[11px] leading-tight text-zinc-500">
          <div>
            <div>{clientes.length} clientes</div>
            <div>{abertas} abertas</div>
          </div>
        </div>
      </div>
      {nav && (
        <div className="hidden md:block border-t border-zinc-100 bg-white/70">
          <div className="mx-auto flex max-w-[1400px] items-center px-4 sm:px-6">{nav}</div>
        </div>
      )}
      {passwordOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm print:hidden" onClick={closePassword}>
          <div role="dialog" aria-modal="true" aria-label="Alterar password" className="w-full max-w-[430px] rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-[800] text-[#0F172A]">Alterar password</h2>
                <p className="mt-1 text-[12px] leading-5 text-[#64748B]">
                  {employeeProfile ? 'Password usada para entrar com este acesso ao gabinete.' : 'Password da sua conta Estudo360.'}
                </p>
              </div>
              <button type="button" onClick={closePassword} disabled={passwordBusy} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <input
                type={showPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="Password atual"
                autoComplete="current-password"
                className="w-full rounded-xl border border-zinc-200 bg-[#F8FAFC] px-3 py-2.5 text-[13px] outline-none focus:border-[#0677FF] focus:bg-white"
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Nova password"
                autoComplete="new-password"
                className="w-full rounded-xl border border-zinc-200 bg-[#F8FAFC] px-3 py-2.5 text-[13px] outline-none focus:border-[#0677FF] focus:bg-white"
              />
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') void submitPassword(); }}
                  placeholder="Repetir nova password"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-zinc-200 bg-[#F8FAFC] px-3 py-2.5 pr-10 text-[13px] outline-none focus:border-[#0677FF] focus:bg-white"
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 hover:text-zinc-700" aria-label={showPassword ? 'Ocultar passwords' : 'Mostrar passwords'}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-[600] text-rose-700">{passwordError}</div>}
              {passwordSuccess && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-[600] text-emerald-700">{passwordSuccess}</div>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closePassword} disabled={passwordBusy} className="rounded-xl border border-zinc-200 px-4 py-2 text-[13px] font-[700] text-zinc-600">Fechar</button>
              <button type="button" onClick={() => void submitPassword()} disabled={passwordBusy} className="inline-flex items-center gap-2 rounded-xl bg-[#0F172A] px-4 py-2 text-[13px] font-[700] text-white disabled:opacity-60">
                {passwordBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Guardar password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
