import { useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet, Search, Building2, Download, Loader2, FileText } from 'lucide-react';
import { listEmpresas, type EmpresaRecord } from './lib/empresas';
import { defaultPreviSaState, type PreviSaState } from './previSaState';
import { downloadPrevisaExcel } from './lib/previsaExcel';

/**
 * Exportar relatório — escolhe a empresa e descarrega documentos já preenchidos.
 * Por agora: Previsa (IRC Modelo 22) em Excel, réplica do PrevisaV25_01.xls.
 * Os relatórios em Word entram aqui no futuro como mais um cartão.
 */

// Reconstrói o estado do Previsa de uma empresa: parte dos valores por defeito,
// sobrepõe o que estiver guardado em `empresa.previsa` e garante que a
// identificação (designação, NIF, período) fica preenchida a partir do registo.
function previsaStateFor(emp: EmpresaRecord): PreviSaState {
  const base = defaultPreviSaState();
  const saved = (emp.previsa ?? {}) as Partial<PreviSaState>;
  const merged = { ...base, ...saved } as PreviSaState;
  merged.designacao = (saved.designacao || emp.nome || emp.profile?.nomeCliente || '').trim() || base.designacao;
  merged.nif = (saved.nif || emp.nif || emp.profile?.nif || '').trim() || base.nif;
  if (!saved.periodo) merged.periodo = base.periodo;
  return merged;
}

// Considera que há dados contabilísticos preenchidos se algum dos campos de
// rendimentos/gastos do Previsa não for zero (para avisar quando vai sair vazio).
function hasPrevisaData(emp: EmpresaRecord): boolean {
  const s = (emp.previsa ?? {}) as Record<string, unknown>;
  return Object.entries(s).some(([k, v]) =>
    (k.startsWith('rai_') || k === 'volumeNegocios') && typeof v === 'number' && v !== 0,
  );
}

export default function ExportarRelatorio({ onOpenPrevisa }: { onOpenPrevisa?: (empresaId: string) => void }) {
  const empresas = useMemo(() => listEmpresas(), []);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return empresas;
    return empresas.filter(e =>
      (e.nome || '').toLowerCase().includes(q) || (e.nif || '').includes(q),
    );
  }, [empresas, query]);

  const handlePrevisa = async (emp: EmpresaRecord) => {
    setBusyId(emp.id);
    try {
      await downloadPrevisaExcel(previsaStateFor(emp), emp.nome || emp.profile?.nomeCliente);
    } catch (e) {
      console.error('Falha ao exportar o Previsa:', e);
      alert('Não foi possível gerar o Excel do Previsa. Tenta novamente.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#F5F7FA]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <div className="w-11 h-11 rounded-[12px] bg-[#0677FF]/10 flex items-center justify-center shrink-0">
            <FileDown className="w-5 h-5 text-[#0677FF]" />
          </div>
          <div>
            <h1 className="text-[22px] font-[800] text-[#0B1D2D] leading-tight tracking-[-0.4px]">Exportar relatório</h1>
            <p className="text-[13px] text-slate-500 font-[500]">Escolhe a empresa e descarrega o documento já preenchido.</p>
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
            {/* Pesquisa */}
            <div className="mt-7 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Procurar empresa por nome ou NIF…"
                className="w-full pl-10 pr-4 py-3 rounded-[12px] border border-slate-200 bg-white text-[14px] font-[500] text-[#0B1D2D] placeholder:text-slate-400 focus:outline-none focus:border-[#0677FF] focus:ring-2 focus:ring-[#0677FF]/15 transition"
              />
            </div>

            {/* Documento disponível — etiqueta */}
            <p className="mt-7 mb-2.5 text-[11px] font-[800] uppercase tracking-[0.6px] text-slate-400">
              Documentos disponíveis
            </p>

            <div className="space-y-2.5">
              {filtered.map(emp => {
                const busy = busyId === emp.id;
                const empty = !hasPrevisaData(emp);
                return (
                  <div
                    key={emp.id}
                    className="bg-white rounded-[14px] border border-slate-200/70 p-4 flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-[10px] bg-[#10B981]/10 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-[18px] h-[18px] text-[#10B981]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-[800] text-[#0F172A] leading-tight truncate">
                        {emp.nome || emp.profile?.nomeCliente || 'Empresa sem nome'}
                      </p>
                      <p className="text-[12px] text-slate-500 font-[500] mt-0.5 truncate">
                        Previsa · IRC Modelo 22 (Excel)
                        {emp.nif ? ` · NIF ${emp.nif}` : ''}
                      </p>
                      {empty && (
                        <button
                          type="button"
                          onClick={() => onOpenPrevisa?.(emp.id)}
                          className="mt-1.5 text-[11.5px] font-[600] text-amber-600 hover:text-amber-700 hover:underline text-left"
                          title="Abrir o Previsa desta empresa para preencher os valores"
                        >
                          Sem valores preenchidos — o Excel sai com a estrutura mas a zeros. Abrir o Previsa →
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePrevisa(emp)}
                      disabled={busy}
                      className="flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] text-[12.5px] font-[700] text-white bg-[#0677FF] hover:bg-[#0560d8] active:scale-[0.97] disabled:opacity-60 disabled:cursor-wait transition-all shrink-0"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      <span className="hidden sm:inline">{busy ? 'A gerar…' : 'Descarregar Excel'}</span>
                    </button>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-[13px] text-slate-500 font-[500] py-6 text-center">
                  Nenhuma empresa corresponde a “{query}”.
                </p>
              )}
            </div>

            {/* Word — em breve */}
            <p className="mt-9 mb-2.5 text-[11px] font-[800] uppercase tracking-[0.6px] text-slate-400">
              Em breve
            </p>
            <div className="rounded-[14px] border border-dashed border-slate-300 bg-white/60 p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-[10px] bg-slate-100 flex items-center justify-center shrink-0">
                <FileText className="w-[18px] h-[18px] text-slate-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-[700] text-slate-500 leading-tight">Relatórios em Word</p>
                <p className="text-[12px] text-slate-400 font-[500] mt-0.5">A exportação em formato Word será adicionada em breve.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
