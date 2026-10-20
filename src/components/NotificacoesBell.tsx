import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, BellOff, CalendarClock, CheckCheck } from 'lucide-react';
import type { AlertaGabinete, GabineteCliente, Obrigacao } from '../lib/gabinete';
import {
  prazosNotificaveis, resumoBadge, porLer, marcarLida, lerLidas,
  notificacoesAtivas, setNotificacoesAtivas, permissaoNotificacoes,
  pedirPermissaoNotificacoes, enviarNotificacoes, proximosSaft,
  type PrazoNotificavel,
} from '../lib/notificacoes';

const CORES: Record<PrazoNotificavel['severidade'], string> = {
  atrasado: 'border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]',
  hoje: 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]',
  proximo: 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1E40AF]',
  futuro: 'border-zinc-200 bg-white text-zinc-600',
};

const ETIQUETA: Record<PrazoNotificavel['severidade'], string> = {
  atrasado: 'Atrasado',
  hoje: 'Hoje',
  proximo: 'Próximo',
  futuro: 'Futuro',
};

function fmtData(ms: number): string {
  return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit' }).format(new Date(ms));
}

function quandoTexto(dias: number): string {
  if (dias < 0) return `${Math.abs(dias)}d atrasado`;
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  return `em ${dias}d`;
}

