import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Plus, Building2, FileUp, Trash2, ChevronDown, Search, FileText, Pencil, X, Download,
  UserCircle, ListOrdered, Package, History,
  Calculator, Car, Ticket, User, BarChart2, Home, Building, Banknote, Receipt, TrendingUp,
} from 'lucide-react';
import {
  listEmpresas,
  type EmpresaRecord,
} from './lib/empresas';
import { cn } from './lib/utils';

// Menu de cada cliente (antes vivia na sidebar; agora abre dentro do cartão).
type NavOpts = { openPackage?: boolean; toggleFlow?: boolean };
const SIM_MENU: { view: string; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { view: 'tax', label: 'Fiscal', Icon: Calculator },
  { view: 'vehicle', label: 'Viaturas', Icon: Car },
  { view: 'ticket', label: 'Tickets', Icon: Ticket },
  { view: 'selfss', label: 'SS Indep.', Icon: User },
  { view: 'diagnostico', label: 'Diagnóstico', Icon: BarChart2 },
  { view: 'imoveis', label: 'Imóveis', Icon: Home },
  { view: 'imt', label: 'IMT', Icon: Building },
  { view: 'salario', label: 'Salário', Icon: Banknote },
  { view: 'irs', label: 'IRS', Icon: Receipt },
  { view: 'previsa', label: 'Previsa', Icon: TrendingUp },
];

interface Props {
  /** Selecciona o cliente e abre a vista pedida (Perfil, simulador, histórico…). */
  onNavigate: (empId: string, view: string, opts?: NavOpts) => void;
  /** "Inserir à mão": abre um rascunho limpo no modo Novo Cliente (a empresa só
   *  é criada quando o utilizador carrega em "Guardar cliente"). */
  onNovaEmpresaManual: () => void;
  onNovaEmpresaFromSAFT: (file: File) => void;
  onSAFTUpload: (file: File, empId: string) => void;
  onDeleteEmpresa: (empId: string) => void;
  refreshKey?: number;
  /** Cliente activo — cartão fica destacado e expandido por defeito. */
  currentEmpresaId?: string | null;
}

export default function EmpresasList({ onNavigate, onNovaEmpresaManual, onNovaEmpresaFromSAFT, onSAFTUpload, onDeleteEmpresa, refreshKey, currentEmpresaId }: Props) {
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>(() => listEmpresas());
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<EmpresaRecord | null>(null);
  const [showNovaModal, setShowNovaModal] = useState(false);
  // Acordeão: um cartão expandido de cada vez. Por defeito, o cliente activo.
  const [expandedId, setExpandedId] = useState<string | null>(currentEmpresaId ?? null);
  const novaSaftInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEmpresas(listEmpresas());
  }, [refreshKey]);

  // Ao chegar com um cliente activo, abre o seu cartão.
  useEffect(() => {
    if (currentEmpresaId) setExpandedId(currentEmpresaId);
  }, [currentEmpresaId]);

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
          <ul className="grid gap-3" role="list">
            {filtered.map(emp => (
              <EmpresaCard
                key={emp.id}
                emp={emp}
                active={emp.id === currentEmpresaId}
                expanded={emp.id === expandedId}
                onToggle={() => setExpandedId(id => id === emp.id ? null : emp.id)}
                onNavigate={onNavigate}
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
              Esta acção remove o perfil e os dados associados desta empresa do equipamento. Não pode ser desfeita.
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
  onUploadSaft: (file: File) => void;
  onAskDelete: () => void;
}

// Item do menu do cliente (dentro do dropdown do cartão).
const MenuItem: React.FC<{ Icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }> = ({ Icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-[13px] font-[600] text-[#334155] hover:bg-[#0677FF]/8 hover:text-[#0677FF] active:scale-[0.99] transition-colors text-left"
  >
    <Icon className="w-4 h-4 shrink-0" />
    <span className="truncate">{label}</span>
  </button>
);

const EmpresaCard: React.FC<EmpresaCardProps> = ({ emp, active, expanded, onToggle, onNavigate, onUploadSaft, onAskDelete }) => {
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
          onClick={() => onNavigate(emp.id, 'profile')}
          title="Abrir perfil do cliente"
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
            title="Mostrar menu rápido (simuladores, histórico…)"
            aria-label={`Menu rápido de ${displayNome}`}
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

      {/* Dropdown do cliente: os menus que antes viviam na sidebar. */}
      {expanded && (
        <div className="border-t border-[#EEF2F7] px-3 py-2">
          <div className="grid gap-0.5">
            <MenuItem Icon={UserCircle} label="Perfil do Cliente" onClick={() => onNavigate(emp.id, 'profile')} />
            <MenuItem Icon={ListOrdered} label="Vista detalhada" onClick={() => onNavigate(emp.id, 'profile', { toggleFlow: true })} />
            <MenuItem Icon={Package} label="Pacote cliente" onClick={() => onNavigate(emp.id, 'profile', { openPackage: true })} />
            <MenuItem Icon={History} label="Histórico de simulações" onClick={() => onNavigate(emp.id, 'historico')} />
          </div>
          <div className="mt-2 mb-1 px-3 text-[10px] font-[800] uppercase tracking-[1px] text-[#0677FF]">Simuladores</div>
          <div className="grid grid-cols-2 gap-0.5">
            {SIM_MENU.map(s => (
              <MenuItem key={s.view} Icon={s.Icon} label={s.label} onClick={() => onNavigate(emp.id, s.view)} />
            ))}
          </div>
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
