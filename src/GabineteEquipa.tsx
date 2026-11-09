import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useGabineteColaboradores, useGabineteClientes } from './lib/useGabinete';
import { filterActive } from './lib/gabineteSelectors';
import {
  getColaboradorInitials,
  guardarColaboradorLocal,
  removerColaboradorLocal,
  upsertCliente,
  type Colaborador,
  type ColaboradorRole,
} from './lib/gabinete';
import {
  atualizarCargoColaborador,
  enfileirarRevogacao,
  removeFromGabinete,
  getActiveGabineteId,
  getGabineteMeta,
  guardarCargos,
  type CargosCustom,
  type GabineteMeta,
  type GabineteRole,
} from './lib/gabinetes';
import { can, PERMISSION_LABELS, setCustomRolesCache, type PermissionAction } from './lib/permissions';
import {
  atualizarAcessoEquipa,
  criarAcessoEquipa,
  EquipaAcessoError,
  removerAcessoEquipa,
  reporPasswordEquipa,
} from './lib/equipaAcesso';
import { deleteColaborador } from './lib/gabinete';

const ROLE_BASE_LABEL: Record<string, string> = {
  admin: 'Admin',
  contabilista: 'Contabilista',
  estagiaria: 'Estagiária',
};

const TODAS_PERMISSOES = Object.keys(PERMISSION_LABELS) as PermissionAction[];

function labelDoCargo(role: string, meta?: GabineteMeta | null): string {
  if (role.startsWith('custom:')) {
    return meta?.customRoles?.[role]?.nome || meta?.customRoles?.[role.slice(7)]?.nome || 'Cargo personalizado';
  }
  return ROLE_BASE_LABEL[role] || role || 'Colaborador';
}

function styleDoCargo(role: string): string {
  if (role === 'admin') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (role === 'contabilista') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (role === 'estagiaria') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-violet-50 text-violet-700 border-violet-200';
}

function passwordCumpreRegras(password: string): boolean {
  return password.length >= 8
    && password.length <= 128
    && /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(password)
    && /\d/.test(password)
    && !/^\s|\s$/.test(password);
}

function mensagemErro(error: unknown): string {
  if (error instanceof EquipaAcessoError) return error.message;
  return 'Não foi possível concluir a operação. Tente novamente.';
}

type CredenciaisVisiveis = {
  titulo: string;
  nome: string;
  email: string;
  password: string;
  role: string;
};

