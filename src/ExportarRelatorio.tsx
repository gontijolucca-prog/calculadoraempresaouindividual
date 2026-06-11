import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  FileDown, FileText, Download, Printer, Building2, ChevronDown, Pencil,
  Calculator, FileSignature, Package, Search, Check, Loader2, FileSpreadsheet,
} from 'lucide-react';
import { listEmpresas, upsertEmpresa, SAFT_REPARSE_REV, type EmpresaRecord } from './lib/empresas';
import { parseSAFT } from './lib/saft';
import { loadFromStorage, saveToStorage } from './lib/storage';
import { officeSettingsAreComplete, type OfficeSettings } from './lib/officeSettings';
import type { HonorariosConfig } from './lib/honorarios';
import {
  DOC_TYPES, downloadAsWord, makeEditableHtml, serializeEditedDoc, fillStatusFor, hasPrevisaData,
} from './lib/wordDocs';
import {
  getInitialTaxState, getInitialVehicleState, getInitialTicketState, getInitialSSState,
  type TaxSimulatorState, type VehicleSimulatorState, type TicketSimulatorState, type SSState,
} from './lib/simDefaults';
import PDFPreviewEditor from './PDFPreviewEditor';
import Proposta from './Proposta';
import MinutaContrato from './MinutaContrato';
import { defaultProfile, type ClientProfile } from './ClientProfile';
import { printViaPaged, printHtmlViaPaged } from './lib/printPaged';
import { downloadPrevisaExcel } from './lib/previsaExcel';
import { defaultPreviSaState, type PreviSaState } from './previSaState';
import { calculate } from './lib/previsaCalc';

/**
 * Exportar documentos — escolhe a empresa (dropdown) e o documento, pré-visualiza
 * numa folha editável inline (clica e corrige qualquer texto), e descarrega/
 * imprime com formatação A4 limpa.
 *
 * A lista de documentos junta DOIS grupos para a empresa selecionada:
 *  1) "Pacote do cliente" (em primeiro) — Simulação Fiscal, Proposta e Minuta,
 *     os mesmos documentos React do modal "Pacote cliente" (impressão/PDF).
 *  2) Documentos da contabilista — Demonstrações Financeiras etc., gerados em
 *     Word (.doc) a partir de src/lib/wordDocs.ts.
 */

// ─── Pacote do cliente (documentos React, impressão/PDF) ──────────────────────
type PkgId = 'simulacao' | 'proposta' | 'minuta';
const PACKAGE_DOCS: { id: PkgId; label: string; descricao: string; Icon: typeof Calculator }[] = [
  { id: 'simulacao', label: 'Simulação Fiscal',      descricao: 'ENI vs Lda + cenários (Pacote do Cliente).',  Icon: Calculator },
  { id: 'proposta',  label: 'Proposta de Honorários', descricao: 'Carta de honorários (Pacote do Cliente).',    Icon: FileText },
  { id: 'minuta',    label: 'Minuta de Contrato',     descricao: 'Modelo OCC preenchido (Pacote do Cliente).',  Icon: FileSignature },
];
const PKG_IDS: PkgId[] = ['simulacao', 'proposta', 'minuta'];
const isPkg = (id: string): id is PkgId => (PKG_IDS as string[]).includes(id);
// id do elemento printRoot de cada documento do pacote (para o paged.js).
const PKG_ROOT_ID: Record<PkgId, string> = {
  simulacao: 'pdf-editor-root',
  proposta: 'proposta-print-root',
  minuta: 'minuta-print-root',
};

// Junta `over` em cima de `base`, recursivamente para objetos simples (arrays e
// primitivos substituem). Usado para completar perfis legados/parciais com os
// valores por defeito — os documentos do pacote (PDFPreviewEditor, Proposta,
// Minuta) assumem um perfil completo e rebentam com campos em falta.
function deepMerge<T>(base: T, over: Partial<T> | undefined): T {
  if (!over) return base;
  const isObj = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);
  if (!isObj(base) || !isObj(over)) return (over as T) ?? base;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) continue;
    out[k] = isObj(out[k]) && isObj(v) ? deepMerge(out[k], v as Record<string, unknown>) : v;
  }
  return out as T;
}

function normalizeProfile(p: ClientProfile | undefined): ClientProfile | undefined {
  return p ? deepMerge(defaultProfile, p) : undefined;
}

