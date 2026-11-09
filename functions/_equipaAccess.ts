import { verifyFirebaseRequest } from './_auth';
import {
  commitFirestoreFields,
  createAuthUser,
  createEmployeeCustomToken,
  deleteFirestoreDoc,
  firestoreList,
  getFirestoreDoc,
  hashEmail,
  lookupAuthByEmail,
  lookupAuthByUid,
  patchFirestoreDoc,
  signInAuthPassword,
  updateAuthUser,
  writeAccessAudit,
} from './_firebaseAdmin';

type Env = Record<string, unknown>;

export const ALLOWED_ORIGINS = [
  'https://estudo360.pt',
  'https://www.estudo360.pt',
  'https://estudo360.pages.dev',
  'http://localhost:3000',
  'http://localhost:3100',
  'http://localhost:3200',
  'http://localhost:3300',
  'http://localhost:3400',
  'http://127.0.0.1:3000',
];

export function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'https://estudo360.pt',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function origemPermitida(origin: string | null, referer: string | null): boolean {
  for (const value of [origin, referer]) {
    if (!value) continue;
    try {
      const candidateOrigin = new URL(value).origin;
      if (ALLOWED_ORIGINS.some((allowed) => new URL(allowed).origin === candidateOrigin)) return true;
    } catch {
      // ignora cabeçalhos malformados
    }
  }
  return false;
}

