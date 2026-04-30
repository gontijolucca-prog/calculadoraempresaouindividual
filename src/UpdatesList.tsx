import React, { useState } from 'react';
import { ArrowLeft, Plus, Trash2, ClipboardList, CheckCheck } from 'lucide-react';

const STORAGE_KEY = 'recofatima_updates';

export interface UpdateItem {
  id: string;
  text: string;
  atualizado: boolean;
  aprovado: boolean;
  createdAt: number;
}

export function loadUpdateItems(): UpdateItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUpdateItems(items: UpdateItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function hasPendingUpdates(): boolean {
  return loadUpdateItems().some(i => i.atualizado && !i.aprovado);
}

interface Props {
  onBack: () => void;
  onItemsChange?: () => void;
}

export default function UpdatesList({ onBack, onItemsChange }: Props) {
  const [items, setItems] = useState<UpdateItem[]>(loadUpdateItems);
  const [newText, setNewText] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const mutate = (next: UpdateItem[]) => {
    setItems(next);
    saveUpdateItems(next);
    onItemsChange?.();
  };

  const addItem = () => {
    const text = newText.trim();
    if (!text) return;
    mutate([...items, { id: Date.now().toString(), text, atualizado: false, aprovado: false, createdAt: Date.now() }]);
    setNewText('');
  };

  const toggle = (id: string, field: 'atualizado' | 'aprovado') => {
    mutate(items.map(i => i.id === id ? { ...i, [field]: !i[field] } : i));
  };

  const confirmDelete = (id: string) => {
    mutate(items.filter(i => i.id !== id));
    setDeleteConfirm(null);
  };

  const sorted = [
    ...items.filter(i => !(i.atualizado && i.aprovado)),
    ...items.filter(i => i.atualizado && i.aprovado),
  ];

  const pendingCount = items.filter(i => i.atualizado && !i.aprovado).length;
  const doneCount = items.filter(i => i.atualizado && i.aprovado).length;

  return (
    <div className="h-full bg-[#F8FAFC] overflow-y-auto">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] px-6 md:px-10 py-4 flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[13px] font-[700] text-[#475569] hover:text-[#781D1D] transition-colors px-3 py-2 rounded-[8px] hover:bg-[#FDF2F2]"
        >
          <ArrowLeft size={16} />
          Voltar
        </button>
        <div className="h-6 w-px bg-[#E2E8F0]" />
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-[10px] bg-[#781D1D15]">
            <ClipboardList className="w-5 h-5 text-[#781D1D]" />
          </div>
          <div>
            <h1 className="text-[18px] font-[800] text-[#0F172A]">Checklist de Atualizações</h1>
            <p className="text-[11px] font-[600] text-[#781D1D] uppercase tracking-[1px]">Registo de atualizações do site</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="text-[11px] font-[700] bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full">
              {pendingCount} por aprovar
            </span>
          )}
          {doneCount > 0 && (
            <span className="text-[11px] font-[700] bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full flex items-center gap-1">
              <CheckCheck size={12} />
              {doneCount} concluído{doneCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 md:px-10 py-10 space-y-6">

        {/* Add new item */}
        <div className="bg-white rounded-[20px] p-6 shadow-sm border border-[#E2E8F0]">
          <p className="text-[12px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-3">Adicionar nova atualização</p>
          <div className="flex gap-3">
            <input
              type="text"
              value={newText}
              onChange={e => setNewText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              placeholder="Descreva a atualização efetuada..."
              className="flex-1 px-4 py-3 bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[10px] text-[14px] font-[600] text-[#0F172A] focus:border-[#781D1D] outline-none transition-all placeholder:text-[#CBD5E1]"
            />
            <button
              onClick={addItem}
              disabled={!newText.trim()}
              className="flex items-center gap-2 bg-[#781D1D] text-white px-5 py-3 rounded-[10px] text-[14px] font-[700] hover:bg-[#5A1313] active:scale-[0.98] transition-all shadow-md shadow-[#781D1D]/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              <Plus size={16} />
              Adicionar
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-1">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-[5px] bg-emerald-500 flex items-center justify-center">
              <svg width="11" height="9" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className="text-[12px] font-[700] text-emerald-700">Atualizado</span>
            <span className="text-[11px] text-[#94A3B8]">— foi efetuada uma alteração</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-[5px] bg-blue-500 flex items-center justify-center">
              <svg width="11" height="9" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className="text-[12px] font-[700] text-blue-700">Aprovado</span>
            <span className="text-[11px] text-[#94A3B8]">— o cliente verificou</span>
          </div>
        </div>

        {/* Empty state */}
        {sorted.length === 0 ? (
          <div className="bg-white rounded-[20px] p-14 shadow-sm border border-[#E2E8F0] text-center">
            <ClipboardList className="w-12 h-12 text-[#CBD5E1] mx-auto mb-4" />
            <p className="text-[15px] font-[700] text-[#94A3B8]">Sem atualizações registadas</p>
            <p className="text-[13px] text-[#CBD5E1] mt-1 font-[500]">Adicione a primeira atualização no campo acima.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map(item => {
              const done = item.atualizado && item.aprovado;
              const pending = item.atualizado && !item.aprovado;
              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-[16px] border shadow-sm transition-all duration-300 ${
                    done
                      ? 'opacity-50 border-[#E2E8F0]'
                      : pending
                      ? 'border-amber-300 shadow-amber-100/60'
                      : 'border-[#E2E8F0]'
                  }`}
                >
                  <div className="flex items-center gap-4 px-5 py-4">

                    {/* Checkboxes column */}
                    <div className="flex flex-col gap-[10px] shrink-0">
                      {/* Atualizado */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggle(item.id, 'atualizado')}
                          className={`w-[22px] h-[22px] rounded-[5px] border-2 flex items-center justify-center transition-all ${
                            item.atualizado
                              ? 'bg-emerald-500 border-emerald-500'
                              : 'border-emerald-300 hover:border-emerald-400 bg-white'
                          }`}
                          title="Marcar como atualizado"
                        >
                          {item.atualizado && (
                            <svg width="11" height="9" viewBox="0 0 12 10" fill="none">
                              <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </button>
                        <span className="text-[10px] font-[700] text-emerald-600 uppercase tracking-[0.5px] whitespace-nowrap">At.</span>
                      </div>
                      {/* Aprovado */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggle(item.id, 'aprovado')}
                          className={`w-[22px] h-[22px] rounded-[5px] border-2 flex items-center justify-center transition-all ${
                            item.aprovado
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-blue-300 hover:border-blue-400 bg-white'
                          }`}
                          title="Marcar como aprovado"
                        >
                          {item.aprovado && (
                            <svg width="11" height="9" viewBox="0 0 12 10" fill="none">
                              <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </button>
                        <span className="text-[10px] font-[700] text-blue-600 uppercase tracking-[0.5px] whitespace-nowrap">Ap.</span>
                      </div>
                    </div>

                    {/* Status indicator */}
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      done ? 'bg-emerald-400' : pending ? 'bg-amber-400' : 'bg-[#CBD5E1]'
                    }`} />

                    {/* Text */}
                    <p className={`flex-1 text-[14px] leading-relaxed font-[600] min-w-0 ${
                      done ? 'line-through text-[#94A3B8]' : 'text-[#0F172A]'
                    }`}>
                      {item.text}
                    </p>

                    {/* Status badges */}
                    <div className="hidden sm:flex flex-col gap-1 shrink-0 items-end">
                      {pending && (
                        <span className="text-[10px] font-[700] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                          Por aprovar
                        </span>
                      )}
                      {done && (
                        <span className="text-[10px] font-[700] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                          Concluído
                        </span>
                      )}
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => setDeleteConfirm(item.id)}
                      className="p-2 rounded-[8px] text-[#CBD5E1] hover:text-red-500 hover:bg-red-50 transition-all shrink-0 ml-1"
                      title="Apagar item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer note */}
        {items.length > 0 && (
          <p className="text-center text-[11px] text-[#CBD5E1] font-[500] pb-4">
            Todos os itens ficam guardados permanentemente no navegador.
          </p>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="relative bg-white rounded-[24px] p-8 shadow-2xl max-w-sm w-full">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h3 className="text-[20px] font-[800] text-[#0F172A]">Apagar item?</h3>
                <p className="text-[13px] text-[#64748B] mt-2 font-[500] leading-relaxed">
                  Tem a certeza que deseja apagar este item?<br/>Esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="flex gap-3 w-full mt-1">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3 rounded-[10px] text-[14px] font-[700] bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => confirmDelete(deleteConfirm)}
                  className="flex-1 py-3 rounded-[10px] text-[14px] font-[700] bg-red-500 text-white hover:bg-red-600 active:scale-[0.98] transition-all shadow-md shadow-red-500/25"
                >
                  Apagar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
