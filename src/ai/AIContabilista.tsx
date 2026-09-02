import React, { useState, useRef, useEffect, useCallback, useImperativeHandle } from 'react';
import { Sparkles, X, Send, Trash2, Check, RotateCcw, Lightbulb, FileUp } from 'lucide-react';
import { parseReply, type BotAction, type FillField, type ViewId } from './actions';
import { registerSuggestion } from './suggestions';
import { GUIAS, reativarGuias, type ViewKey } from '../lib/guias';
import { useHideOnScroll } from '../lib/useHideOnScroll';

// Bridge fornecida pelo App: dá ao bot poderes de navegação e preenchimento,
// e um contexto ANONIMIZADO (sem dados sensíveis) para enviar ao modelo.
export interface BotBridge {
  getContext: () => string;
  navigate: (view: ViewId) => void;
  setMode: (mode: 'empresa' | 'novo-cliente') => void;
  applyFill: (target: string, fields: FillField[]) => void;
  /** Abre o seletor de ficheiro para importar um SAF-T: "novo" cria um cliente novo;
   *  "empresa" importa/substitui no cliente ativo. */
  openSaftUpload?: (mode?: 'novo' | 'empresa') => { ok: boolean; reason?: string };
  /** Lista de documentos que o bot pode gerar e descarregar. */
  listDownloadableDocs?: () => { id: string; label: string }[];
  /** Lista de clientes guardados (id + nome). */
  listClients?: () => { id: string; name: string }[];
  /** Ativa um cliente pelo nome (igual ou parcial). */
  selectClient?: (name: string) => { ok: boolean; name?: string };
  /** Gera e descarrega um documento do cliente ativo (Word/Excel). */
  downloadDoc?: (docId: string) => Promise<{ ok: boolean; label?: string; reason?: string }>;
  currentUser?: string;
  currentView?: string;
  /** Inicia a visita guiada da ferramenta indicada. */
  startTour?: (view: string) => void;
  /** Marca a ferramenta como "não perguntar novamente". */
  setTourDisabled?: (view: string) => void;
  /** true enquanto uma visita guiada está a decorrer. */
  tourActive?: () => boolean;
}

/** API exposta pelo bot à app (ref). */
export interface BotApi {
  notifyTourEnd: (view: string) => void;
}

// Nota de ação aplicada — guarda a ação para o utilizador poder REPETI-LA com um clique.
interface NoteItem { text: string; action?: BotAction }

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  notes?: NoteItem[];               // ações auto-aplicadas (clicáveis para repetir)
  pendingFill?: { target: string; fields: FillField[] } | null;
  fillApplied?: boolean;
  replies?: string[];               // sugestões de próximo passo (botões clicáveis)
  saftCta?: 'novo' | 'empresa' | 'escolher'; // botão de SAF-T; 'escolher' mostra os clientes
  downloadPicker?: boolean;         // assistente guiado: escolher cliente + documento
  tourOffer?: { titulo: string; intro: string } | null; // oferta de visita guiada
}

// Chat só por sessão (sobrevive a refresh, limpa-se ao fechar o separador/browser);
// nunca partilhado entre computadores. Sem memória permanente — é só um helper.
const STORE_KEY = 'estudo360:ai_chat_session_v1';
const LEGACY_STORE_KEY = 'estudo360:ai_chat_v1'; // localStorage antigo (persistente) — a apagar
const GREETING: ChatMsg = {
  role: 'assistant',
  content: 'Olá! Sou o **AI Contabilista**, o teu assistente aqui no Estudo 360. Posso explicar qualquer função, abrir os simuladores por ti, ajudar a preencher um cliente e registar sugestões de melhoria. Em que te ajudo?',
};
// (Removida a saudação proativa — o bot fica quieto até o utilizador interagir.)

const QUICK = [
  'Como funciona o Simulador de IRS?',
  'Ajuda-me a criar um cliente novo',
  'Qual simulador uso para o salário líquido?',
  'Quero sugerir uma melhoria',
];

