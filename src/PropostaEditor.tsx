/**
 * Editor da proposta — lista de cards, canvas 16:9 e inspetor.
 *
 * Autosave local+Firestore (debounce 800 ms), geração AI por card e publicação
 * de link só-leitura. O PDF é a impressão do mesmo renderer, um card por página.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowUp, Check, Copy, ExternalLink, GripVertical,
  Link2, Loader2, Plus, Printer, Sparkles, Trash2, X,
} from 'lucide-react';
import type { OfficeSettings } from './lib/officeSettings';
import type { HonorariosConfig } from './lib/honorarios';
import type { DeckCard, DeckDoc, DeckTheme, CardKind } from './lib/deck/types';
import { DECK_THEMES, newCardId, cleanText } from './lib/deck/types';
import { buildBrief, type DeckCliente } from './lib/deck/build';
import { chooseDeck, prepareAiCard } from './lib/deck/plan';
import { requestAiCards } from './lib/deck/ai';
import { publicUrl, SHARE_DAYS } from './lib/deck/share';
import { publishDeck, revokeDeck, saveDeck } from './lib/deck/store';
import { DeckCardView, DeckPrintStyles } from './components/deck/DeckRenderer';
import GamaCopyButton from './components/GamaCopyButton';

interface Props {
  deck: DeckDoc;
  office: OfficeSettings;
  honorarios: HonorariosConfig;
  cliente: DeckCliente | null;
  autoAi?: boolean;
  onBack: () => void;
}

const KIND_LABEL: Record<CardKind, string> = {
  cover: 'Capa',
  section: 'Secção',
  bullets: 'Lista',
  stats: 'Números',
  pricing: 'Preço',
  timeline: 'Plano',
  contact: 'Contacto',
};

const KIND_SEED: Record<CardKind, Partial<DeckCard>> = {
  cover: { title: 'Proposta de Serviços', subtitle: 'O nosso escritório' },
  section: { title: 'Nova secção', body: 'Escreve aqui o texto.' },
  bullets: { title: 'Nova lista', items: [{ label: 'Primeiro ponto', note: 'Uma frase de apoio.' }] },
  stats: { title: 'Números', items: [{ label: 'Rótulo', value: '24h' }, { label: 'Rótulo', value: '100%' }] },
  pricing: { title: 'Investimento', items: [{ label: 'Serviço', value: '100 €/mês' }] },
  timeline: { title: 'Plano', items: [{ label: 'Semana 1', value: 'Arranque' }] },
  contact: { title: 'Próximo passo', subtitle: 'Falamos em breve.', items: [{ label: 'Email', value: 'geral@escritorio.pt' }] },
};

export default function PropostaEditor({ deck: initial, office, honorarios, cliente, autoAi, onBack }: Props) {
  const [deck, setDeck] = useState<DeckDoc>(initial);
  const [active, setActive] = useState(0);
  const [busyAi, setBusyAi] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const [pubOpen, setPubOpen] = useState(false);
  const [pubBusy, setPubBusy] = useState(false);
  const [pubError, setPubError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const dragFrom = useRef<number | null>(null);
  const autoAiDone = useRef(false);

  const card = deck.cards[active] ?? deck.cards[0];
  const brand = useMemo(
    () => ({
      nome: office.nome || 'Estudo 360°',
      corPrimaria: office.corPrimaria || '#0677FF',
      logoDataUrl: office.logoDataUrl,
      email: office.email,
      telefone: office.telefone,
      website: office.website,
    }),
    [office],
  );

  // Grava já o deck ao abrir: uma proposta nova ainda não existe no Firestore
  // e não pode perder-se se o utilizador sair sem editar nada.
  useEffect(() => {
    saveDeck(initial);
  }, [initial]);

  // ── autosave ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setSaved(false);
    const t = setTimeout(() => {
      saveDeck(deck);
      setSaved(true);
    }, 800);
    return () => clearTimeout(t);
  }, [deck]);

  const patch = useCallback((partial: Partial<DeckDoc>) => {
    setDeck((d) => ({ ...d, ...partial, updatedAt: Date.now() }));
  }, []);

  const patchCard = useCallback((id: string, partial: Partial<DeckCard>) => {
    setDeck((d) => ({
      ...d,
      updatedAt: Date.now(),
      cards: d.cards.map((c) => (c.id === id ? { ...c, ...partial } : c)),
    }));
  }, []);

  const move = useCallback((from: number, to: number) => {
    setDeck((d) => {
      if (to < 0 || to >= d.cards.length) return d;
      const cards = [...d.cards];
      const [c] = cards.splice(from, 1);
      cards.splice(to, 0, c);
      return { ...d, cards, updatedAt: Date.now() };
    });
    setActive((a) => (a === from ? to : a));
  }, []);

  const addCard = useCallback((kind: CardKind) => {
    const c: DeckCard = { id: newCardId(), kind, ...(KIND_SEED[kind] as object) } as DeckCard;
    setDeck((d) => {
      const cards = [...d.cards];
      const at = card && card.kind === 'contact' ? cards.length - 1 : cards.length;
      cards.splice(at, 0, c);
      return { ...d, cards, updatedAt: Date.now() };
    });
    setAddOpen(false);
  }, [card]);

  const removeCard = useCallback((id: string) => {
    setDeck((d) => {
      if (d.cards.length <= 3) return d;
      return { ...d, cards: d.cards.filter((c) => c.id !== id), updatedAt: Date.now() };
    });
    setActive((a) => Math.max(0, a - 1));
  }, []);

  const brief = useMemo(() => buildBrief({ office, honorarios, cliente }), [office, honorarios, cliente]);

  // ── geração AI ────────────────────────────────────────────────────────────
  const runFullAi = useCallback(async () => {
    setBusyAi(true);
    setAiNote('A escrever com AI…');
    const raw = await requestAiCards({ mode: 'plan', brief });
    const result = chooseDeck(raw, { office, honorarios, cliente });
    setDeck((d) => ({ ...d, cards: result.cards, updatedAt: Date.now() }));
    setActive(0);
    setAiNote(result.source === 'ai' ? 'Texto gerado por AI — revê e ajusta.' : 'AI indisponível: ficou a versão base, editável.');
    setBusyAi(false);
  }, [brief, office, honorarios, cliente]);

  useEffect(() => {
    if (!autoAi || autoAiDone.current) return;
    autoAiDone.current = true;
    void runFullAi();
  }, [autoAi, runFullAi]);

  const rewriteCard = useCallback(async () => {
    if (!card) return;
    setBusyAi(true);
    setAiNote(`A reescrever “${KIND_LABEL[card.kind]}”…`);
    const raw = await requestAiCards({ mode: 'rewrite', brief, card, instruction: 'mais concreto, sem clichés, mantém o tamanho' });
    if (raw) {
      const next = prepareAiCard(raw, { office, honorarios, cliente }, card);
      setDeck((d) => ({ ...d, cards: d.cards.map((c) => (c.id === card.id ? next : c)), updatedAt: Date.now() }));
      setAiNote('Card reescrito. Podes continuar a editar à mão.');
    } else {
      setAiNote('Não consegui reescrever agora — o card ficou como estava.');
    }
    setBusyAi(false);
  }, [card, brief, office, honorarios, cliente]);

  // ── publicar ──────────────────────────────────────────────────────────────
  const publish = useCallback(async () => {
    setPubBusy(true);
    setPubError(null);
    try {
      const saved = saveDeck(deck);
      const res = await publishDeck(saved, office);
      const next = { ...saved, slug: res.slug, expiresAt: res.expiresAt };
      setDeck(next);
      saveDeck(next);
      setPubOpen(true);
    } catch (e) {
      setPubError(e instanceof Error ? e.message : 'Falha ao publicar.');
    } finally {
      setPubBusy(false);
    }
  }, [deck, office]);

  const revoke = useCallback(async () => {
    if (!deck.slug) return;
    setPubBusy(true);
    try {
      await revokeDeck(deck.slug);
      const next = { ...deck, slug: undefined, expiresAt: undefined };
      setDeck(next);
      saveDeck(next);
      setPubOpen(false);
    } catch {
      setPubError('Não consegui revogar. Tenta outra vez.');
    } finally {
      setPubBusy(false);
    }
  }, [deck]);

  const copyLink = useCallback(async () => {
    if (!deck.slug) return;
    try {
      await navigator.clipboard.writeText(publicUrl(deck.slug));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard bloqueado — o link fica visível para copiar à mão */ }
  }, [deck.slug]);

  const print = useCallback(() => {
    window.print();
  }, []);

  const items = card?.items ?? [];

  return (
    <div className="h-full flex flex-col bg-[#F5F7FA]">
      <DeckPrintStyles />

      {/* Barra superior */}
      <div className="no-print shrink-0 bg-white border-b border-[#E2E8F0] px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] font-[700] text-[#64748B] hover:text-[#0F172A]">
          <ArrowLeft className="w-4 h-4" /> Propostas
        </button>
        <input
          value={deck.titulo}
          onChange={(e) => patch({ titulo: e.target.value.slice(0, 90) })}
          className="flex-1 min-w-[180px] max-w-[420px] px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[14px] font-[700] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0677FF]/30"
          aria-label="Título da proposta"
        />
        <select
          value={deck.tema}
          onChange={(e) => patch({ tema: e.target.value as DeckTheme })}
          className="px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] text-[12px] font-[700] text-[#334155] bg-white"
          aria-label="Tema"
        >
          {DECK_THEMES.map((t) => <option key={t} value={t}>{t === 'claro' ? 'Claro' : t === 'escuro' ? 'Escuro' : 'Marca'}</option>)}
        </select>
        <span className="text-[11px] font-[600] text-[#94A3B8] inline-flex items-center gap-1">
          {saved ? <><Check className="w-3.5 h-3.5" /> Guardado</> : <><Loader2 className="w-3.5 h-3.5 animate-spin" /> A guardar…</>}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={rewriteCard} disabled={busyAi || !card} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[12px] font-[700] text-[#334155] hover:border-[#0677FF] disabled:opacity-50">
            {busyAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Regerar card
          </button>
          <GamaCopyButton office={office} honorarios={honorarios} cliente={cliente} briefing={deck.respostas} />
          <button onClick={print} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[12px] font-[700] text-[#334155] hover:border-[#0677FF]">
            <Printer className="w-4 h-4" /> PDF
          </button>
          <button onClick={publish} disabled={pubBusy} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0677FF] text-white text-[12px] font-[700] hover:bg-[#0059c9] disabled:opacity-60">
            {pubBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} {deck.slug ? 'Atualizar link' : 'Publicar'}
          </button>
        </div>
      </div>

      {aiNote && (
        <div className="no-print px-4 py-1.5 bg-[#EFF6FF] border-b border-[#DBEAFE] text-[12px] font-[600] text-[#1D4ED8] flex items-center gap-2">
          {busyAi && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {aiNote}
          {!busyAi && <button onClick={() => setAiNote(null)} className="ml-auto text-[#1D4ED8]/70 hover:text-[#1D4ED8]"><X className="w-3.5 h-3.5" /></button>}
        </div>
      )}

      <div className="no-print flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        {/* Lista de cards */}
        <aside className="order-2 lg:order-1 w-full lg:w-[210px] shrink-0 border-t lg:border-t-0 lg:border-r border-[#E2E8F0] bg-white lg:overflow-y-auto p-2 flex lg:block gap-1 overflow-x-auto">
          {deck.cards.map((c, i) => (
            <div
              key={c.id}
              draggable
              onDragStart={() => { dragFrom.current = i; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragFrom.current !== null) move(dragFrom.current, i); dragFrom.current = null; }}
              onClick={() => setActive(i)}
              className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer border shrink-0 min-w-[150px] lg:min-w-0 ${i === active ? 'border-[#0677FF] bg-[#EFF6FF]' : 'border-transparent hover:bg-[#F8FAFC]'}`}
            >
              <GripVertical className="w-3.5 h-3.5 text-[#CBD5E1] shrink-0" />
              <span className="w-5 h-5 rounded bg-[#F1F5F9] text-[10px] font-[800] text-[#64748B] flex items-center justify-center shrink-0">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-[800] text-[#0F172A] truncate">{c.title || KIND_LABEL[c.kind]}</div>
                <div className="text-[10px] font-[600] text-[#94A3B8] truncate">{KIND_LABEL[c.kind]}</div>
              </div>
              {deck.cards.length > 3 && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeCard(c.id); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-[#94A3B8] hover:text-red-600"
                  aria-label={`Remover card ${i + 1}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          <div className="flex gap-1 pt-1 shrink-0 min-w-[150px] lg:min-w-0">
            <button onClick={() => move(active, active - 1)} disabled={active === 0} className="flex-1 py-1.5 rounded-lg border border-[#E2E8F0] text-[11px] font-[700] text-[#64748B] disabled:opacity-40 inline-flex items-center justify-center gap-1"><ArrowUp className="w-3 h-3" /> Subir</button>
            <button onClick={() => move(active, active + 1)} disabled={active >= deck.cards.length - 1} className="flex-1 py-1.5 rounded-lg border border-[#E2E8F0] text-[11px] font-[700] text-[#64748B] disabled:opacity-40 inline-flex items-center justify-center gap-1"><ArrowDown className="w-3 h-3" /> Descer</button>
          </div>
          <div className="relative pt-1 shrink-0 min-w-[150px] lg:min-w-0">
            <button onClick={() => setAddOpen((v) => !v)} className="w-full py-2 rounded-lg border border-dashed border-[#CBD5E1] text-[12px] font-[700] text-[#0677FF] hover:bg-[#EFF6FF] inline-flex items-center justify-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Adicionar card
            </button>
            {addOpen && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#E2E8F0] rounded-xl shadow-xl p-1">
                {(Object.keys(KIND_LABEL) as CardKind[]).map((k) => (
                  <button key={k} onClick={() => addCard(k)} className="w-full text-left px-2.5 py-1.5 rounded-lg text-[12px] font-[600] text-[#334155] hover:bg-[#F1F5F9]">{KIND_LABEL[k]}</button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Canvas */}
        <main className="order-1 lg:order-2 flex-1 min-w-0 p-2.5 md:p-6 flex items-start justify-center lg:overflow-auto">
          <div className="w-full max-w-[1120px] shadow-[0_10px_40px_rgba(15,23,42,0.14)] rounded-[10px] overflow-hidden">
            {card && <DeckCardView card={card} tema={deck.tema} brand={brand} index={active} total={deck.cards.length} />}
          </div>
        </main>

        {/* Inspetor */}
        <aside className="order-3 w-full lg:w-[300px] shrink-0 border-t lg:border-t-0 lg:border-l border-[#E2E8F0] bg-white lg:overflow-y-auto p-3 space-y-3">
          {card && (
            <>
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[10px] font-[800] uppercase tracking-wide text-[#64748B]">{KIND_LABEL[card.kind]}</span>
                <span className="text-[10px] font-[600] text-[#94A3B8]">#{active + 1}</span>
              </div>
              <Field label="Título">
                <input value={card.title ?? ''} onChange={(e) => patchCard(card.id, { title: cleanText(e.target.value, 90) })} className={inputCls} />
              </Field>
              <Field label="Subtítulo">
                <input value={card.subtitle ?? ''} onChange={(e) => patchCard(card.id, { subtitle: cleanText(e.target.value, 140) })} className={inputCls} />
              </Field>
              <Field label="Texto">
                <textarea value={card.body ?? ''} onChange={(e) => patchCard(card.id, { body: cleanText(e.target.value, 700) })} rows={4} className={inputCls + ' resize-y'} />
              </Field>

              <div className="pt-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-[800] uppercase tracking-wide text-[#64748B]">Itens</span>
                  <button
                    onClick={() => patchCard(card.id, { items: [...items, { label: 'Novo item' }] })}
                    className="text-[11px] font-[700] text-[#0677FF] inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Juntar
                  </button>
                </div>
                <div className="space-y-2">
                  {items.map((it, i) => (
                    <div key={i} className="rounded-lg border border-[#E2E8F0] p-2 space-y-1">
                      <div className="flex items-center gap-1">
                        <input
                          value={it.label}
                          onChange={(e) => {
                            const next = [...items];
                            next[i] = { ...it, label: cleanText(e.target.value, 90) };
                            patchCard(card.id, { items: next });
                          }}
                          className="flex-1 px-2 py-1 rounded border border-[#E2E8F0] text-[11px] font-[700]"
                          placeholder="Rótulo"
                        />
                        <button
                          onClick={() => patchCard(card.id, { items: items.filter((_, j) => j !== i) })}
                          className="p-1 text-[#94A3B8] hover:text-red-600"
                          aria-label="Remover item"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input
                        value={it.value ?? ''}
                        onChange={(e) => {
                          const next = [...items];
                          next[i] = { ...it, value: cleanText(e.target.value, 60) };
                          patchCard(card.id, { items: next });
                        }}
                        className="w-full px-2 py-1 rounded border border-[#E2E8F0] text-[11px]"
                        placeholder="Valor (opcional)"
                      />
                      <input
                        value={it.note ?? ''}
                        onChange={(e) => {
                          const next = [...items];
                          next[i] = { ...it, note: cleanText(e.target.value, 160) };
                          patchCard(card.id, { items: next });
                        }}
                        className="w-full px-2 py-1 rounded border border-[#E2E8F0] text-[11px] text-[#64748B]"
                        placeholder="Nota (opcional)"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[10px] font-[500] text-[#94A3B8] pt-1">
                O preço do card “Preço” é sempre o calculado pelos honorários — a AI não o altera.
              </p>
            </>
          )}
        </aside>
      </div>

      {/* Impressão: todos os cards, um por página */}
      <div id="deck-print-root" style={{ display: 'none' }}>
        {deck.cards.map((c, i) => (
          <div key={c.id} className="deck-page">
            <DeckCardView card={c} tema={deck.tema} brand={brand} index={i} total={deck.cards.length} />
          </div>
        ))}
      </div>

      {/* Modal de publicação */}
      {pubOpen && deck.slug && (
        <div className="no-print fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setPubOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[16px] font-[800] text-[#0F172A]">Proposta publicada</h3>
                <p className="text-[12px] text-[#64748B] mt-0.5">Link só-leitura. Expira em {SHARE_DAYS} dias ou quando revogares.</p>
              </div>
              <button onClick={() => setPubOpen(false)} className="p-1 text-[#94A3B8] hover:text-[#0F172A]"><X className="w-5 h-5" /></button>
            </div>
            <div className="mt-4 flex items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-2">
              <code className="flex-1 text-[12px] font-mono text-[#0F172A] truncate">{publicUrl(deck.slug)}</code>
              <button onClick={copyLink} className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0677FF] text-white text-[11px] font-[700]">
                {copied ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
              </button>
            </div>
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <a href={publicUrl(deck.slug)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E2E8F0] text-[12px] font-[700] text-[#334155] hover:border-[#0677FF]">
                <ExternalLink className="w-4 h-4" /> Abrir link
              </a>
              <a href={`mailto:?subject=${encodeURIComponent(deck.titulo)}&body=${encodeURIComponent(publicUrl(deck.slug))}`} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E2E8F0] text-[12px] font-[700] text-[#334155] hover:border-[#0677FF]">
                Enviar por email
              </a>
              <button onClick={revoke} disabled={pubBusy} className="ml-auto text-[12px] font-[700] text-red-600 hover:underline disabled:opacity-50">Revogar link</button>
            </div>
            {pubError && <p className="mt-3 text-[12px] font-[600] text-red-600">{pubError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = 'w-full px-2.5 py-1.5 rounded-lg border border-[#E2E8F0] text-[12px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0677FF]/30';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-[800] uppercase tracking-wide text-[#64748B] mb-1">{label}</span>
      {children}
    </label>
  );
}
