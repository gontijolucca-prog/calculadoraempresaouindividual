import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Building2, FileUp, Trash2, ChevronRight, Search } from 'lucide-react';
import {
  listEmpresas,
  deleteEmpresa,
  setCurrentEmpresaId,
  newId,
  upsertEmpresa,
  type EmpresaRecord,
} from './lib/empresas';
import { defaultProfile } from './ClientProfile';

interface Props {
  onOpenEmpresa: (empId: string) => void;
  onNovaEmpresa: (empId: string) => void;
  onSAFTUpload: (file: File, empId: string) => void;
  refreshKey?: number;
}

export default function EmpresasList({ onOpenEmpresa, onNovaEmpresa, onSAFTUpload, refreshKey }: Props) {
  const [empresas, setEmpresas] = useState<EmpresaRecord[]>(() => listEmpresas());
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<EmpresaRecord | null>(null);

  useEffect(() => {
    setEmpresas(listEmpresas());
  }, [refreshKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...empresas].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!q) return sorted;
    return sorted.filter(e =>
      e.nome.toLowerCase().includes(q) || e.nif.includes(q)
    );
  }, [empresas, query]);

  const handleNova = () => {
    const id = newId();
    upsertEmpresa({
      id,
      nome: '',
      nif: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      profile: { ...defaultProfile },
    });
    setCurrentEmpresaId(id);
    onNovaEmpresa(id);
  };

  const handleOpen = (id: string) => {
    setCurrentEmpresaId(id);
    onOpenEmpresa(id);
  };

  const handleDelete = (emp: EmpresaRecord) => {
    deleteEmpresa(emp.id);
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
              onClick={handleNova}
              className="inline-flex items-center gap-2 bg-[#0677FF] text-white px-4 py-2.5 rounded-[10px] text-[13px] font-[700] hover:bg-[#0556CC] active:scale-[0.98] transition-all shadow-md shadow-[#0677FF]/25"
            >
              <Plus className="w-4 h-4" /> Nova Empresa
            </button>
          </div>
          <p className="text-[13px] text-[#6B7280] font-[500] mt-1 max-w-xl">
            A tua carteira de clientes. Cada empresa tem perfil próprio, SAFT associado
            e o histórico de simulações fica guardado no equipamento.
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
          <EmptyState onNova={handleNova} hasQuery={query.length > 0} />
        ) : (
          <ul className="grid gap-3" role="list">
            {filtered.map(emp => (
              <EmpresaCard
                key={emp.id}
                emp={emp}
                onOpen={() => handleOpen(emp.id)}
                onUploadSaft={(file) => onSAFTUpload(file, emp.id)}
                onAskDelete={() => { setConfirmDelete(emp); }}
              />
            ))}
          </ul>
        )}

        <p className="mt-8 text-[11px] text-[#94A3B8] font-[500]">
          {empresas.length} empresa{empresas.length === 1 ? '' : 's'} guardada{empresas.length === 1 ? '' : 's'} · armazenamento local
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
    </motion.div>
  );
}

interface EmpresaCardProps {
  emp: EmpresaRecord;
  onOpen: () => void;
  onUploadSaft: (file: File) => void;
  onAskDelete: () => void;
}

const EmpresaCard: React.FC<EmpresaCardProps> = ({ emp, onOpen, onUploadSaft, onAskDelete }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const updated = formatRelative(emp.updatedAt);
  const displayNome = emp.nome.trim() || 'Empresa sem nome';
  const initials = (displayNome.match(/\b\w/g) || []).slice(0, 2).join('').toUpperCase() || 'E';

  return (
    <li className="bg-white border border-[#E5E9F0] rounded-[14px] hover:border-[#0677FF]/40 hover:shadow-md transition-all group">
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onOpen}
          className="flex-1 flex items-center gap-4 text-left px-5 py-4"
        >
          <div className="w-11 h-11 rounded-[10px] bg-[#0677FF]/10 text-[#0677FF] font-[800] text-[14px] flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-[700] text-[#0B1D2D] truncate">{displayNome}</div>
            <div className="text-[12px] text-[#6B7280] font-[500] mt-0.5 flex items-center gap-2">
              <span>{emp.nif ? `NIF ${emp.nif}` : 'Sem NIF'}</span>
              <span aria-hidden="true">·</span>
              <span>Atualizado {updated}</span>
              {emp.saftFileName && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-600">SAFT associado</span>
                </>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#0677FF] transition-colors shrink-0" />
        </button>
        <div className="flex items-center gap-1 pr-3">
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
