import { useMemo, useState, type ComponentType } from 'react';
import {
  Calculator, Car, Ticket, User, BarChart2, Home, Building, Banknote,
  Receipt, TrendingUp, History, RotateCcw, Trash2, FolderOpen,
} from 'lucide-react';
import { listSimulacoes, deleteSimulacao, type SimulationRecord } from './lib/empresas';
import { SIM_LABELS, type SimView } from './lib/simSummary';

interface Props {
  empresaId: string | null;
  empresaNome: string;
  /** Restaura o snapshot e navega para o simulador correspondente. */
  onRestore: (rec: SimulationRecord) => void;
  /** Avisa o App que o histórico mudou (para propagar ao Firestore). */
  onChanged: () => void;
  /** Bump externo (ex.: depois de guardar noutra view) força re-leitura. */
  refreshKey: number;
}

const TIPO_ICON: Record<string, ComponentType<{ className?: string }>> = {
  tax: Calculator, vehicle: Car, ticket: Ticket, selfss: User,
  diagnostico: BarChart2, imoveis: Home, imt: Building, salario: Banknote,
  irs: Receipt, previsa: TrendingUp,
};

const fmtDate = (ms: number) =>
  new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));

export default function SimulacoesHistory({ empresaId, empresaNome, onRestore, onChanged, refreshKey }: Props) {
  const [tick, setTick] = useState(0);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const records = useMemo(
    () => (empresaId ? listSimulacoes(empresaId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [empresaId, tick, refreshKey],
  );

  const handleDelete = (id: string) => {
    if (!empresaId) return;
    deleteSimulacao(empresaId, id);
    setConfirmId(null);
    setTick(n => n + 1);
    onChanged();
  };

  if (!empresaId) {
    return (
      <div className="h-full flex items-center justify-center bg-[#F5F7FA] px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="w-7 h-7 text-slate-400" />
          </div>
          <h2 className="text-[18px] font-[800] text-[#0F172A]">Sem cliente selecionado</h2>
          <p className="text-[13px] text-[#64748B] font-[500] mt-2 leading-relaxed">
            Abre uma empresa na Lista de Empresas para veres o histórico de simulações dela.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#F5F7FA]">
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8">
        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <div className="w-11 h-11 rounded-[12px] bg-[#0677FF]/10 flex items-center justify-center shrink-0">
            <History className="w-5 h-5 text-[#0677FF]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[22px] font-[800] text-[#0B1D2D] leading-tight tracking-[-0.4px]">
              Histórico de simulações
            </h1>
            <p className="text-[13px] text-[#64748B] font-[500] mt-0.5 truncate">
              {empresaNome || 'Cliente sem nome'} · {records.length} simulaç{records.length === 1 ? 'ão' : 'ões'} guardada{records.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {records.length === 0 ? (
          <div className="bg-white rounded-[16px] border border-slate-200/70 p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4">
              <History className="w-6 h-6 text-slate-300" />
            </div>
            <h2 className="text-[15px] font-[800] text-[#0F172A]">Ainda não há simulações guardadas</h2>
            <p className="text-[13px] text-[#64748B] font-[500] mt-2 leading-relaxed max-w-md mx-auto">
              Abre um simulador e preenche-o: a simulação fica <strong className="text-[#0677FF]">guardada automaticamente</strong> aqui,
              associada a este cliente, e pode ser reaberta a qualquer momento.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {records.map((rec) => {
              const Icon = TIPO_ICON[rec.tipo] ?? Calculator;
              const label = SIM_LABELS[rec.tipo as SimView] ?? rec.label ?? 'Simulação';
              const confirming = confirmId === rec.id;
              return (
                <div
                  key={rec.id}
                  className="group bg-white rounded-[14px] border border-slate-200/70 hover:border-[#0677FF]/40 hover:shadow-[0_4px_16px_-8px_rgba(6,119,255,0.35)] transition-all p-4 flex items-start gap-4"
                >
                  <div className="w-10 h-10 rounded-[10px] bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                    <Icon className="w-[18px] h-[18px] text-[#0677FF]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-[800] text-[#0F172A] leading-tight">{label}</span>
                      {rec.auto && (
                        <span className="text-[9px] font-[800] uppercase tracking-[0.5px] text-[#0677FF] bg-[#0677FF]/10 px-1.5 py-0.5 rounded-[5px]">Auto</span>
                      )}
                      <span className="text-[10px] font-[700] uppercase tracking-[0.5px] text-slate-400">
                        {fmtDate(rec.createdAt)}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-[#475569] font-[500] mt-0.5 truncate">{rec.resumo}</p>
                    {rec.detalhes && rec.detalhes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {rec.detalhes.map((d, i) => (
                          <span key={i} className={
                            d.r
                              ? 'inline-flex items-baseline gap-1 text-[11px] bg-[#0677FF]/8 border border-[#0677FF]/25 rounded-[6px] px-2 py-0.5'
                              : 'inline-flex items-baseline gap-1 text-[11px] bg-slate-50 border border-slate-200/80 rounded-[6px] px-2 py-0.5'
                          }>
                            <span className={d.r ? 'text-[#0677FF] font-[700]' : 'text-slate-400 font-[600]'}>{d.label}:</span>
                            <span className={d.r ? 'text-[#0677FF] font-[800] tabular-nums' : 'text-[#0F172A] font-[700] tabular-nums'}>{d.valor}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onRestore(rec)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-[12px] font-[700] text-[#0677FF] bg-[#0677FF]/10 hover:bg-[#0677FF]/15 ative:scale-[0.97] transition-all"
                      title="Reabrir esta simulação no simulador"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Abrir</span>
                    </button>
                    {confirming ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(rec.id)}
                        onBlur={() => setConfirmId(null)}
                        autoFocus
                        className="px-3 py-2 rounded-[10px] text-[12px] font-[700] text-white bg-red-600 hover:bg-red-700 ative:scale-[0.97] transition-all"
                        title="Confirmar eliminação"
                      >
                        Confirmar?
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmId(rec.id)}
                        className="p-2 rounded-[10px] text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Eliminar simulação"
                        aria-label="Eliminar simulação"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
