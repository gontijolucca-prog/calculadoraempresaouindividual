import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Mail, Trash2, Pencil, X, Plus, Search, CheckCircle2, Clock, Shield, Copy, Check } from 'lucide-react';
import { useGabineteColaboradores, useGabineteClientes } from './lib/useGabinete';
import { filterActive } from './lib/gabineteSelectors';
import { upsertColaborador, deleteColaborador, newColaboradorId, getColaboradorInitials, upsertCliente, type Colaborador, type ColaboradorRole } from './lib/gabinete';
import { getActiveGabineteId, getGabineteMeta, inviteToGabinete, removeFromGabinete, atualizarCargoColaborador, type GabineteMeta } from './lib/gabinetes';
import { PERMISSION_LABELS, type PermissionAction, setCustomRolesCache } from './lib/permissions';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './lib/firebase';

const ROLE_BASE_LABEL: Record<string, string> = {
  admin: 'Admin',
  contabilista: 'Contabilista',
  estagiaria: 'Estagiária',
};
const roleLabel: Record<string, string> = ROLE_BASE_LABEL;
function labelDoCargo(role: string, meta?: GabineteMeta | null): string {
  if (role.startsWith('custom:')) return meta?.customRoles?.[role]?.nome || meta?.customRoles?.[role.slice(7)]?.nome || 'Cargo personalizado';
  return ROLE_BASE_LABEL[role] || role;
}
function styleDoCargo(role: string): string {
  if (role === 'admin') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (role === 'contabilista') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (role === 'estagiaria') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-violet-50 text-violet-700 border-violet-200';
}
const TODAS_PERMISSOES = Object.keys(PERMISSION_LABELS) as PermissionAction[];

/** Link público do convite — a página onde a pessoa define a password. */
const CONVITE_BASE = 'https://estudo360.pt/convite';
const linkDoConvite = (token: string) => `${CONVITE_BASE}?t=${encodeURIComponent(token)}`;

/** Mensagem pronta a enviar (email, WhatsApp ou à frente) com o link do convite. */
function mensagemConvite(c: Colaborador, link: string, meta?: GabineteMeta | null): string {
  const primeiro = c.nome.trim().split(/\s+/)[0] || c.nome;
  return `Olá ${primeiro},

Convidei-te para a equipa do gabinete no Estudo360, como ${labelDoCargo(c.role, meta)}.

${link
    ? `Abre este link e define a tua password (vale 7 dias):\n${link}`
    : 'Pede-me um link de convite novo (o anterior já não vale).'}

O email do convite é ${c.email}. Se já tiveres conta Estudo360, na página do link usa «Já tenho conta — entrar».

Qualquer dúvida, diz-me.`;
}