const VIEW_LABEL: Record<string, string> = {
  empresas: 'Lista de Empresas', profile: 'Perfil do Cliente', tax: 'Simulador Fiscal',
  vehicle: 'Simulador de Viaturas', ticket: 'Tickets de Refeição', selfss: 'SS de Independente',
  diagnostico: 'Diagnóstico de Autonomia', imoveis: 'Imóveis na Empresa', imt: 'Simulador IMT',
  salario: 'Salário Líquido', irs: 'Simulador de IRS', previsa: 'Simulador Previsa',
  historico: 'Histórico', exportar: 'Exportar documentos', 'office-settings': 'Definições do Escritório',
  legal: 'Base Legal',
};

// Sem memória nenhuma entre carregamentos: cada refresh ou nova tab começa do zero.
// O bot é só um helper da sessão atual — limpamos restos de versões antigas que
// guardavam histórico (localStorage e sessionStorage) e arrancamos sempre limpos.
function loadChat(): ChatMsg[] {
  try { localStorage.removeItem(LEGACY_STORE_KEY); } catch { /* */ }
  try { sessionStorage.removeItem(STORE_KEY); } catch { /* */ }
  return [GREETING];
}

// Mini-markdown seguro: **negrito**, quebras de linha, e listas simples.
function renderText(text: string): React.ReactNode {
  return text.split('\n').map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={j} className="font-[800]">{p.slice(2, -2)}</strong>
        : <React.Fragment key={j}>{p}</React.Fragment>,
    );
    return <span key={i}>{parts}{i < text.split('\n').length - 1 && <br />}</span>;
  });
}