export function jsonResponse(body: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  });
}

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export function emailValido(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/**
 * Identificador de entrada de um colaborador.
 *
 * O dono cria o login; não é preciso existir email. Aceita:
 *  - um utilizador simples: `ana`, `ana.silva`, `recepcao-2` (3 a 40 chars);
 *  - ou um email, para os acessos que já foram criados assim.
 */
export function identificadorValido(valor: string): boolean {
  const v = String(valor || '').trim().toLowerCase();
  if (!v || v.length > 254) return false;
  if (emailValido(v)) return true;
  return /^[a-z0-9][a-z0-9._-]{2,39}$/.test(v);
}

export function passwordValida(password: string): boolean {
  return password.length >= 8
    && password.length <= 128
    && /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(password)
    && /\d/.test(password)
    && !/^\s|\s$/.test(password);
}

function validarNome(value: unknown): string {
  const nome = String(value || '').trim().replace(/\s+/g, ' ');
  if (nome.length < 2 || nome.length > 120) throw new AccessError('nome_invalido', 400);
  return nome;
}

function validarGabineteId(value: unknown): string {
  const id = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new AccessError('gabinete_invalido', 400);
  return id;
}

function validarCredentialId(value: unknown): string {
  const id = String(value || '').trim();
  if (!/^cred_[a-f0-9]{24}$/.test(id)) throw new AccessError('credencial_invalida', 400);
  return id;
}

function validarPassword(value: unknown): string {
  const password = String(value || '');
  if (!passwordValida(password)) throw new AccessError('password_fraca', 400);
  return password;
}

export class AccessError extends Error {
  constructor(public readonly codigo: string, public readonly status = 400) {
    super(codigo);
  }
}

export interface GabineteMetaLite {
  id: string;
  nome?: string;
  ownerUid?: string;
  ownerEmail?: string;
  memberUids?: string[];
  members?: Record<string, { role?: string; email?: string; addedAt?: number }>;
  customRoles?: Record<string, { nome?: string; permissoes?: string[] }>;
  inviteEmails?: string[];
  invites?: unknown[];
  inviteRoles?: Record<string, unknown>;
  inviteExpiries?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface EmployeeCredential {
  credentialId: string;
  gabineteId: string;
  uid: string;
  nome: string;
  email: string;
  emailHash: string;
  role: string;
  status: 'preparing' | 'active' | 'revoked' | 'error';
  creationNonce?: string;
  normalUid?: string;
  normalMembershipAddedByCredential?: boolean;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  passwordUpdatedAt?: number;
  revokedAt?: number;
  revokedBy?: string;
  [key: string]: unknown;
}

interface EmployeeLoginIndex {
  email: string;
  credentialIds: string[];
  updatedAt: number;
  [key: string]: unknown;
}

interface EmployeeProfile {
  credentialId: string;
  gabineteId: string;
  nome: string;
  email: string;
  role: string;
  status: 'active' | 'revoked' | 'error';
  createdAt: number;
  updatedAt: number;
  [key: string]: unknown;
}

export interface AuthContext {
  uid: string;
  email: string;
  claims: Record<string, unknown>;
}

export function parseCustomClaims(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export async function authContext(
  request: Request,
  env: Env,
  fetchImpl: typeof fetch = fetch,
): Promise<AuthContext | null> {
  const verified = await verifyFirebaseRequest(request, env, fetchImpl);
  if (!verified) return null;
  const user = await lookupAuthByUid(env, verified.uid, fetchImpl).catch(() => null);
  if (!user) return null;
  return {
    uid: user.uid,
    email: normalizeEmail(user.email || verified.email),
    claims: parseCustomClaims(user.customAttributes),
  };
}

export async function loadGabinete(
  env: Env,
  gabineteId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GabineteMetaLite> {
  const stored = await getFirestoreDoc<GabineteMetaLite>(env, `gabinetes/${gabineteId}`, fetchImpl);
  if (!stored) throw new AccessError('gabinete_nao_encontrado', 404);
  return { ...stored.data, id: gabineteId };
}

function roleDoMembro(meta: GabineteMetaLite, uid: string): string {
  if (uid === meta.ownerUid || uid === meta.id) return 'admin';
  return String(meta.members?.[uid]?.role || '');
}

const PERMISSOES_BASE: Record<string, string[]> = {
  admin: [
    'editar-operacional', 'editar-clientes', 'gerir-obrigacoes',
    'ver-cofre', 'editar-cofre', 'apagar', 'restaurar', 'purgar',
    'gerir-equipa', 'gerir-acessos', 'gerir-gabinete',
  ],
  contabilista: [
    'editar-operacional', 'editar-clientes', 'gerir-obrigacoes',
    'ver-cofre', 'editar-cofre', 'apagar', 'restaurar',
  ],
  estagiaria: ['editar-operacional'],
};

function eAdmin(meta: GabineteMetaLite, uid: string): boolean {
  return roleDoMembro(meta, uid) === 'admin';
}

function permissoesDoCargo(meta: GabineteMetaLite, role: string): string[] {
  if (PERMISSOES_BASE[role]) return PERMISSOES_BASE[role];
  if (!role.startsWith('custom:')) return [];
  return meta.customRoles?.[role]?.permissoes || meta.customRoles?.[role.slice(7)]?.permissoes || [];
}

export function podeGerirAcessos(meta: GabineteMetaLite, uid: string): boolean {
  const role = roleDoMembro(meta, uid);
  if (role === 'admin') return true;
  if (!role.startsWith('custom:')) return false;
  const permissoes = meta.customRoles?.[role]?.permissoes || meta.customRoles?.[role.slice(7)]?.permissoes || [];
  return permissoes.includes('gerir-acessos');
}

export function podeAtribuirCargo(meta: GabineteMetaLite, auth: AuthContext, role: string): boolean {
  if (eAdmin(meta, auth.uid)) return true;
  if (role === 'admin') return false;
  const ator = permissoesDoCargo(meta, roleDoMembro(meta, auth.uid));
  const alvo = permissoesDoCargo(meta, role);
  return alvo.length > 0 && alvo.every((permissao) => ator.includes(permissao));
}

function exigirGestaoDeCredencial(meta: GabineteMetaLite, auth: AuthContext, cred: EmployeeCredential): void {
  if (!podeAtribuirCargo(meta, auth, cred.role)) {
    throw new AccessError('cargo_superior_ao_seu', 403);
  }
}

export function roleValida(meta: GabineteMetaLite, role: string): boolean {
  if (['admin', 'contabilista', 'estagiaria'].includes(role)) return true;
  return role.startsWith('custom:')
    && !!(meta.customRoles?.[role] || meta.customRoles?.[role.slice(7)]);
}

function exigirGestor(meta: GabineteMetaLite, auth: AuthContext): void {
  if (!podeGerirAcessos(meta, auth.uid)) throw new AccessError('sem_permissao_acessos', 403);
}

function roleRecebida(value: unknown, meta: GabineteMetaLite): string {
  const role = String(value || '').trim();
  if (!roleValida(meta, role)) throw new AccessError('cargo_invalido', 400);
  return role;
}

async function credentialIdDeterministico(gabineteId: string, email: string): Promise<string> {
  const digest = await hashEmail(`${gabineteId}:${normalizeEmail(email)}`);
  return `cred_${digest.slice(0, 24)}`;
}

function technicalAuthEmail(credentialId: string): string {
  return `employee+${credentialId}@auth.estudo360.pt`;
}

function technicalClaims(credentialId: string, gabineteId: string): Record<string, unknown> {
  return { employeeOnly: true, credentialId, gabineteId };
}

function publicCollaborator(cred: EmployeeCredential): Record<string, unknown> {
  return {
    id: cred.credentialId,
    credentialId: cred.credentialId,
    nome: cred.nome,
    email: cred.email,
    role: cred.role,
    status: cred.status === 'active' ? 'ativo' : 'pendente',
    linkedUid: cred.normalUid || cred.uid,
    accessStatus: cred.status,
    createdAt: cred.createdAt,
    updatedAt: cred.updatedAt,
    _updatedAt: cred.updatedAt,
  };
}

interface NovoMembro {
  uid: string;
  email: string;
  role: string;
}

async function atualizarMembros(
  env: Env,
  gabineteId: string,
  adicionar: NovoMembro[] = [],
  remover: string[] = [],
): Promise<void> {
  const removerSet = new Set(remover);
  const porUid = new Map<string, NovoMembro>();
  for (const membro of adicionar) {
    if (!membro.uid || removerSet.has(membro.uid)) continue;
    porUid.set(membro.uid, membro);
  }
  const membros = Array.from(porUid.values());
  const emailNormalizado: Record<string, unknown> = {};
  const members: Record<string, unknown> = {};
  for (const membro of membros) {
    members[membro.uid] = {
      role: membro.role,
      email: normalizeEmail(membro.email),
      addedAt: Date.now(),
    };
  }
  if (membros.length) emailNormalizado.members = members;
  emailNormalizado.updatedAt = Date.now();
  await commitFirestoreFields(
    env,
    `gabinetes/${gabineteId}`,
    emailNormalizado,
    // Incluir os removidos no updateMask SEM valor apaga `members.{uid}`.
    // Sem isto, o cargo antigo sobrevivia e `deriveRole` voltava a dá-lo.
    ['updatedAt', ...membros.map((membro) => `members.${membro.uid}`), ...Array.from(removerSet).map((uid) => `members.${uid}`)],
    [{
      fieldPath: 'memberUids',
      append: membros.map((membro) => membro.uid),
      remove: Array.from(removerSet),
    }],
  );
}

async function carregarCredencial(
  env: Env,
  credentialId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<EmployeeCredential | null> {
  const stored = await getFirestoreDoc<EmployeeCredential>(
    env,
    `employeeCredentials/${credentialId}`,
    fetchImpl,
  );
  return stored ? { ...stored.data, credentialId } : null;
}

async function carregarIndice(
  env: Env,
  emailHash: string,
  fetchImpl: typeof fetch = fetch,
): Promise<EmployeeLoginIndex | null> {
  const stored = await getFirestoreDoc<EmployeeLoginIndex>(
    env,
    `employeeLoginIndexes/${emailHash}`,
    fetchImpl,
  );
  return stored ? stored.data : null;
}

async function guardarIndice(
  env: Env,
  email: string,
  credentialId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const emailHash = await hashEmail(email);
  const atual = await carregarIndice(env, emailHash, fetchImpl);
  const credentialIds = Array.from(new Set([...(atual?.credentialIds || []), credentialId]));
  await patchFirestoreDoc(env, `employeeLoginIndexes/${emailHash}`, {
    email: normalizeEmail(email),
    credentialIds,
    updatedAt: Date.now(),
  }, {}, fetchImpl);
}

async function guardarPerfil(
  env: Env,
  cred: EmployeeCredential,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const profile: EmployeeProfile = {
    credentialId: cred.credentialId,
    gabineteId: cred.gabineteId,
    nome: cred.nome,
    email: cred.email,
    role: cred.role,
    status: cred.status === 'active' ? 'active' : cred.status === 'revoked' ? 'revoked' : 'error',
    createdAt: cred.createdAt,
    updatedAt: cred.updatedAt,
  };
  await patchFirestoreDoc(env, `employeeProfiles/${cred.uid}`, profile, {}, fetchImpl);
}

async function guardarColaborador(
  env: Env,
  cred: EmployeeCredential,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await patchFirestoreDoc(
    env,
    `gabinete/${cred.gabineteId}/colaboradores/${cred.credentialId}`,
    publicCollaborator(cred),
    {},
    fetchImpl,
  );
}

async function marcarFalhaCriacao(
  env: Env,
  cred: EmployeeCredential,
  motivo: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const agora = Date.now();
  await patchFirestoreDoc(env, `employeeCredentials/${cred.credentialId}`, {
    status: 'error',
    failureReason: motivo,
    updatedAt: agora,
  }, { merge: true }, fetchImpl).catch(() => {});
  await guardarPerfil(env, { ...cred, status: 'error', updatedAt: agora }, fetchImpl).catch(() => {});
}

async function removerResiduosCriacao(
  env: Env,
  cred: EmployeeCredential,
  opcoes: { removerDaEquipa?: string[]; desativarAuth?: string[] } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const { removerDaEquipa = [], desativarAuth = [] } = opcoes;
  await Promise.allSettled([
    deleteFirestoreDoc(env, `gabinete/${cred.gabineteId}/colaboradores/${cred.credentialId}`, fetchImpl),
    deleteFirestoreDoc(env, `employeeProfiles/${cred.uid}`, fetchImpl),
    deleteFirestoreDoc(env, `employeeCredentials/${cred.credentialId}`, fetchImpl),
    // Se a falha aconteceu depois de escrever a equipa, o membro ficaria com
    // acesso real a apesar de a UI dizer que a criação falhou.
    removerDaEquipa.length
      ? atualizarMembros(env, cred.gabineteId, [], removerDaEquipa)
      : Promise.resolve(),
    ...desativarAuth.map((uid) => updateAuthUser(env, { localId: uid, disable: true, revoke: true }, fetchImpl).catch(() => {})),
  ]);
}

export async function criarCredencial(
  request: Request,
  env: Env,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const auth = await authContext(request, env);
  if (!auth) throw new AccessError('sessao_invalida', 401);
  const gabineteId = validarGabineteId(body.gabineteId);
  const meta = await loadGabinete(env, gabineteId);
  exigirGestor(meta, auth);

  const nome = validarNome(body.nome);
  const email = normalizeEmail(body.email);
  const password = validarPassword(body.password);
  const role = roleRecebida(body.role, meta);
  if (!podeAtribuirCargo(meta, auth, role)) {
    throw new AccessError('cargo_superior_ao_seu', 403);
  }
  if (!identificadorValido(email)) throw new AccessError('identificador_invalido', 400);
  if (email.endsWith('@auth.estudo360.pt')) throw new AccessError('email_reservado', 400);
  if (email === normalizeEmail(meta.ownerEmail)) throw new AccessError('email_do_dono', 409);
  if (password === email) throw new AccessError('password_fraca', 400);

  const emailHash = await hashEmail(email);
  const credentialId = await credentialIdDeterministico(gabineteId, email);
  const existente = await carregarCredencial(env, credentialId);
  if (existente?.status === 'active') throw new AccessError('email_ja_tem_acesso', 409);
  if (existente?.status === 'preparing' && Date.now() - Number(existente.updatedAt || 0) < 10 * 60_000) {
    throw new AccessError('acesso_a_ser_criado', 409);
  }
  const indice = await carregarIndice(env, emailHash);
  const credenciaisExistentes = await Promise.all(
    (indice?.credentialIds || []).slice(0, 20).map((id) => carregarCredencial(env, id)),
  );
  if (credenciaisExistentes.some((c) => c?.gabineteId === gabineteId && c.status === 'active')) {
    throw new AccessError('email_ja_tem_acesso', 409);
  }

  const normal = await lookupAuthByEmail(env, email).catch(() => null);
  if (parseCustomClaims(normal?.customAttributes).employeeOnly === true) {
    throw new AccessError('email_reservado', 409);
  }
  const normalUid = normal?.uid || existente?.normalUid;
  const normalJaEraMembro = !!normalUid && (
    normalUid === meta.ownerUid
    || normalUid === meta.id
    || !!meta.memberUids?.includes(normalUid)
  );
  const normalMembershipAddedByCredential = normalUid
    ? (typeof existente?.normalMembershipAddedByCredential === 'boolean'
        ? existente.normalMembershipAddedByCredential
        : !normalJaEraMembro)
    : false;
  const uid = `emp_${credentialId.slice(5)}`;
  const authEmail = technicalAuthEmail(credentialId);
  const claims = technicalClaims(credentialId, gabineteId);
  const agora = Date.now();
  const creationNonce = crypto.randomUUID();
  const cred: EmployeeCredential = {
    credentialId,
    gabineteId,
    uid,
    nome,
    email,
    emailHash,
    role,
    status: 'preparing',
    creationNonce,
    normalUid,
    normalMembershipAddedByCredential,
    createdAt: Number(existente?.createdAt || agora),
    createdBy: String(existente?.createdBy || auth.uid),
    updatedAt: agora,
  };

  try {
    const authExistente = await lookupAuthByUid(env, uid).catch(() => null);
    if (authExistente) {
      await updateAuthUser(env, {
        localId: uid,
        password,
        claims,
        disable: false,
        revoke: true,
      });
    } else {
      await createAuthUser(env, {
        localId: uid,
        email: authEmail,
        password,
        displayName: nome,
        claims,
      });
    }
    await patchFirestoreDoc(env, `employeeCredentials/${credentialId}`, cred, {}, undefined);

    await atualizarMembros(env, gabineteId, [
      { uid, email, role },
      ...(normalUid && !normalJaEraMembro && normalMembershipAddedByCredential
        ? [{ uid: normalUid, email, role }]
        : []),
    ]);

    const ativa: EmployeeCredential = { ...cred, status: 'active', updatedAt: Date.now() };
    await patchFirestoreDoc(env, `employeeCredentials/${credentialId}`, {
      status: 'active',
      updatedAt: ativa.updatedAt,
    }, { merge: true });
    await guardarIndice(env, email, credentialId);
    await guardarPerfil(env, ativa);
    await guardarColaborador(env, ativa);
    await writeAccessAudit(env, {
      uid: auth.uid,
      email: auth.email,
      gabineteId,
      type: 'create_employee_credential',
      detail: credentialId,
    });
    return {
      ok: true,
      colaborador: publicCollaborator(ativa),
      credencialId: credentialId,
      loginEmail: email,
      normalAccountLinked: !!normalUid,
    };
  } catch (e) {
    if (e instanceof AccessError) throw e;
    const concorrente = await carregarCredencial(env, credentialId).catch(() => null);
    if (!existente && concorrente && concorrente.status !== 'error' && concorrente.creationNonce !== creationNonce) {
      throw new AccessError('acesso_a_ser_criado', 409);
    }
    if (existente) {
      await patchFirestoreDoc(env, `employeeCredentials/${credentialId}`, {
        status: existente.status,
        updatedAt: Date.now(),
      }, { merge: true }).catch(() => {});
      await guardarPerfil(env, existente).catch(() => {});
    } else {
      await marcarFalhaCriacao(env, cred, 'falha_criacao').catch(() => {});
      await removerResiduosCriacao(env, cred, {
        removerDaEquipa: [uid, ...(normalUid && normalMembershipAddedByCredential ? [normalUid] : [])],
        desativarAuth: [uid],
      }).catch(() => {});
    }
    throw new AccessError('nao_foi_possivel_criar_acesso', 502);
  }
}

export async function atualizarCredencial(
  request: Request,
  env: Env,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const auth = await authContext(request, env);
  if (!auth) throw new AccessError('sessao_invalida', 401);
  const credentialId = validarCredentialId(body.credentialId);
  const cred = await carregarCredencial(env, credentialId);
  if (!cred) throw new AccessError('credencial_nao_encontrada', 404);
  const meta = await loadGabinete(env, cred.gabineteId);
  exigirGestor(meta, auth);
  exigirGestaoDeCredencial(meta, auth, cred);
  const nome = validarNome(body.nome);
  const role = roleRecebida(body.role, meta);
  if (!podeAtribuirCargo(meta, auth, role)) {
    throw new AccessError('cargo_superior_ao_seu', 403);
  }

  const updated: EmployeeCredential = {
    ...cred,
    nome,
    role,
    updatedAt: Date.now(),
  };
  await Promise.all([
    atualizarMembros(env, cred.gabineteId, [
      { uid: cred.uid, email: cred.email, role },
      ...(cred.normalUid && cred.normalMembershipAddedByCredential
        ? [{ uid: cred.normalUid, email: cred.email, role }]
        : []),
    ]),
    patchFirestoreDoc(env, `employeeCredentials/${credentialId}`, {
      nome,
      role,
      updatedAt: updated.updatedAt,
    }, { merge: true }),
    guardarPerfil(env, updated),
    guardarColaborador(env, updated),
    writeAccessAudit(env, {
      uid: auth.uid,
      email: auth.email,
      gabineteId: cred.gabineteId,
      type: 'update_employee_credential',
      detail: credentialId,
    }),
  ]);
  return { ok: true, colaborador: publicCollaborator(updated) };
}

export async function reporPassword(
  request: Request,
  env: Env,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const auth = await authContext(request, env);
  if (!auth) throw new AccessError('sessao_invalida', 401);
  const credentialId = validarCredentialId(body.credentialId);
  const cred = await carregarCredencial(env, credentialId);
  if (!cred) throw new AccessError('credencial_nao_encontrada', 404);
  if (cred.status !== 'active') throw new AccessError('acesso_revogado', 409);
  const meta = await loadGabinete(env, cred.gabineteId);
  exigirGestor(meta, auth);
  exigirGestaoDeCredencial(meta, auth, cred);
  const password = validarPassword(body.password);
  const claims = technicalClaims(cred.credentialId, cred.gabineteId);
  await updateAuthUser(env, {
    localId: cred.uid,
    password,
    claims,
    revoke: true,
  });
  const updatedAt = Date.now();
  await patchFirestoreDoc(env, `employeeCredentials/${credentialId}`, {
    passwordUpdatedAt: updatedAt,
    passwordUpdatedBy: auth.uid,
    updatedAt,
  }, { merge: true });
  await writeAccessAudit(env, {
    uid: auth.uid,
    email: auth.email,
    gabineteId: cred.gabineteId,
    type: 'reset_employee_password',
    detail: credentialId,
  });
  return { ok: true, credencialId: credentialId, loginEmail: cred.email, updatedAt };
}

export async function alterarPasswordPropria(
  request: Request,
  env: Env,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const auth = await authContext(request, env);
  if (!auth) throw new AccessError('sessao_invalida', 401);
  if (auth.claims.employeeOnly !== true) throw new AccessError('conta_nao_tecnica', 403);
  const credentialId = validarCredentialId(auth.claims.credentialId);
  const cred = await carregarCredencial(env, credentialId);
  if (!cred || cred.uid !== auth.uid) throw new AccessError('credencial_nao_encontrada', 404);
  if (cred.status !== 'active') throw new AccessError('acesso_revogado', 403);
  const passwordAtual = String(body.passwordAtual || '');
  const passwordNova = validarPassword(body.passwordNova);
  const confirmada = await signInAuthPassword(env, technicalAuthEmail(credentialId), passwordAtual);
  if (!confirmada || confirmada.uid !== cred.uid) throw new AccessError('password_atual_incorreta', 401);
  await updateAuthUser(env, {
    localId: cred.uid,
    password: passwordNova,
    claims: technicalClaims(cred.credentialId, cred.gabineteId),
  });
  const updatedAt = Date.now();
  await patchFirestoreDoc(env, `employeeCredentials/${credentialId}`, {
    passwordUpdatedAt: updatedAt,
    passwordUpdatedBy: cred.uid,
    updatedAt,
  }, { merge: true });
  await writeAccessAudit(env, {
    uid: cred.uid,
    email: cred.email,
    gabineteId: cred.gabineteId,
    type: 'change_own_employee_password',
    detail: credentialId,
  });
  return { ok: true };
}

async function existeOutraCredencialAtiva(
  env: Env,
  cred: EmployeeCredential,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const indice = await carregarIndice(env, cred.emailHash, fetchImpl);
  const outras = (indice?.credentialIds || []).filter((id) => id !== cred.credentialId);
  const carregadas = await Promise.all(outras.slice(0, 20).map((id) => carregarCredencial(env, id, fetchImpl)));
  return carregadas.some((c) => c?.status === 'active' && c.gabineteId === cred.gabineteId);
}

export async function removerAcesso(
  request: Request,
  env: Env,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const auth = await authContext(request, env);
  if (!auth) throw new AccessError('sessao_invalida', 401);
  const credentialId = validarCredentialId(body.credentialId);
  const cred = await carregarCredencial(env, credentialId);
  if (!cred) throw new AccessError('credencial_nao_encontrada', 404);
  const meta = await loadGabinete(env, cred.gabineteId);
  exigirGestor(meta, auth);
  exigirGestaoDeCredencial(meta, auth, cred);
  if (cred.uid === meta.ownerUid || cred.normalUid === meta.ownerUid) {
    throw new AccessError('dono_nao_pode_ser_removido', 409);
  }

  const removeUids = [cred.uid];
  if (cred.normalUid && cred.normalMembershipAddedByCredential && !(await existeOutraCredencialAtiva(env, cred))) {
    if (cred.normalUid === meta.ownerUid || cred.normalUid === meta.id) {
      throw new AccessError('dono_nao_pode_ser_removido', 409);
    }
    removeUids.push(cred.normalUid);
  }
  const agora = Date.now();
  const revoked: EmployeeCredential = {
    ...cred,
    status: 'revoked',
    revokedAt: agora,
    revokedBy: auth.uid,
    updatedAt: agora,
  };
  await Promise.all([
    atualizarMembros(env, cred.gabineteId, [], removeUids),
    patchFirestoreDoc(env, `employeeCredentials/${credentialId}`, {
      status: 'revoked',
      revokedAt: agora,
      revokedBy: auth.uid,
      updatedAt: agora,
    }, { merge: true }),
    guardarPerfil(env, revoked),
    deleteFirestoreDoc(env, `gabinete/${cred.gabineteId}/colaboradores/${credentialId}`),
    writeAccessAudit(env, {
      uid: auth.uid,
      email: auth.email,
      gabineteId: cred.gabineteId,
      type: 'revoke_employee_access',
      detail: credentialId,
    }),
  ]);
  return { ok: true, credencialId: credentialId, status: 'revoked' };
}

interface LoginMatch {
  cred: EmployeeCredential;
  authEmail: string;
}

async function tentarPasswords(
  env: Env,
  credenciais: EmployeeCredential[],
  password: string,
): Promise<LoginMatch[]> {
  const out: LoginMatch[] = [];
  for (const cred of credenciais.slice(0, 12)) {
    const authEmail = technicalAuthEmail(cred.credentialId);
    const match = await signInAuthPassword(env, authEmail, password);
    if (match?.uid === cred.uid) out.push({ cred, authEmail });
  }
  return out;
}

export async function loginTecnico(
  env: Env,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  if (!identificadorValido(email) || !password || password.length > 128) {
    throw new AccessError('credenciais_invalidas', 401);
  }
  const emailHash = await hashEmail(email);
  const indice = await carregarIndice(env, emailHash);
  if (!indice?.credentialIds?.length) throw new AccessError('credenciais_invalidas', 401);
  const credenciais = (await Promise.all(
    indice.credentialIds.slice(0, 20).map((id) => carregarCredencial(env, id)),
  )).filter((c): c is EmployeeCredential => !!c);
  const ativas = credenciais.filter((c) => c.status === 'active');
  const ativasMatch = await tentarPasswords(env, ativas, password);
  if (ativasMatch.length > 1) throw new AccessError('credenciais_ambiguas', 409);
  if (ativasMatch.length === 1) {
    const { cred } = ativasMatch[0];
    const token = await createEmployeeCustomToken(
      env,
      cred.uid,
      technicalClaims(cred.credentialId, cred.gabineteId),
    );
    return {
      ok: true,
      token,
      credentialId: cred.credentialId,
      gabineteId: cred.gabineteId,
      status: 'active',
    };
  }

  const revogadas = credenciais.filter((c) => c.status === 'revoked');
  const revogadasMatch = await tentarPasswords(env, revogadas, password);
  if (revogadasMatch.length > 1) throw new AccessError('credenciais_ambiguas', 409);
  if (revogadasMatch.length === 1) {
    const { cred } = revogadasMatch[0];
    const token = await createEmployeeCustomToken(
      env,
      cred.uid,
      technicalClaims(cred.credentialId, cred.gabineteId),
    );
    return {
      ok: true,
      token,
      credentialId: cred.credentialId,
      gabineteId: cred.gabineteId,
      status: 'revoked',
    };
  }
  throw new AccessError('credenciais_invalidas', 401);
}

export async function vincularContaNormal(
  request: Request,
  env: Env,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const auth = await authContext(request, env);
  if (!auth) throw new AccessError('sessao_invalida', 401);
  if (auth.claims.employeeOnly === true) throw new AccessError('conta_tecnica', 403);
  const email = normalizeEmail(auth.email);
  if (!emailValido(email)) return { ok: true, gabinetesVinculados: [] };
  const password = String(body.password || '');
  if (!password) throw new AccessError('password_obrigatoria', 400);
  const emailHash = await hashEmail(email);
  const indice = await carregarIndice(env, emailHash);
  if (!indice?.credentialIds?.length) return { ok: true, gabinetesVinculados: [] };
  const credenciais = (await Promise.all(
    indice.credentialIds.slice(0, 20).map((id) => carregarCredencial(env, id)),
  )).filter((c): c is EmployeeCredential => !!c && c.status === 'active');

  const matches = await tentarPasswords(env, credenciais, password);
  if (matches.length > 1) throw new AccessError('credenciais_ambiguas', 409);
  if (matches.length === 0) throw new AccessError('credenciais_invalidas', 401);

  const cred = matches[0].cred;
  const meta = await loadGabinete(env, cred.gabineteId);
  if (meta.ownerUid === auth.uid) return { ok: true, gabinetesVinculados: [] };
  const jaEraMembro = !!meta.memberUids?.includes(auth.uid);
  if (!jaEraMembro) {
    await atualizarMembros(env, cred.gabineteId, [{
      uid: auth.uid,
      email,
      role: cred.role,
    }]);
  }
  if (!cred.normalUid) {
    await patchFirestoreDoc(env, `employeeCredentials/${cred.credentialId}`, {
      normalUid: auth.uid,
      normalMembershipAddedByCredential: !jaEraMembro,
      updatedAt: Date.now(),
    }, { merge: true });
  }
  await patchFirestoreDoc(
    env,
    `gabinete/${cred.gabineteId}/colaboradores/${cred.credentialId}`,
    { linkedUid: auth.uid, status: 'ativo', updatedAt: Date.now() },
    { merge: true },
  ).catch(() => {});
  await writeAccessAudit(env, {
    uid: auth.uid,
    email,
    gabineteId: cred.gabineteId,
    type: 'link_normal_account',
    detail: cred.credentialId,
  });
  return { ok: true, gabinetesVinculados: [cred.gabineteId] };
}

export async function migrarConvitesLegados(
  request: Request,
  env: Env,
): Promise<Record<string, unknown>> {
  const auth = await authContext(request, env);
  if (!auth) throw new AccessError('sessao_invalida', 401);
  if (auth.email !== 'admin@estudo360.pt') throw new AccessError('apenas_admin', 403);
  const convites = await firestoreList(env, 'convites');
  let convitesRemovidos = 0;
  for (const convite of convites) {
    try {
      await deleteFirestoreDoc(env, convite.path);
      convitesRemovidos++;
    } catch {
      // Continua: um token inválido não bloqueia os restantes.
    }
  }
  const gabinetes = await firestoreList(env, 'gabinetes');
  let gabinetesLimpos = 0;
  for (const gab of gabinetes) {
    const id = gab.path.split('/').pop() || '';
    if (!id) continue;
    try {
      await patchFirestoreDoc(env, `gabinetes/${id}`, {
        inviteEmails: [],
        invites: [],
        inviteRoles: {},
        inviteExpiries: {},
        updatedAt: Date.now(),
      }, { merge: true });
      gabinetesLimpos++;
    } catch {
      // Continua: um documento inválido não bloqueia os restantes.
    }
  }
  await writeAccessAudit(env, {
    uid: auth.uid,
    email: auth.email,
    type: 'migrate_legacy_invites',
    detail: `${convitesRemovidos} convites, ${gabinetesLimpos} gabinetes`,
  });
  return { ok: true, convitesRemovidos, gabinetesLimpos };
}