export default function GabineteEquipa({ role }: { role: GabineteRole }) {
  const colaboradores = useGabineteColaboradores();
  const clientesAll = useGabineteClientes();
  const clientes = useMemo(() => filterActive(clientesAll), [clientesAll]);
  const podeGerirEquipa = can(role, 'gerir-equipa');
  const podeGerirAcessos = can(role, 'gerir-acessos');

  const [q, setQ] = useState('');
  const [filtroRole, setFiltroRole] = useState<'todos' | ColaboradorRole>('todos');
  const [gabMeta, setGabMeta] = useState<GabineteMeta | null>(null);
  const [aviso, setAviso] = useState('');
  const [erroGlobal, setErroGlobal] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Colaborador | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formConfirm, setFormConfirm] = useState('');
  const [formRole, setFormRole] = useState<ColaboradorRole>('contabilista');
  const [formErro, setFormErro] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [credenciais, setCredenciais] = useState<CredenciaisVisiveis | null>(null);
  const [copiado, setCopiado] = useState('');

  const [resetTarget, setResetTarget] = useState<Colaborador | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetErro, setResetErro] = useState('');
  const [resetSaving, setResetSaving] = useState(false);
  const [resetMostrar, setResetMostrar] = useState(false);

  const [removerTarget, setRemoverTarget] = useState<Colaborador | null>(null);
  const [removendo, setRemovendo] = useState(false);

  const [showCargos, setShowCargos] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleNome, setRoleNome] = useState('');
  const [rolePerms, setRolePerms] = useState<PermissionAction[]>([]);
  const [roleErro, setRoleErro] = useState('');
  const [roleSaving, setRoleSaving] = useState(false);

  // Escape fecha o diálogo mais acima. Sem isto, quem usa teclado ficava preso.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (formOpen && !formSaving) { setFormOpen(false); return; }
      if (resetTarget && !resetSaving) { setResetTarget(null); return; }
      if (removerTarget && !removendo) { setRemoverTarget(null); return; }
      if (showRoleModal && !roleSaving) { setShowRoleModal(false); return; }
      if (showCargos) setShowCargos(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [formOpen, formSaving, resetTarget, resetSaving, removerTarget, removendo, showRoleModal, roleSaving, showCargos]);

  const recarregarMeta = useCallback(async () => {
    const gabId = getActiveGabineteId();
    if (!gabId) {
      setGabMeta(null);
      return;
    }
    const meta = await getGabineteMeta(gabId, { force: true }).catch(() => null);
    setGabMeta(meta);
  }, []);

  useEffect(() => {
    void recarregarMeta();
  }, [recarregarMeta]);

  const copiar = async (texto: string, chave: string) => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
        ok = true;
      }
    } catch {
      // usa o fallback abaixo
    }
    if (!ok) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = texto;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '-1000px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        ok = document.execCommand('copy');
        textarea.remove();
      } catch {
        ok = false;
      }
    }
    setCopiado(ok ? chave : '');
    if (!ok) setAviso('Selecione o texto e copie manualmente.');
    window.setTimeout(() => setCopiado(''), 2200);
  };

  const filtered = useMemo(() => {
    const termo = q.trim().toLowerCase();
    return colaboradores.filter((colaborador) => {
      if (filtroRole !== 'todos' && colaborador.role !== filtroRole) return false;
      if (!termo) return true;
      return `${colaborador.nome} ${colaborador.email} ${labelDoCargo(colaborador.role, gabMeta)}`
        .toLowerCase()
        .includes(termo);
    });
  }, [colaboradores, filtroRole, gabMeta, q]);

  const abrirNovo = () => {
    setEditing(null);
    setFormNome('');
    setFormEmail('');
    setFormPassword('');
    setFormConfirm('');
    setFormRole('contabilista');
    setFormErro('');
    setMostrarPassword(false);
    setFormOpen(true);
  };

  const abrirEdicao = (colaborador: Colaborador) => {
    setEditing(colaborador);
    setFormNome(colaborador.nome);
    setFormEmail(colaborador.email);
    setFormPassword('');
    setFormConfirm('');
    setFormRole(colaborador.role);
    setFormErro('');
    setMostrarPassword(false);
    setFormOpen(true);
  };

  const guardarFormulario = async () => {
    if (!podeGerirAcessos || formSaving) return;
    setFormErro('');
    const nome = formNome.trim();
    const email = formEmail.trim().toLowerCase();
    if (nome.length < 2) {
      setFormErro('Indique o nome completo do colaborador.');
      return;
    }
    if (!editing && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setFormErro('Indique um email válido.');
      return;
    }
    if (!editing) {
      if (!passwordCumpreRegras(formPassword)) {
        setFormErro('A password deve ter pelo menos 8 caracteres, incluir uma letra e um número.');
        return;
      }
      if (formPassword !== formConfirm) {
        setFormErro('As duas passwords não coincidem.');
        return;
      }
    }
    const gabineteId = getActiveGabineteId();
    if (!gabineteId) {
      setFormErro('Não há um gabinete ativo.');
      return;
    }

    setFormSaving(true);
    try {
      if (editing) {
        const credentialId = editing.credentialId || editing.id;
        if (/^cred_[a-f0-9]{24}$/.test(credentialId)) {
          const resposta = await atualizarAcessoEquipa({
            credentialId,
            nome,
            role: formRole,
          });
          guardarColaboradorLocal(resposta.colaborador);
        } else {
          await atualizarCargoColaborador(gabineteId, editing.email, formRole, editing.linkedUid);
          guardarColaboradorLocal({
            ...editing,
            nome,
            role: formRole,
            initials: getColaboradorInitials(nome),
            updatedAt: Date.now(),
          });
        }
        setAviso(`${nome} atualizado.`);
      } else {
        const resposta = await criarAcessoEquipa({
          gabineteId,
          nome,
          email,
          password: formPassword,
          role: formRole,
        });
        guardarColaboradorLocal(resposta.colaborador);
        setCredenciais({
          titulo: 'Acesso criado',
          nome,
          email: resposta.loginEmail,
          password: formPassword,
          role: formRole,
        });
        setAviso(`${nome} já pode entrar com o email e a password criados.`);
      }
      setFormOpen(false);
      setEditing(null);
      await recarregarMeta();
    } catch (error) {
      setFormErro(mensagemErro(error));
    } finally {
      setFormSaving(false);
    }
  };

  const abrirReset = (colaborador: Colaborador) => {
    setResetTarget(colaborador);
    setResetPassword('');
    setResetConfirm('');
    setResetErro('');
    setResetMostrar(false);
  };

  const confirmarReset = async () => {
    if (!resetTarget || resetSaving || !podeGerirAcessos) return;
    setResetErro('');
    if (!passwordCumpreRegras(resetPassword)) {
      setResetErro('A password deve ter pelo menos 8 caracteres, incluir uma letra e um número.');
      return;
    }
    if (resetPassword !== resetConfirm) {
      setResetErro('As duas passwords não coincidem.');
      return;
    }
    setResetSaving(true);
    try {
      const resposta = await reporPasswordEquipa({
        credentialId: resetTarget.credentialId || resetTarget.id,
        password: resetPassword,
      });
      setCredenciais({
        titulo: 'Password reposta',
        nome: resetTarget.nome,
        email: resposta.loginEmail,
        password: resetPassword,
        role: resetTarget.role,
      });
      setResetTarget(null);
      setAviso(`Password de ${resetTarget.nome} alterada.`);
    } catch (error) {
      setResetErro(mensagemErro(error));
    } finally {
      setResetSaving(false);
    }
  };

  const confirmarRemocao = async () => {
    if (!removerTarget || removendo || !podeGerirAcessos) return;
    setRemovendo(true);
    setErroGlobal('');
    try {
      const id = removerTarget.credentialId || removerTarget.id;
      if (/^cred_[a-f0-9]{24}$/.test(id)) {
        await removerAcessoEquipa(id);
      } else {
        const gabineteId = getActiveGabineteId();
        if (!gabineteId) throw new Error('gabinete');
        await removeFromGabinete(gabineteId, removerTarget.email, removerTarget.linkedUid || removerTarget.id);
        await deleteColaborador(id);
      }
      removerColaboradorLocal(id);
      setAviso(`${removerTarget.nome} deixou de ter acesso a este gabinete.`);
      setRemoverTarget(null);
      await recarregarMeta();
    } catch (error) {
      // Se a remoção não chegou ao servidor, fica na fila: caso contrário a
      // pessoa continuaria com acesso e ninguém voltaria a tentar.
      const gabineteId = getActiveGabineteId();
      if (gabineteId && removerTarget) {
        enfileirarRevogacao(gabineteId, removerTarget.email, removerTarget.linkedUid || undefined);
      }
      setErroGlobal(`${mensagemErro(error)} A revogação ficou em fila e será repetida automaticamente.`);
    } finally {
      setRemovendo(false);
    }
  };

  const salvarCargo = async () => {
    if (!podeGerirEquipa || roleSaving) return;
    setRoleErro('');
    const nome = roleNome.trim();
    if (!nome) {
      setRoleErro('Dê um nome ao cargo.');
      return;
    }
    if (rolePerms.length === 0) {
      setRoleErro('Escolha pelo menos uma permissão.');
      return;
    }
    const gabineteId = getActiveGabineteId();
    if (!gabineteId) {
      setRoleErro('Não há um gabinete ativo.');
      return;
    }
    const roleId = editingRoleId || `custom:${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const base = (gabMeta?.customRoles || {}) as CargosCustom;
    const customRoles: CargosCustom = {
      ...base,
      [roleId]: {
        ...(base[roleId] || {}),
        nome,
        permissoes: rolePerms,
        createdAt: base[roleId]?.createdAt || Date.now(),
        createdBy: 'owner',
      },
    };
    setRoleSaving(true);
    setCustomRolesCache(customRoles as never);
    setGabMeta((meta) => meta ? { ...meta, customRoles } : ({ customRoles } as GabineteMeta));
    try {
      const ok = await guardarCargos(gabineteId, customRoles);
      if (!ok) throw new Error('sync');
      setAviso(editingRoleId ? `Cargo «${nome}» atualizado.` : `Cargo «${nome}» criado.`);
      setShowRoleModal(false);
      setShowCargos(false);
      setEditingRoleId(null);
      setRoleNome('');
      setRolePerms([]);
      await recarregarMeta();
    } catch {
      setRoleErro('O cargo ficou guardado neste dispositivo e será sincronizado automaticamente.');
    } finally {
      setRoleSaving(false);
    }
  };

  const apagarCargo = async (roleId: string) => {
    if (!podeGerirEquipa) return;
    const emUso = colaboradores.filter((colaborador) => colaborador.role === roleId).length;
    if (emUso > 0) {
      setAviso(`Este cargo está atribuído a ${emUso} colaborador(es). Mude o cargo antes de apagar.`);
      return;
    }
    if (!window.confirm('Apagar este cargo personalizado?')) return;
    const gabineteId = getActiveGabineteId();
    if (!gabineteId) return;
    const customRoles = { ...(gabMeta?.customRoles || {}) } as CargosCustom;
    delete customRoles[roleId];
    setCustomRolesCache(customRoles as never);
    setGabMeta((meta) => meta ? { ...meta, customRoles } : meta);
    const ok = await guardarCargos(gabineteId, customRoles);
    setAviso(ok ? 'Cargo apagado.' : 'Cargo apagado neste dispositivo; a sincronização será repetida.');
  };

  const emailTechnical = (colaborador: Colaborador) => colaborador.email;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-[800] text-[#0B1D2D]">
              <Users className="h-4 w-4 text-[var(--accent-strong)]" /> Equipa do gabinete
            </h2>
            <p className="mt-1 max-w-[720px] text-[12.5px] leading-5 text-[#64748B]">
              O dono ou um administrador cria o email e a password. Não é enviado nenhum email e a pessoa entra diretamente neste gabinete.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {podeGerirEquipa && (
              <button onClick={() => setShowCargos(true)} className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm font-[600] text-[#334155] hover:bg-[#F8FAFC]">
                Gerir cargos
              </button>
            )}
            {podeGerirAcessos && (
              <button onClick={abrirNovo} className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F172A] px-4 py-2 text-sm font-[600] text-white">
                <UserPlus className="h-4 w-4" /> Criar acesso
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Pesquisar nome, email ou cargo…"
              className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-3 text-sm"
            />
          </div>
          <select value={filtroRole} onChange={(event) => setFiltroRole(event.target.value as never)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm">
            <option value="todos">Todos os cargos</option>
            <option value="admin">Admin</option>
            <option value="contabilista">Contabilista</option>
            <option value="estagiaria">Estagiária</option>
            {Object.entries((gabMeta?.customRoles || {}) as Record<string, { nome: string }>).map(([key, cargo]) => (
              <option key={key} value={key}>{cargo.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {erroGlobal && (
        <div role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12.5px] font-[600] text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {erroGlobal}
          <button onClick={() => setErroGlobal('')} className="ml-auto text-rose-400 hover:text-rose-700"><X className="h-4 w-4" /></button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 text-center">
          <Users className="mx-auto mb-2 h-8 w-8 text-zinc-300" />
          <p className="text-sm text-zinc-500">
            {q || filtroRole !== 'todos' ? 'Nenhum colaborador corresponde à pesquisa.' : 'Ainda sem colaboradores neste gabinete.'}
          </p>
          {!q && filtroRole === 'todos' && podeGerirAcessos && (
            <button onClick={abrirNovo} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-[600] text-white">
              <Plus className="h-4 w-4" /> Criar o primeiro acesso
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-[#F8FAFC] text-xs text-[#64748B]">
                <tr>
                  <th className="px-4 py-3 text-left font-[600]">Colaborador</th>
                  <th className="px-4 py-3 text-left font-[600]">Email</th>
                  <th className="px-4 py-3 text-left font-[600]">Cargo</th>
                  <th className="px-4 py-3 text-left font-[600]">Estado</th>
                  <th className="px-4 py-3 text-right font-[600]">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {filtered.map((colaborador) => {
                  const active = (colaborador.accessStatus || 'active') === 'active';
                  const temCredencial = /^cred_[a-f0-9]{24}$/.test(colaborador.credentialId || colaborador.id);
                  return (
                    <tr key={colaborador.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-[700] text-white"
                            style={{ background: colaborador.cor || (colaborador.role === 'admin' ? '#0F172A' : colaborador.role === 'contabilista' ? 'var(--accent-strong)' : '#D97706') }}
                          >
                            {colaborador.initials || getColaboradorInitials(colaborador.nome)}
                          </span>
                          <span className="font-[600] text-[#0F172A]">{colaborador.nome}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#475569]">{emailTechnical(colaborador)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-[600] ${styleDoCargo(colaborador.role)}`}>
                          {labelDoCargo(colaborador.role, gabMeta)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {active ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-[600] text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-[600] text-amber-800">
                            <Clock className="h-3.5 w-3.5" /> A preparar
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {podeGerirAcessos && temCredencial && (
                            <button onClick={() => abrirReset(colaborador)} className="rounded-lg p-1.5 text-[var(--accent-strong)] hover:bg-blue-50" title="Repor password">
                              <KeyRound className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {podeGerirAcessos && (
                            <button onClick={() => abrirEdicao(colaborador)} className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100" title="Editar nome ou cargo">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {podeGerirAcessos && (
                            <button onClick={() => setRemoverTarget(colaborador)} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50" title="Remover acesso">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <h3 className="flex items-center gap-2 text-[13px] font-[700] text-[#0B1D2D]">
          <Shield className="h-4 w-4 text-[var(--accent-strong)]" /> Associações por cliente
        </h3>
        <p className="mt-1 text-[12px] text-[#64748B]">Define responsável, apoio e supervisor de cada cliente. Estes nomes aparecem na Visão geral.</p>
        <div className="mt-3 space-y-2">
          {clientes.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed p-4 text-center text-[12px] text-[#94A3B8]">Sem clientes para associar.</div>
          ) : clientes.map((cliente) => (
            <div key={cliente.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[#F1F5F9] bg-[#F8FAFC] p-2">
              <span className="w-[160px] truncate text-[12.5px] font-[600] text-[#0F172A]">{cliente.nome}</span>
              {[
                { key: 'responsavelId' as const, label: 'Responsável', value: cliente.responsavelId },
                { key: 'apoioId' as const, label: 'Apoio', value: cliente.apoioId },
                { key: 'supervisorId' as const, label: 'Supervisor', value: cliente.supervisorId },
              ].map((field) => (
                <select
                  key={field.key}
                  value={field.value || ''}
                  onChange={async (event) => {
                    const id = event.target.value || undefined;
                    const colaborador = colaboradores.find((item) => item.id === id);
                    const patch: Record<string, unknown> = { [field.key]: id, updatedAt: Date.now() };
                    if (field.key === 'responsavelId') patch.responsavelInterno = colaborador ? { nome: colaborador.nome, initials: colaborador.initials || getColaboradorInitials(colaborador.nome) } : undefined;
                    if (field.key === 'apoioId') patch.apoioAdministrativo = colaborador ? { nome: colaborador.nome, initials: colaborador.initials || getColaboradorInitials(colaborador.nome) } : undefined;
                    if (field.key === 'supervisorId') patch.supervisor = colaborador ? { nome: colaborador.nome, initials: colaborador.initials || getColaboradorInitials(colaborador.nome) } : undefined;
                    await upsertCliente({ ...cliente, ...patch } as typeof cliente);
                  }}
                  className="min-w-[130px] flex-1 rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-[12px]"
                >
                  <option value="">{field.label} — nenhum</option>
                  {colaboradores.map((colaborador) => (
                    <option key={colaborador.id} value={colaborador.id}>
                      {colaborador.nome} ({labelDoCargo(colaborador.role, gabMeta)})
                    </option>
                  ))}
                </select>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-[12px] leading-[18px] text-blue-900">
        <strong>Como funciona:</strong> o administrador define o email e uma password. O colaborador entra com essas credenciais e fica ligado apenas a este gabinete. Se já usar esse email numa conta normal, a conta existente também passa a ver este gabinete. A remoção corta o acesso imediatamente.
      </div>

      {aviso && (
        <div role="status" className="fixed bottom-4 left-1/2 z-[70] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl bg-[#0F172A] px-4 py-2.5 text-[12.5px] font-[600] text-white shadow-xl">
          {aviso}
          <button onClick={() => setAviso('')} className="ml-3 text-white/60 hover:text-white">×</button>
        </div>
      )}

      {formOpen && (
        <div role="dialog" aria-modal="true" aria-label="Adicionar colaborador" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => !formSaving && setFormOpen(false)}>
          <div className="max-h-[94vh] w-full max-w-[500px] overflow-y-auto rounded-2xl border bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-[700] text-[#0F172A]">{editing ? 'Editar colaborador' : 'Criar acesso de colaborador'}</h3>
              <button onClick={() => setFormOpen(false)} disabled={formSaving} className="rounded-lg p-1 hover:bg-zinc-100"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-1 text-[12px] leading-5 text-[#64748B]">
              {editing ? 'Pode alterar o nome e o cargo. O email identifica este login e não é alterado aqui.' : 'Não será enviado qualquer email. Guarde e entregue estas credenciais ao colaborador.'}
            </p>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-[10.5px] font-[700] uppercase tracking-[0.8px] text-[#64748B]">Nome completo</span>
                <input value={formNome} onChange={(event) => setFormNome(event.target.value)} autoFocus className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm" />
              </label>
              <label className="block">
                <span className="text-[10.5px] font-[700] uppercase tracking-[0.8px] text-[#64748B]">Email de entrada</span>
                <input value={formEmail} onChange={(event) => setFormEmail(event.target.value)} type="email" disabled={!!editing} className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm disabled:bg-zinc-100 disabled:text-zinc-500" />
              </label>
              <label className="block">
                <span className="text-[10.5px] font-[700] uppercase tracking-[0.8px] text-[#64748B]">Cargo</span>
                <select value={formRole} onChange={(event) => setFormRole(event.target.value as ColaboradorRole)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm">
                  <option value="admin">Admin — gere todo o gabinete</option>
                  <option value="contabilista">Contabilista</option>
                  <option value="estagiaria">Estagiária</option>
                  {Object.entries((gabMeta?.customRoles || {}) as Record<string, { nome: string }>).map(([id, cargo]) => (
                    <option key={id} value={id}>{cargo.nome} (personalizado)</option>
                  ))}
                </select>
              </label>
              {!editing && (
                <>
                  <label className="block">
                    <span className="text-[10.5px] font-[700] uppercase tracking-[0.8px] text-[#64748B]">Password inicial</span>
                    <div className="relative mt-1">
                      <input
                        type={mostrarPassword ? 'text' : 'password'}
                        value={formPassword}
                        onChange={(event) => setFormPassword(event.target.value)}
                        autoComplete="new-password"
                        className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 pr-10 text-sm"
                      />
                      <button type="button" onClick={() => setMostrarPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400" aria-label={mostrarPassword ? 'Ocultar password' : 'Mostrar password'}>
                        {mostrarPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-[10.5px] font-[700] uppercase tracking-[0.8px] text-[#64748B]">Repetir password</span>
                    <input
                      type={mostrarPassword ? 'text' : 'password'}
                      value={formConfirm}
                      onChange={(event) => setFormConfirm(event.target.value)}
                      autoComplete="new-password"
                      className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
                    />
                  </label>
                  <p className="text-[11px] leading-5 text-[#94A3B8]">Mínimo 8 caracteres, com pelo menos uma letra e um número.</p>
                </>
              )}
              {formErro && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-[600] text-rose-700">{formErro}</div>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setFormOpen(false)} disabled={formSaving} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm">Cancelar</button>
              <button onClick={() => void guardarFormulario()} disabled={formSaving} className="inline-flex items-center gap-2 rounded-xl bg-[#0F172A] px-4 py-2 text-sm font-[600] text-white disabled:opacity-60">
                {formSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? 'Guardar alterações' : 'Criar acesso'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resetTarget && (
        <div role="dialog" aria-modal="true" aria-label="Repor password" className="fixed inset-0 z-[61] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => !resetSaving && setResetTarget(null)}>
          <div className="w-full max-w-[450px] rounded-2xl border bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-[700] text-[#0F172A]">Repor password</h3>
              <button onClick={() => setResetTarget(null)} disabled={resetSaving} className="rounded-lg p-1 hover:bg-zinc-100"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-1 text-[12px] leading-5 text-[#64748B]">{resetTarget.nome} · {resetTarget.email}</p>
            <div className="mt-4 space-y-3">
              <div className="relative">
                <input
                  type={resetMostrar ? 'text' : 'password'}
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  placeholder="Nova password"
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 pr-10 text-sm"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setResetMostrar((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400" aria-label={resetMostrar ? 'Ocultar password' : 'Mostrar password'}>
                  {resetMostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <input
                type={resetMostrar ? 'text' : 'password'}
                value={resetConfirm}
                onChange={(event) => setResetConfirm(event.target.value)}
                placeholder="Repetir nova password"
                className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm"
                autoComplete="new-password"
              />
              {resetErro && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-[600] text-rose-700">{resetErro}</div>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setResetTarget(null)} disabled={resetSaving} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm">Cancelar</button>
              <button onClick={() => void confirmarReset()} disabled={resetSaving} className="inline-flex items-center gap-2 rounded-xl bg-[#0F172A] px-4 py-2 text-sm font-[600] text-white disabled:opacity-60">
                {resetSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Repor password
              </button>
            </div>
          </div>
        </div>
      )}

      {removerTarget && (
        <div role="dialog" aria-modal="true" aria-label="Remover acesso" className="fixed inset-0 z-[62] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => !removendo && setRemoverTarget(null)}>
          <div className="w-full max-w-[430px] rounded-2xl border bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-[17px] font-[700] text-[#0F172A]">Remover acesso</h3>
            <p className="mt-2 text-[13px] leading-6 text-[#475569]">
              <b>{removerTarget.nome}</b> deixa de conseguir consultar ou alterar este gabinete. O login pode continuar a existir, mas apresenta um aviso de acesso removido.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setRemoverTarget(null)} disabled={removendo} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm">Cancelar</button>
              <button onClick={() => void confirmarRemocao()} disabled={removendo} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-[600] text-white disabled:opacity-60">
                {removendo && <Loader2 className="h-4 w-4 animate-spin" />}
                Remover acesso
              </button>
            </div>
          </div>
        </div>
      )}

      {credenciais && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-label={credenciais.titulo} className="w-full max-w-[500px] rounded-2xl border bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[18px] font-[700] text-[#0F172A]">{credenciais.titulo}</h3>
                <p className="mt-1 text-[12px] leading-5 text-[#64748B]">Estas credenciais não ficam guardadas na aplicação. Entregue-as agora ao colaborador.</p>
              </div>
              <button onClick={() => setCredenciais(null)} className="rounded-lg p-1 hover:bg-zinc-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 space-y-2">
              {[
                { label: 'Nome', value: credenciais.nome },
                { label: 'Email', value: credenciais.email },
                { label: 'Password', value: credenciais.password },
                { label: 'Cargo', value: labelDoCargo(credenciais.role, gabMeta) },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
                  <span className="w-20 shrink-0 text-[10.5px] font-[700] uppercase tracking-[0.7px] text-[#64748B]">{item.label}</span>
                  <span className="min-w-0 flex-1 break-all font-mono text-[12.5px] font-[600] text-[#0F172A]">{item.value}</span>
                  <button onClick={() => void copiar(item.value, item.label)} className="rounded-lg p-1.5 text-[var(--accent-strong)] hover:bg-blue-50" title={`Copiar ${item.label}`}>
                    {copiado === item.label ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={() => void copiar(`Email: ${credenciais.email}\nPassword: ${credenciais.password}\nEntrar em: https://estudo360.pt`, 'tudo')}
                className="rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm font-[600]"
              >
                {copiado === 'tudo' ? 'Credenciais copiadas' : 'Copiar credenciais'}
              </button>
              <button onClick={() => setCredenciais(null)} className="rounded-xl bg-[#0F172A] px-4 py-2.5 text-sm font-[600] text-white">Concluir</button>
            </div>
          </div>
        </div>
      )}

      {showCargos && podeGerirEquipa && (
        <div role="dialog" aria-modal="true" aria-label="Gerir cargos" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setShowCargos(false)}>
          <div className="max-h-[88vh] w-full max-w-[570px] overflow-y-auto rounded-2xl border bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-[700] text-[#0F172A]">Gerir cargos</h3>
              <button onClick={() => setShowCargos(false)} className="rounded-lg p-1 hover:bg-zinc-100"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-1 text-[12.5px] text-[#64748B]">Crie, edite ou apague cargos personalizados deste gabinete.</p>
            <div className="mt-4 space-y-2">
              {Object.entries((gabMeta?.customRoles || {}) as CargosCustom).length === 0 && (
                <p className="rounded-xl border border-dashed px-4 py-6 text-center text-[13px] text-[#94A3B8]">Ainda sem cargos personalizados.</p>
              )}
              {Object.entries((gabMeta?.customRoles || {}) as CargosCustom).map(([id, cargo]) => {
                const usados = colaboradores.filter((colaborador) => colaborador.role === id).length;
                return (
                  <div key={id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-[600] text-[#0F172A]">{cargo.nome}</div>
                      <div className="text-[11.5px] text-[#64748B]">{cargo.permissoes.length} permissões · {usados} colaborador(es)</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingRoleId(id);
                          setRoleNome(cargo.nome);
                          setRolePerms(cargo.permissoes as PermissionAction[]);
                          setRoleErro('');
                          setShowCargos(false);
                          setShowRoleModal(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-2 py-1 text-[11.5px] font-[600] text-[var(--accent-strong)] hover:bg-[#EFF6FF]"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </button>
                      <button onClick={() => void apagarCargo(id)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 text-[11.5px] font-[600] text-rose-600 hover:bg-rose-50">
                        <Trash2 className="h-3.5 w-3.5" /> Apagar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setEditingRoleId(null);
                  setRoleNome('');
                  setRolePerms([]);
                  setRoleErro('');
                  setShowCargos(false);
                  setShowRoleModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F172A] px-4 py-2 text-sm font-[600] text-white"
              >
                <Plus className="h-4 w-4" /> Novo cargo
              </button>
            </div>
          </div>
        </div>
      )}

      {showRoleModal && podeGerirEquipa && (
        <div role="dialog" aria-modal="true" aria-label="Criar cargo" className="fixed inset-0 z-[61] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => !roleSaving && setShowRoleModal(false)}>
          <div className="max-h-[90vh] w-full max-w-[540px] overflow-y-auto rounded-2xl border bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-[700] text-[#0F172A]">{editingRoleId ? 'Editar cargo' : 'Criar novo cargo'}</h3>
              <button onClick={() => setShowRoleModal(false)} disabled={roleSaving} className="rounded-lg p-1 hover:bg-zinc-100"><X className="h-4 w-4" /></button>
            </div>
            <label className="mt-4 block text-[10.5px] font-[700] uppercase tracking-[0.8px] text-[#64748B]">Nome do cargo</label>
            <input value={roleNome} onChange={(event) => setRoleNome(event.target.value)} placeholder="Ex.: Gestor de clientes" className="mt-1 w-full rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-sm" />
            <label className="mt-4 block text-[10.5px] font-[700] uppercase tracking-[0.8px] text-[#64748B]">Permissões</label>
            <div className="mt-1 space-y-1.5">
              {TODAS_PERMISSOES.map((permission) => (
                <label key={permission} className="flex items-start gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12.5px] text-[#334155] hover:bg-[#F8FAFC]">
                  <input
                    type="checkbox"
                    checked={rolePerms.includes(permission)}
                    onChange={() => setRolePerms((previous) => previous.includes(permission) ? previous.filter((item) => item !== permission) : [...previous, permission])}
                    className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                  />
                  {PERMISSION_LABELS[permission]}
                </label>
              ))}
            </div>
            {roleErro && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{roleErro}</div>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowRoleModal(false)} disabled={roleSaving} className="rounded-xl border border-[#E2E8F0] px-4 py-2 text-sm">Cancelar</button>
              <button onClick={() => void salvarCargo()} disabled={roleSaving} className="inline-flex items-center gap-2 rounded-xl bg-[#0F172A] px-4 py-2 text-sm font-[600] text-white disabled:opacity-60">
                {roleSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingRoleId ? 'Guardar cargo' : 'Criar cargo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