// Assistente guiado de download: escolher o cliente, depois o documento, e descarrega.
function DownloadPicker({ bridge }: { bridge: BotBridge }) {
  const [clientName, setClientName] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const clients = bridge.listClients?.() ?? [];
  const docs = bridge.listDownloadableDocs?.() ?? [];

  if (!clients.length) {
    return <p className="mt-2 text-[12px] font-[600] text-[#64748B]">Ainda não há clientes guardados — cria primeiro um cliente.</p>;
  }
  return (
    <div className="mt-2.5 rounded-[12px] border border-[#0677FF]/25 bg-[#0677FF]/5 p-3">
      <div className="text-[11px] font-[800] uppercase tracking-[0.4px] text-[#0677FF] mb-2">
        {clientName ? <>Documento para <span className="normal-case">{clientName}</span></> : 'De que cliente é o documento?'}
      </div>
      {!clientName && (
        <div className="flex flex-wrap gap-1.5">
          {clients.map((c) => (
            <button key={c.id} type="button"
              onClick={() => { bridge.selectClient?.(c.name); setClientName(c.name); }}
              className="text-[12px] font-[700] px-3 py-1.5 rounded-full bg-white border border-[#0677FF]/30 text-[#0677FF] hover:bg-[#0677FF] hover:text-white active:scale-[0.97] transition-all">
              {c.name}
            </button>
          ))}
        </div>
      )}
      {clientName && !done && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {docs.map((d) => (
              <button key={d.id} type="button" disabled={downloading}
                onClick={async () => {
                  setDownloading(true);
                  const res = await bridge.downloadDoc?.(d.id);
                  setDownloading(false);
                  setDone(res?.ok ? `Descarreguei: ${res.label ?? d.label}` : 'Não consegui gerar esse documento.');
                }}
                className="text-[12px] font-[700] px-3 py-1.5 rounded-full bg-white border border-[#0677FF]/30 text-[#0677FF] hover:bg-[#0677FF] hover:text-white active:scale-[0.97] transition-all disabled:opacity-50">
                {d.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setClientName(null)}
            className="mt-2 text-[11px] font-[700] text-[#64748B] hover:text-[#0677FF] hover:underline">
            ← trocar de cliente
          </button>
        </>
      )}
      {done && (
        <div className="flex items-center gap-1.5 text-[12px] font-[700] text-emerald-600">
          <Check className="w-3.5 h-3.5" strokeWidth={3} /> {done}
          <button type="button" onClick={() => setDone(null)}
            className="ml-2 text-[11px] font-[700] text-[#64748B] hover:text-[#0677FF] hover:underline">outro documento</button>
        </div>
      )}
    </div>
  );
}

export default function AIContabilista({ ref, bridge, liftBottom = false, view, viewTitle = '' }: {
  ref?: React.Ref<BotApi>;
  bridge: BotBridge;
  liftBottom?: boolean;
  view: string;
  viewTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  // Esconde o botão flutuante durante o scroll ativo (só o botão fechado —
  // o painel aberto é um dialog e não se esconde).
  const scrollHidden = useHideOnScroll();
  const [msgs, setMsgs] = useState<ChatMsg[]>(loadChat);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Destaque + som quando o bot sugere uma visita guiada
  const [destaque, setDestaque] = useState(false);
  const destaqueTimer = useRef<number | undefined>(undefined);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Desbloqueia o áudio no primeiro gesto do utilizador (política de autoplay)
  useEffect(() => {
    const unlock = () => {
      try {
        if (!audioCtxRef.current) {
          const AC = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (AC) audioCtxRef.current = new AC();
        }
        audioCtxRef.current?.resume?.();
      } catch { /* sem áudio — o destaque visual continua a funcionar */ }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const tocarSino = useCallback(() => {
    try {
      const ctx = audioCtxRef.current;
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      const nota = (freq: number, inicio: number, dur: number, ganho: number) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(ganho, t + inicio);
        g.gain.exponentialRampToValueAtTime(0.0001, t + inicio + dur);
        osc.connect(g).connect(ctx.destination);
        osc.start(t + inicio);
        osc.stop(t + inicio + dur + 0.03);
      };
      nota(880, 0, 0.16, 0.07);       // lá — suave
      nota(1174.66, 0.11, 0.22, 0.05); // ré — confirmação
    } catch { /* noop */ }
  }, []);

  const notificarGuia = useCallback(() => {
    setDestaque(true);
    window.clearTimeout(destaqueTimer.current);
    destaqueTimer.current = window.setTimeout(() => setDestaque(false), 3400);
    tocarSino();
  }, [tocarSino]);

  // Sem persistência: o chat vive só em memória e desaparece no refresh/nova tab.

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, busy, open]);

  // O bot fica QUIETO: só intervém quando o utilizador interage (pedido Lucca).
  // As sugestões de guia passaram para a própria página (GuiaSugestao).

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    setTimeout(() => inputRef.current?.focus(), 120);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Aplica ações que não precisam de confirmação (navegação, modo, sugestões).
  // Cada nota guarda a ação original — clicar na nota volta a executá-la.
  const applyAutoActions = useCallback(async (actions: BotAction[]): Promise<NoteItem[]> => {
    const notes: NoteItem[] = [];
    for (const a of actions) {
      if (a.type === 'navigate') {
        bridge.navigate(a.view);
        notes.push({ text: `Abri: ${VIEW_LABEL[a.view] ?? a.view}`, action: a });
      } else if (a.type === 'setMode') {
        bridge.setMode(a.mode);
        notes.push({ text: a.mode === 'empresa' ? 'Mudei para o modo Empresa' : 'Mudei para o modo Novo Cliente', action: a });
      } else if (a.type === 'suggestion') {
        // Feedback interno: regista em silêncio, sem mostrar nada ao utilizador.
        await registerSuggestion({
          title: a.title, detail: a.detail, area: a.area,
          autor: bridge.currentUser, vista: bridge.currentView,
        });
      } else if (a.type === 'selectClient') {
        const res = bridge.selectClient?.(a.name);
        notes.push(res?.ok
          ? { text: `Selecionei o cliente: ${res.name}`, action: a }
          : { text: `Não encontrei nenhum cliente com o nome "${a.name}".` });
      } else if (a.type === 'download') {
        const res = await bridge.downloadDoc?.(a.docId);
        if (res?.ok) notes.push({ text: `Descarreguei: ${res.label ?? 'documento'}`, action: a });
        else if (res?.reason === 'sem-cliente') notes.push({ text: 'Para descarregar um documento, seleciona primeiro um cliente.' });
        else notes.push({ text: 'Não consegui gerar esse documento.' });
      }
    }
    return notes;
  }, [bridge]);

  // Repete uma ação a partir do clique na nota (navegar, mudar modo, selecionar, descarregar).
  const repeatAction = useCallback(async (a: BotAction) => {
    if (a.type === 'navigate') bridge.navigate(a.view);
    else if (a.type === 'setMode') bridge.setMode(a.mode);
    else if (a.type === 'selectClient') bridge.selectClient?.(a.name);
    else if (a.type === 'download') await bridge.downloadDoc?.(a.docId);
  }, [bridge]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput('');

    // Pedido de guia/tour → tratado localmente (sem chamar a API):
    // reativa as perguntas e oferece a visita guiada da página atual.
    if (/\b(guia|tour|visita)\b/i.test(trimmed)) {
      reativarGuias();
      const v = view as ViewKey;
      const g = GUIAS[v];
      setMsgs((prev) => [
        ...prev,
        { role: 'user', content: trimmed },
        ...(g
          ? [{ role: 'assistant' as const, content: 'Claro! Aqui tens a visita guiada desta página 👇', tourOffer: { titulo: g.titulo, intro: g.intro } }]
          : [{ role: 'assistant' as const, content: 'Esta página não tem visita guiada — mas posso explicar-te o que ela faz!' }]),
      ]);
      if (g) notificarGuia();
      return;
    }

    const history = [...msgs, { role: 'user' as const, content: trimmed }];
    setMsgs(history);
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appContext: bridge.getContext(),
          messages: history.slice(-16).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json().catch(() => ({ reply: '' }));
      const reply: string = data?.reply || 'Não consegui responder agora. Tenta de novo daqui a pouco.';
      const { text: visible, actions } = parseReply(reply);

      const fillAction = actions.find((a) => a.type === 'fill') as Extract<BotAction, { type: 'fill' }> | undefined;
      const repliesAction = actions.find((a) => a.type === 'replies') as Extract<BotAction, { type: 'replies' }> | undefined;
      const saftAction = actions.find((a) => a.type === 'openSaftUpload') as Extract<BotAction, { type: 'openSaftUpload' }> | undefined;
      const wantsDownloadPicker = actions.some((a) => a.type === 'downloadPicker');
      // openSaftUpload vira um botão na mensagem: abrir o seletor de ficheiro só é
      // permitido a partir de um clique do utilizador (gesto), não de um callback async.
      const autoActions = actions.filter((a) => a.type !== 'fill' && a.type !== 'replies' && a.type !== 'openSaftUpload' && a.type !== 'downloadPicker');
      const notes = await applyAutoActions(autoActions);

      setMsgs((prev) => [...prev, {
        role: 'assistant',
        content: visible,
        notes: notes.length ? notes : undefined,
        pendingFill: fillAction ? { target: fillAction.target, fields: fillAction.fields } : null,
        replies: repliesAction?.options,
        saftCta: saftAction ? (saftAction.mode ?? 'novo') : undefined,
        downloadPicker: wantsDownloadPicker || undefined,
      }]);
    } catch {
      setMsgs((prev) => [...prev, { role: 'assistant', content: 'Tive um problema de ligação. Verifica a internet e tenta de novo.' }]);
    } finally {
      setBusy(false);
    }
  }, [msgs, busy, bridge, applyAutoActions, view]);

  const confirmFill = (idx: number) => {
    setMsgs((prev) => {
      const m = prev[idx];
      if (!m?.pendingFill) return prev;
      bridge.applyFill(m.pendingFill.target, m.pendingFill.fields);
      const next = [...prev];
      next[idx] = { ...m, fillApplied: true };
      return next;
    });
  };

  const cancelFill = (idx: number) => {
    setMsgs((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], pendingFill: null };
      return next;
    });
  };

  const clearChat = () => setMsgs([GREETING]);

  // O bot fica quieto também depois do tour: sem follow-up automático.
  // (O utilizador interage com ele se quiser ajuda — nada de mensagens não pedidas.)
  const notifyTourEnd = useCallback((_v: string) => { /* silencioso */ }, []);

  useImperativeHandle(ref, () => ({ notifyTourEnd }), [notifyTourEnd]);

  return (
    <>
      {/* Botão flutuante. Abaixo de lg: círculo só-com-ícone (o texto "AI
          Contabilista" em tablet/mobile tapava conteúdo — agora é um círculo
          compacto no canto, em cluster com a pill do Guia). */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir o AI Contabilista"
          aria-hidden={scrollHidden}
          tabIndex={scrollHidden ? -1 : 0}
          className={`no-print fixed z-[90] right-5 lg:right-6 flex items-center gap-2.5 justify-center w-11 h-11 lg:w-auto lg:h-auto lg:py-3 lg:pl-3.5 lg:pr-4 py-0 rounded-full text-white font-[800] text-[14px] active:scale-[0.97] transition-all duration-200 group ${liftBottom ? 'bottom-40 lg:bottom-24' : 'bottom-5 lg:bottom-6'} ${scrollHidden ? 'opacity-0 translate-y-3 pointer-events-none' : ''} ${destaque ? 'guia-destaque' : ''}`}
          style={{
            background: 'linear-gradient(135deg, #0677FF 0%, #00C2FF 100%)',
            boxShadow: '0 8px 28px -8px rgba(6,119,255,0.65), 0 0 0 1px rgba(6,119,255,0.25)',
          }}
        >
          <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/20">
            <Sparkles className="w-4.5 h-4.5" strokeWidth={2.5} style={{ width: 18, height: 18 }} />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#00FFA3] border-2 border-[#0677FF]" />
          </span>
          <span className="hidden lg:inline">AI Contabilista</span>
        </button>
      )}

      {/* Painel */}
      {open && (
        <div className={`no-print fixed inset-0 z-[95] sm:inset-auto sm:bottom-6 sm:right-6 flex items-end sm:items-stretch justify-center sm:justify-end ${destaque ? 'guia-destaque rounded-[20px]' : ''}`}>
          {/* Backdrop (só mobile) */}
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setOpen(false)}
            className="sm:hidden absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          />

          <div
            role="dialog"
            aria-label="AI Contabilista"
            className="relative w-full sm:w-[400px] h-[88vh] sm:h-[640px] sm:max-h-[calc(100vh-3rem)] bg-white rounded-t-[24px] sm:rounded-[24px] shadow-2xl flex flex-col overflow-hidden border border-slate-200"
            style={{ boxShadow: '0 24px 60px -12px rgba(11,29,45,0.45)' }}
          >
            {/* Header */}
            <div className="shrink-0 px-4 py-3 flex items-center gap-3 text-white"
              style={{ background: 'linear-gradient(135deg, #0B1D2D 0%, #0677FF 100%)' }}>
              <span className="relative flex items-center justify-center w-9 h-9 rounded-full bg-white/15 shrink-0">
                <Sparkles className="w-5 h-5" strokeWidth={2.5} />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#00FFA3] border-2 border-[#0B1D2D]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-[800] leading-tight">AI Contabilista</div>
                <div className="text-[11px] font-[600] text-white/70 leading-tight">Assistente do Estudo 360 · grátis</div>
              </div>
              {/* Limpar só com histórico — conversa nova (só boas-vindas) não tem nada para apagar. */}
              {msgs.length > 1 && (
                <button type="button" onClick={clearChat} aria-label="Limpar conversa"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                  <Trash2 className="w-4 h-4" strokeWidth={2.2} />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar"
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                <X className="w-4.5 h-4.5" strokeWidth={2.4} style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {/* Mensagens */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#F5F7FA]">
              {msgs.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex flex-col items-start gap-1.5'}>
                  <div className={
                    m.role === 'user'
                      ? 'max-w-[85%] rounded-[16px] rounded-br-[5px] px-3.5 py-2.5 text-[13.5px] font-[500] leading-relaxed text-white'
                      : 'max-w-[88%] rounded-[16px] rounded-bl-[5px] px-3.5 py-2.5 text-[13.5px] font-[500] leading-relaxed text-[#0F172A] bg-white border border-slate-200'
                  } style={m.role === 'user' ? { background: 'linear-gradient(135deg, #0677FF 0%, #044BB6 100%)' } : undefined}>
                    {renderText(m.content)}

                    {/* Notas de ações auto-aplicadas — clicáveis para repetir a ação */}
                    {m.notes?.map((n, k) => n.action ? (
                      <button key={k} type="button" onClick={() => repeatAction(n.action!)}
                        title="Clica para repetir esta ação"
                        className="mt-2 flex items-center gap-1.5 text-[11.5px] font-[700] text-[#0677FF] hover:underline active:scale-[0.98] transition-all text-left">
                        <RotateCcw className="w-3.5 h-3.5" strokeWidth={2.5} /> {n.text}
                      </button>
                    ) : (
                      <div key={k} className="mt-2 flex items-center gap-1.5 text-[11.5px] font-[700] text-[#64748B]">
                        <RotateCcw className="w-3.5 h-3.5" strokeWidth={2.5} /> {n.text}
                      </div>
                    ))}

                    {/* Cartão de confirmação de preenchimento */}
                    {m.pendingFill && !m.fillApplied && (
                      <div className="mt-2.5 rounded-[12px] border border-[#0677FF]/25 bg-[#0677FF]/5 p-3">
                        <div className="text-[11px] font-[800] uppercase tracking-[0.4px] text-[#0677FF] mb-1.5">
                          Preencher {VIEW_LABEL[m.pendingFill.target] ?? m.pendingFill.target}?
                        </div>
                        <ul className="space-y-1 mb-2.5">
                          {m.pendingFill.fields.map((f, k) => (
                            <li key={k} className="flex items-baseline justify-between gap-2 text-[12.5px]">
                              <span className="text-[#64748B] font-[600]">{f.label}</span>
                              <span className="text-[#0F172A] font-[800] tabular-nums text-right">{String(f.value)}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => confirmFill(i)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-[9px] text-[12.5px] font-[800] text-white active:scale-[0.98] transition-all"
                            style={{ background: 'linear-gradient(135deg, #0677FF 0%, #044BB6 100%)' }}>
                            <Check className="w-3.5 h-3.5" strokeWidth={3} /> Aplicar
                          </button>
                          <button type="button" onClick={() => cancelFill(i)}
                            className="px-3 py-2 rounded-[9px] text-[12.5px] font-[700] text-[#64748B] bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                            Não
                          </button>
                        </div>
                      </div>
                    )}
                    {m.fillApplied && (
                      <div className="mt-2 flex items-center gap-1.5 text-[11.5px] font-[700] text-emerald-600">
                        <Check className="w-3.5 h-3.5" strokeWidth={3} /> Campos preenchidos
                      </div>
                    )}
                    {m.saftCta && m.saftCta !== 'escolher' && (
                      <button type="button"
                        onClick={() => {
                          const res = bridge.openSaftUpload?.(m.saftCta as 'novo' | 'empresa');
                          if (res && !res.ok && res.reason === 'sem-cliente') {
                            setMsgs((prev) => [...prev, { role: 'assistant', content: 'Para importar para um cliente existente, escolhe primeiro o cliente. Diz-me o nome dele.' }]);
                          }
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-[800] px-3 py-2 rounded-xl bg-[#0677FF] text-white hover:bg-[#0560d6] active:scale-[0.97] transition-all">
                        <FileUp className="w-4 h-4" strokeWidth={2.4} />
                        {m.saftCta === 'empresa' ? 'Carregar SAF-T no cliente ativo' : 'Carregar SAF-T (cliente novo)'}
                      </button>
                    )}
                    {m.saftCta === 'escolher' && (
                      <div className="mt-2.5 rounded-[12px] border border-[#0677FF]/25 bg-[#0677FF]/5 p-3">
                        <div className="text-[11px] font-[800] uppercase tracking-[0.4px] text-[#0677FF] mb-2">Para que cliente é o SAF-T?</div>
                        <div className="flex flex-wrap gap-1.5">
                          {(bridge.listClients?.() ?? []).map((c) => (
                            <button key={c.id} type="button"
                              onClick={() => {
                                // Mesmo clique = gesto: seleciona o cliente e abre logo o seletor de ficheiro.
                                bridge.selectClient?.(c.name);
                                bridge.openSaftUpload?.('empresa');
                              }}
                              className="text-[12px] font-[700] px-3 py-1.5 rounded-full bg-white border border-[#0677FF]/30 text-[#0677FF] hover:bg-[#0677FF] hover:text-white active:scale-[0.97] transition-all">
                              {c.name}
                            </button>
                          ))}
                          <button type="button" onClick={() => bridge.openSaftUpload?.('novo')}
                            className="inline-flex items-center gap-1 text-[12px] font-[800] px-3 py-1.5 rounded-full bg-[#0677FF] text-white hover:bg-[#0560d6] active:scale-[0.97] transition-all">
                            <FileUp className="w-3.5 h-3.5" strokeWidth={2.4} /> Cliente novo
                          </button>
                        </div>
                      </div>
                    )}
                    {m.downloadPicker && (
                      <DownloadPicker bridge={bridge} />
                    )}
                    {m.tourOffer && (
                      <div className={`mt-2.5 rounded-[12px] border border-[#0677FF]/25 bg-[#0677FF]/5 p-3 ${destaque ? 'guia-card-destaque' : ''}`}>
                        <div className="text-[11px] font-[800] uppercase tracking-[0.4px] text-[#0677FF] mb-1">
                          Visita guiada · {m.tourOffer.titulo}
                        </div>
                        <p className="text-[12px] text-slate-600 leading-relaxed">{m.tourOffer.intro}</p>
                        <label className="mt-2 flex items-center gap-2 text-[11.5px] text-slate-500 cursor-pointer select-none">
                          <input type="checkbox"
                            onChange={(e) => { if (e.target.checked) bridge.setTourDisabled?.(view); }}
                            className="accent-[#0677FF]" />
                          Não perguntar novamente nesta ferramenta
                        </label>
                        <div className="mt-2 flex gap-2">
                          <button type="button"
                            onClick={() => bridge.startTour?.(view)}
                            className="inline-flex items-center gap-1.5 text-[12px] font-[800] px-3 py-2 rounded-xl bg-[#0677FF] text-white hover:bg-[#0560d6] active:scale-[0.97] transition-all">
                            Ver tour · {viewTitle || m.tourOffer.titulo}
                          </button>
                          <button type="button"
                            onClick={() => setMsgs((prev) => prev.filter((x) => x !== m))}
                            className="text-[12px] font-[700] px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-[0.97] transition-all">
                            Agora não
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sugestões de próximo passo (só na última mensagem do bot; nunca enquanto há um preenchimento por confirmar) */}
                  {m.role === 'assistant' && m.replies?.length && i === msgs.length - 1 && !busy && !m.pendingFill ? (
                    <div className="flex flex-wrap gap-1.5 pl-0.5">
                      {m.replies.map((opt, k) => (
                        <button key={k} type="button" onClick={() => send(opt)} aria-label={`Sugestão: ${opt}`}
                          className="text-left text-[12px] font-[700] px-3 py-1.5 rounded-full bg-white border border-[#0677FF]/30 text-[#0677FF] max-w-full whitespace-normal break-words hover:bg-[#0677FF] hover:text-white hover:border-[#0677FF] active:scale-[0.97] transition-all">
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}

              {/* Chips de arranque */}
              {msgs.length <= 1 && !busy && !msgs[msgs.length - 1]?.replies?.length && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {QUICK.map((q) => (
                    <button key={q} type="button" onClick={() => send(q)}
                      className="text-left text-[12px] font-[600] px-2.5 py-1.5 rounded-full bg-white border border-slate-200 text-[#334155] hover:border-[#0677FF] hover:text-[#0677FF] transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {busy && (
                <div className="flex justify-start">
                  <div className="rounded-[16px] rounded-bl-[5px] px-4 py-3 bg-white border border-slate-200">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0677FF] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0677FF] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0677FF] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-2.5">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
                  }}
                  rows={1}
                  placeholder="Escreve a tua pergunta…"
                  className="flex-1 resize-none max-h-28 px-3 py-2.5 rounded-[12px] bg-[#F5F7FA] border border-slate-200 text-[14px] font-[500] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#0677FF] focus:ring-2 focus:ring-[#0677FF]/15 transition-all"
                  style={{ fontSize: 16 }}
                />
                <button
                  type="button"
                  onClick={() => send(input)}
                  disabled={!input.trim() || busy}
                  aria-label="Enviar"
                  className="shrink-0 w-10 h-10 rounded-[12px] flex items-center justify-center text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.95] transition-all"
                  style={{ background: 'linear-gradient(135deg, #0677FF 0%, #044BB6 100%)' }}
                >
                  <Send className="w-4.5 h-4.5" strokeWidth={2.4} style={{ width: 18, height: 18 }} />
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 px-1">
                <Lightbulb className="w-3 h-3 text-[#94A3B8]" strokeWidth={2.2} />
                <p className="text-[10.5px] font-[500] text-[#94A3B8] leading-tight">
                  Apoio à ferramenta — não substitui o contabilista. Dados sensíveis não são partilhados.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
