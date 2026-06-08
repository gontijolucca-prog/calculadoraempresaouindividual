import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, Send, Trash2, Check, RotateCcw, Lightbulb } from 'lucide-react';
import { parseReply, type BotAction, type FillField, type ViewId } from './actions';
import { registerSuggestion } from './suggestions';

// Bridge fornecida pelo App: dá ao bot poderes de navegação e preenchimento,
// e um contexto ANONIMIZADO (sem dados sensíveis) para enviar ao modelo.
export interface BotBridge {
  getContext: () => string;
  navigate: (view: ViewId) => void;
  setMode: (mode: 'empresa' | 'novo-cliente') => void;
  applyFill: (target: string, fields: FillField[]) => void;
  currentUser?: string;
  currentView?: string;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  notes?: string[];                 // ações auto-aplicadas (navegação/sugestão)
  pendingFill?: { target: string; fields: FillField[] } | null;
  fillApplied?: boolean;
  replies?: string[];               // sugestões de próximo passo (botões clicáveis)
}

const STORE_KEY = 'estudo360:ai_chat_v1';
const GREETING: ChatMsg = {
  role: 'assistant',
  content: 'Olá! Sou o **AI Contabilista**, o teu assistente aqui no Estudo 360. Posso explicar qualquer função, abrir os simuladores por ti, ajudar a preencher um cliente e registar sugestões de melhoria. Em que te ajudo?',
};

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

function loadChat(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as ChatMsg[];
      if (Array.isArray(arr) && arr.length) return arr;
    }
  } catch { /* ignora */ }
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

export default function AIContabilista({ bridge, liftBottom = false }: { bridge: BotBridge; liftBottom?: boolean }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>(loadChat);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(msgs.slice(-40))); } catch { /* */ }
  }, [msgs]);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, busy, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    setTimeout(() => inputRef.current?.focus(), 120);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Aplica ações que não precisam de confirmação (navegação, modo, sugestões).
  const applyAutoActions = useCallback(async (actions: BotAction[]): Promise<string[]> => {
    const notes: string[] = [];
    for (const a of actions) {
      if (a.type === 'navigate') {
        bridge.navigate(a.view);
        notes.push(`Abri: ${VIEW_LABEL[a.view] ?? a.view}`);
      } else if (a.type === 'setMode') {
        bridge.setMode(a.mode);
        notes.push(a.mode === 'empresa' ? 'Mudei para o modo Empresa' : 'Mudei para o modo Novo Cliente');
      } else if (a.type === 'suggestion') {
        const { cloud } = await registerSuggestion({
          title: a.title, detail: a.detail, area: a.area,
          autor: bridge.currentUser, vista: bridge.currentView,
        });
        notes.push(cloud ? 'Sugestão registada para a equipa ✓' : 'Sugestão guardada (será sincronizada) ✓');
      }
    }
    return notes;
  }, [bridge]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput('');
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
      const autoActions = actions.filter((a) => a.type !== 'fill' && a.type !== 'replies');
      const notes = await applyAutoActions(autoActions);

      setMsgs((prev) => [...prev, {
        role: 'assistant',
        content: visible,
        notes: notes.length ? notes : undefined,
        pendingFill: fillAction ? { target: fillAction.target, fields: fillAction.fields } : null,
        replies: repliesAction?.options,
      }]);
    } catch {
      setMsgs((prev) => [...prev, { role: 'assistant', content: 'Tive um problema de ligação. Verifica a internet e tenta de novo.' }]);
    } finally {
      setBusy(false);
    }
  }, [msgs, busy, bridge, applyAutoActions]);

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

  return (
    <>
      {/* Botão flutuante */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir o AI Contabilista"
          className={`no-print fixed z-[90] ${liftBottom ? 'bottom-24' : 'bottom-5'} right-5 sm:bottom-6 sm:right-6 flex items-center gap-2.5 pl-3.5 pr-4 py-3 rounded-full text-white font-[800] text-[14px] active:scale-[0.97] transition-all group`}
          style={{
            background: 'linear-gradient(135deg, #0677FF 0%, #00C2FF 100%)',
            boxShadow: '0 8px 28px -8px rgba(6,119,255,0.65), 0 0 0 1px rgba(6,119,255,0.25)',
          }}
        >
          <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/20">
            <Sparkles className="w-4.5 h-4.5" strokeWidth={2.5} style={{ width: 18, height: 18 }} />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#00FFA3] border-2 border-[#0677FF]" />
          </span>
          <span className="hidden sm:inline">AI Contabilista</span>
        </button>
      )}

      {/* Painel */}
      {open && (
        <div className="no-print fixed inset-0 z-[95] sm:inset-auto sm:bottom-6 sm:right-6 flex items-end sm:items-stretch justify-center sm:justify-end">
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
              <button type="button" onClick={clearChat} aria-label="Limpar conversa"
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                <Trash2 className="w-4 h-4" strokeWidth={2.2} />
              </button>
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

                    {/* Notas de ações auto-aplicadas */}
                    {m.notes?.map((n, k) => (
                      <div key={k} className="mt-2 flex items-center gap-1.5 text-[11.5px] font-[700] text-[#0677FF]">
                        <RotateCcw className="w-3.5 h-3.5" strokeWidth={2.5} /> {n}
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
              {msgs.length <= 1 && !busy && (
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
