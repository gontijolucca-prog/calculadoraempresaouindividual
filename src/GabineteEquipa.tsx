import React, { useMemo, useState } from 'react';
import { Users, Mail, Trash2, Pencil, X, Plus, Search, CheckCircle2, Clock, Shield } from 'lucide-react';
import { useGabineteColaboradores, useGabineteClientes } from './lib/useGabinete';
import { upsertColaborador, deleteColaborador, newColaboradorId, getColaboradorInitials, upsertCliente, type Colaborador, type ColaboradorRole } from './lib/gabinete';

const roleLabel: Record<ColaboradorRole, string> = {
  admin: 'Admin',
  contabilista: 'Contabilista',
  estagiaria: 'Estagiária',
};
const roleStyle: Record<ColaboradorRole, string> = {
  admin: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  contabilista: 'bg-blue-50 text-blue-700 border-blue-200',
  estagiaria: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function GabineteEquipa() {
  const colaboradores = useGabineteColaboradores();
  const clientes = useGabineteClientes();
  const [q, setQ] = useState('');
  const [filtroRole, setFiltroRole] = useState<'todos' | ColaboradorRole>('todos');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Colaborador | null>(null);
  const [form, setForm] = useState<Partial<Colaborador>>({ role: 'contabilista' });
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim();
    return colaboradores.filter(c => {
      if (filtroRole !== 'todos' && c.role !== filtroRole) return false;
      if (!s) return true;
      return `${c.nome} ${c.email} ${c.role}`.toLowerCase().includes(s);
    });
  }, [colaboradores, q, filtroRole]);

  const openAdd = () => {
    setEditing(null);
    setForm({ role: 'contabilista', status: 'convite_pendente' });
    setError('');
    setShowForm(true);
  };
  const openEdit = (c: Colaborador) => {
    setEditing(c);
    setForm({ ...c });
    setError('');
    setShowForm(true);
  };
  const handleSave = async () => {
    const nome = form.nome?.trim();
    const email = form.email?.trim().toLowerCase();
    const role = form.role as ColaboradorRole;
    if (!nome) { setError('Nome obrigatório'); return; }
    if (!email || !/.+@.+\..+/.test(email)) { setError('Email válido obrigatório'); return; }
    const dup = colaboradores.some(c => c.email.toLowerCase() === email && c.id !== editing?.id);
    if (dup) { setError('Este email já está na equipa'); return; }
    const col: Colaborador = {
      id: editing?.id || newColaboradorId(),
      nome,
      email,
      role: role || 'contabilista',
      initials: getColaboradorInitials(nome),
      status: editing?.status || 'convite_pendente',
      inviteSentAt: editing?.inviteSentAt || Date.now(),
      linkedUid: editing?.linkedUid,
      cor: editing?.cor,
      avatar: editing?.avatar,
      createdAt: editing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    await upsertColaborador(col);
    setShowForm(false);
    setEditing(null);
    setForm({ role: 'contabilista' });
  };

  const handleReenviar = async (c: Colaborador) => {
    await upsertColaborador({ ...c, inviteSentAt: Date.now(), status: 'convite_pendente', updatedAt: Date.now() });
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-[800] flex items-center gap-2 text-[#0B1D2D]"><Users className="w-4 h-4 text-[#2563EB]" /> Equipa do gabinete</h2>
            <p className="text-[12.5px] text-[#64748B] mt-1">Quem trabalha aqui — convida por email e associa a clientes como responsável, apoio ou supervisor.</p>
          </div>
          <button onClick={openAdd} className="px-4 py-2 rounded-xl bg-[#0F172A] text-white text-sm font-[600] flex items-center gap-1.5"><Plus className="w-4 h-4" /> Adicionar funcionário</button>
        </div>
        <div className="mt-4 flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Pesquisar nome, email ou cargo..." className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm" />
          </div>
          <select value={filtroRole} onChange={e => setFiltroRole(e.target.value as never)} className="px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm">
            <option value="todos">Todos os cargos</option>
            <option value="admin">Admin</option>
            <option value="contabilista">Contabilista</option>
            <option value="estagiaria">Estagiária</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-8 text-center">
          <Users className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">{q || filtroRole !== 'todos' ? 'Nenhum colaborador corresponde à pesquisa.' : 'Ainda sem equipa. Adiciona o primeiro funcionário por email.'}</p>
          {q === '' && filtroRole === 'todos' && (
            <button onClick={openAdd} className="mt-3 px-4 py-2 rounded-xl bg-[#0677FF] text-white text-sm font-medium">Adicionar funcionário</button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F8FAFC] text-[#64748B] text-xs">
                <tr>
                  <th className="text-left px-4 py-3 font-[600]">Colaborador</th>
                  <th className="text-left px-4 py-3 font-[600]">Email</th>
                  <th className="text-left px-4 py-3 font-[600]">Cargo</th>
                  <th className="text-left px-4 py-3 font-[600]">Estado</th>
                  <th className="text-right px-4 py-3 font-[600]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-[700] text-white shrink-0" style={{ background: c.cor || (c.role === 'admin' ? '#0F172A' : c.role === 'contabilista' ? '#2563EB' : '#F59E0B') }}>{c.initials || getColaboradorInitials(c.nome)}</span>
                        <span className="font-[600] text-[#0F172A]">{c.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#475569]">{c.email}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full border text-[11px] font-[600] ${roleStyle[c.role]}`}>{roleLabel[c.role]}</span></td>
                    <td className="px-4 py-3">
                      {c.status === 'ativo' ? (
                        <span className="inline-flex items-center gap-1 text-[12px] text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" /> Ativo{c.linkedUid ? '' : ' (sem link)'}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[12px] text-amber-700"><Clock className="w-3.5 h-3.5" /> Convite pendente</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-600" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                        {c.status === 'convite_pendente' && <button onClick={() => handleReenviar(c)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-[#2563EB]" title="Reenviar convite"><Mail className="w-3.5 h-3.5" /></button>}
                        <button onClick={async () => { if (confirm(`Remover ${c.nome}?`)) await deleteColaborador(c.id); }} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600" title="Remover"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <h3 className="text-[13px] font-[700] text-[#0B1D2D] flex items-center gap-2"><Shield className="w-4 h-4 text-[#2563EB]" /> Associações por cliente</h3>
        <p className="text-[12px] text-[#64748B] mt-1">Define responsável, apoio e supervisor de cada cliente a partir da equipa. Reflete na Visão geral.</p>
        <div className="mt-3 space-y-2">
          {clientes.length === 0 ? (
            <div className="text-[12px] text-[#94A3B8] border-2 border-dashed rounded-xl p-4 text-center">Sem clientes — cria um cliente para associar.</div>
          ) : clientes.slice(0, 20).map(cli => (
            <div key={cli.id} className="flex flex-wrap items-center gap-2 p-2 rounded-xl border border-[#F1F5F9] bg-[#F8FAFC]">
              <span className="w-[160px] truncate text-[12.5px] font-[600] text-[#0F172A]">{cli.nome}</span>
              {[
                { key: 'responsavelId' as const, label: 'Responsável', value: cli.responsavelId },
                { key: 'apoioId' as const, label: 'Apoio', value: cli.apoioId },
                { key: 'supervisorId' as const, label: 'Supervisor', value: cli.supervisorId },
              ].map(field => (
                <select
                  key={field.key}
                  value={field.value || ''}
                  onChange={async e => {
                    const cid = e.target.value || undefined;
                    const col = colaboradores.find(c => c.id === cid);
                    const patch: Record<string, unknown> = { [field.key]: cid, updatedAt: Date.now() };
                    if (field.key === 'responsavelId') patch['responsavelInterno'] = col ? { nome: col.nome, initials: col.initials || getColaboradorInitials(col.nome) } : undefined;
                    if (field.key === 'apoioId') patch['apoioAdministrativo'] = col ? { nome: col.nome, initials: col.initials || getColaboradorInitials(col.nome) } : undefined;
                    if (field.key === 'supervisorId') patch['supervisor'] = col ? { nome: col.nome, initials: col.initials || getColaboradorInitials(col.nome) } : undefined;
                    await upsertCliente({ ...cli, ...patch } as typeof cli);
                  }}
                  className="flex-1 min-w-[130px] px-2 py-1.5 rounded-lg border border-[#E2E8F0] bg-white text-[12px]"
                >
                  <option value="">{field.label} — nenhum</option>
                  {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome} ({roleLabel[c.role]})</option>)}
                </select>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] leading-[17px] text-amber-900">
        <strong>Como funciona o convite por email:</strong> ao adicionar um funcionário, criamos o registo com estado <em>Convite pendente</em>. A pessoa deve <strong>criar conta no estudo360 com esse mesmo email</strong> (Registo). Ao fazer login, o gabinete deteta o email e marca o colaborador como <em>Ativo</em> automaticamente (link por email). Cada login/officeId vê a sua própria equipa isolada (Firestore <code>gabinete/{'{'}officeId{'}'}/colaboradores</code>).
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-[480px] bg-white rounded-2xl p-6 border shadow-xl space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{editing ? 'Editar colaborador' : 'Adicionar funcionário'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-zinc-100 rounded"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <input value={form.nome || ''} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" />
              <input value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email (para login)" type="email" className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 text-sm" />
              <select value={form.role || 'contabilista'} onChange={e => setForm({ ...form, role: e.target.value as ColaboradorRole })} className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm">
                <option value="admin">Admin — dono do gabinete</option>
                <option value="contabilista">Contabilista</option>
                <option value="estagiaria">Estagiária</option>
              </select>
              {error && <div className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border border-zinc-200 text-sm">Cancelar</button>
              <button onClick={handleSave} className="px-4 py-2 rounded-xl bg-[#0F172A] text-white text-sm font-medium">{editing ? 'Guardar' : 'Adicionar (convite pendente)'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
