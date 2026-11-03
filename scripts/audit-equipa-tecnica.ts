/**
 * E2E do fluxo de acessos da equipa nos emuladores Auth + Firestore.
 *
 * Executar:
 *   firebase emulators:exec --only auth,firestore --project demo-estudo360-audit \
 *     "node --import tsx scripts/audit-equipa-tecnica.ts"
 */
import {
  firestoreList,
  getFirestoreDoc,
  hashEmail,
  patchFirestoreDoc,
} from '../functions/_firebaseAdmin';
import { onRequestPost as equipaPost } from '../functions/api/equipa-contas';
import { onRequestPost as loginPost } from '../functions/api/colaborador-login';
import { onRequestPost as vincularPost } from '../functions/api/vincular-conta';

const KEY = process.env.FIREBASE_API_KEY || 'AIzaSyChJKEBjPKZcRVF4R_n07UoUB9QO0q_EzM';
const AUTH_HOST = String(process.env.FIREBASE_AUTH_EMULATOR_HOST || '').trim();
const FS_HOST = String(process.env.FIRESTORE_EMULATOR_HOST || '').trim();
const PROJECT = 'demo-estudo360-audit';
const ORIGIN = 'http://localhost:3000';
if (!AUTH_HOST || !FS_HOST) throw new Error('Execute este teste dentro de firebase emulators:exec.');

