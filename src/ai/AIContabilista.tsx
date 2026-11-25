import React, { useState, useRef, useEffect, useCallback, useImperativeHandle } from 'react';
import { X, Trash2, ChevronLeft, Home, PlayCircle, FileUp, Download, Lightbulb, Check } from 'lucide-react';
import { ARVORE, NO_RAIZ, type NoAjuda } from './arvoreAjuda';
import { registerSuggestion } from './suggestions';
import type { FillField } from './actions';
import { useHideOnScroll } from '../lib/useHideOnScroll';
import { useAuth } from '../lib/auth';

// Bridge fornecida pelo App: navegação, importação de SAF-T e downloads.
// (O bot já não chama nenhum modelo — não há dados a sair do browser.)
export interface BotBridge {
  getContext: () => string;
  /** Aceita vistas da app e também tabs do gabinete ('gab-…'). */
  navigate: (view: string) => void;
  setMode: (mode: 'empresa' | 'novo-cliente') => void;
  applyFill: (target: string, fields: FillField[]) => void;
  openSaftUpload?: (mode?: 'novo' | 'empresa') => { ok: boolean; reason?: string };
  listDownloadableDocs?: () => { id: string; label: string }[];
  listClients?: () => { id: string; name: string }[];
  selectClient?: (name: string) => { ok: boolean; name?: string };
  downloadDoc?: (docId: string) => Promise<{ ok: boolean; label?: string; reason?: string }>;
  currentUser?: string;
  currentView?: string;
  /** Inicia a visita guiada da ferramenta indicada. */
  startTour?: (view: string) => void;
  setTourDisabled?: (view: string) => void;
  tourActive?: () => boolean;
}

/** API exposta pelo bot à app (ref). */
export interface BotApi {
  notifyTourEnd: (view: string) => void;
}

interface Passo {
  noId: string;
  /** Rótulo escolhido para chegar a este passo (mostrado como bolha do utilizador). */
  escolha?: string;
}

const ABRIU_KEY = 'estudo360:ajuda:abriu-sessao';

/** Uma folha pode ter várias ações; a UI mostra só as que fazem sentido. */
function Folha({ no, bridge, onFechar }: { no: NoAjuda; bridge: BotBridge; onFechar: () => void }) {
  const [estado, setEstado] = useState<string | null>(null);
  const [sugestao, setSugestao] = useState('');
  const [enviada, setEnviada] = useState<'cloud' | 'local' | null>(null);
  const docs = no.docs ? (bridge.listDownloadableDocs?.() ?? []) : [];

  const verNoEcra = () => {
    if (!no.destino) return;
    const { view, guia } = no.destino;
    onFechar();
    // Deixa o painel fechar e a vista montar antes de arrancar o tour.
    window.setTimeout(() => {
      bridge.navigate(view);
      if (guia) window.setTimeout(() => bridge.startTour?.(guia), 350);
    }, 120);
  };

  const abrirSaft = () => {
    const res = bridge.openSaftUpload?.(no.saft ?? 'novo');
    if (res && !res.ok) {
      setEstado(res.reason === 'sem-cliente'
        ? 'Escolha primeiro um cliente na Lista de Empresas e tente outra vez.'
        : 'Não consegui abrir o seletor de ficheiro. Tente outra vez.');
    }
  };

  const descarregar = async (id: string, label: string) => {
    setEstado('A preparar…');
    const res = await bridge.downloadDoc?.(id);
    setEstado(res?.ok ? `Descarregado: ${res.label ?? label}` : 'Não consegui gerar esse documento.');
  };

  const enviarSugestao = async () => {
    const texto = sugestao.trim();
    if (!texto) return;
    const res = await registerSuggestion({
      title: texto.slice(0, 90),
      detail: texto,
      area: 'assistente',
      autor: bridge.currentUser,
      vista: bridge.currentView,
    });
    setSugestao('');
    setEnviada(res.cloud ? 'cloud' : 'local');
  };

  return (
    <div className="flex flex-col gap-2">
      {no.destino && (
        <button
          type="button"
          onClick={verNoEcra}
          className="inline-flex items-center justify-center gap-2 self-start px-3.5 py-2.5 rounded-[12px] text-[12.5px] font-[800] text-white active:scale-[0.98] transition-all"
          style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)' }}
        >
          <PlayCircle className="w-4 h-4" strokeWidth={2.4} /> Ver no ecrã
        </button>
      )}

      {no.saft && (
        <button
          type="button"
          onClick={abrirSaft}
          className="inline-flex items-center gap-2 self-start px-3.5 py-2.5 rounded-[12px] text-[12.5px] font-[800] bg-white border border-[var(--accent)]/40 text-[var(--accent)] hover:bg-[var(--accent)]/5 active:scale-[0.98] transition-all"
        >
          <FileUp className="w-4 h-4" strokeWidth={2.4} />
          {no.saft === 'empresa' ? 'Carregar SAF-T neste cliente' : 'Escolher ficheiro SAF-T'}
        </button>
      )}

      {no.docs && (
        <div className="flex flex-wrap gap-1.5">
          {docs.length === 0 && (
            <span className="text-[12px] text-[#64748B]">Selecione primeiro um cliente.</span>
          )}
          {docs.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => { void descarregar(d.id, d.label); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[var(--accent)]/30 text-[12px] font-[700] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white active:scale-[0.97] transition-all"
            >
              <Download className="w-3.5 h-3.5" strokeWidth={2.4} /> {d.label}
            </button>
          ))}
        </div>
      )}

      {no.sugestao && (
        enviada ? (
          <p className="flex items-center gap-1.5 text-[12px] font-[700] text-emerald-600">
            <Check className="w-4 h-4" strokeWidth={3} />
            {enviada === 'cloud'
              ? 'Obrigado — a sugestão foi enviada.'
              : 'Guardada neste dispositivo. Vai seguir assim que houver ligação.'}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <label htmlFor="ajuda-sugestao" className="text-[11.5px] font-[700] text-[#64748B]">
              A sua sugestão
            </label>
            <textarea
              id="ajuda-sugestao"
              value={sugestao}
              onChange={(e) => setSugestao(e.target.value)}
              rows={3}
              maxLength={800}
              placeholder="Ex.: queria exportar o mapa RH para Excel…"
              className="resize-none px-3 py-2.5 rounded-[10px] bg-white border border-slate-200 text-[13px] font-[500] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 transition-all"
              style={{ fontSize: 16 }}
            />
            <button
              type="button"
              onClick={() => { void enviarSugestao(); }}
              disabled={!sugestao.trim()}
              className="self-start px-3.5 py-2 rounded-[10px] text-[12.5px] font-[800] text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
              style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)' }}
            >
              Enviar sugestão
            </button>
          </div>
        )
      )}

      {estado && <p className="text-[11.5px] font-[600] text-[#64748B]" role="status">{estado}</p>}
    </div>
  );
}