const FILL_BADGE: Record<string, { txt: string; cls: string }> = {
  completo: { txt: 'Preenchido', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  parcial:  { txt: 'Parcial',    cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  modelo:   { txt: 'Modelo',     cls: 'text-slate-500 bg-slate-50 border-slate-200' },
  pacote:   { txt: 'Pacote',     cls: 'text-[#0677FF] bg-[#0677FF]/10 border-[#0677FF]/20' },
};

export default function ExportarRelatorio({ office, honorarios, onOpenPrevisa, onGoToOfficeSettings, currentEmpresaId }: {
  office: OfficeSettings;
  honorarios: HonorariosConfig;
  onOpenPrevisa?: (empresaId: string) => void;
  onGoToOfficeSettings?: () => void;
  /** Empresa "a trabalhar" — fica pré-selecionada ao entrar no Exportar. */
  currentEmpresaId?: string | null;
}) {
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>(() => listEmpresas());
  // Pré-seleção: 1.º a empresa ativa ("a trabalhar"), 2.º a última escolhida
  // neste ecrã (sobrevive a refresh), 3.º a primeira da lista.
  const [empresaId, setEmpresaId] = useState<string>(() => {
    if (currentEmpresaId && empresas.some(e => e.id === currentEmpresaId)) return currentEmpresaId;
    const saved = loadFromStorage<string | null>('exportarEmpresaId', null);
    return (saved && empresas.some(e => e.id === saved)) ? saved : (empresas[0]?.id ?? '');
  });
  // Se a empresa ativa mudar com o ecrã aberto, acompanha-a.
  useEffect(() => {
    if (currentEmpresaId && empresas.some(e => e.id === currentEmpresaId)) setEmpresaId(currentEmpresaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEmpresaId]);
  // Seleção pode ser um doc do pacote (PkgId) ou um doc Word (DocTypeId).
  const [docId, setDocId] = useState<string>(() => {
    const saved = loadFromStorage<string | null>('exportarDocId', null);
    return (saved && (isPkg(saved) || saved === 'previsa' || DOC_TYPES.some(d => d.id === saved))) ? saved : 'simulacao';
  });
  useEffect(() => { saveToStorage('exportarEmpresaId', empresaId); }, [empresaId]);
  useEffect(() => { saveToStorage('exportarDocId', docId); }, [docId]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Os documentos do pacote são folhas A4 fixas (210mm ≈ 794px). Escalamos para
  // caber na largura da coluna de pré-visualização (senão saem cortados).
  const pkgWrapRef = useRef<HTMLDivElement>(null);
  const [pkgScale, setPkgScale] = useState(1);
  // Altura natural do documento Word no iframe (px) — o iframe cresce com o
  // conteúdo e a página externa faz o scroll, como nos documentos do pacote
  // (sem caixa de 72vh com scroll interno a "cortar" a folha).
  const [wordH, setWordH] = useState(1123);
  const [printingPkg, setPrintingPkg] = useState(false);
  // Combobox pesquisável da empresa (útil quando a carteira tem muitos clientes).
  const [empresaOpen, setEmpresaOpen] = useState(false);
  const [empresaQuery, setEmpresaQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const empresaBoxRef = useRef<HTMLDivElement>(null);
  const empresaListRef = useRef<HTMLDivElement>(null);

  const emp = empresas.find(e => e.id === empresaId) ?? null;

  // Re-deriva dados NOVOS do SAF-T guardado (fluxos de caixa pelo método
  // directo + saldos de abertura) em empresas importadas antes desta
  // funcionalidade existir — uma única vez por empresa (saftReprocessadoEm).
  // Só acrescenta campos ausentes; valores já editados à mão ficam intactos.
  useEffect(() => {
    // rev aplicada: empresas pré-versionamento com saftReprocessadoEm contam
    // como rev 1; subir SAFT_REPARSE_REV faz todas re-derivarem campos novos.
    const revAplicada = emp?.saftReparseRev ?? (emp?.saftReprocessadoEm ? 1 : 0);
    if (!emp?.saftXml || revAplicada >= SAFT_REPARSE_REV) return;
    try {
      const r = parseSAFT(emp.saftXml);
      const prof = emp.profile ?? defaultProfile;
      const cont = { ...defaultProfile.contabilidade, ...(prof.contabilidade ?? {}) } as ClientProfile['contabilidade'];
      const contRec = cont as unknown as Record<string, number | boolean | undefined>;
      // só campos DERIVADOS novos (fc*, vendas*) e só quando ausentes — valores
      // editados à mão ficam intactos.
      for (const [k, v] of Object.entries(r.contabilidade ?? {})) {
        if ((k.startsWith('fc') || k.startsWith('vendas')) && contRec[k] === undefined) contRec[k] = v as number;
      }
      const novoProfile: ClientProfile = {
        ...prof,
        contabilidade: cont,
        ...(prof.contabilidadeAbertura || !r.contabilidadeAbertura ? {} : { contabilidadeAbertura: r.contabilidadeAbertura }),
      };
      upsertEmpresa({ ...emp, profile: novoProfile, saftReprocessadoEm: Date.now(), saftReparseRev: SAFT_REPARSE_REV });
      setEmpresas(listEmpresas());
    } catch {
      // SAF-T guardado ilegível — marca como processado para não repetir o
      // parse a cada visita; o import manual continua disponível.
      upsertEmpresa({ ...emp, saftReprocessadoEm: Date.now(), saftReparseRev: SAFT_REPARSE_REV });
      setEmpresas(listEmpresas());
    }
    // Deps deliberadamente só [emp?.id]: o efeito é one-shot por empresa (o
    // guard saftReprocessadoEm impede repetição) e emp?.id é o proxy correto
    // para "empresa selecionada mudou". Reimports são tratados no próprio
    // import (App.tsx), que já deriva fluxos/abertura e re-marca a empresa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emp?.id]);

  const empresaLabel = emp
    ? `${emp.nome || emp.profile?.nomeCliente || 'Empresa sem nome'}${emp.nif ? ` · ${emp.nif}` : ''}`
    : 'Escolher empresa';
  const empresasFiltradas = useMemo(() => {
    const q = empresaQuery.trim().toLowerCase();
    if (!q) return empresas;
    return empresas.filter(e =>
      `${e.nome ?? ''} ${e.profile?.nomeCliente ?? ''} ${e.nif ?? ''}`.toLowerCase().includes(q),
    );
  }, [empresas, empresaQuery]);

  // Fecha o combobox ao clicar fora.
  useEffect(() => {
    if (!empresaOpen) return;
    const onDown = (ev: MouseEvent) => {
      if (empresaBoxRef.current && !empresaBoxRef.current.contains(ev.target as Node)) {
        setEmpresaOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [empresaOpen]);

  // Ao abrir, destaca a empresa atual; a cada pesquisa, volta ao topo.
  useEffect(() => {
    if (!empresaOpen) return;
    const idx = empresasFiltradas.findIndex(e => e.id === empresaId);
    setHighlight(idx >= 0 ? idx : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaOpen]);
  useEffect(() => { setHighlight(0); }, [empresaQuery]);
  // Mantém a opção destacada visível.
  useEffect(() => {
    if (!empresaOpen) return;
    empresaListRef.current?.querySelector(`#empresa-opt-${highlight}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlight, empresaOpen]);

  const selectEmpresaAt = (i: number) => {
    const e = empresasFiltradas[i];
    if (e) { setEmpresaId(e.id); setEmpresaOpen(false); }
  };
  const onComboKey = (ev: ReactKeyboardEvent) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setHighlight(h => Math.min(empresasFiltradas.length - 1, h + 1)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setHighlight(h => Math.max(0, h - 1)); }
    else if (ev.key === 'Enter') { ev.preventDefault(); selectEmpresaAt(highlight); }
    else if (ev.key === 'Escape') { ev.preventDefault(); setEmpresaOpen(false); }
  };

  const pkg = isPkg(docId);
  // Previsa (Excel Modelo 22) — documento especial: não é Word-HTML nem React,
  // é o ficheiro original .xlsx preenchido e descarregado.
  const isPrevisa = docId === 'previsa';
  const def = DOC_TYPES.find(d => d.id === docId) ?? DOC_TYPES[0];
  const avisoPrevisa = !pkg && !!emp && !hasPrevisaData(emp) && (isPrevisa || def.precisaPrevisa);

  const previsaState = useMemo<PreviSaState>(
    () => ({ ...defaultPreviSaState(), ...((emp?.previsa ?? {}) as Partial<PreviSaState>) }),
    [emp],
  );
  const previsaRes = useMemo(() => (isPrevisa ? calculate(previsaState) : null), [isPrevisa, previsaState]);
  const [downloadingPrevisa, setDownloadingPrevisa] = useState(false);
  const handleDownloadPrevisa = async () => {
    if (!emp || downloadingPrevisa) return;
    setDownloadingPrevisa(true);
    try {
      await downloadPrevisaExcel(previsaState, emp.nome || emp.profile?.nomeCliente || '');
    } catch (e) {
      console.error('Falha ao gerar o Excel do Previsa:', e);
      alert('Não foi possível gerar o Excel do Previsa. Tenta novamente.');
    } finally {
      setDownloadingPrevisa(false);
    }
  };

  // Estados dos simuladores para a empresa SELECIONADA (não a ativa no App):
  // lê o que está guardado na empresa, com fallback aos valores iniciais do perfil.
  // O perfil é normalizado (completado com os defaults) para os documentos do
  // pacote não rebentarem com empresas de perfil parcial/legado.
  const sims = useMemo(() => (emp?.sims ?? {}) as Record<string, unknown>, [emp]);
  const profile = useMemo(() => normalizeProfile(emp?.profile), [emp]);
  const taxState = (sims.tax as TaxSimulatorState) ?? (profile ? getInitialTaxState(profile) : undefined);
  const vehicleState = (sims.vehicle as VehicleSimulatorState) ?? getInitialVehicleState(profile);
  const ticketState = (sims.ticket as TicketSimulatorState) ?? (profile ? getInitialTicketState(profile) : undefined);
  const ssState = (sims.selfss as SSState) ?? (profile ? getInitialSSState(profile) : undefined);

  // HTML base do documento Word (só para docs da contabilista).
  const docHtml = useMemo(
    () => (!pkg && !isPrevisa && emp ? def.build(emp, office) : ''),
    [pkg, isPrevisa, emp, def, office],
  );

  // Carrega o documento Word editável no iframe quando muda a seleção, e
  // sincroniza a altura do iframe com o conteúdo (folha contínua, sem scroll
  // interno) — recalcula quando o documento carrega, quando o utilizador edita
  // e quando as fontes/layout assentam.
  useEffect(() => {
    const f = iframeRef.current;
    if (!f) return;
    f.srcdoc = docHtml ? makeEditableHtml(docHtml) : '';
    if (!docHtml) return;
    let ro: ResizeObserver | null = null;
    let t: ReturnType<typeof setTimeout> | null = null;
    const onLoad = () => {
      const d = f.contentDocument;
      if (!d) return;
      const resize = () => setWordH(Math.max(400, d.documentElement.scrollHeight));
      resize();
      // Fontes/imagens podem assentar depois do load.
      t = setTimeout(resize, 350);
      d.addEventListener('input', resize);
      if (d.body) {
        ro = new ResizeObserver(resize);
        ro.observe(d.body);
      }
    };
    f.addEventListener('load', onLoad);
    return () => {
      f.removeEventListener('load', onLoad);
      ro?.disconnect();
      if (t) clearTimeout(t);
    };
  }, [docHtml]);

  // Escala a folha A4 (pacote E documentos Word) para caber na largura disponível.
  useEffect(() => {
    const el = pkgWrapRef.current;
    if (!el) return;
    const A4_PX = 794; // 210mm @ 96dpi
    const compute = () => {
      const avail = el.clientWidth - 24; // padding interno
      setPkgScale(Math.min(1, Math.max(0.3, avail / A4_PX)));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [docId]);

  const handleDownloadWord = () => {
    if (!emp || pkg) return;
    const doc = iframeRef.current?.contentDocument;
    const html = doc ? serializeEditedDoc(doc) : docHtml;
    // Evita descarregar um .doc vazio se a folha ainda não renderizou.
    if (!html || !html.trim()) {
      alert('O documento ainda está a carregar — tenta de novo dentro de instantes.');
      return;
    }
    try {
      downloadAsWord(html, def.filename(emp));
    } catch (e) {
      console.error('Falha ao gerar o documento:', e);
      alert('Não foi possível gerar o documento. Tenta novamente.');
    }
  };

  // Imprime os documentos da contabilista (HTML "Word") via paged.js: margens em
  // TODAS as páginas, rodapé repetido e numeração "Página X de Y" — coisas que o
  // window.print() do Chrome não faz (não suporta margin-boxes do @page).
  const handlePrintWord = () => {
    if (!emp || pkg || printingPkg) return;
    const doc = iframeRef.current?.contentDocument;
    const html = doc ? serializeEditedDoc(doc) : docHtml;
    if (!html || !html.trim()) {
      // Folha ainda a renderizar — cai para o print nativo do iframe.
      iframeRef.current?.contentWindow?.focus();
      iframeRef.current?.contentWindow?.print();
      return;
    }
    setPrintingPkg(true);
    printHtmlViaPaged(html, {
      title: docLabel,
      footerLeft: office.nome || office.contabilistaResponsavel || '',
      footerRight: '',
      onSettled: () => setPrintingPkg(false),
    });
  };

  const docLabel = pkg
    ? (PACKAGE_DOCS.find(d => d.id === docId)?.label ?? '')
    : isPrevisa
      ? 'Previsa — Modelo 22 (Excel)'
      : def.label;

  // Imprime o documento do pacote via paged.js: margens em todas as páginas,
  // rodapé repetido e numeração "Página X de Y". Cai para window.print() se o
  // root ainda não estiver montado. Mostra "a preparar" enquanto pagina (~1-2s).
  const handlePrintPkg = () => {
    if (!isPkg(docId) || printingPkg) return;
    const root = pkgWrapRef.current?.querySelector(`#${PKG_ROOT_ID[docId]}`) as HTMLElement | null;
    if (!root) { window.print(); return; }
    setPrintingPkg(true);
    printViaPaged(root, {
      title: docLabel,
      footerLeft: office.nome || office.contabilistaResponsavel || '',
      footerRight: '',
      onSettled: () => setPrintingPkg(false),
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-[#F5F7FA]">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1 no-print">
          <div className="w-11 h-11 rounded-[12px] bg-[#0677FF]/10 flex items-center justify-center shrink-0">
            <FileDown className="w-5 h-5 text-[#0677FF]" />
          </div>
          <div>
            <h1 className="text-[22px] font-[800] text-[#0B1D2D] leading-tight tracking-[-0.4px]">Exportar documentos</h1>
            <p className="text-[13px] text-slate-500 font-[500]">Escolhe a empresa e o documento, edita na folha e descarrega ou imprime.</p>
          </div>
        </div>

        {/* Aviso: sem as Definições do Escritório, os documentos saem com o
            branding genérico "Estudo 360" em vez do nome/logo do escritório. */}
        {!officeSettingsAreComplete(office) && (
          <div className="mt-4 flex items-start gap-2.5 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 no-print">
            <Building2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-amber-800 font-[500] leading-relaxed">
              Os dados do escritório estão incompletos — os documentos saem com o branding genérico em vez do teu nome e logo.{' '}
              {onGoToOfficeSettings && (
                <button type="button" onClick={onGoToOfficeSettings} className="font-[700] underline hover:text-amber-900">
                  Preencher Definições do Escritório →
                </button>
              )}
            </p>
          </div>
        )}

        {empresas.length === 0 ? (
          <div className="mt-8 rounded-[16px] border border-dashed border-slate-300 bg-white px-8 py-12 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Building2 className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-[15px] font-[700] text-[#0B1D2D]">Ainda não há empresas</p>
            <p className="mt-1.5 text-[13px] text-slate-500 font-[500] max-w-md mx-auto text-balance">
              Cria uma empresa na Lista de Empresas para a poderes exportar aqui.
            </p>
          </div>
        ) : (
          <div className="mt-7 grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-6 items-start">
            {/* ── Coluna de controlo ── */}
            <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-1 no-print">
              {/* Passo 1 — empresa (dropdown) */}
              <p className="mb-2 text-[11px] font-[800] uppercase tracking-[0.6px] text-slate-400">1 · Empresa</p>
              <div className="relative" ref={empresaBoxRef}>
                <button
                  type="button"
                  onClick={() => { setEmpresaOpen(o => !o); setEmpresaQuery(''); }}
                  onKeyDown={ev => { if (!empresaOpen && (ev.key === 'ArrowDown' || ev.key === 'Enter')) { ev.preventDefault(); setEmpresaQuery(''); setEmpresaOpen(true); } }}
                  aria-haspopup="listbox"
                  aria-expanded={empresaOpen}
                  aria-controls="empresa-listbox"
                  className="w-full flex items-center gap-2 pl-4 pr-10 py-3 rounded-[12px] border border-slate-200 bg-white text-[14px] font-[600] text-[#0B1D2D] text-left focus:outline-none focus:border-[#0677FF] focus:ring-2 focus:ring-[#0677FF]/15 transition cursor-pointer"
                >
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">{empresaLabel}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-transform ${empresaOpen ? 'rotate-180' : ''}`} />
                </button>

                {empresaOpen && (
                  <div className="absolute z-20 mt-1.5 w-full rounded-[12px] border border-slate-200 bg-white shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)] overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
                      <Search className="w-4 h-4 text-slate-400 shrink-0" />
                      <input
                        autoFocus
                        value={empresaQuery}
                        onChange={e => setEmpresaQuery(e.target.value)}
                        onKeyDown={onComboKey}
                        role="combobox"
                        aria-expanded
                        aria-controls="empresa-listbox"
                        aria-activedescendant={empresasFiltradas[highlight] ? `empresa-opt-${highlight}` : undefined}
                        placeholder="Procurar por nome ou NIF…"
                        className="w-full bg-transparent text-[13.5px] font-[500] text-[#0B1D2D] placeholder:text-slate-400 focus:outline-none"
                      />
                    </div>
                    <div ref={empresaListRef} id="empresa-listbox" role="listbox" aria-label="Empresas" className="max-h-[280px] overflow-y-auto py-1">
                      {empresasFiltradas.length === 0 ? (
                        <p className="px-4 py-6 text-center text-[12.5px] text-slate-400 font-[500]">Sem resultados para “{empresaQuery}”.</p>
                      ) : (
                        empresasFiltradas.map((e, i) => {
                          const active = e.id === empresaId;
                          const hl = i === highlight;
                          return (
                            <button
                              key={e.id}
                              id={`empresa-opt-${i}`}
                              type="button"
                              role="option"
                              aria-selected={active}
                              onClick={() => { setEmpresaId(e.id); setEmpresaOpen(false); }}
                              onMouseEnter={() => setHighlight(i)}
                              className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 transition-colors ${hl ? 'bg-[#0677FF]/[0.08]' : active ? 'bg-[#0677FF]/[0.04]' : ''}`}
                            >
                              <span className={`w-4 h-4 shrink-0 flex items-center justify-center ${active ? 'text-[#0677FF]' : 'text-transparent'}`}>
                                <Check className="w-4 h-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[13.5px] font-[700] text-[#0F172A] truncate">{e.nome || e.profile?.nomeCliente || 'Empresa sem nome'}</span>
                                {e.nif && <span className="block text-[11.5px] text-slate-400 font-[500]">NIF {e.nif}</span>}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Passo 2 — documento */}
              <p className="mt-6 mb-2 text-[11px] font-[800] uppercase tracking-[0.6px] text-slate-400">2 · Documento</p>

              {/* Grupo: Pacote do cliente (primeiro) */}
              <div className="flex items-center gap-1.5 mb-2 text-[10.5px] font-[800] uppercase tracking-[0.5px] text-[#0677FF]">
                <Package className="w-3.5 h-3.5" />
                Pacote do cliente
              </div>
              <div className="space-y-2" role="radiogroup" aria-label="Documentos do pacote do cliente">
                {PACKAGE_DOCS.map(d => {
                  const active = d.id === docId;
                  const Icon = d.Icon;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setDocId(d.id)}
                      className={`w-full text-left flex items-start gap-3 p-3.5 rounded-[14px] border transition-all ${
                        active
                          ? 'border-[#0677FF] bg-[#0677FF]/[0.04] shadow-[0_2px_10px_-6px_rgba(6,119,255,0.5)]'
                          : 'border-slate-200/80 bg-white hover:border-[#0677FF]/40'
                      }`}
                    >
                      <span className={`mt-0.5 w-[18px] h-[18px] rounded-full border-2 shrink-0 flex items-center justify-center ${active ? 'border-[#0677FF]' : 'border-slate-300'}`}>
                        {active && <span className="w-[9px] h-[9px] rounded-full bg-[#0677FF]" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 flex-wrap">
                          <Icon className="w-3.5 h-3.5 text-[#0677FF] shrink-0" />
                          <span className="text-[13.5px] font-[800] text-[#0F172A] leading-tight">{d.label}</span>
                          <span className={`text-[9px] font-[800] uppercase tracking-[0.4px] px-1.5 py-0.5 rounded-[5px] border ${FILL_BADGE.pacote.cls}`}>{FILL_BADGE.pacote.txt}</span>
                        </span>
                        <span className="block text-[12px] text-slate-500 font-[500] mt-0.5">{d.descricao}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Grupo: Documentos da contabilista */}
              <div className="flex items-center gap-1.5 mt-5 mb-2 text-[10.5px] font-[800] uppercase tracking-[0.5px] text-slate-400">
                <FileText className="w-3.5 h-3.5" />
                Demonstrações & documentos
              </div>
              <div className="space-y-2" role="radiogroup" aria-label="Documentos da contabilista">
                {DOC_TYPES.map(d => {
                  const active = d.id === docId;
                  // Badge dinâmico: reflete os dados REAIS da empresa selecionada,
                  // não o melhor caso do modelo (que dizia "Preenchido" com tudo vazio).
                  const badge = FILL_BADGE[emp ? fillStatusFor(d.id, emp, office) : d.fill];
                  return (
                    <button
                      key={d.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setDocId(d.id)}
                      className={`w-full text-left flex items-start gap-3 p-3.5 rounded-[14px] border transition-all ${
                        active
                          ? 'border-[#0677FF] bg-[#0677FF]/[0.04] shadow-[0_2px_10px_-6px_rgba(6,119,255,0.5)]'
                          : 'border-slate-200/80 bg-white hover:border-[#0677FF]/40'
                      }`}
                    >
                      <span className={`mt-0.5 w-[18px] h-[18px] rounded-full border-2 shrink-0 flex items-center justify-center ${active ? 'border-[#0677FF]' : 'border-slate-300'}`}>
                        {active && <span className="w-[9px] h-[9px] rounded-full bg-[#0677FF]" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13.5px] font-[800] text-[#0F172A] leading-tight">{d.label}</span>
                          <span className={`text-[9px] font-[800] uppercase tracking-[0.4px] px-1.5 py-0.5 rounded-[5px] border ${badge.cls}`}>{badge.txt}</span>
                        </span>
                        <span className="block text-[12px] text-slate-500 font-[500] mt-0.5">{d.descricao}</span>
                      </span>
                    </button>
                  );
                })}

                {/* Previsa — Modelo 22 em Excel (o ficheiro original preenchido) */}
                {(() => {
                  const active = isPrevisa;
                  const badge = FILL_BADGE[emp && hasPrevisaData(emp) ? 'completo' : 'modelo'];
                  return (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setDocId('previsa')}
                      className={`w-full text-left flex items-start gap-3 p-3.5 rounded-[14px] border transition-all ${
                        active
                          ? 'border-[#0677FF] bg-[#0677FF]/[0.04] shadow-[0_2px_10px_-6px_rgba(6,119,255,0.5)]'
                          : 'border-slate-200/80 bg-white hover:border-[#0677FF]/40'
                      }`}
                    >
                      <span className={`mt-0.5 w-[18px] h-[18px] rounded-full border-2 shrink-0 flex items-center justify-center ${active ? 'border-[#0677FF]' : 'border-slate-300'}`}>
                        {active && <span className="w-[9px] h-[9px] rounded-full bg-[#0677FF]" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 flex-wrap">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="text-[13.5px] font-[800] text-[#0F172A] leading-tight">Previsa — Modelo 22 (Excel)</span>
                          <span className={`text-[9px] font-[800] uppercase tracking-[0.4px] px-1.5 py-0.5 rounded-[5px] border ${badge.cls}`}>{badge.txt}</span>
                        </span>
                        <span className="block text-[12px] text-slate-500 font-[500] mt-0.5">O ficheiro original do Previsa preenchido com os dados da empresa; recalcula ao abrir.</span>
                      </span>
                    </button>
                  );
                })()}
              </div>

              {/* Aviso: documento precisa de dados do Previsa que faltam */}
              {avisoPrevisa && (
                <div className="mt-4 flex items-start gap-2.5 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3">
                  <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[12.5px] text-amber-800 font-[500] leading-relaxed">
                    Esta empresa ainda não tem valores no Previsa — o documento sai com a estrutura mas a zeros.{' '}
                    {onOpenPrevisa && emp && (
                      <button type="button" onClick={() => onOpenPrevisa(emp.id)} className="font-[700] underline hover:text-amber-900">
                        Abrir o Previsa →
                      </button>
                    )}
                  </p>
                </div>
              )}

              {/* Ações */}
              <div className="mt-6 flex flex-col gap-2.5">
                {isPrevisa ? (
                  <button
                    type="button"
                    onClick={handleDownloadPrevisa}
                    disabled={!emp || downloadingPrevisa}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-[12px] text-[14px] font-[800] text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  >
                    {downloadingPrevisa ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <FileSpreadsheet className="w-4.5 h-4.5" />}
                    {downloadingPrevisa ? 'A gerar Excel…' : 'Descarregar Excel (.xlsx)'}
                  </button>
                ) : (
                  <>
                    {!pkg && (
                      <button
                        type="button"
                        onClick={handleDownloadWord}
                        disabled={!emp}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-[12px] text-[14px] font-[800] text-white bg-[#0677FF] hover:bg-[#0560d8] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                      >
                        <Download className="w-4.5 h-4.5" />
                        Descarregar em Word
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={pkg ? handlePrintPkg : handlePrintWord}
                      disabled={!emp || printingPkg}
                      className={`w-full flex items-center justify-center gap-2 px-4 rounded-[12px] font-[800] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all ${
                        pkg
                          ? 'py-3.5 text-[14px] text-white bg-[#0677FF] hover:bg-[#0560d8]'
                          : 'py-3 text-[13.5px] text-[#0677FF] bg-white border border-[#0677FF]/30 hover:bg-[#0677FF]/[0.04]'
                      }`}
                    >
                      {printingPkg ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Printer className="w-4.5 h-4.5" />}
                      {printingPkg ? 'A preparar páginas…' : 'Imprimir / Guardar PDF'}
                    </button>
                  </>
                )}
              </div>
              <p className="mt-2.5 text-[11.5px] text-slate-400 font-[500] text-center text-balance">
                {isPrevisa
                  ? 'Sai o Excel original do Previsa (13 folhas) com os dados desta empresa; as fórmulas recalculam ao abrir.'
                  : pkg
                    ? 'Edita o documento na folha e imprime ou guarda como PDF.'
                    : 'Descarrega o que vês na folha — com as tuas edições. O Word abre o .doc editável.'}
              </p>
            </div>

            {/* ── Pré-visualização editável ── */}
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3 mb-2 no-print">
                <div className="flex items-center gap-1.5 text-[11px] font-[800] uppercase tracking-[0.6px] text-slate-400">
                  {isPrevisa ? <FileSpreadsheet className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                  3 · {docLabel}{isPrevisa ? '' : ' — editável'}
                </div>
                {isPrevisa ? (
                  <button
                    type="button"
                    onClick={handleDownloadPrevisa}
                    disabled={!emp || downloadingPrevisa}
                    className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-[12.5px] font-[800] text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-[0_2px_10px_-4px_rgba(5,150,105,0.5)]"
                  >
                    {downloadingPrevisa ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                    {downloadingPrevisa ? 'A gerar…' : 'Descarregar Excel'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={pkg ? handlePrintPkg : handlePrintWord}
                    disabled={!emp || printingPkg}
                    className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-[12.5px] font-[800] text-white bg-[#0677FF] hover:bg-[#0560d8] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-[0_2px_10px_-4px_rgba(6,119,255,0.6)]"
                  >
                    {printingPkg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                    {printingPkg ? 'A preparar…' : 'Imprimir / PDF'}
                  </button>
                )}
              </div>

              {pkg ? (
                // Documentos do pacote (React): renderiza o componente, que já é
                // editável inline e isola-se na impressão.
                <div ref={pkgWrapRef} className="rounded-[14px] border border-slate-200 bg-[#E2E8F0] p-3 shadow-[0_2px_14px_-8px_rgba(15,23,42,0.25)]">
                  {emp && profile && (
                    <div style={{ zoom: pkgScale }}>
                      {docId === 'simulacao' && (
                        <PDFPreviewEditor
                          profile={profile}
                          taxState={taxState}
                          vehicleState={vehicleState}
                          ticketState={ticketState}
                          ssState={ssState}
                          onClose={() => { /* sem modal aqui */ }}
                          embedded
                          office={office}
                        />
                      )}
                      {docId === 'proposta' && (
                        <Proposta profile={profile} office={office} honorarios={honorarios} />
                      )}
                      {docId === 'minuta' && (
                        <MinutaContrato profile={profile} office={office} honorarios={honorarios} />
                      )}
                    </div>
                  )}
                </div>
              ) : isPrevisa ? (
                // Previsa: não há pré-visualização do .xlsx — mostra o resumo
                // do Modelo 22 calculado com os dados desta empresa e explica
                // o que sai no ficheiro.
                <div className="rounded-[14px] border border-slate-200 bg-white p-6 shadow-[0_2px_14px_-8px_rgba(15,23,42,0.25)] no-print">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-11 h-11 rounded-[12px] bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-[800] text-[#0B1D2D] leading-tight truncate">{previsaState.designacao || emp?.nome || 'Empresa'}</p>
                      <p className="text-[12.5px] text-slate-500 font-[500]">Período {previsaState.periodo || '—'} · modelo PrevisaV25 (13 folhas)</p>
                    </div>
                  </div>
                  {previsaRes && (previsaRes.totalRendimentos !== 0 || previsaRes.totalGastos !== 0 || previsaState.c701_rai !== 0) ? (
                    <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {([
                        ['Total de rendimentos', previsaRes.totalRendimentos],
                        ['Total de gastos', previsaRes.totalGastos],
                        [previsaRes.effectiveRai >= 0 ? 'Resultado antes de impostos' : 'Prejuízo antes de impostos', Math.abs(previsaRes.effectiveRai)],
                        ['Matéria coletável', previsaRes.materiaColetavel],
                        ['IRC liquidado + TA', previsaRes.c358 + previsaRes.taTotal],
                        [previsaRes.c367 >= 0 ? 'Total a pagar' : 'Total a recuperar', Math.abs(previsaRes.c367)],
                      ] as [string, number][]).map(([label, v]) => (
                        <div key={label} className="rounded-[12px] border border-slate-200 bg-slate-50/60 px-3.5 py-3">
                          <p className="text-[10.5px] font-[800] uppercase tracking-[0.5px] text-slate-400">{label}</p>
                          <p className="mt-0.5 text-[15px] font-[800] text-[#0B1D2D] tabular-nums">
                            {v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-5 text-[13px] text-slate-500 font-[500] leading-relaxed">
                      Esta empresa ainda não tem valores no Previsa — o Excel sai com a estrutura completa do modelo, a zeros.
                      {onOpenPrevisa && emp && (
                        <> {' '}
                          <button type="button" onClick={() => onOpenPrevisa(emp.id)} className="font-[700] text-[#0677FF] underline hover:text-[#0560d8]">
                            Abrir o Previsa →
                          </button>
                        </>
                      )}
                    </p>
                  )}
                  <p className="mt-5 text-[12px] text-slate-400 font-[500] leading-relaxed">
                    O ficheiro descarregado é o modelo original do Previsa com as células de input preenchidas
                    (rendimentos e gastos por conta, regime, dimensão e identificação) — formatação, fórmulas e as
                    13 folhas ficam intactas, e o Excel recalcula tudo ao abrir. Os restantes quadros (Q07, Q10,
                    prejuízos, tributações autónomas) preenchem-se no próprio ficheiro ou aqui no simulador.
                  </p>
                </div>
              ) : (
                // Documentos da contabilista (Word HTML) num iframe editável,
                // apresentado como folha A4 contínua e escalada — igual aos
                // documentos do pacote. O iframe cresce com o conteúdo (wordH)
                // e é a página externa que faz o scroll; sem caixa de altura
                // fixa com scroll interno a cortar o documento.
                <div ref={pkgWrapRef} className="rounded-[14px] border border-slate-200 bg-[#E2E8F0] p-3 shadow-[0_2px_14px_-8px_rgba(15,23,42,0.25)] no-print">
                  <p className="px-1 pb-2 text-[12px] text-slate-500 font-[500]">
                    Clica em qualquer texto da folha e edita diretamente antes de descarregar.
                  </p>
                  {/* Espaçador com a altura visual da folha escalada; o iframe
                      mantém 794px de largura lógica (A4) e é reduzido com
                      transform para caber na coluna. */}
                  <div style={{ height: wordH * pkgScale, width: 794 * pkgScale, margin: '0 auto', position: 'relative' }}>
                    <iframe
                      ref={iframeRef}
                      title="Pré-visualização do documento"
                      scrolling="no"
                      className="bg-white shadow-[0_4px_24px_rgba(0,0,0,0.12)] border-0 block"
                      style={{
                        width: 794,
                        height: wordH,
                        transform: `scale(${pkgScale})`,
                        transformOrigin: 'top left',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