const AUTH_BASE = `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1`;
const FS_BASE = `http://${FS_HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;
const env = {
  FIREBASE_PROJECT_ID: PROJECT,
  FIREBASE_AUTH_EMULATOR_HOST: AUTH_HOST,
  FIRESTORE_EMULATOR_HOST: FS_HOST,
  FIREBASE_API_KEY: KEY,
};

let failures = 0;
const check = (condition: unknown, label: string) => {
  console.log(`${condition ? '✓' : '✗'} ${label}`);
  if (!condition) failures++;
};

async function raw(method: string, url: string, body?: unknown, token?: string): Promise<{ status: number; text: string }> {
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, text: await response.text() };
}

async function signup(email: string): Promise<{ uid: string; token: string; email: string }> {
  const response = await raw('POST', `${AUTH_BASE}/accounts:signUp?key=${KEY}`, {
    email,
    password: 'Teste12345!',
    returnSecureToken: true,
  });
  const data = JSON.parse(response.text);
  if (!data.idToken) throw new Error(`signup ${email}: ${response.text}`);
  return { uid: data.localId, token: data.idToken, email };
}

async function callFunction(
  handler: (ctx: { request: Request; env: Record<string, unknown> }) => Promise<Response>,
  path: string,
  body: Record<string, unknown>,
  token?: string,
): Promise<{ status: number; data: Record<string, any> }> {
  const request = new Request(`https://estudo360.pt${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      Referer: `${ORIGIN}/equipa`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const response = await handler({ request, env });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function exchangeCustomToken(customToken: string): Promise<{ uid: string; token: string; claims: Record<string, unknown> }> {
  const response = await raw('POST', `${AUTH_BASE}/accounts:signInWithCustomToken?key=${KEY}`, {
    token: customToken,
    returnSecureToken: true,
  });
  const data = JSON.parse(response.text);
  if (!data.idToken) throw new Error(`custom token: ${response.text}`);
  const payload = JSON.parse(Buffer.from(data.idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  return { uid: data.localId, token: data.idToken, claims: payload };
}

async function tenantWrite(gid: string, token: string): Promise<number> {
  const response = await raw('PATCH', `${FS_BASE}/empresas/${gid}/chunks/0`, {
    fields: {
      list: { arrayValue: { values: [] } },
      updatedAt: { integerValue: String(Date.now()) },
      chunk: { integerValue: '0' },
    },
  }, token);
  return response.status;
}

const stamp = Date.now();
const owner = await signup(`owner+equipa+${stamp}@estudo360.pt`);
const normalExisting = await signup(`normal-existente+${stamp}@empresa.pt`);
const normalMember = await signup(`normal-membro+${stamp}@empresa.pt`);
const gid = `gab_equipa_${stamp.toString(36)}`;
const email = `colaborador+${stamp}@empresa.pt`;
const password1 = 'Equipa12345!';
const password2 = 'Equipa23456!';
const password3 = 'Equipa34567!';

await patchFirestoreDoc(env, `gabinetes/${gid}`, {
  id: gid,
  nome: 'Gabinete E2E',
  ownerUid: owner.uid,
  ownerEmail: owner.email,
  memberUids: [owner.uid],
  members: {
    [owner.uid]: { role: 'admin', email: owner.email, addedAt: Date.now() },
  },
  customRoles: {},
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const ownerLookup = await raw('POST', `${AUTH_BASE}/accounts:lookup?key=${KEY}`, { idToken: owner.token });
check(ownerLookup.status === 200, `token do dono é válido no emulador (${ownerLookup.status}) ${ownerLookup.text.slice(0, 100)}`);

const create = await callFunction(equipaPost, '/api/equipa-contas', {
  action: 'criar',
  gabineteId: gid,
  nome: 'Ana Colaboradora',
  email,
  password: password1,
  role: 'contabilista',
}, owner.token);
check(create.status === 201, `dono cria acesso (${create.status}) ${JSON.stringify(create.data).slice(0, 180)}`);
check(!JSON.stringify(create.data).includes(password1), 'resposta não devolve a password');
if (create.status !== 201) {
  console.log('\nFAIL — criação de acesso bloqueada; testes seguintes abortados.');
  process.exit(1);
}
const credentialId = String(create.data.credencialId || '');
const credentialDoc = await getFirestoreDoc<Record<string, unknown>>(env, `employeeCredentials/${credentialId}`);
check(credentialDoc?.data.status === 'active', 'credencial fica ativa no servidor');
check(!JSON.stringify(credentialDoc?.data).includes(password1), 'password não é guardada no Firestore');
const technicalUid = String(credentialDoc?.data.uid || '');
const profileDoc = await getFirestoreDoc<Record<string, unknown>>(env, `employeeProfiles/${technicalUid}`);
check(profileDoc?.data.status === 'active', 'perfil técnico fica legível ao colaborador');

const login1 = await callFunction(loginPost, '/api/colaborador-login', { email, password: password1 });
check(login1.status === 200 && !!login1.data.token, `login criado pelo dono funciona (${login1.status})`);
const session1 = await exchangeCustomToken(String(login1.data.token || ''));
check(session1.claims.employeeOnly === true, 'sessão técnica recebe claim employeeOnly');
check(session1.claims.credentialId === credentialId, 'sessão técnica recebe o credentialId correto');
check(session1.claims.gabineteId === gid, 'sessão técnica fica presa ao gabinete correto');
check((await tenantWrite(gid, session1.token)) === 200, 'conta técnica acede aos dados do gabinete');

const concurrentEmails = [
  `concorrente-a+${stamp}@empresa.pt`,
  `concorrente-b+${stamp}@empresa.pt`,
];
const concurrentCreates = await Promise.all(concurrentEmails.map((concurrentEmail, index) => callFunction(
  equipaPost,
  '/api/equipa-contas',
  {
    action: 'criar',
    gabineteId: gid,
    nome: `Concorrente ${index + 1}`,
    email: concurrentEmail,
    password: `Concorrente${index + 1}2345!`,
    role: index === 0 ? 'contabilista' : 'estagiaria',
  },
  owner.token,
)));
check(concurrentCreates.every((result) => result.status === 201), 'dois administradores conseguem criar acessos em paralelo');
const concurrentMeta = await getFirestoreDoc<Record<string, any>>(env, `gabinetes/${gid}`);
const concurrentCredentialIds = concurrentCreates.map((result) => String(result.data.credencialId || ''));
const concurrentUids = await Promise.all(concurrentCredentialIds.map(async (id) => {
  const doc = await getFirestoreDoc<Record<string, unknown>>(env, `employeeCredentials/${id}`);
  return String(doc?.data.uid || '');
}));
check(concurrentUids.every((uid) => (concurrentMeta?.data.memberUids || []).includes(uid)), 'escritas paralelas preservam os dois membros no gabinete');
await Promise.all(concurrentCredentialIds.map((id) => callFunction(
  equipaPost,
  '/api/equipa-contas',
  { action: 'remover', credentialId: id },
  owner.token,
)));

const reset = await callFunction(equipaPost, '/api/equipa-contas', {
  action: 'repor_password',
  credentialId,
  password: password2,
}, owner.token);
check(reset.status === 200, `dono repõe password (${reset.status})`);
const oldAfterReset = await callFunction(loginPost, '/api/colaborador-login', { email, password: password1 });
const newAfterReset = await callFunction(loginPost, '/api/colaborador-login', { email, password: password2 });
check(oldAfterReset.status === 401, 'password antiga deixa de funcionar após reposição');
check(newAfterReset.status === 200, 'password reposta funciona');
const session2 = await exchangeCustomToken(String(newAfterReset.data.token || ''));

const ownChange = await callFunction(equipaPost, '/api/equipa-contas', {
  action: 'alterar_password',
  passwordAtual: password2,
  passwordNova: password3,
}, session2.token);
check(ownChange.status === 200, `colaborador altera a própria password (${ownChange.status})`);
check((await callFunction(loginPost, '/api/colaborador-login', { email, password: password2 })).status === 401, 'password intermédia deixa de funcionar');
const finalLogin = await callFunction(loginPost, '/api/colaborador-login', { email, password: password3 });
check(finalLogin.status === 200, 'password alterada pelo colaborador funciona');

const secondGid = `${gid}_2`;
await patchFirestoreDoc(env, `gabinetes/${secondGid}`, {
  id: secondGid,
  nome: 'Segundo Gabinete E2E',
  ownerUid: owner.uid,
  ownerEmail: owner.email,
  memberUids: [owner.uid],
  members: {
    [owner.uid]: { role: 'admin', email: owner.email, addedAt: Date.now() },
  },
  customRoles: {},
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
const createAmbiguous = await callFunction(equipaPost, '/api/equipa-contas', {
  action: 'criar',
  gabineteId: secondGid,
  nome: 'Ana no Segundo Gabinete',
  email,
  password: password3,
  role: 'contabilista',
}, owner.token);
check(createAmbiguous.status === 201, 'mesmo email pode ter credenciais separadas em dois gabinetes');
const ambiguousLogin = await callFunction(loginPost, '/api/colaborador-login', { email, password: password3 });
check(ambiguousLogin.status === 409 && ambiguousLogin.data.erro === 'credenciais_ambiguas', 'passwords iguais em dois gabinetes são recusadas como ambíguas');
const secondCredentialId = String(createAmbiguous.data.credencialId || '');
const resetAmbiguous = await callFunction(equipaPost, '/api/equipa-contas', {
  action: 'repor_password',
  credentialId: secondCredentialId,
  password: 'Equipa45678!',
}, owner.token);
check(resetAmbiguous.status === 200, 'reposição resolve a ambiguidade entre gabinetes');
check((await callFunction(loginPost, '/api/colaborador-login', { email, password: password3 })).status === 200, 'login volta a identificar um único gabinete');
await callFunction(equipaPost, '/api/equipa-contas', { action: 'remover', credentialId: secondCredentialId }, owner.token);

const beforeNormalMember = await getFirestoreDoc<Record<string, any>>(env, `gabinetes/${gid}`);
await patchFirestoreDoc(env, `gabinetes/${gid}`, {
  memberUids: Array.from(new Set([...(beforeNormalMember?.data.memberUids || []), normalMember.uid])),
  members: {
    ...(beforeNormalMember?.data.members || {}),
    [normalMember.uid]: { role: 'contabilista', email: normalMember.email, addedAt: Date.now() },
  },
  updatedAt: Date.now(),
}, { merge: true });
const createForExistingMember = await callFunction(equipaPost, '/api/equipa-contas', {
  action: 'criar',
  gabineteId: gid,
  nome: 'Membro Já Existente',
  email: normalMember.email,
  password: 'Membro12345!',
  role: 'estagiaria',
}, owner.token);
check(createForExistingMember.status === 201, 'dono cria password de gabinete para membro normal já existente');
let memberMeta = await getFirestoreDoc<Record<string, any>>(env, `gabinetes/${gid}`);
check(memberMeta?.data.members?.[normalMember.uid]?.role === 'contabilista', 'cargo original do membro normal é preservado');
await callFunction(equipaPost, '/api/equipa-contas', {
  action: 'remover',
  credentialId: String(createForExistingMember.data.credencialId || ''),
}, owner.token);
memberMeta = await getFirestoreDoc<Record<string, any>>(env, `gabinetes/${gid}`);
check((memberMeta?.data.memberUids || []).includes(normalMember.uid), 'remover a password não remove o membro normal pré-existente');

const normalEmail = `normal-ligado+${stamp}@empresa.pt`;
const createExisting = await callFunction(equipaPost, '/api/equipa-contas', {
  action: 'criar',
  gabineteId: gid,
  nome: 'Conta Normal',
  email: normalExisting.email,
  password: 'Normal12345!',
  role: 'estagiaria',
}, owner.token);
check(createExisting.status === 201, 'dono cria acesso para email que já tem conta normal');
const normalPasswordStillWorks = await raw('POST', `${AUTH_BASE}/accounts:signInWithPassword?key=${KEY}`, {
  email: normalExisting.email,
  password: 'Teste12345!',
  returnSecureToken: true,
});
const cabinetPasswordForExisting = await callFunction(loginPost, '/api/colaborador-login', {
  email: normalExisting.email,
  password: 'Normal12345!',
});
check(normalPasswordStillWorks.status === 200, 'password da conta normal não é alterada');
check(cabinetPasswordForExisting.status === 200, 'password criada pelo gabinete também funciona para o mesmo email');
let gabMeta = await getFirestoreDoc<Record<string, any>>(env, `gabinetes/${gid}`);
check((gabMeta?.data.memberUids || []).includes(normalExisting.uid), 'conta normal existente é associada automaticamente');
const removeNormal = await callFunction(equipaPost, '/api/equipa-contas', {
  action: 'remover',
  credentialId: String(createExisting.data.credencialId || ''),
}, owner.token);
check(removeNormal.status === 200, 'dono remove o acesso da conta normal');
gabMeta = await getFirestoreDoc<Record<string, any>>(env, `gabinetes/${gid}`);
check(!(gabMeta?.data.memberUids || []).includes(normalExisting.uid), 'remoção retira também a conta normal do gabinete');

const createLater = await callFunction(equipaPost, '/api/equipa-contas', {
  action: 'criar',
  gabineteId: gid,
  nome: 'Conta Criada Depois',
  email: normalEmail,
  password: 'Depois12345!',
  role: 'contabilista',
}, owner.token);
check(createLater.status === 201, 'dono cria acesso antes de a conta normal existir');
const normalLater = await signup(normalEmail);
const linkWithoutPassword = await callFunction(vincularPost, '/api/vincular-conta', {}, normalLater.token);
check(linkWithoutPassword.status === 400, 'conta normal não entra no gabinete apenas pelo email');
const linkWrongPassword = await callFunction(vincularPost, '/api/vincular-conta', {
  password: 'PasswordErrada123!',
}, normalLater.token);
check(linkWrongPassword.status === 401, 'password errada do gabinete não liga a conta normal');
const link = await callFunction(vincularPost, '/api/vincular-conta', {
  password: 'Depois12345!',
}, normalLater.token);
check(link.status === 200, `conta normal criada depois confirma o acesso com a password do gabinete (${link.status})`);
gabMeta = await getFirestoreDoc<Record<string, any>>(env, `gabinetes/${gid}`);
check((gabMeta?.data.memberUids || []).includes(normalLater.uid), 'conta criada depois aparece no gabinete');

const remove = await callFunction(equipaPost, '/api/equipa-contas', {
  action: 'remover',
  credentialId,
}, owner.token);
check(remove.status === 200, 'dono revoga o acesso técnico');
const revokedLogin = await callFunction(loginPost, '/api/colaborador-login', { email, password: password3 });
check(revokedLogin.status === 200 && revokedLogin.data.status === 'revoked', 'login revogado entra no estado de acesso removido');
const revokedSession = await exchangeCustomToken(String(revokedLogin.data.token || ''));
check((await tenantWrite(gid, revokedSession.token)) === 403, 'sessão revogada não consegue ler nem escrever dados');
const revokedProfile = await getFirestoreDoc<Record<string, unknown>>(env, `employeeProfiles/${technicalUid}`);
check(revokedProfile?.data.status === 'revoked', 'perfil técnico fica marcado como revogado');

const index = await getFirestoreDoc<Record<string, unknown>>(
  env,
  `employeeLoginIndexes/${await hashEmail(email)}`,
);
check(Array.isArray(index?.data.credentialIds) && (index?.data.credentialIds as string[]).includes(credentialId), 'índice de login mantém a credencial para o ecrã de revogação');

const audits = await firestoreList(env, 'audit_events');
const auditTypes = new Set(audits.map((item) => String(item.data.type || '')));
check(auditTypes.has('create_employee_credential'), 'auditoria regista criação de acesso');
check(auditTypes.has('reset_employee_password'), 'auditoria regista reposição');
check(auditTypes.has('change_own_employee_password'), 'auditoria regista alteração própria');
check(auditTypes.has('revoke_employee_access'), 'auditoria regista revogação');
check(!JSON.stringify(audits).includes(password1) && !JSON.stringify(audits).includes(password2) && !JSON.stringify(audits).includes(password3), 'auditoria não contém passwords');

console.log(failures ? `\nFAIL — ${failures} falha(s)` : '\nPASS — fluxo E2E dos acessos da equipa OK');
process.exit(failures ? 1 : 0);
