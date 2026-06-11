import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Plus, Building2, FileUp, Trash2, ChevronDown, Search, FileText, Pencil, X, Download,
  History, RotateCcw,
  Calculator, Car, Ticket, User, BarChart2, Home, Building, Banknote, Receipt, TrendingUp,
} from 'lucide-react';
import {
  listEmpresas, listSimulacoes, deleteSimulacao,
  type EmpresaRecord, type SimulationRecord,
} from './lib/empresas';
import { SIM_LABELS, type SimView } from './lib/simSummary';
import { cn } from './lib/utils';

type NavOpts = { openPackage?: boolean; toggleFlow?: boolean };

// Ícone por tipo de simulação — usado no histórico dentro do cartão.
const TIPO_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  tax: Calculator, vehicle: Car, ticket: Ticket, selfss: User,
  diagnostico: BarChart2, imoveis: Home, imt: Building, salario: Banknote,
  irs: Receipt, previsa: TrendingUp,
};

const fmtDateHist = (ms: number) =>
  new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));

interface Props {
  /** Seleciona o cliente e abre a vista pedida (Perfil, simulador, histórico…). */
  onNavigate: (empId: string, view: string, opts?: NavOpts) => void;
  /** Seleciona o cliente para trabalhar SEM navegar (fica na lista). */
  onSelect: (empId: string) => void;
  /** "Inserir à mão": abre um rascunho limpo no modo Novo Cliente (a empresa só
   *  é criada quando o utilizador carrega em "Guardar cliente"). */
  onNovaEmpresaManual: () => void;
  onNovaEmpresaFromSAFT: (file: File) => void;
  onSAFTUpload: (file: File, empId: string) => void;
  onDeleteEmpresa: (empId: string) => void;
  /** Restaura uma simulação do histórico deste cliente (seleciona-o primeiro). */
  onRestoreSimulacao: (empId: string, rec: SimulationRecord) => void;
  /** Avisa o App que o histórico mudou (propagar ao Firestore). */
  onHistoricoChanged: () => void;
  refreshKey?: number;
  /** Cliente ativo — cartão fica destacado. */
  currentEmpresaId?: string | null;
}