export default function AIContabilista({ ref, bridge, liftBottom = false }: {
  ref?: React.Ref<BotApi>;
  bridge: BotBridge;
  liftBottom?: boolean;
  view: string;
  viewTitle?: string;
}) {
  const { user, employeeProfile, accountEmail } = useAuth();
  const personName = employeeProfile?.nome || user?.displayName || accountEmail || user?.email || 'Utilizador';
  const personInitials = personName
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';

  const [open, setOpen] = useState(false);
  const scrollHidden = useHideOnScroll();
  const [caminho, setCaminho] = useState<Passo[]>([{ noId: NO_RAIZ }]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const opcoesRef = useRef<HTMLDivElement>(null);

  const noAtual = ARVORE[caminho[caminho.length - 1]?.noId ?? NO_RAIZ] ?? ARVORE[NO_RAIZ];
  const naRaiz = caminho.length <= 1;

  // Abre sozinho uma vez por sessão (pedido: a primeira interação é o chat a perguntar).
  useEffect(() => {
    try {
      if (!sessionStorage.getItem(ABRIU_KEY)) {
        sessionStorage.setItem(ABRIU_KEY, '1');
        setOpen(true);
      }
    } catch { /* modo privado — fica fechado */ }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    // Foco na primeira opção: teclado não fica preso no vazio.
    const t = window.setTimeout(() => {
      opcoesRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }, 80);
    return () => window.clearTimeout(t);
  }, [open, caminho]);

  const escolher = useCallback((rotulo: string, proximo: string) => {
    setCaminho((c) => [...c, { noId: proximo, escolha: rotulo }]);
  }, []);

  const voltar = () => setCaminho((c) => (c.length > 1 ? c.slice(0, -1) : c));
  const inicio = () => setCaminho([{ noId: NO_RAIZ }]);

  const notifyTourEnd = useCallback((_v: string) => { /* silencioso */ }, []);
  useImperativeHandle(ref, () => ({ notifyTourEnd }), [notifyTourEnd]);

  const fechar = () => setOpen(false);

  return (
    <>
      {/* Botão flutuante */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir o AI Contabilista"
          aria-hidden={scrollHidden}
          tabIndex={scrollHidden ? -1 : 0}
          className={`no-print fixed z-[90] right-5 lg:right-6 flex items-center gap-2.5 justify-center w-11 h-11 lg:w-auto lg:h-auto lg:py-3 lg:pl-3.5 lg:pr-4 py-0 rounded-full text-white font-[800] text-[14px] active:scale-[0.97] transition-all duration-200 ${liftBottom ? 'bottom-40 lg:bottom-24' : 'bottom-5 lg:bottom-6'} ${scrollHidden ? 'opacity-0 translate-y-3 pointer-events-none' : ''}`}
          style={{
            background: 'linear-gradient(135deg, var(--accent) 0%, #00C2FF 100%)',
            boxShadow: '0 8px 28px -8px rgba(6,119,255,0.65), 0 0 0 1px rgba(6,119,255,0.25)',
          }}
        >
          <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/20">
            <span className="text-[10px] font-[900] tracking-[0.3px]" aria-hidden>{personInitials}</span>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#00FFA3] border-2 border-[var(--accent)]" />
          </span>
          <span className="hidden lg:inline">AI Contabilista</span>
        </button>
      )}

      {/* Painel */}
      {open && (
        <div className="no-print fixed inset-0 z-[95] sm:inset-auto sm:bottom-6 sm:right-6 flex items-end sm:items-stretch justify-center sm:justify-end">
          <button
            type="button"
            aria-label="Fechar"
            onClick={fechar}
            className="sm:hidden absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          />

          <div
            role="dialog"
            aria-label="Assistente do Estudo 360"
            className="relative w-full sm:w-[400px] h-[88vh] sm:h-[640px] sm:max-h-[calc(100vh-3rem)] bg-white rounded-t-[24px] sm:rounded-[24px] shadow-2xl flex flex-col overflow-hidden border border-slate-200"
            style={{ boxShadow: '0 24px 60px -12px rgba(11,29,45,0.45)' }}
          >
            {/* Header */}
            <div className="shrink-0 px-4 py-3 flex items-center gap-3 text-white"
              style={{ background: 'linear-gradient(135deg, #0B1D2D 0%, var(--accent) 100%)' }}>
              <span className="relative flex items-center justify-center w-9 h-9 rounded-full bg-white/15 shrink-0">
                <span className="text-[11px] font-[900] tracking-[0.3px]" aria-hidden>{personInitials}</span>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#00FFA3] border-2 border-[#0B1D2D]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-[800] leading-tight">AI Contabilista</div>
                <div className="text-[11px] font-[600] text-white/70 leading-tight">Assistente do Estudo 360 · guia passo a passo</div>
              </div>
              {!naRaiz && (
                <button type="button" onClick={inicio} aria-label="Voltar ao início"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                  <Trash2 className="w-4 h-4" strokeWidth={2.2} />
                </button>
              )}
              <button type="button" onClick={fechar} aria-label="Fechar"
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                <X className="w-4 h-4" strokeWidth={2.4} />
              </button>
            </div>

            {/* Conversa */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#F5F7FA]">
              {caminho.map((p, i) => {
                const no = ARVORE[p.noId];
                if (!no) return null;
                const ultimo = i === caminho.length - 1;
                return (
                  <div key={i} className="space-y-2">
                    {p.escolha && (
                      <div className="flex justify-end">
                        <div
                          className="max-w-[85%] rounded-[16px] rounded-br-[5px] px-3.5 py-2.5 text-[13px] font-[600] leading-snug text-white"
                          style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)' }}
                        >
                          {p.escolha}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-start">
                      <div className="max-w-[88%] rounded-[16px] rounded-bl-[5px] px-3.5 py-2.5 text-[13.5px] font-[500] leading-relaxed text-[#0F172A] bg-white border border-slate-200">
                        {no.texto}
                      </div>
                    </div>

                    {ultimo && no.opcoes && (
                      <div ref={opcoesRef} className="flex flex-col gap-1.5 pt-0.5" role="group" aria-label="Escolha uma opção">
                        {no.opcoes.map((o) => (
                          <button
                            key={o.proximo}
                            type="button"
                            onClick={() => escolher(o.rotulo, o.proximo)}
                            className="text-left px-3.5 py-2.5 rounded-[12px] bg-white border border-slate-200 text-[13px] font-[700] text-[#0F172A] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/[0.04] active:scale-[0.99] transition-all"
                          >
                            {o.rotulo}
                          </button>
                        ))}
                      </div>
                    )}

                    {ultimo && !no.opcoes && (
                      <div className="pl-0.5">
                        <Folha no={no} bridge={bridge} onFechar={fechar} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Navegação — sem caixa de texto: o caminho faz-se por escolhas */}
            <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={voltar}
                  disabled={naRaiz}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-[10px] text-[12.5px] font-[800] text-[#334155] bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" strokeWidth={2.6} /> Voltar
                </button>
                <button
                  type="button"
                  onClick={inicio}
                  disabled={naRaiz}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-[10px] text-[12.5px] font-[700] text-[#64748B] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Home className="w-3.5 h-3.5" strokeWidth={2.4} /> Início
                </button>
                <span className="ml-auto text-[10.5px] font-[500] text-[#94A3B8]">escolha uma opção</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 px-1">
                <Lightbulb className="w-3 h-3 text-[#94A3B8]" strokeWidth={2.2} />
                <p className="text-[10.5px] font-[500] text-[#94A3B8] leading-tight">
                  Guias da ferramenta — não substitui o contabilista.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