export function NotificacoesBell({
  clientes, obrigacoes, alertas, onGo,
}: {
  clientes: GabineteCliente[];
  obrigacoes: Obrigacao[];
  alertas: AlertaGabinete[];
  onGo?: (tab: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [tick, setTick] = useState(0);
  const [vistas, setVistas] = useState<Record<string, string>>(() => lerLidas());
  const [ativas, setAtivas] = useState<boolean>(() => notificacoesAtivas());
  const [permissao, setPermissao] = useState(() => permissaoNotificacoes());
  const [aviso, setAviso] = useState<string | null>(null);
  const caixa = useRef<HTMLDivElement | null>(null);

  // Relógio: recalcula os dias e volta a tentar notificar a cada 15 min (aba visível).
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setTick(t => t + 1);
    }, 15 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!caixa.current) return;
      if (!caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const lista = useMemo(
    () => prazosNotificaveis({ clientes, obrigacoes, alertas }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clientes, obrigacoes, alertas, tick],
  );
  const naoLidas = useMemo(() => porLer(lista, vistas), [lista, vistas, tick]);
  const badge = resumoBadge(naoLidas);
  const saft = useMemo(() => proximosSaft(obrigacoes, Date.now(), 3), [obrigacoes, tick]);
  const atrasados = lista.filter(p => p.severidade === 'atrasado');
  const hoje = lista.filter(p => p.severidade === 'hoje');
  const proximos = lista.filter(p => p.severidade === 'proximo');

  // Notificação do sistema: ao abrir e a cada 15 min, nunca repetindo no mesmo dia.
  useEffect(() => {
    if (!ativas) return;
    const enviados = enviarNotificacoes(lista);
    if (enviados > 0) setVistas(lerLidas());
  }, [lista, ativas]);

  const ativar = async () => {
    const p = await pedirPermissaoNotificacoes();
    setPermissao(p === 'indisponivel' ? 'indisponivel' : p);
    if (p === 'granted') {
      setNotificacoesAtivas(true); setAtivas(true);
      const n = enviarNotificacoes(lista);
      setVistas(lerLidas());
      setAviso(n > 0 ? `${n} notificação(ões) enviada(s).` : 'Notificações ligadas.');
    } else if (p === 'denied') {
      setAviso('O browser bloqueou as notificações. Autorize nas definições do site.');
    } else if (p === 'indisponivel') {
      setAviso('Este browser não suporta notificações.');
    }
  };

  const desligar = () => {
    setNotificacoesAtivas(false); setAtivas(false); setAviso('Notificações desligadas.');
  };

  const marcarTudo = () => {
    lista.forEach(p => marcarLida(p));
    setVistas(lerLidas());
  };

  const abrirItem = (p: PrazoNotificavel) => {
    marcarLida(p); setVistas(lerLidas());
    if (onGo) onGo(p.tipo === 'alerta' ? 'visao-geral' : p.tipo === 'saft' ? 'obrigacoes' : 'obrigacoes');
    setAberto(false);
  };

  const linha = (p: PrazoNotificavel) => (
    <button
      key={p.chave}
      onClick={() => abrirItem(p)}
      className={`w-full text-left rounded-lg border px-2.5 py-2 hover:brightness-[0.98] ${CORES[p.severidade]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12.5px] font-[600] leading-tight line-clamp-2">{p.titulo}</span>
        <span className="shrink-0 text-[10.5px] font-[800] uppercase tracking-wide opacity-80">{ETIQUETA[p.severidade]}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] opacity-80">
        <span>{fmtData(p.vencimento)}</span>
        <span>·</span>
        <span>{quandoTexto(p.dias)}</span>
        {p.cliente ? <><span>·</span><span className="truncate">{p.cliente}</span></> : null}
      </div>
    </button>
  );

  const secao = (titulo: string, items: PrazoNotificavel[]) => items.length > 0 && (
    <div className="space-y-1.5">
      <div className="px-1 text-[10.5px] font-[800] uppercase tracking-[0.8px] text-zinc-500">{titulo} ({items.length})</div>
      {items.map(linha)}
    </div>
  );

  return (
    <div className="relative" ref={caixa}>
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        aria-label={`Notificações${badge.total ? ` (${badge.total})` : ''}`}
        title="Prazos e alertas"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
      >
        <Bell className="h-4 w-4" />
        {badge.total > 0 && (
          <span className={`absolute -right-1 -top-1 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full px-1 text-[10px] font-[800] text-white ${badge.atrasados > 0 ? 'bg-[#DC2626]' : 'bg-[#0677FF]'}`}>
            {badge.total > 9 ? '9+' : badge.total}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-11 z-50 w-[min(92vw,380px)] rounded-xl border border-zinc-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[13px] font-[800] text-[#0B1D2D]">Prazos e alertas</div>
            <div className="flex items-center gap-1.5">
              <button onClick={marcarTudo} className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2 py-1 text-[11px] font-[600] text-zinc-600 hover:bg-zinc-50">
                <CheckCheck className="h-3.5 w-3.5" /> Lidas
              </button>
              <button onClick={() => setAberto(false)} className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100" aria-label="Fechar">✕</button>
            </div>
          </div>

          <div className="mb-2 rounded-lg border border-zinc-200 bg-[#F8FAFC] p-2">
            {permissao === 'granted' && ativas ? (
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11.5px] font-[600] text-emerald-700"><Bell className="h-3.5 w-3.5" /> Notificações do browser ligadas</span>
                <button onClick={desligar} className="inline-flex items-center gap-1 text-[11px] font-[600] text-zinc-500 hover:text-zinc-700"><BellOff className="h-3.5 w-3.5" /> Desligar</button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11.5px] text-zinc-600">Recebe um aviso no computador quando um prazo aperta.</span>
                <button onClick={ativar} className="shrink-0 rounded-full bg-[#0677FF] px-2.5 py-1 text-[11px] font-[700] text-white hover:bg-blue-600">Ativar</button>
              </div>
            )}
            {aviso && <div className="mt-1.5 text-[11px] text-zinc-500">{aviso}</div>}
            {permissao === 'denied' && <div className="mt-1.5 text-[11px] text-[#B91C1C]">Bloqueado pelo browser — ver definições do site.</div>}
          </div>

          <div className="max-h-[48vh] space-y-3 overflow-y-auto pr-0.5">
            {lista.length === 0 && (
              <div className="rounded-lg border border-dashed border-zinc-200 py-6 text-center text-[12px] text-zinc-500">Nada em atraso nem a vencer nos próximos 7 dias.</div>
            )}
            {secao('Atrasados', atrasados)}
            {secao('Hoje', hoje)}
            {secao('Próximos 7 dias', proximos)}

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 px-1 text-[10.5px] font-[800] uppercase tracking-[0.8px] text-zinc-500">
                <CalendarClock className="h-3.5 w-3.5" /> SAF-T online (dia 5)
              </div>
              {saft.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-200 px-2.5 py-2 text-[11.5px] text-zinc-500">
                  Sem datas SAF-T geradas. Ative “Envio SAFT” no cliente para criar as 12 datas do ano.
                </div>
              ) : saft.map(p => (
                <div key={p.chave} className="rounded-lg border border-zinc-200 px-2.5 py-2 text-[11.5px] text-zinc-700">
                  <div className="font-[600] truncate">{p.cliente || 'Cliente'}</div>
                  <div className="text-zinc-500">{fmtData(p.vencimento)} · {quandoTexto(p.dias)} · entrega até ao dia 5</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2 border-t border-zinc-100 pt-2 text-[10.5px] leading-snug text-zinc-500">
            Avisos só com a app aberta. Para avisos do portal, ative as notificações no Portal das Finanças (e-fatura / SAF-T).
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificacoesBell;
