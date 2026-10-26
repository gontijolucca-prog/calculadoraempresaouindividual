/**
 * "Fazer Proposta" — entrada do módulo: lista as propostas guardadas e cria
 * uma nova a partir de um cliente (ou versão geral do escritório).
 *
 * Fluxo: escolher cliente → criar deck base (template) → abrir editor, que
 * pede o texto à AI em background e cai no template se ela falhar.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock, Copy, FileText, Link2, Loader2, Plus, Presentation, Settings as SettingsIcon, Sparkles, Trash2, X } from 'lucide-react';
import type { OfficeSettings } from './lib/officeSettings';
import { officeSettingsAreComplete } from './lib/officeSettings';
import type { HonorariosConfig } from './lib/honorarios';
import { listEmpresas, getCurrentEmpresaId } from './lib/empresas';
import { type DeckCliente } from './lib/deck/build';
import { buildPropostaTailored, type BriefingCliente } from './lib/deck/tailoring';
import { buildGamaPrompt } from './lib/gamaPrompt';
import { logAudit } from './lib/audit';
import { DECK_THEMES, type DeckDoc, type DeckTheme } from './lib/deck/types';
import { publicUrl } from './lib/deck/share';
import { listMetas, removeDeck, syncMetas, type DeckMeta } from './lib/deck/store';
import { useAuth } from './lib/auth';
import { getGabineteOfficeId } from './lib/gabinete';

interface Props {
  office: OfficeSettings;
  honorarios: HonorariosConfig;
  onOpen: (deck: DeckDoc, cliente: DeckCliente | null, autoAi: boolean) => void;
  onGoToOfficeSettings: () => void;
}

function newDeckId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return `d_${c.randomUUID().replace(/-/g, '').slice(0, 20)}`;
  return `d_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export default function PropostaView({ office, honorarios, onOpen, onGoToOfficeSettings }: Props) {
  const { user } = useAuth();
  const [metas, setMetas] = useState<DeckMeta[]>(() => listMetas());
  const [creating, setCreating] = useState(false);
  const [passo, setPasso] = useState<'escolha' | 'briefing'>('escolha');
  const [caminho, setCaminho] = useState<'app' | 'gamma' | null>(null);
  const [briefing, setBriefing] = useState<BriefingCliente>({});
  const [ajuste, setAjuste] = useState('');
  const [motivoAjuste, setMotivoAjuste] = useState('');
  const [gammaTxt, setGammaTxt] = useState<string | null>(null);
  // Já entra no cliente ativo: a proposta sai logo à medida dele.
  const [clienteId, setClienteId] = useState(() => getCurrentEmpresaId() || '');
  const [tema, setTema] = useState<DeckTheme>('claro');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const empresas = useMemo(() => listEmpresas(), []);

  useEffect(() => {
    let alive = true;
    syncMetas().then((m) => { if (alive) setMetas(m); });
    return () => { alive = false; };
  }, []);

  // As 4 perguntas começam preenchidas com o que já existe do cliente.
  useEffect(() => {
    const emp = empresas.find((e) => e.id === clienteId);
    const p = (emp?.profile ?? {}) as Record<string, unknown>;
    setBriefing((b) => ({
      setor: b.setor || (typeof p.atividadePrincipal === 'string' ? p.atividadePrincipal : ''),
      dimensao: b.dimensao || (p.nrFuncionarios ? `${p.nrFuncionarios} pessoa(s)` : ''),
      faturacao: b.faturacao || (p['faturaçaoAnualPrevista'] ? `${Number(p['faturaçaoAnualPrevista']).toLocaleString('pt-PT')} €` : ''),
      objetivo: b.objetivo || '',
    }));
  }, [clienteId, empresas]);

  const clienteSelecionado = (): DeckCliente | null => {
    const empresa = empresas.find((e) => e.id === clienteId) ?? null;
    return empresa
      ? { id: empresa.id, nome: empresa.nome, nif: empresa.nif, profile: empresa.profile as DeckCliente['profile'] }
      : null;
  };

  /** Caminho 1: gera a proposta dentro do Estudo360 (7 blocos, preço real). */
  const criarNaApp = async () => {
    setBusy(true);
    setError(null);
    try {
      const cliente = clienteSelecionado();
      const valorAjuste = Number(ajuste.replace(',', '.')) || 0;
      const deck = buildPropostaTailored({
        id: newDeckId(),
        office,
        honorarios,
        cliente,
        briefing,
        tema,
        ownerUid: user?.uid || '',
        gabineteId: getGabineteOfficeId(),
        ajuste: valorAjuste || motivoAjuste.trim()
          ? { mensal: valorAjuste, motivo: motivoAjuste.trim() || 'Ajuste comercial', por: user?.email || user?.uid || 'local' }
          : undefined,
      });
      if (valorAjuste) {
        logAudit('proposta_ajuste_preco', `Proposta ${cliente?.nome || 'geral'}`, {
          ajusteMensal: valorAjuste, motivo: motivoAjuste.trim(), clienteId: cliente?.id ?? null,
        });
      }
      setCreating(false);
      setPasso('escolha');
      onOpen(deck, cliente, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui criar a proposta.');
    } finally {
      setBusy(false);
    }
  };

  /** Caminho 2: a mesma estrutura, em texto para colar no Gamma. */
  const criarNoGamma = () => {
    const cliente = clienteSelecionado();
    setGammaTxt(buildGamaPrompt(office, honorarios, cliente, { briefing }));
  };

  const copiarGamma = async () => {
    if (!gammaTxt) return;
    try { await navigator.clipboard.writeText(gammaTxt); } catch { /* sem clipboard */ }
    window.open('https://gamma.app/create', '_blank', 'noopener,noreferrer');
  };

  const apagar = (id: string) => {
    removeDeck(id);
    setMetas(listMetas());
  };

  const copiar = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(publicUrl(slug));
      setCopied(slug);
      setTimeout(() => setCopied(null), 1800);
    } catch { /* sem clipboard */ }
  };

  const perfilIncompleto = !officeSettingsAreComplete(office);

  return (
    <div className="max-w-[1100px] mx-auto px-4 md:px-6 py-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] md:text-[26px] font-[800] text-[#0F172A] tracking-tight inline-flex items-center gap-2">
            <Presentation className="w-6 h-6 text-[#0677FF]" /> Fazer Proposta
          </h1>
          <p className="text-[13px] text-[#64748B] font-[500] mt-1 max-w-[620px]">
            Gera uma proposta comercial com AI a partir dos dados do escritório, do cliente e da tabela de honorários. Editável card a card, com PDF e link público.
          </p>
        </div>
        <button
          onClick={() => { setCreating(true); setPasso('escolha'); setCaminho(null); setGammaTxt(null); }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0677FF] text-white text-[13px] font-[700] hover:bg-[#0059c9] transition-colors"
        >
          <Plus className="w-4 h-4" /> Nova proposta
        </button>
      </header>

      {perfilIncompleto && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <SettingsIcon className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-[12.5px] text-amber-800 font-[500]">
            Faltam dados do escritório (nome, NIF, cédula ou morada) — a proposta vai sair incompleta.
            <button onClick={onGoToOfficeSettings} className="ml-1 font-[800] underline">Completar agora</button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] font-[600] text-red-700">{error}</div>
      )}

      {/* Nova proposta — passo 1: escolher caminho (obrigatório) */}
      {creating && (
        <div className="mt-5 bg-white rounded-2xl border border-[#E2E8F0] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-[800] text-[#0F172A]">
              {passo === 'escolha' ? 'Nova proposta — como queres gerar?' : caminho === 'gamma' ? 'Nova proposta no Gamma' : 'Nova proposta no Estudo360'}
            </h2>
            <button onClick={() => { setCreating(false); setPasso('escolha'); setCaminho(null); }} className="p-1 text-[#94A3B8] hover:text-[#0F172A]"><X className="w-4 h-4" /></button>
          </div>

          {passo === 'escolha' && (
            <div className="mt-4 grid md:grid-cols-2 gap-3">
              <button
                onClick={() => { setCaminho('app'); setPasso('briefing'); }}
                className="text-left rounded-xl border border-[#E2E8F0] p-4 hover:border-[#0677FF] hover:bg-[#F8FBFF] transition-colors"
              >
                <span className="inline-flex items-center gap-2 text-[13.5px] font-[800] text-[#0677FF]"><Sparkles className="w-4 h-4" /> Gerar no Estudo360</span>
                <span className="mt-1.5 block text-[12px] text-[#64748B]">Proposta de 7 blocos, editável, com PDF e link público. O preço vem da tabela.</span>
              </button>
              <button
                onClick={() => { setCaminho('gamma'); setPasso('briefing'); }}
                className="text-left rounded-xl border border-[#E2E8F0] p-4 hover:border-[#0677FF] hover:bg-[#F8FBFF] transition-colors"
              >
                <span className="inline-flex items-center gap-2 text-[13.5px] font-[800] text-[#0F172A]"><Presentation className="w-4 h-4" /> Levar para o Gamma</span>
                <span className="mt-1.5 block text-[12px] text-[#64748B]">O mesmo conteúdo em texto pronto a colar no gamma.app. Sem chave, custo zero.</span>
              </button>
            </div>
          )}

          {passo === 'briefing' && caminho && (
            <>
              <button onClick={() => { setPasso('escolha'); setCaminho(null); setGammaTxt(null); }} className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-[700] text-[#64748B] hover:text-[#0F172A]">
                <ArrowRight className="w-3.5 h-3.5 rotate-180" /> Trocar caminho
              </button>

              <div className="mt-3 grid md:grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-[11px] font-[800] uppercase tracking-wide text-[#64748B] mb-1.5">Cliente</span>
                  <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-[#E2E8F0] text-[13px] font-[600] text-[#0F172A] bg-white">
                    <option value="">Versão geral do escritório (sem cliente)</option>
                    {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}{e.nif ? ` · ${e.nif}` : ''}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[11px] font-[800] uppercase tracking-wide text-[#64748B] mb-1.5">Tema</span>
                  <div className="flex gap-2">
                    {DECK_THEMES.map((t) => (
                      <button key={t} onClick={() => setTema(t)}
                        className={`flex-1 px-3 py-2.5 rounded-xl border text-[12px] font-[700] ${tema === t ? 'border-[#0677FF] bg-[#EFF6FF] text-[#0677FF]' : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]'}`}>
                        {t === 'claro' ? 'Claro' : t === 'escuro' ? 'Escuro' : 'Marca'}
                      </button>
                    ))}
                  </div>
                </label>
              </div>

              <div className="mt-4">
                <p className="text-[11px] font-[800] uppercase tracking-wide text-[#64748B]">4 perguntas — ficam ligadas a este cliente</p>
                <div className="mt-2 grid md:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-[11.5px] font-[700] text-[#334155] mb-1">Setor</span>
                    <input value={briefing.setor || ''} onChange={(e) => setBriefing({ ...briefing, setor: e.target.value })} placeholder="ex.: restauração, construção, clínica" className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-[13px]" />
                  </label>
                  <label className="block">
                    <span className="block text-[11.5px] font-[700] text-[#334155] mb-1">Dimensão (pessoas)</span>
                    <input value={briefing.dimensao || ''} onChange={(e) => setBriefing({ ...briefing, dimensao: e.target.value })} placeholder="ex.: 3 pessoas" className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-[13px]" />
                  </label>
                  <label className="block">
                    <span className="block text-[11.5px] font-[700] text-[#334155] mb-1">Faturação anual</span>
                    <input value={briefing.faturacao || ''} onChange={(e) => setBriefing({ ...briefing, faturacao: e.target.value })} placeholder="ex.: 250 000 €" className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-[13px]" />
                  </label>
                  <label className="block">
                    <span className="block text-[11.5px] font-[700] text-[#334155] mb-1">Objetivo a 12 meses</span>
                    <input value={briefing.objetivo || ''} onChange={(e) => setBriefing({ ...briefing, objetivo: e.target.value })} placeholder="ex.: fechar contas a tempo e reduzir impostos" className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-[13px]" />
                  </label>
                </div>
              </div>

              {caminho === 'app' && (
                <div className="mt-4">
                  <p className="text-[11px] font-[800] uppercase tracking-wide text-[#64748B]">Preço (tabela + ajuste registado)</p>
                  <div className="mt-2 grid md:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block text-[11.5px] font-[700] text-[#334155] mb-1">Ajuste €/mês (negativo = desconto)</span>
                      <input value={ajuste} onChange={(e) => setAjuste(e.target.value)} inputMode="decimal" placeholder="ex.: -25" className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-[13px]" />
                    </label>
                    <label className="block">
                      <span className="block text-[11.5px] font-[700] text-[#334155] mb-1">Motivo do ajuste</span>
                      <input value={motivoAjuste} onChange={(e) => setMotivoAjuste(e.target.value)} placeholder="ex.: cliente antigo / mais anos de contrato" className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] text-[13px]" />
                    </label>
                  </div>
                  <p className="mt-1.5 text-[11px] text-[#94A3B8]">O ajuste fica no registo de auditoria (quem, quando e porquê).</p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {caminho === 'app' ? (
                  <button onClick={criarNaApp} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0677FF] text-white text-[13px] font-[700] hover:bg-[#0059c9] disabled:opacity-60">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Criar proposta
                  </button>
                ) : (
                  <>
                    <button onClick={criarNoGamma} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0F172A] text-white text-[13px] font-[700] hover:bg-black">
                      <Presentation className="w-4 h-4" /> Gerar texto
                    </button>
                    {gammaTxt && (
                      <button onClick={copiarGamma} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0677FF] text-white text-[13px] font-[700] hover:bg-[#0059c9]">
                        <Copy className="w-4 h-4" /> Copiar + abrir Gamma
                      </button>
                    )}
                  </>
                )}
                <span className="text-[11px] text-[#94A3B8] font-[500]">Preço sempre da tabela de honorários.</span>
              </div>

              {gammaTxt && (
                <details className="mt-3" open>
                  <summary className="cursor-pointer text-[11.5px] font-[700] text-[#64748B]">Texto para o Gamma ({gammaTxt.length} caracteres)</summary>
                  <pre className="mt-1.5 max-h-[240px] overflow-auto whitespace-pre-wrap rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-[11px] leading-snug text-[#334155]">{gammaTxt}</pre>
                </details>
              )}
            </>
          )}
        </div>
      )}

      {/* Lista */}
      <h2 className="mt-7 text-[13px] font-[800] uppercase tracking-wide text-[#64748B]">As minhas propostas</h2>
      {metas.length === 0 ? (
        <div className="mt-3 bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-8 text-center">
          <Presentation className="w-8 h-8 text-[#CBD5E1] mx-auto" />
          <p className="mt-2 text-[13px] font-[600] text-[#64748B]">Ainda não há propostas. Cria a primeira com o botão acima.</p>
        </div>
      ) : (
        <ul className="mt-3 grid md:grid-cols-2 gap-3">
          {metas.map((m) => (
            <li key={m.id} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 hover:border-[#93C5FD] transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-[14px] font-[800] text-[#0F172A] truncate">{m.titulo}</h3>
                  <p className="text-[12px] font-[500] text-[#64748B] truncate">{m.clienteNome || 'Versão geral do escritório'}</p>
                </div>
                <button onClick={() => apagar(m.id)} className="p-1 text-[#CBD5E1] hover:text-red-600 shrink-0" aria-label={`Apagar ${m.titulo}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-3 text-[11px] font-[600] text-[#94A3B8]">
                <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(m.updatedAt).toLocaleDateString('pt-PT')}</span>
                {m.slug && (
                  <span className="inline-flex items-center gap-1 text-[#0677FF]"><Link2 className="w-3 h-3" /> link ativo</span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button
                  onClick={async () => {
                    const { loadDeck } = await import('./lib/deck/store');
                    const deck = await loadDeck(m.id);
                    if (!deck) { setError('Não encontrei esta proposta. Pode ter sido apagada noutro dispositivo.'); return; }
                    const empresa = empresas.find((e) => e.id === deck.clienteId) ?? null;
                    onOpen(deck, empresa ? { id: empresa.id, nome: empresa.nome, nif: empresa.nif, profile: empresa.profile as DeckCliente['profile'] } : null, false);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0F172A] text-white text-[11.5px] font-[700] hover:bg-black"
                >
                  Abrir <ArrowRight className="w-3.5 h-3.5" />
                </button>
                {m.slug && (
                  <button onClick={() => copiar(m.slug!)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E2E8F0] text-[11.5px] font-[700] text-[#334155] hover:border-[#0677FF]">
                    <Copy className="w-3.5 h-3.5" /> {copied === m.slug ? 'Copiado' : 'Copiar link'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
