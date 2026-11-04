import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Building2, Users, Plus, LogOut, Check, Loader2, ShieldCheck, Briefcase, ChevronRight, AlertTriangle, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useAuth } from './lib/auth';
import {
  listMyGabinetes, createGabinete,
  setActiveGabineteId, getActiveGabineteId, type GabineteMeta,
} from './lib/gabinetes';
import { EquipaAcessoError, vincularContaNormal } from './lib/equipaAcesso';

interface Props {
  onChosen: (gabineteId: string) => void;
}

export default function GabineteSelector({ onChosen }: Props) {
  const { user, employeeProfile, accountEmail, logout } = useAuth();
  const [meus, setMeus] = useState<GabineteMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newNif, setNewNif] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkPassword, setLinkPassword] = useState('');
  const [showLinkPassword, setShowLinkPassword] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState('');

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const { meus: m } = await listMyGabinetes();
      setMeus(m);
      // Auto-select se só houver um gabinete e não houver um ativo prévio.
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNome.trim()) { setError('Indique o nome do gabinete.'); return; }
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

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkPassword) {
      setError('Indique a password criada pelo gabinete.');
      return;
    }
    setLinkBusy(true);
    setError(null);
    setLinkSuccess('');
    try {
      const result = await vincularContaNormal(linkPassword);
      if (result.gabinetesVinculados.length === 0) {
        setError('Não encontrámos um acesso ativo para este email com essa password. Confirme os dados ou peça ao gabinete para repor a password.');
        return;
      }
      const gabineteId = result.gabinetesVinculados[0];
      setLinkSuccess('Acesso confirmado. A abrir o gabinete...');
      setLinkPassword('');
      setActiveGabineteId(gabineteId);
      onChosen(gabineteId);
    } catch (err) {
      setError(err instanceof EquipaAcessoError
        ? err.message
        : 'Não foi possível confirmar este acesso. Tente novamente.');
    } finally {
      setLinkBusy(false);
    }
  };

  const activeId = getActiveGabineteId();

  return (
    <div className="min-h-screen w-full bg-[#F5F7FA] flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="" className="w-8 h-8 object-contain logo-orb" />
          <span className="text-[16px] font-[800] tracking-[-0.2px] text-[#0B1D2D]">ESTUDO<span className="text-[#0677FF]">360°</span></span>
          <span className="ml-2 text-[11px] font-[700] tracking-[1px] uppercase px-2 py-1 rounded-full bg-white border border-[#E2E8F0] text-[#64748B]">Gabinetes</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-[13px] text-[#64748B]">{accountEmail}</span>
          <button onClick={() => logout()} className="inline-flex items-center gap-1.5 text-[13px] font-[600] px-3 py-1.5 rounded-full border border-black/10 hover:bg-black/5"><LogOut className="w-3.5 h-3.5" /> Sair</button>
        </div>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-6xl grid lg:grid-cols-[1.15fr_0.85fr] gap-6">
          {/* Esquerda — lista */}
          <div className="space-y-6">
            <div>
              <h1 className="text-[30px] font-[800] tracking-[-1px] text-[#0B1D2D] leading-none">Em que gabinete pretende trabalhar?</h1>
              <p className="mt-2 text-[14px] text-[#64748B]">Escolha o gabinete onde quer trabalhar. As associações criadas pelo dono aparecem aqui automaticamente.</p>
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
                <div className="bg-white rounded-[20px] border border-[#E2E8F0] shadow-sm overflow-hidden">
                  <div className="px-5 py-3 bg-[#F5F7FA] border-b border-[#E2E8F0] flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#0677FF]" />
                    <span className="text-[11px] font-[800] tracking-[1px] uppercase text-[#0F172A]">Os seus gabinetes</span>
                    <span className="ml-auto text-[11px] font-[700] text-[#94A3B8]">{meus.length}</span>
                  </div>
                  {meus.length === 0 ? (
                    <div className="p-8 text-center">
                      <Briefcase className="w-8 h-8 text-[#94A3B8] mx-auto" />
                      <p className="mt-2 text-[14px] font-[600] text-[#475569]">Ainda não tem gabinetes</p>
                      <p className="text-[13px] text-[#94A3B8]">Crie o primeiro abaixo.</p>
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
            {!employeeProfile && (
              <div className="bg-white rounded-[20px] border border-[#E2E8F0] shadow-sm p-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#EFF6FF] text-[#0677FF] flex items-center justify-center"><KeyRound className="w-4 h-4" /></div>
                  <div>
                    <h2 className="text-[16px] font-[800] text-[#0B1D2D]">Já tem um acesso criado pelo gabinete?</h2>
                    <p className="text-[12px] text-[#64748B] mt-0.5">{accountEmail}</p>
                  </div>
                </div>
                {!linkOpen ? (
                  <>
                    <p className="mt-3 text-[13px] text-[#64748B] leading-relaxed">Use a password que o dono ou administrador criou para este email. Assim, a sua conta fica associada ao gabinete certo.</p>
                    <button onClick={() => { setLinkOpen(true); setError(null); }} className="mt-4 w-full inline-flex items-center justify-center gap-2 border border-[#0677FF]/25 bg-[#EFF6FF] text-[#0558C9] py-3 rounded-xl text-[14px] font-[800] hover:bg-[#E3F0FF]">
                      <KeyRound className="w-4 h-4" /> Confirmar acesso ao gabinete
                    </button>
                  </>
                ) : (
                  <form onSubmit={handleLink} className="mt-4 space-y-3">
                    <label className="block">
                      <span className="text-[11px] font-[700] uppercase tracking-[1px] text-[#64748B]">Password criada pelo gabinete</span>
                      <div className="relative mt-1">
                        <input
                          type={showLinkPassword ? 'text' : 'password'}
                          value={linkPassword}
                          onChange={(e) => setLinkPassword(e.target.value)}
                          className="w-full px-3 pr-11 py-3 rounded-xl border border-[#E2E8F0] bg-[#F5F7FA] text-[14px] focus:bg-white focus:border-[#0677FF] outline-none"
                          autoComplete="current-password"
                          autoFocus
                        />
                        <button type="button" onClick={() => setShowLinkPassword(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#64748B] hover:text-[#0B1D2D]" aria-label={showLinkPassword ? 'Ocultar password' : 'Mostrar password'}>
                          {showLinkPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </label>
                    {linkSuccess && <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-[12.5px] font-[600] text-emerald-700"><Check className="w-4 h-4" /> {linkSuccess}</div>}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setLinkOpen(false); setLinkPassword(''); setError(null); }} className="flex-1 py-3 rounded-xl border border-[#E2E8F0] bg-white text-[14px] font-[700] text-[#475569]">Cancelar</button>
                      <button type="submit" disabled={linkBusy} className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0677FF] text-white text-[14px] font-[800] hover:bg-[#0558c9] disabled:opacity-60">
                        {linkBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Confirmar
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {!employeeProfile && <div className="bg-white rounded-[20px] border border-[#E2E8F0] shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-[#0B1D2D] text-white flex items-center justify-center"><Plus className="w-4 h-4" /></div>
                <h2 className="text-[16px] font-[800] text-[#0B1D2D]">Criar novo gabinete</h2>
              </div>
              {!creating ? (
                <>
                  <p className="text-[13px] text-[#64748B] leading-relaxed">Cada gabinete tem a sua carteira de clientes, tarefas e cofre separados. Pode ter quantos precisar (por sociedade, por marca, por equipa).</p>
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
            </div>}

            <div className="bg-[#0B1D2D] text-white rounded-[20px] p-6">
              <div className="flex items-center gap-2 text-emerald-300"><ShieldCheck className="w-4 h-4" /><span className="text-[11px] font-[800] tracking-[1px] uppercase">Privado por gabinete</span></div>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-300">Cada gabinete é um espaço isolado: clientes, tarefas, obrigações e cofre nunca se misturam entre gabinetes — nem mesmo para o dono. Só membros autorizados vêem o gabinete.</p>
              {!employeeProfile && <div className="mt-4 flex items-center gap-2 text-[12px] text-slate-400"><Users className="w-4 h-4" /> Crie os logins da equipa no ecrã Equipa do Gabinete.</div>}
            </div>
          </div>
        </div>
      </div>

      <footer className="py-4 text-center text-[11px] text-[#94A3B8]">Pode sempre trocar de gabinete no topo do Gabinete.</footer>
    </div>
  );
}