export default function EmpresasList({ onNavigate, onSelect, onNovaEmpresaManual, onNovaEmpresaFromSAFT, onSAFTUpload, onDeleteEmpresa, onRestoreSimulacao, onHistoricoChanged, refreshKey, currentEmpresaId }: Props) {
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>(() => listEmpresas());
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<EmpresaRecord | null>(null);
  const [showNovaModal, setShowNovaModal] = useState(false);
  // Acordeão: um cartão expandido de cada vez. Inicia sempre FECHADO.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const novaSaftInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEmpresas(listEmpresas());
  }, [refreshKey]);

  // Close modal with Escape
  useEffect(() => {
    if (!showNovaModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowNovaModal(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showNovaModal]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...empresas].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!q) return sorted;
    return sorted.filter(e =>
      e.nome.toLowerCase().includes(q) || e.nif.includes(q)
    );
  }, [empresas, query]);

  const startNova = () => setShowNovaModal(true);

  const handleNovaManual = () => {
    // Não cria a empresa já — abre o rascunho no modo Novo Cliente. A empresa
    // entra na lista só quando o utilizador carregar em "Guardar cliente".
    setShowNovaModal(false);
    onNovaEmpresaManual();
  };

  const handleNovaFromSAFT = (file: File) => {
    setShowNovaModal(false);
    onNovaEmpresaFromSAFT(file);
  };

  const handleDelete = (emp: EmpresaRecord) => {
    // Delega no App: remove localmente E propaga a eliminação ao Firestore
    // (autoritativo). Sem isto, o merge de arranque ressuscitava a empresa.
    onDeleteEmpresa(emp.id);
    setEmpresas(listEmpresas());
    setConfirmDelete(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-full bg-[#F5F7FA] px-6 sm:px-10 py-8"
    >
      <div className="max-w-5xl mx-auto">

        <header className="flex flex-col gap-1 mb-6">
          <p className="text-[10px] font-[800] uppercase tracking-[2.5px] text-[#6B7280]">CRM · Carteira</p>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h1 className="text-[34px] sm:text-[40px] font-[800] text-[#0B1D2D] tracking-[-1px] leading-none">
              Lista de Empresas
            </h1>
            <button
              type="button"
              onClick={startNova}
              className="inline-flex items-center gap-2 bg-[#0677FF] text-white px-4 py-2.5 rounded-[10px] text-[13px] font-[700] hover:bg-[#0556CC] active:scale-[0.98] transition-all shadow-md shadow-[#0677FF]/25"
            >
              <Plus className="w-4 h-4" /> Nova Empresa
            </button>
          </div>
          <p className="text-[13px] text-[#6B7280] font-[500] mt-1 max-w-xl">
            A tua carteira de clientes. Cada empresa tem perfil próprio, SAF-T associado
            e histórico de simulações — tudo sincronizado na nuvem, acessível em qualquer computador.
          </p>
        </header>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Procurar por nome ou NIF…"
            className="w-full pl-10 pr-4 py-3 bg-white border border-[#E5E9F0] rounded-[12px] text-[14px] font-[500] text-[#0B1D2D] placeholder:text-[#94A3B8] focus:border-[#0677FF] outline-none transition-colors"
          />
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <EmptyState onNova={startNova} hasQuery={query.length > 0} />
        ) : (
          <ul className="grid grid-cols-1 gap-3" role="list">
            {filtered.map(emp => (
              <EmpresaCard
                key={emp.id}
                emp={emp}
                active={emp.id === currentEmpresaId}
                expanded={emp.id === expandedId}
                onToggle={() => setExpandedId(id => id === emp.id ? null : emp.id)}
                onSelectCard={() => { onSelect(emp.id); setExpandedId(id => id === emp.id ? null : emp.id); }}
                onNavigate={onNavigate}
                onRestore={(rec) => onRestoreSimulacao(emp.id, rec)}
                onHistoricoChanged={onHistoricoChanged}
                refreshKey={refreshKey}
                onUploadSaft={(file) => onSAFTUpload(file, emp.id)}
                onAskDelete={() => { setConfirmDelete(emp); }}
              />
            ))}
          </ul>
        )}

        <p className="mt-8 text-[11px] text-[#94A3B8] font-[500]">
          {empresas.length} empresa{empresas.length === 1 ? '' : 's'} guardada{empresas.length === 1 ? '' : 's'} · sincronizado na nuvem
        </p>
      </div>

      {/* Confirmação de eliminação */}
      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[1000] flex items-center justify-center p-6"
        >
          <button
            type="button"
            aria-label="Cancelar"
            onClick={() => setConfirmDelete(null)}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
          />
          <div className="relative bg-white rounded-[20px] shadow-2xl max-w-md w-full p-6">
            <h2 className="text-[18px] font-[800] text-[#0B1D2D] mb-2">
              Eliminar {confirmDelete.nome || 'esta empresa'}?
            </h2>
            <p className="text-[13px] text-[#6B7280] font-[500] mb-5">
              Esta ação remove o perfil e os dados associados desta empresa do equipamento. Não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-[10px] text-[13px] font-[700] bg-[#F1F5F9] text-[#0B1D2D] hover:bg-[#E2E8F0] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-2.5 rounded-[10px] text-[13px] font-[700] bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nova Empresa: escolher fluxo (SAFT vs manual) */}
      {showNovaModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="nova-modal-title"
          className="fixed inset-0 z-[1000] flex items-center justify-center p-6"
        >
          <button
            type="button"
            aria-label="Cancelar"
            onClick={() => setShowNovaModal(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
          />
          <div className="relative bg-white rounded-[22px] shadow-2xl max-w-xl w-full overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-[#0677FF] to-[#00C2FF] w-full" />
            <div className="p-7">
              <div className="flex items-start justify-between mb-1">
                <h2 id="nova-modal-title" className="text-[22px] font-[800] text-[#0B1D2D] leading-tight">
                  Nova Empresa
                </h2>
                <button
                  type="button"
                  onClick={() => setShowNovaModal(false)}
                  aria-label="Fechar"
                  className="w-8 h-8 -mt-1 -mr-1 rounded-full flex items-center justify-center text-[#6B7280] hover:text-[#0B1D2D] hover:bg-[#F1F5F9] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[13px] text-[#6B7280] font-[500] mb-5">
                Como queres adicionar esta empresa à tua carteira?
              </p>

              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => novaSaftInputRef.current?.click()}
                  className="text-left p-5 rounded-[14px] border-2 border-[#E5E9F0] hover:border-[#0677FF] hover:bg-[#0677FF]/4 transition-all group focus-visible:border-[#0677FF]"
                >
                  <div className="w-10 h-10 rounded-[10px] bg-[#0677FF]/12 text-[#0677FF] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="text-[15px] font-[800] text-[#0B1D2D]">A partir de SAF-T</div>
                  <p className="text-[12px] text-[#6B7280] font-[500] mt-1 leading-snug">
                    Importa o ficheiro SAF-T e preenchemos automaticamente os dados da empresa.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={handleNovaManual}
                  className="text-left p-5 rounded-[14px] border-2 border-[#E5E9F0] hover:border-[#0B1D2D] hover:bg-[#0B1D2D]/4 transition-all group focus-visible:border-[#0B1D2D]"
                >
                  <div className="w-10 h-10 rounded-[10px] bg-[#0B1D2D]/10 text-[#0B1D2D] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <Pencil className="w-5 h-5" />
                  </div>
                  <div className="text-[15px] font-[800] text-[#0B1D2D]">Inserir à mão</div>
                  <p className="text-[12px] text-[#6B7280] font-[500] mt-1 leading-snug">
                    Abre o Perfil do Cliente em branco para preencheres os dados manualmente.
                  </p>
                </button>
              </div>

              <input
                ref={novaSaftInputRef}
                type="file"
                accept=".xml,application/xml,text/xml"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleNovaFromSAFT(file);
                  e.target.value = '';
                }}
              />
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

interface EmpresaCardProps {
  emp: EmpresaRecord;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: (empId: string, view: string, opts?: NavOpts) => void;
  /** Clique no corpo do cartão: seleciona o cliente e abre/fecha o histórico. */
  onSelectCard: () => void;
  /** Restaura uma simulação do histórico deste cliente. */
  onRestore: (rec: SimulationRecord) => void;
  onHistoricoChanged: () => void;
  refreshKey?: number;
  onUploadSaft: (file: File) => void;
  onAskDelete: () => void;
}

// Histórico de simulações do cliente — vive dentro do dropdown do cartão.
const CardHistorico: React.FC<{ empId: string; onRestore: (rec: SimulationRecord) => void; onChanged: () => void; refreshKey?: number }> = ({ empId, onRestore, onChanged, refreshKey }) => {
  const [tick, setTick] = useState(0);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const records = useMemo(() => listSimulacoes(empId), [empId, tick, refreshKey]);

  if (records.length === 0) {
    return (
      <p className="px-3 py-3 text-[12.5px] text-[#6B7280] font-[500]">
        Ainda não há simulações guardadas para este cliente — abre um simulador e a simulação fica guardada aqui automaticamente.
      </p>
    );
  }
  return (
    <div className="max-h-72 overflow-y-auto pr-1 space-y-1">
      {records.map((rec) => {
        const Icon = TIPO_ICON[rec.tipo] ?? Calculator;
        const label = SIM_LABELS[rec.tipo as SimView] ?? rec.label ?? 'Simulação';
        const confirming = confirmId === rec.id;
        return (
          <div key={rec.id} className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] hover:bg-[#F5F7FA] transition-colors">
            <div className="w-8 h-8 rounded-[8px] bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-[#0677FF]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-[800] text-[#0F172A] leading-tight">{label}</span>
                <span className="text-[10px] font-[700] uppercase tracking-[0.5px] text-slate-400">{fmtDateHist(rec.createdAt)}</span>
              </div>
              <p className="text-[12px] text-[#475569] font-[500] truncate">{rec.resumo}</p>
            </div>
            <button
              type="button"
              onClick={() => onRestore(rec)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[12px] font-[700] text-[#0677FF] bg-[#0677FF]/10 hover:bg-[#0677FF]/15 active:scale-[0.97] transition-all shrink-0"
              title="Reabrir esta simulação no simulador"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Abrir</span>
            </button>
            {confirming ? (
              <button
                type="button"
                onClick={() => { deleteSimulacao(empId, rec.id); setConfirmId(null); setTick(n => n + 1); onChanged(); }}
                onBlur={() => setConfirmId(null)}
                autoFocus
                className="px-2.5 py-1.5 rounded-[8px] text-[12px] font-[700] text-white bg-red-600 hover:bg-red-700 transition-all shrink-0"
                title="Confirmar eliminação"
              >
                Confirmar?
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmId(rec.id)}
                className="p-1.5 rounded-[8px] text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                title="Eliminar simulação"
                aria-label="Eliminar simulação"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

const EmpresaCard: React.FC<EmpresaCardProps> = ({ emp, active, expanded, onToggle, onSelectCard, onNavigate, onRestore, onHistoricoChanged, refreshKey, onUploadSaft, onAskDelete }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const updated = formatRelative(emp.updatedAt);
  const displayNome = emp.nome.trim() || 'Empresa sem nome';
  const initials = (displayNome.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() || 'E';

  return (
    <li className={cn(
      'bg-white border rounded-[14px] transition-all',
      active ? 'border-[#0677FF] ring-1 ring-[#0677FF]/30 shadow-md' : 'border-[#E5E9F0] hover:border-[#0677FF]/40 hover:shadow-md',
    )}>
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onSelectCard}
          title="Selecionar este cliente e ver o histórico de simulações"
          className="flex-1 flex items-center gap-4 text-left px-5 py-4 min-w-0"
        >
          <div className="w-11 h-11 rounded-[10px] bg-[#0677FF]/10 text-[#0677FF] font-[800] text-[14px] flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-[700] text-[#0B1D2D] truncate">
              {displayNome}
              {active && <span className="ml-2 align-middle text-[10px] font-[800] uppercase tracking-[0.5px] text-[#0677FF] bg-[#0677FF]/10 px-1.5 py-0.5 rounded-full">a trabalhar</span>}
            </div>
            <div className="text-[12px] text-[#6B7280] font-[500] mt-0.5 flex items-center gap-2 flex-wrap">
              <span>{emp.nif ? `NIF ${emp.nif}` : 'Sem NIF'}</span>
              <span aria-hidden="true">·</span>
              <span>Atualizado {updated}</span>
              {emp.saftFileName && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-600">SAF-T associado</span>
                </>
              )}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-1 pr-3">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            title="Mostrar histórico de simulações"
            aria-label={`Histórico de simulações de ${displayNome}`}
            className="p-2 rounded-[8px] text-[#6B7280] hover:text-[#0677FF] hover:bg-[#0677FF]/8 transition-colors"
          >
            <ChevronDown className={cn('w-4 h-4 transition-transform', expanded ? 'text-[#0677FF]' : '-rotate-90')} />
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xml,application/xml,text/xml"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) onUploadSaft(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            title="Importar SAF-T para esta empresa"
            className="p-2 rounded-[8px] text-[#6B7280] hover:text-[#0677FF] hover:bg-[#0677FF]/8 transition-colors"
            aria-label={`Importar SAF-T para ${displayNome}`}
          >
            <FileUp className="w-4 h-4" />
          </button>
          {emp.saftXml && (
            <button
              type="button"
              onClick={() => {
                const blob = new Blob([emp.saftXml as string], { type: 'application/xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = emp.saftFileName || `SAFT_${(emp.nif || emp.nome || emp.id).replace(/\s+/g, '_')}.xml`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              }}
              title="Exportar (descarregar) o SAF-T deste cliente"
              className="p-2 rounded-[8px] text-[#6B7280] hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
              aria-label={`Exportar SAF-T de ${displayNome}`}
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onAskDelete}
            title="Eliminar empresa"
            className="p-2 rounded-[8px] text-[#6B7280] hover:text-red-600 hover:bg-red-50 transition-colors"
            aria-label={`Eliminar ${displayNome}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dropdown do cliente = histórico de simulações (perfil abre no clique do cartão;
          simuladores ficam na sidebar depois de selecionar o cliente). */}
      {expanded && (
        <div className="border-t border-[#EEF2F7] px-3 py-2">
          <div className="flex items-center gap-2 px-3 pt-1 pb-2">
            <History className="w-3.5 h-3.5 text-[#0677FF]" />
            <span className="text-[10px] font-[800] uppercase tracking-[1px] text-[#0677FF]">Histórico de simulações</span>
          </div>
          <CardHistorico empId={emp.id} onRestore={onRestore} onChanged={onHistoricoChanged} refreshKey={refreshKey} />
        </div>
      )}
    </li>
  );
};

function EmptyState({ onNova, hasQuery }: { onNova: () => void; hasQuery: boolean }) {
  if (hasQuery) {
    return (
      <div className="text-center py-16 px-4 bg-white border border-dashed border-[#E5E9F0] rounded-[16px]">
        <p className="text-[14px] text-[#6B7280] font-[500]">Nenhuma empresa corresponde à pesquisa.</p>
      </div>
    );
  }
  return (
    <div className="text-center py-16 px-6 bg-white border border-dashed border-[#E5E9F0] rounded-[16px]">
      <div className="w-14 h-14 rounded-full bg-[#0677FF]/10 text-[#0677FF] flex items-center justify-center mx-auto mb-4">
        <Building2 className="w-6 h-6" />
      </div>
      <h2 className="text-[18px] font-[800] text-[#0B1D2D] mb-1">Ainda não tens empresas guardadas</h2>
      <p className="text-[13px] text-[#6B7280] font-[500] max-w-md mx-auto mb-5">
        Cria a primeira empresa da tua carteira. Vais poder importar o SAF-T e gerar simulações associadas.
      </p>
      <button
        type="button"
        onClick={onNova}
        className="inline-flex items-center gap-2 bg-[#0677FF] text-white px-5 py-3 rounded-[10px] text-[13px] font-[700] hover:bg-[#0556CC] active:scale-[0.98] transition-all shadow-md shadow-[#0677FF]/25"
      >
        <Plus className="w-4 h-4" /> Criar primeira empresa
      </button>
    </div>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d} d`;
  return new Date(ts).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