export default function GabineteEquipa() {
  const colaboradores = useGabineteColaboradores();
  const clientesAll = useGabineteClientes();
  const clientes = useMemo(() => filterActive(clientesAll), [clientesAll]);
  const [q, setQ] = useState('');
  const [filtroRole, setFiltroRole] = useState<'todos' | ColaboradorRole>('todos');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Colaborador | null>(null);
  const [form, setForm] = useState<Partial<Colaborador>>({ role: 'contabilista' });
  const [convite, setConvite] = useState<Colaborador | null>(null);
  const [envio, setEnvio] = useState<'a-enviar' | 'enviado' | 'sem-servico' | 'falhou' | null>(null);
  const [tokenConvite, setTokenConvite] = useState<string>('');
  const [error, setError] = useState('');
  // Metadados do gabinete ativo: dão-nos o token guardado em cada convite (para
  // o botão «Copiar link» das linhas pendentes).
  const [gabMeta, setGabMeta] = useState<GabineteMeta | null>(null);
  const [copiado, setCopiado] = useState('');
  const [reenviandoId, setReenviandoId] = useState<string | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleNome, setRoleNome] = useState('');
  const [rolePerms, setRolePerms] = useState<PermissionAction[]>([]);
  const [roleErro, setRoleErro] = useState('');
  const [roleSaving, setRoleSaving] = useState(false);

  const criarCargo = async () => {
    const nome = roleNome.trim();
    if (!nome) { setRoleErro('Dê um nome ao cargo.'); return; }
    if (rolePerms.length === 0) { setRoleErro('Escolha pelo menos uma permissão.'); return; }
    const gabId = getActiveGabineteId();
    if (!gabId) { setRoleErro('Sem gabinete ativo.'); return; }
    setRoleSaving(true); setRoleErro('');
    try {
      const roleId = `custom:${Math.random().toString(36).slice(2, 10)}`;
      // Lê o estado atual do gabinete para não apagar cargos já existentes
      // (a cache local pode ainda não ter carregado quando o formulário abre).
      const atual = await getGabineteMeta(gabId).catch(() => null);
      const customRoles = { ...(atual?.customRoles || gabMeta?.customRoles || {}), [roleId]: { nome, permissoes: rolePerms, createdAt: Date.now(), createdBy: 'owner' } };
      await updateDoc(doc(db, 'gabinetes', gabId), { customRoles });
      setCustomRolesCache(customRoles);
      const fresco = await getGabineteMeta(gabId).catch(() => null);
      setGabMeta(fresco || (gabMeta ? { ...gabMeta, customRoles } : null));
      setForm((f) => ({ ...f, role: roleId as ColaboradorRole }));
      setShowRoleModal(false);
      setRoleNome(''); setRolePerms([]);
    } catch (e: any) {
      setRoleErro(e?.message || 'Não foi possível guardar o cargo.');
    } finally { setRoleSaving(false); }
  };

  const recarregarMeta = useCallback(async () => {
    const gabId = getActiveGabineteId();
    if (!gabId) { setGabMeta(null); return; }
    const meta = await getGabineteMeta(gabId).catch(() => null);
    setGabMeta(meta);
  }, []);
  useEffect(() => { void recarregarMeta(); }, [recarregarMeta]);

  // Email → token do convite mais recente guardado no gabinete.
  const tokenPorEmail = useMemo(() => {
    const porEmail = new Map<string, string>();
    for (const inv of gabMeta?.invites || []) {
      const email = (inv.email || '').toLowerCase();
      if (email && inv.token) porEmail.set(email, inv.token);
    }
    return porEmail;
  }, [gabMeta]);

  const copiar = useCallback(async (texto: string, chave: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(chave);
      window.setTimeout(() => setCopiado(atual => (atual === chave ? '' : atual)), 2200);
    } catch {
      window.prompt('Copia o texto abaixo:', texto);
    }
  }, []);

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
    setEnvio(null);
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
    // Editar: guarda o registo e atualiza o cargo de quem já está no gabinete.
    // Não cria convite novo (o colaborador já existe) nem mexe no link pendente.
    if (editing) {
      await upsertColaborador(col);
      const gabId = getActiveGabineteId();
      if (gabId) {
        try { await atualizarCargoColaborador(gabId, email, col.role, col.linkedUid); }
        catch (e) { alert('Guardado, mas o cargo no gabinete não atualizou: ' + String((e as Error)?.message || e)); }
      }
      await recarregarMeta();
      setShowForm(false);
      setEditing(null);
      setForm({ role: 'contabilista' });
      return;
    }

    await upsertColaborador(col);
    // Convite real ao gabinete: sem isto o colaborador nunca conseguia entrar
    // (só ficava o registo local na lista da equipa).
    setTokenConvite('');
    setEnvio(null);
    const gabId = getActiveGabineteId();
    let tokenConviteAtual = '';
    if (gabId) {
      try {
        const { token } = await inviteToGabinete(gabId, email, role || 'contabilista');
        setTokenConvite(token);
        tokenConviteAtual = token;
        await recarregarMeta();
      } catch (e) {
        alert('Funcionário guardado, mas o convite ao gabinete falhou: ' + String((e as Error)?.message || e));
      }
    }
    setShowForm(false);
    setEditing(null);
    setForm({ role: 'contabilista' });
    setConvite(col);
    void enviarPeloServidor(col, tokenConviteAtual);
  };

  /** Pede ao servidor (Cloudflare) que envie o email do convite. */
  const enviarPeloServidor = async (c: Colaborador, token: string) => {
    if (!token) { setEnvio(null); return; } // sem link não há email que valha
    setEnvio('a-enviar');
    try {
      const { auth } = await import('./lib/firebase');
      const idToken = await auth.currentUser?.getIdToken();
      const gabId = getActiveGabineteId();
      const meta = gabId ? await getGabineteMeta(gabId).catch(() => null) : null;
      const r = await fetch('/api/equipa-convite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: c.email, nome: c.nome, gabinete: meta?.nome || '', cargo: c.role, idToken, token }),
      });
      const j = await r.json().catch(() => ({}));
      if (j?.ok) setEnvio('enviado');
      else setEnvio(j?.erro === 'email_nao_configurado' ? 'sem-servico' : 'falhou');
    } catch {
      setEnvio('falhou');
    }
  };

  /**
   * Reenviar = gerar um convite NOVO. `inviteToGabinete` cria outro doc em
   * `convites/{token}` e apaga os antigos do mesmo email, por isso o link que
   * já foi partilhado deixa de abrir.
   */
  const handleReenviar = async (c: Colaborador) => {
    const gabId = getActiveGabineteId();
    if (!gabId) { alert('Escolhe primeiro o gabinete ativo.'); return; }
    setReenviandoId(c.id);
    setEnvio(null);
    setTokenConvite('');
    try {
      const { token } = await inviteToGabinete(gabId, c.email, c.role);
      setTokenConvite(token);
      setConvite({ ...c, status: 'convite_pendente' });
      try {
        if (c.status !== 'ativo') {
          await upsertColaborador({ ...c, inviteSentAt: Date.now(), status: 'convite_pendente', updatedAt: Date.now() });
        }
      } catch { /* convite já criado; a lista local atualiza à próxima */ }
      await recarregarMeta();
      void enviarPeloServidor(c, token);
    } catch (e) {
      alert('Não consegui gerar um convite novo: ' + String((e as Error)?.message || e));
    } finally {
      setReenviandoId(null);
    }
  };

  /** Botão «Copiar link» das pendentes: usa o token guardado; se não houver, gera um novo. */
  const copiarLinkPendente = async (c: Colaborador) => {
    const token = tokenPorEmail.get(c.email.toLowerCase());
    if (token) { await copiar(linkDoConvite(token), `link:${c.id}`); return; }
    await handleReenviar(c); // convite antigo sem token: cria link novo e abre o modal
  };

  /** Remover da equipa: confirmação explícita + revogação do convite pendente. */
  const handleRemover = async (c: Colaborador) => {
    if (!window.confirm(`Remover ${c.nome} da equipa?\n\nDeixa de ter acesso a este gabinete e o link do convite pendente deixa de funcionar.`)) return;
    const gabId = getActiveGabineteId();
    if (gabId) {
      try {
        // removeFromGabinete revoga também os docs `convites` pendentes deste email.
        await removeFromGabinete(gabId, c.email, c.linkedUid || undefined);
      } catch (e) {
        alert(String((e as Error)?.message || e));
        return;
      }
    }
    await deleteColaborador(c.id);
    await recarregarMeta();
    if (convite?.id === c.id) setConvite(null);
  };

  const linkConvite = tokenConvite ? linkDoConvite(tokenConvite) : '';
  const textoConvite = convite ? mensagemConvite(convite, linkConvite) : '';
  const mailtoConvite = convite
    ? `mailto:${convite.email}?subject=${encodeURIComponent('Convite para o gabinete no Estudo360')}&body=${encodeURIComponent(textoConvite)}`
    : '';

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-[800] flex items-center gap-2 text-[#0B1D2D]"><Users className="w-4 h-4 text-[#2563EB]" /> Equipa do gabinete</h2>
            <p className="text-[12.5px] text-[#64748B] mt-1">Quem trabalha aqui — convida por link e associa a clientes como responsável, apoio ou supervisor.</p>
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
            {Object.entries((gabMeta?.customRoles || {}) as Record<string, { nome: string }>).map(([key, r]) => (
              <option key={key} value={key}>{r.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-8 text-center">
          <Users className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">{q || filtroRole !== 'todos' ? 'Nenhum colaborador corresponde à pesquisa.' : 'Ainda sem equipa. Adiciona o primeiro funcionário e recebe um link de convite.'}</p>
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
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full border text-[11px] font-[600] ${styleDoCargo(c.role)}`}>{labelDoCargo(c.role, gabMeta)}</span></td>
                    <td className="px-4 py-3">
                      {c.status === 'ativo' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-[600] bg-emerald-50 text-emerald-700 border-emerald-200" title={c.linkedUid ? 'Conta ligada a este registo' : 'Conta ainda não ligada a este registo'}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Ativa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-[600] bg-amber-50 text-amber-800 border-amber-200">
                          <Clock className="w-3.5 h-3.5" /> Convite pendente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-600" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                        {c.status === 'convite_pendente' && (
                          <>
                            <button
                              onClick={() => void copiarLinkPendente(c)}
                              disabled={reenviandoId === c.id}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#E2E8F0] text-[11.5px] font-[600] text-[#2563EB] hover:bg-[#EFF6FF] disabled:opacity-50"
                              title={tokenPorEmail.has(c.email.toLowerCase()) ? 'Copiar o link do convite pendente' : 'Ainda sem link guardado — gera um novo'}
                            >
                              {copiado === `link:${c.id}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              {copiado === `link:${c.id}` ? 'Copiado' : 'Copiar link'}
                            </button>
                            <button
                              onClick={() => void handleReenviar(c)}
                              disabled={reenviandoId === c.id}
                              className="p-1.5 rounded-lg hover:bg-zinc-100 text-[#2563EB] disabled:opacity-50"
                              title="Reenviar — gera um link novo (o antigo deixa de valer)"
                            ><Mail className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                        <button onClick={() => void handleRemover(c)} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600" title="Remover da equipa"><Trash2 className="w-3.5 h-3.5" /></button>
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
                  {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome} ({labelDoCargo(c.role, gabMeta)})</option>)}
                </select>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] leading-[17px] text-amber-900">
        <strong>Como funciona o convite:</strong> ao adicionar um funcionário criamos o registo e um <strong>link de convite único</strong> (vale 7 dias). Copia o link ou a mensagem e envia tu — <strong>o envio automático de email não está configurado</strong>, por isso não prometemos email. A pessoa abre o link, define a password e entra; a linha passa a <em>Ativa</em>. Reenviar gera um link novo e invalida o antigo; remover da equipa revoga os convites pendentes. Cada gabinete vê a sua própria equipa isolada (Firestore <code>gabinete/{'{'}officeId{'}'}/colaboradores</code>).
      </div>

      {showRoleModal && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowRoleModal(false)}>
          <div className="w-full max-w-[520px] max-h-[88vh] overflow-y-auto bg-white rounded-2xl p-6 border shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Criar novo cargo</h3>
              <button onClick={() => setShowRoleModal(false)} className="p-1 hover:bg-zinc-100 rounded"><X className="w-4 h-4" /></button>
            </div>
            <p className="mt-1 text-[12.5px] text-[#64748B]">O cargo fica guardado no gabinete e pode ser atribuído a qualquer colaborador.</p>
            <label className="mt-4 block text-[11px] font-[800] uppercase tracking-[1px] text-[#64748B]">Nome do cargo</label>
            <input value={roleNome} onChange={(e) => setRoleNome(e.target.value)} placeholder="Ex.: Gestor de clientes" className="mt-1 w-full px-3 py-2.5 rounded-xl border border-[#E2E8F0] text-sm" />
            <label className="mt-4 block text-[11px] font-[800] uppercase tracking-[1px] text-[#64748B]">Permissões</label>
            <div className="mt-1 space-y-1.5">
              {TODAS_PERMISSOES.map((perm) => (
                <label key={perm} className="flex items-start gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12.5px] text-[#334155] hover:bg-[#F8FAFC]">
                  <input type="checkbox" checked={rolePerms.includes(perm)} onChange={() => setRolePerms((prev) => prev.includes(perm) ? prev.filter((x) => x !== perm) : [...prev, perm])} className="mt-0.5 w-4 h-4 accent-[#0677FF]" />
                  {PERMISSION_LABELS[perm]}
                </label>
              ))}
            </div>
            {roleErro && <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12.5px] text-rose-700">{roleErro}</div>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowRoleModal(false)} className="px-4 py-2 rounded-xl border border-[#E2E8F0] text-sm">Cancelar</button>
              <button onClick={criarCargo} disabled={roleSaving} className="px-4 py-2 rounded-xl bg-[#0F172A] text-white text-sm font-[600] disabled:opacity-60">{roleSaving ? 'A guardar…' : 'Criar cargo'}</button>
            </div>
          </div>
        </div>
      )}

      {convite && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setConvite(null)}>
          <div className="w-full max-w-[560px] max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-6 border shadow-xl" role="dialog" aria-modal="true" aria-label={`Convite para ${convite.nome}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">Convite para {convite.nome}</h3>
                <p className="text-[12px] text-[#64748B] mt-0.5">{convite.email} · {roleLabel[convite.role]}</p>
              </div>
              <button onClick={() => setConvite(null)} className="p-1 hover:bg-zinc-100 rounded" aria-label="Fechar"><X className="w-4 h-4" /></button>
            </div>

            {envio === 'enviado' && (
              <div className="mt-3 rounded-xl px-3 py-2 text-[12.5px] font-[600] bg-emerald-50 text-emerald-800 border border-emerald-200">Email enviado para {convite.email} pelo servidor.</div>
            )}
            {envio === 'a-enviar' && (
              <div className="mt-3 rounded-xl px-3 py-2 text-[12.5px] font-[600] bg-slate-50 text-slate-600 border border-slate-200">A tentar enviar o email pelo servidor…</div>
            )}
            {(envio === 'sem-servico' || envio === 'falhou') && (
              <div className="mt-3 rounded-xl px-3 py-2 text-[12.5px] leading-5 bg-amber-50 text-amber-900 border border-amber-200">
                <b>O envio automático de email não está configurado.</b> Partilha o link abaixo (email, WhatsApp ou à frente) — é este link que dá acesso.
              </div>
            )}

            {linkConvite ? (
              <>
                <label htmlFor="convite-link" className="mt-4 block text-[11px] font-[700] uppercase tracking-[0.8px] text-[#64748B]">
                  Link do convite <span className="normal-case tracking-normal font-[500]">· válido 7 dias</span>
                </label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <input
                    id="convite-link"
                    readOnly
                    value={linkConvite}
                    onFocus={e => e.currentTarget.select()}
                    onClick={e => e.currentTarget.select()}
                    className="flex-1 min-w-[220px] px-3 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-[12px] text-[#334155]"
                  />
                  <button
                    onClick={() => void copiar(linkConvite, 'modal-link')}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0F172A] text-white text-[12.5px] font-[600]"
                  >
                    {copiado === 'modal-link' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiado === 'modal-link' ? 'Copiado' : 'Copiar link'}
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-[#94A3B8]">
                  <a href={linkConvite} target="_blank" rel="noopener" className="text-[#0677FF] font-[600]">Abrir a página do convite</a> para testar. A pessoa define a password e entra no gabinete.
                </p>
              </>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12.5px] leading-5 text-amber-900">
                Ainda não há link para este convite — o convite ao gabinete não foi criado.{' '}
                <button onClick={() => void handleReenviar(convite)} disabled={reenviandoId === convite.id} className="font-[700] underline disabled:opacity-50">Gerar link novo</button>
              </div>
            )}

            <p className="mt-4 text-[11px] font-[700] uppercase tracking-[0.8px] text-[#64748B]">Mensagem pronta a enviar</p>
            <pre className="mt-1.5 whitespace-pre-wrap rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-[12px] leading-5 text-[#334155] max-h-[180px] overflow-auto">{textoConvite}</pre>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                onClick={() => void copiar(textoConvite, 'modal-msg')}
                className="px-4 py-2 rounded-xl border border-[#E2E8F0] text-sm font-[600]"
              >{copiado === 'modal-msg' ? 'Mensagem copiada' : 'Copiar mensagem'}</button>
              <a
                href={mailtoConvite}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F172A] text-white text-sm font-[600]"
              ><Mail className="w-4 h-4" /> Abrir no email</a>
            </div>
            <p className="mt-3 text-[11px] text-[#94A3B8]">O acesso só fica ativo depois de a pessoa abrir o link e definir a password. Reenviar gera um link novo e invalida o anterior.</p>
          </div>
        </div>
      )}

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
              <select value={form.role || 'contabilista'} onChange={e => { const v = e.target.value; if (v === '__novo__') { setRoleNome(''); setRolePerms([]); setRoleErro(''); setShowRoleModal(true); return; } setForm({ ...form, role: v as ColaboradorRole }); }} className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm">
                <option value="admin">Admin — dono do gabinete</option>
                <option value="contabilista">Contabilista</option>
                <option value="estagiaria">Estagiária</option>
                {Object.entries((gabMeta?.customRoles || {}) as Record<string, { nome: string }>).map(([key, r]) => (
                  <option key={key} value={key}>{r.nome} (personalizado)</option>
                ))}
                <option value="__novo__">＋ Criar novo cargo…</option>
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
