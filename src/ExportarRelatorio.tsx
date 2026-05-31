import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileDown, FileText, Download, Printer, Building2, ChevronDown, Pencil,
  Calculator, FileSignature, Package,
} from 'lucide-react';
import { listEmpresas, type EmpresaRecord } from './lib/empresas';
import type { OfficeSettings } from './lib/officeSettings';
import type { HonorariosConfig } from './lib/honorarios';
import {
  DOC_TYPES, downloadAsWord, makeEditableHtml, serializeEditedDoc, type DocTypeId,
} from './lib/wordDocs';
import {
  getInitialTaxState, getInitialVehicleState, getInitialTicketState, getInitialSSState,
  type TaxSimulatorState, type VehicleSimulatorState, type TicketSimulatorState, type SSState,
} from './lib/simDefaults';
import PDFPreviewEditor from './PDFPreviewEditor';
import Proposta from './Proposta';
import MinutaContrato from './MinutaContrato';

/**
 * Exportar documentos — escolhe a empresa (dropdown) e o documento, pré-visualiza
 * numa folha editável inline (clica e corrige qualquer texto), e descarrega/
 * imprime com formatação A4 limpa.
 *
 * A lista de documentos junta DOIS grupos para a empresa seleccionada:
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

// Há dados contabilísticos no Previsa desta empresa? (para avisar quando um
// documento que depende deles vai sair vazio).
function hasPrevisaData(emp: EmpresaRecord): boolean {
  const s = (emp.previsa ?? {}) as Record<string, unknown>;
  return Object.entries(s).some(([k, v]) =>
    (k.startsWith('rai_') || k === 'volumeNegocios') && typeof v === 'number' && v !== 0,
  );
}

const FILL_BADGE: Record<string, { txt: string; cls: string }> = {
  completo: { txt: 'Preenchido', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  parcial:  { txt: 'Parcial',    cls: 'text-amber-700 bg-amber-50 border-amber-200' },
  modelo:   { txt: 'Modelo',     cls: 'text-slate-500 bg-slate-50 border-slate-200' },
  pacote:   { txt: 'Pacote',     cls: 'text-[#0677FF] bg-[#0677FF]/10 border-[#0677FF]/20' },
};

export default function ExportarRelatorio({ office, honorarios, onOpenPrevisa }: {
  office: OfficeSettings;
  honorarios: HonorariosConfig;
  onOpenPrevisa?: (empresaId: string) => void;
}) {
  const empresas = useMemo(() => listEmpresas(), []);
  const [empresaId, setEmpresaId] = useState<string>(empresas[0]?.id ?? '');
  // Selecção pode ser um doc do pacote (PkgId) ou um doc Word (DocTypeId).
  const [docId, setDocId] = useState<string>('simulacao');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const emp = empresas.find(e => e.id === empresaId) ?? null;
  const pkg = isPkg(docId);
  const def = DOC_TYPES.find(d => d.id === docId) ?? DOC_TYPES[0];
  const avisoPrevisa = !pkg && !!emp && def.precisaPrevisa && !hasPrevisaData(emp);

  // Estados dos simuladores para a empresa SELECCIONADA (não a activa no App):
  // lê o que está guardado na empresa, com fallback aos valores iniciais do perfil.
  const sims = useMemo(() => (emp?.sims ?? {}) as Record<string, unknown>, [emp]);
  const profile = emp?.profile;
  const taxState = (sims.tax as TaxSimulatorState) ?? (profile ? getInitialTaxState(profile) : undefined);
  const vehicleState = (sims.vehicle as VehicleSimulatorState) ?? getInitialVehicleState();
  const ticketState = (sims.ticket as TicketSimulatorState) ?? (profile ? getInitialTicketState(profile) : undefined);
  const ssState = (sims.selfss as SSState) ?? (profile ? getInitialSSState(profile) : undefined);

  // HTML base do documento Word (só para docs da contabilista).
  const docHtml = useMemo(
    () => (!pkg && emp ? def.build(emp, office) : ''),
    [pkg, emp, def, office],
  );

  // Carrega o documento Word editável no iframe quando muda a selecção.
  useEffect(() => {
    const f = iframeRef.current;
    if (!f) return;
    f.srcdoc = docHtml ? makeEditableHtml(docHtml) : '';
  }, [docHtml]);

  const handleDownloadWord = () => {
    if (!emp || pkg) return;
    const doc = iframeRef.current?.contentDocument;
    const html = doc ? serializeEditedDoc(doc) : docHtml;
    try {
      downloadAsWord(html, def.filename(emp));
    } catch (e) {
      console.error('Falha ao gerar o documento:', e);
      alert('Não foi possível gerar o documento. Tenta novamente.');
    }
  };

  const handlePrintWord = () => {
    iframeRef.current?.contentWindow?.focus();
    iframeRef.current?.contentWindow?.print();
  };

  // Documentos do pacote isolam-se na impressão (body * { visibility:hidden }),
  // por isso basta imprimir a janela — sai só o documento activo.
  const handlePrintPkg = () => window.print();

  const docLabel = pkg
    ? (PACKAGE_DOCS.find(d => d.id === docId)?.label ?? '')
    : def.label;

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
            <div className="lg:sticky lg:top-6 no-print">
              {/* Passo 1 — empresa (dropdown) */}
              <p className="mb-2 text-[11px] font-[800] uppercase tracking-[0.6px] text-slate-400">1 · Empresa</p>
              <div className="relative">
                <select
                  value={empresaId}
                  onChange={e => setEmpresaId(e.target.value)}
                  className="w-full appearance-none pl-4 pr-10 py-3 rounded-[12px] border border-slate-200 bg-white text-[14px] font-[600] text-[#0B1D2D] focus:outline-none focus:border-[#0677FF] focus:ring-2 focus:ring-[#0677FF]/15 transition cursor-pointer"
                >
                  {empresas.map(e => (
                    <option key={e.id} value={e.id}>
                      {(e.nome || e.profile?.nomeCliente || 'Empresa sem nome')}{e.nif ? ` · ${e.nif}` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                  const badge = FILL_BADGE[d.fill];
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
                  disabled={!emp}
                  className={`w-full flex items-center justify-center gap-2 px-4 rounded-[12px] font-[800] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all ${
                    pkg
                      ? 'py-3.5 text-[14px] text-white bg-[#0677FF] hover:bg-[#0560d8]'
                      : 'py-3 text-[13.5px] text-[#0677FF] bg-white border border-[#0677FF]/30 hover:bg-[#0677FF]/[0.04]'
                  }`}
                >
                  <Printer className="w-4.5 h-4.5" />
                  Imprimir / Guardar PDF
                </button>
              </div>
              <p className="mt-2.5 text-[11.5px] text-slate-400 font-[500] text-center text-balance">
                {pkg
                  ? 'Edita o documento na folha e imprime ou guarda como PDF.'
                  : 'Descarrega o que vês na folha — com as tuas edições. O Word abre o .doc editável.'}
              </p>
            </div>

            {/* ── Pré-visualização editável ── */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-2 text-[11px] font-[800] uppercase tracking-[0.6px] text-slate-400 no-print">
                <Pencil className="w-3.5 h-3.5" />
                3 · {docLabel} — editável
              </div>

              {pkg ? (
                // Documentos do pacote (React): renderiza o componente, que já é
                // editável inline e isola-se na impressão.
                <div className="rounded-[14px] border border-slate-200 bg-[#E2E8F0] p-3 overflow-x-auto shadow-[0_2px_14px_-8px_rgba(15,23,42,0.25)]">
                  {emp && profile && (
                    <>
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
                    </>
                  )}
                </div>
              ) : (
                // Documentos da contabilista (Word HTML) num iframe editável.
                <div className="rounded-[14px] border border-slate-200 bg-slate-100 p-3 shadow-[0_2px_14px_-8px_rgba(15,23,42,0.25)] no-print">
                  <p className="px-1 pb-2 text-[12px] text-slate-500 font-[500]">
                    Clica em qualquer texto da folha e edita diretamente antes de descarregar.
                  </p>
                  <iframe
                    ref={iframeRef}
                    title="Pré-visualização do documento"
                    className="w-full h-[72vh] rounded-[8px] border border-slate-300 bg-white"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
