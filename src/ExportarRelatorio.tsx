import { useMemo, useState } from 'react';
import { FileDown, FileText, Download, Loader2, Building2, ChevronDown } from 'lucide-react';
import { listEmpresas, type EmpresaRecord } from './lib/empresas';
import type { OfficeSettings } from './lib/officeSettings';
import { DOC_TYPES, downloadAsWord, type DocTypeId } from './lib/wordDocs';

/**
 * Exportar documentos — escolhe a empresa (dropdown) e o tipo de documento
 * (radio), e descarrega em Word (.doc) já preenchido com os dados da empresa.
 * Os documentos são os modelos da contabilista (Demonstrações Financeiras,
 * Declaração de Responsabilidade, Acta de AG). Ver src/lib/wordDocs.ts.
 */

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
};

export default function ExportarRelatorio({ office, onOpenPrevisa }: {
  office: OfficeSettings;
  onOpenPrevisa?: (empresaId: string) => void;
}) {
  const empresas = useMemo(() => listEmpresas(), []);
  const [empresaId, setEmpresaId] = useState<string>(empresas[0]?.id ?? '');
  const [docType, setDocType] = useState<DocTypeId>('dr');
  const [busy, setBusy] = useState(false);

  const emp = empresas.find(e => e.id === empresaId) ?? null;
  const def = DOC_TYPES.find(d => d.id === docType) ?? DOC_TYPES[0];
  const avisoPrevisa = !!emp && def.precisaPrevisa && !hasPrevisaData(emp);

  const handleDownload = () => {
    if (!emp) return;
    setBusy(true);
    try {
      downloadAsWord(def.build(emp, office), def.filename(emp));
    } catch (e) {
      console.error('Falha ao gerar o documento:', e);
      alert('Não foi possível gerar o documento. Tenta novamente.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#F5F7FA]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <div className="w-11 h-11 rounded-[12px] bg-[#0677FF]/10 flex items-center justify-center shrink-0">
            <FileDown className="w-5 h-5 text-[#0677FF]" />
          </div>
          <div>
            <h1 className="text-[22px] font-[800] text-[#0B1D2D] leading-tight tracking-[-0.4px]">Exportar documentos</h1>
            <p className="text-[13px] text-slate-500 font-[500]">Escolhe a empresa e o tipo de documento, depois descarrega em Word.</p>
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
          <>
            {/* Passo 1 — empresa (dropdown) */}
            <p className="mt-7 mb-2 text-[11px] font-[800] uppercase tracking-[0.6px] text-slate-400">1 · Empresa</p>
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

            {/* Passo 2 — tipo de documento (radio) */}
            <p className="mt-7 mb-2 text-[11px] font-[800] uppercase tracking-[0.6px] text-slate-400">2 · Tipo de documento</p>
            <div className="space-y-2" role="radiogroup" aria-label="Tipo de documento">
              {DOC_TYPES.map(d => {
                const active = d.id === docType;
                const badge = FILL_BADGE[d.fill];
                return (
                  <button
                    key={d.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setDocType(d.id)}
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

            {/* Descarregar */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={!emp || busy}
              className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-[12px] text-[14px] font-[800] text-white bg-[#0677FF] hover:bg-[#0560d8] active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {busy ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <Download className="w-4.5 h-4.5" />}
              {busy ? 'A gerar…' : 'Descarregar em Word'}
            </button>
            <p className="mt-2.5 text-[11.5px] text-slate-400 font-[500] text-center">
              Ficheiro .doc — abre no Word, Pages ou Google Docs e fica editável.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
