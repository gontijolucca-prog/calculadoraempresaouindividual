import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, ClipboardList, CheckCheck, Loader2 } from 'lucide-react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, orderBy,
} from 'firebase/firestore';
import { db } from './lib/firebase';

export interface UpdateItem {
  id: string;
  text: string;
  atualizado: boolean;
  aprovado: boolean;
  createdAt: number;
}

interface Props {
  onBack: () => void;
}

export default function UpdatesList({ onBack }: Props) {
  const [items, setItems] = useState<UpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'updates'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(
      q,
      snap => {
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as UpdateItem)));
        setLoading(false);
        setError(null);
      },
      err => {
        console.error('Firestore error:', err);
        setLoading(false);
        setError(err.code === 'permission-denied'
          ? 'Sem permissão para aceder ao Firestore. Verifique as regras de segurança na consola Firebase.'
          : `Erro: ${err.message}`);
      }
    );
    return unsub;
  }, []);

  // Close the delete-confirmation modal with Escape
  useEffect(() => {
    if (!deleteConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDeleteConfirm(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [deleteConfirm]);

  const addItem = async () => {
    if (adding) return;
    const text = newText.trim();
    if (!text) return;
    setAdding(true);
    try {
      await addDoc(collection(db, 'updates'), {
        text, atualizado: false, aprovado: false, createdAt: Date.now(),
      });
      setNewText('');
    } catch (err) {
      console.error('Failed to add item:', err);
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (item: UpdateItem, field: 'atualizado' | 'aprovado') => {
    if (togglingId === item.id) return;
    setTogglingId(item.id);
    try {
      await updateDoc(doc(db, 'updates', item.id), { [field]: !item[field] });
    } finally {
      setTogglingId(null);
    }
  };

  const confirmDelete = async (id: string) => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'updates', id));
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
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
          type="button"
          onClick={onBack}
          aria-label="Voltar à página anterior"
          className="flex items-center gap-2 text-[13px] font-[700] text-[#475569] hover:text-[#781D1D] transition-colors px-3 py-2 rounded-[8px] hover:bg-[#FDF2F2]"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Voltar
        </button>
        <div className="h-6 w-px bg-[#E2E8F0]" />
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-[10px] bg-[#781D1D15]">
            <ClipboardList className="w-5 h-5 text-[#781D1D]" />
          </div>
          <div>
            <h1 className="text-[18px] font-[800] text-[#0F172A]">Checklist de Atualizações</h1>
            <p className="text-[11px] font-[600] text-[#781D1D] uppercase tracking-[1px]">Sincronizado em tempo real</p>
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
          <label htmlFor="update-input" className="block text-[12px] font-[700] uppercase tracking-[1px] text-[#64748B] mb-3">Adicionar nova atualização</label>
          <div className="flex gap-3">
            <input
              id="update-input"
              type="text"
              value={newText}
              onChange={e => setNewText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
              placeholder="Descreva a atualização efetuada..."
              disabled={adding}
              className="flex-1 px-4 py-3 bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-[10px] text-[14px] font-[600] text-[#0F172A] focus:border-[#781D1D] outline-none transition-all placeholder:text-[#94A3B8] disabled:opacity-60"
            />
            <button
              type="button"
              onClick={addItem}
              disabled={!newText.trim() || adding}
              aria-busy={adding}
              className="flex items-center gap-2 bg-[#781D1D] text-white px-5 py-3 rounded-[10px] text-[14px] font-[700] hover:bg-[#5A1313] active:scale-[0.98] transition-all shadow-md shadow-[#781D1D]/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {adding ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
              {adding ? 'A guardar…' : 'Adicionar'}
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

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-[20px] p-12 shadow-sm border border-[#E2E8F0] flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-[#781D1D] animate-spin" />
            <p className="text-[13px] font-[600] text-[#94A3B8]">A carregar da cloud...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 rounded-[20px] p-8 border border-red-200 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-red-500 text-xl font-bold">!</span>
            </div>
            <p className="text-[14px] font-[700] text-red-700">Erro de ligação ao Firebase</p>
            <p className="text-[12px] text-red-500 font-[500] max-w-md">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && sorted.length === 0 && (
          <div className="bg-white rounded-[20px] p-14 shadow-sm border border-[#E2E8F0] text-center">
            <ClipboardList className="w-12 h-12 text-[#CBD5E1] mx-auto mb-4" />
            <p className="text-[15px] font-[700] text-[#94A3B8]">Sem atualizações registadas</p>
            <p className="text-[13px] text-[#CBD5E1] mt-1 font-[500]">Adicione a primeira atualização no campo acima.</p>
          </div>
        )}

        {/* Items list */}
        {!loading && sorted.length > 0 && (
          <div className="space-y-3">
            {sorted.map(item => {
              const done = item.atualizado && item.aprovado;
              const pending = item.atualizado && !item.aprovado;
              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-[16px] border shadow-sm transition-all duration-300 ${
                    done ? 'opacity-50 border-[#E2E8F0]' : pending ? 'border-amber-300 shadow-amber-100/60' : 'border-[#E2E8F0]'
                  }`}
                >
                  <div className="flex items-center gap-4 px-5 py-4">

                    {/* Checkboxes */}
                    <div className="flex flex-col gap-[10px] shrink-0">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggle(item, 'atualizado')}
                          disabled={togglingId === item.id}
                          aria-pressed={item.atualizado}
                          aria-label={item.atualizado ? 'Marcar como não atualizado' : 'Marcar como atualizado'}
                          className={`w-[22px] h-[22px] rounded-[5px] border-2 flex items-center justify-center transition-all disabled:opacity-50 ${
                            item.atualizado ? 'bg-emerald-500 border-emerald-500' : 'border-emerald-300 hover:border-emerald-400 bg-white'
                          }`}
                        >
                          {item.atualizado && (
                            <svg width="11" height="9" viewBox="0 0 12 10" fill="none" aria-hidden="true">
                              <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </button>
                        <span className="text-[10px] font-[700] text-emerald-600 uppercase tracking-[0.5px]" aria-hidden="true">At.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggle(item, 'aprovado')}
                          disabled={togglingId === item.id}
                          aria-pressed={item.aprovado}
                          aria-label={item.aprovado ? 'Remover aprovação' : 'Aprovar item'}
                          className={`w-[22px] h-[22px] rounded-[5px] border-2 flex items-center justify-center transition-all disabled:opacity-50 ${
                            item.aprovado ? 'bg-blue-500 border-blue-500' : 'border-blue-300 hover:border-blue-400 bg-white'
                          }`}
                        >
                          {item.aprovado && (
                            <svg width="11" height="9" viewBox="0 0 12 10" fill="none" aria-hidden="true">
                              <path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </button>
                        <span className="text-[10px] font-[700] text-blue-600 uppercase tracking-[0.5px]" aria-hidden="true">Ap.</span>
                      </div>
                    </div>

                    {/* Status dot */}
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      done ? 'bg-emerald-400' : pending ? 'bg-amber-400' : 'bg-[#CBD5E1]'
                    }`} />

                    {/* Text */}
                    <p className={`flex-1 text-[14px] leading-relaxed font-[600] min-w-0 ${
                      done ? 'line-through text-[#94A3B8]' : 'text-[#0F172A]'
                    }`}>
                      {item.text}
                    </p>

                    {/* Status badge */}
                    <div className="hidden sm:flex flex-col gap-1 shrink-0 items-end">
                      {pending && <span className="text-[10px] font-[700] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Por aprovar</span>}
                      {done && <span className="text-[10px] font-[700] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Concluído</span>}
                    </div>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(item.id)}
                      aria-label={`Apagar item: ${item.text.slice(0, 60)}`}
                      title="Apagar item"
                      className="p-2 rounded-[8px] text-[#CBD5E1] hover:text-red-500 hover:bg-red-50 transition-all shrink-0 ml-1"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {items.length > 0 && (
          <p className="text-center text-[11px] text-[#CBD5E1] font-[500] pb-4">
            ☁ Guardado na cloud — sincronizado em todos os dispositivos.
          </p>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          className="fixed inset-0 z-[500] flex items-center justify-center p-4"
        >
          <button
            type="button"
            aria-label="Fechar diálogo"
            onClick={() => setDeleteConfirm(null)}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
          />
          <div className="relative bg-white rounded-[24px] p-8 shadow-2xl max-w-sm w-full">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-8 h-8 text-red-500" aria-hidden="true" />
              </div>
              <div>
                <h3 id="delete-modal-title" className="text-[20px] font-[800] text-[#0F172A]">Apagar item?</h3>
                <p className="text-[13px] text-[#64748B] mt-2 font-[500] leading-relaxed">
                  Tem a certeza que deseja apagar este item?<br/>Esta ação não pode ser desfeita.
                </p>
              </div>
              <div className="flex gap-3 w-full mt-1">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                  className="flex-1 py-3 rounded-[10px] text-[14px] font-[700] bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => confirmDelete(deleteConfirm)}
                  disabled={deleting}
                  aria-busy={deleting}
                  className="flex-1 py-3 rounded-[10px] text-[14px] font-[700] bg-red-500 text-white hover:bg-red-600 active:scale-[0.98] transition-all shadow-md shadow-red-500/25 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 inline-flex items-center justify-center gap-2"
                >
                  {deleting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                  {deleting ? 'A apagar…' : 'Apagar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
