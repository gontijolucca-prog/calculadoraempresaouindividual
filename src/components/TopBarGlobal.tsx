/**
 * Barra de topo global — visível em TODAS as vistas da app.
 * Reaproveita os hooks do gabinete e o sino de notificações; não duplica
 * lógica de negócio. Escondida na impressão.
 */
import { useEffect, useState, type ReactNode } from 'react';
import NotificacoesBell from './NotificacoesBell';
import { useGabineteClientes, useGabineteTarefas, useGabineteObrigacoes, useGabineteCofre, useGabineteAlertas } from '../lib/useGabinete';
import { getActiveGabineteId, getGabineteMeta, clearActiveGabineteAndReload } from '../lib/gabinetes';
import { subscribeSync, getSyncSnapshot } from '../lib/sync';
import { flushOutbox } from '../lib/gabinete';
import { loadOfficeSettings } from '../lib/officeSettings';

export default function TopBarGlobal({ title, subtitle, onGo, onOpenMenu, nav, activeClientName, onClientClick }: { title?: string; subtitle?: string; onGo?: (tab: string) => void; onOpenMenu?: () => void; nav?: ReactNode; activeClientName?: string; onClientClick?: () => void }) {
  const clientes = useGabineteClientes();
  const tarefas = useGabineteTarefas();
  const obrigacoes = useGabineteObrigacoes();
  const cofre = useGabineteCofre();
  const alertas = useGabineteAlertas();
  const [sync, setSync] = useState(() => getSyncSnapshot());
  const [nome, setNome] = useState<string | null>(() => {
    try { return loadOfficeSettings()?.nome?.trim() || null; } catch { return null; }
  });

  useEffect(() => subscribeSync(() => setSync(getSyncSnapshot())), []);
  useEffect(() => {
    let vivo = true;
    const id = getActiveGabineteId();
    if (!id) { setNome(null); return; }
    getGabineteMeta(id).then((m) => { if (vivo && m?.nome) setNome(m.nome); }).catch(() => {});
    return () => { vivo = false; };
  }, []);

  const abertas = tarefas.filter((t) => t.estado !== 'done').length;

  return (
    <div data-testid="topbar-global" className="sticky top-0 z-30 border-b border-zinc-200 bg-white/85 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {onOpenMenu && (
            <button type="button" onClick={onOpenMenu} aria-label="Abrir menu" className="md:hidden p-2 -ml-1 rounded-lg text-zinc-600 hover:bg-zinc-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
            </button>
          )}
          <div className="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0677FF] text-sm font-bold text-white">360</div>
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
    </div>
  );
}
