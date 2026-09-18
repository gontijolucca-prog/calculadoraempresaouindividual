import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Building2, Users, Mail, Plus, LogOut, Check, X, Loader2, ShieldCheck, Briefcase, ChevronRight, AlertTriangle } from 'lucide-react';
import { useAuth } from './lib/auth';
import {
  listMyGabinetes, ensureDefaultGabinete, createGabinete,
  acceptInvite, declineInvite, setActiveGabineteId, getActiveGabineteId, type GabineteMeta,
} from './lib/gabinetes';

interface Props {
  onChosen: (gabineteId: string) => void;
}

export default function GabineteSelector({ onChosen }: Props) {
  const { user, logout } = useAuth();
  const [meus, setMeus] = useState<GabineteMeta[]>([]);
  const [convites, setConvites] = useState<GabineteMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newNif, setNewNif] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      await ensureDefaultGabinete();
      const { meus: m, convites: c } = await listMyGabinetes();
      setMeus(m);
      setConvites(c);
      // Auto-select se só houver 1 e sem convites pendentes e sem ativo prévio
      // Mas user pediu que PERGUNTE SEMPRE — então não auto-entra. Deixa lista visível.
      // Se houver activeId já válido (sessão anterior) e o user já pertence, pré-seleciona visualmente.
    } catch (e: any) {
      setError(e?.message || 'Falha ao carregar gabinetes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const choose = (id: string) => {
    setActiveGabineteId(id);
    onChosen(id);
  };

  const handleAccept = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await acceptInvite(id);
      setActiveGabineteId(id);
      onChosen(id);
    } catch (e: any) {
      setError(e?.message || 'Falha ao aceitar convite.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (id: string) => {
    setBusyId(id);
    try {
      await declineInvite(id);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Falha ao recusar.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNome.trim()) { setError('Indica o nome do gabinete.'); return; }
    setBusyId('create');
    setError(null);
    try {
      const id = await createGabinete(newNome.trim(), newNif.trim() || undefined);
      setActiveGabineteId(id);
      onChosen(id);
    } catch (err: any) {
      setError(err?.message || 'Falha ao criar gabinete.');
    } finally {
      setBusyId(null);
    }
  };

  const activeId = getActiveGabineteId();

  return (
    <div className="min-h-screen w-full bg-[#F5F7FA] flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="" className="w-8 h-8 object-contain" />
          <span className="text-[16px] font-[800] tracking-[-0.2px] text-[#0B1D2D]">ESTUDO<span className="text-[#0677FF]">360°</span></span>
          <span className="ml-2 text-[11px] font-[700] tracking-[1px] uppercase px-2 py-1 rounded-full bg-white border border-[#E2E8F0] text-[#64748B]">Gabinetes</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-[13px] text-[#64748B]">{user?.email}</span>
          <button onClick={() => logout()} className="inline-flex items-center gap-1.5 text-[13px] font-[600] px-3 py-1.5 rounded-full border border-black/10 hover:bg-black/5"><LogOut className="w-3.5 h-3.5" /> Sair</button>
        </div>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-6xl grid lg:grid-cols-[1.15fr_0.85fr] gap-6">
          {/* Esquerda — lista */}
          <div className="space-y-6">
            <div>
              <h1 className="text-[30px] font-[800] tracking-[-1px] text-[#0B1D2D] leading-none">Em que gabinete queres trabalhar?</h1>
              <p className="mt-2 text-[14px] text-[#64748B]">Escolhe um dos teus gabinetes ou aceita um convite. Perguntamos sempre ao entrar — podes trocar a qualquer momento.</p>
            </div>

            {error && (
              <div className="flex gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-xl text-[13px]"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span></div>
            )}

            {loading ? (
              <div className="bg-white rounded-[20px] border border-[#E2E8F0] p-10 flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 text-[#0677FF] animate-spin" />
                <span className="text-[13px] font-[600] text-[#64748B]">A carregar gabinetes…</span>
              </div>
            ) : (
              <>
                {convites.length > 0 && (
                  <div className="bg-white rounded-[20px] border border-amber-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-amber-600" />
                      <span className="text-[11px] font-[800] tracking-[1px] uppercase text-amber-800">Convites para ti ({convites.length})</span>
                    </div>
                    <div className="divide-y divide-[#F1F5F9]">
                      {convites.map(g => (
                        <div key={g.id} className="px-5 py-4 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="text-[14px] font-[800] text-[#0B1D2D] truncate">{g.nome}</div>
                            <div className="text-[12px] text-[#64748B] truncate">{g.ownerEmail} · convidou-te como {g.invites.find(i => i.email.toLowerCase() === (user?.email || '').toLowerCase())?.role || 'colaborador'}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button disabled={busyId === g.id} onClick={() => void handleDecline(g.id)} className="w-9 h-9 rounded-full border border-[#E2E8F0] bg-white hover:bg-[#F5F7FA] flex items-center justify-center disabled:opacity-50"><X className="w-4 h-4 text-[#64748B]" /></button>
                            <button disabled={busyId === g.id} onClick={() => void handleAccept(g.id)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0B1D2D] text-white text-[13px] font-[700] hover:bg-[#162a41] disabled:opacity-50">
                              {busyId === g.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Aceitar e entrar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-[20px] border border-[#E2E8F0] shadow-sm overflow-hidden">
                  <div className="px-5 py-3 bg-[#F5F7FA] border-b border-[#E2E8F0] flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#0677FF]" />
                    <span className="text-[11px] font-[800] tracking-[1px] uppercase text-[#0F172A]">Os teus gabinetes</span>
                    <span className="ml-auto text-[11px] font-[700] text-[#94A3B8]">{meus.length}</span>
                  </div>
                  {meus.length === 0 ? (
                    <div className="p-8 text-center">
                      <Briefcase className="w-8 h-8 text-[#94A3B8] mx-auto" />
                      <p className="mt-2 text-[14px] font-[600] text-[#475569]">Ainda não tens gabinetes</p>
                      <p className="text-[13px] text-[#94A3B8]">Cria o primeiro abaixo.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#F1F5F9]">
                      {meus.map(g => {
                        const isActive = activeId === g.id;
                        const role = g.members[user?.uid || '']?.role || (g.ownerUid === user?.uid ? 'admin' : '—');
                        return (
                          <button key={g.id} onClick={() => choose(g.id)} className={`w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-[#F5F7FA] transition-colors ${isActive ? 'bg-[#EFF6FF]' : ''}`}>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[14px] font-[800] text-[#0B1D2D] truncate">{g.nome}</span>
                                {isActive && <span className="text-[10px] font-[800] tracking-[0.5px] uppercase px-2 py-0.5 rounded-full bg-[#0677FF] text-white">Ativo</span>}
                              </div>
                              <div className="text-[12px] text-[#64748B] truncate">
                                {g.nif ? `NIF ${g.nif} · ` : ''}{role} · {g.memberUids.length} membro(s)
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-[#94A3B8] shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Direita — criar + reassurance */}
          <div className="space-y-4">
            <div className="bg-white rounded-[20px] border border-[#E2E8F0] shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-[#0B1D2D] text-white flex items-center justify-center"><Plus className="w-4 h-4" /></div>
                <h2 className="text-[16px] font-[800] text-[#0B1D2D]">Criar novo gabinete</h2>
              </div>
              {!creating ? (
                <>
                  <p className="text-[13px] text-[#64748B] leading-relaxed">Cada gabinete tem a sua carteira de clientes, tarefas e cofre separados. Podes ter quantos precisares (por sociedade, por marca, por equipa).</p>
                  <button onClick={() => setCreating(true)} className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-[#0B1D2D] text-white py-3 rounded-xl text-[14px] font-[800] hover:bg-[#162a41]">
                    <Plus className="w-4 h-4" /> Criar gabinete
                  </button>
                </>
              ) : (
                <form onSubmit={handleCreate} className="space-y-3">
                  <label className="block">
                    <span className="text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B]">Nome do gabinete *</span>
                    <input value={newNome} onChange={e => setNewNome(e.target.value)} placeholder="Ex: Silva & Associados" className="mt-1 w-full px-3 py-3 rounded-xl border border-[#E2E8F0] bg-[#F5F7FA] text-[14px] focus:bg-white focus:border-[#0677FF] outline-none" autoFocus />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B]">NIF (opcional)</span>
                    <input value={newNif} onChange={e => setNewNif(e.target.value)} placeholder="500000000" className="mt-1 w-full px-3 py-3 rounded-xl border border-[#E2E8F0] bg-[#F5F7FA] text-[14px] focus:bg-white focus:border-[#0677FF] outline-none" />
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setCreating(false)} className="flex-1 py-3 rounded-xl border border-[#E2E8F0] bg-white text-[14px] font-[700] text-[#475569]">Cancelar</button>
                    <button type="submit" disabled={busyId === 'create'} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0677FF] text-white text-[14px] font-[800] hover:bg-[#0558c9] disabled:opacity-60">
                      {busyId === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Criar e entrar
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="bg-[#0B1D2D] text-white rounded-[20px] p-6">
              <div className="flex items-center gap-2 text-emerald-300"><ShieldCheck className="w-4 h-4" /><span className="text-[11px] font-[800] tracking-[1px] uppercase">Privado por gabinete</span></div>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-300">Cada gabinete é um espaço isolado: clientes, tarefas, obrigações e cofre nunca se misturam entre gabinetes — nem mesmo para o dono. Só membros convidados vêem o gabinete.</p>
              <div className="mt-4 flex items-center gap-2 text-[12px] text-slate-400"><Users className="w-4 h-4" /> Convida por email no ecrã Equipa do Gabinete.</div>
            </div>
          </div>
        </div>
      </div>

      <footer className="py-4 text-center text-[11px] text-[#94A3B8]">Podes sempre trocar de gabinete no topo do Gabinete.</footer>
    </div>
  );
}
