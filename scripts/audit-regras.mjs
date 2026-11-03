#!/usr/bin/env node
/**
 * Regressão das Firestore Rules para o modelo de acessos da equipa.
 *
 * Uso no emulador:
 *   firebase emulators:exec --only auth,firestore \
 *     --project demo-estudo360-audit "node scripts/audit-regras.mjs"
 */
const KEY = process.env.FIREBASE_API_KEY || 'AIzaSyChJKEBjPKZcRVF4R_n07UoUB9QO0q_EzM';
const AUTH_EMU = process.env.FIREBASE_AUTH_EMULATOR_HOST || '';
const FS_EMU = process.env.FIRESTORE_EMULATOR_HOST || '';
const P = process.env.GABINETE_PROJECT || (AUTH_EMU || FS_EMU ? 'demo-estudo360-audit' : 'estudo360-app');
const BASE = FS_EMU
  ? `http://${FS_EMU}/v1/projects/${P}/databases/(default)/documents`
  : `https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents`;
const AUTH_BASE = AUTH_EMU
  ? `http://${AUTH_EMU}/identitytoolkit.googleapis.com/v1`
  : 'https://identitytoolkit.googleapis.com/v1';

let fails = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fails++;
};

async function req(method, url, body, token) {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, text: await res.text() };
}

async function signup(email) {
  const result = await req('POST', `${AUTH_BASE}/accounts:signUp?key=${KEY}`, {
    email,
    password: 'Teste12345!',
    returnSecureToken: true,
  });
  const json = JSON.parse(result.text);
  if (!json.idToken) throw new Error(json.error?.message || 'signup falhou');
  return { uid: json.localId, token: json.idToken, email };
}

async function login(email) {
  const result = await req('POST', `${AUTH_BASE}/accounts:signInWithPassword?key=${KEY}`, {
    email,
    password: 'Teste12345!',
    returnSecureToken: true,
  });
  const json = JSON.parse(result.text);
  if (!json.idToken) throw new Error(json.error?.message || 'login falhou');
  return { uid: json.localId, token: json.idToken, email };
}

async function setClaims(uid, claims) {
  const result = await req(
    'POST',
    `${AUTH_BASE}/projects/${P}/accounts:update?key=${KEY}`,
    { localId: uid, customAttributes: JSON.stringify(claims) },
    'owner',
  );
  if (result.status >= 400) throw new Error(`falha ao definir claims: ${result.status} ${result.text}`);
}

const stamp = Date.now();
const gid = `qa${stamp.toString(36)}`;
const ownerEmail = `qaowner+${stamp}@estudo360.pt`;
const colabEmail = `qacolab+${stamp}@estudo360.pt`;
const employeeEmail = `employee+qa${stamp}@auth.estudo360.pt`;
const intruderEmail = `qaintruzo+${stamp}@estudo360.pt`;
const owner = await signup(ownerEmail);
const colab = await signup(colabEmail);
const employee = await signup(employeeEmail);
const intruder = await signup(intruderEmail);
await setClaims(employee.uid, {
  employeeOnly: true,
  credentialId: `cred_${stamp.toString(16).padEnd(24, '0').slice(0, 24)}`,
  gabineteId: gid,
});
const employeeWithClaims = await login(employeeEmail);

const now = Date.now();
const ownerMembers = {
  [owner.uid]: {
    mapValue: {
      fields: {
        role: { stringValue: 'admin' },
        email: { stringValue: ownerEmail },
        addedAt: { integerValue: String(now) },
      },
    },
  },
};
const baseFields = {
  ownerUid: { stringValue: owner.uid },
  ownerEmail: { stringValue: ownerEmail },
  nome: { stringValue: 'QA Regras' },
  createdAt: { integerValue: String(now) },
  updatedAt: { integerValue: String(now) },
  memberUids: { arrayValue: { values: [{ stringValue: owner.uid }] } },
  members: { mapValue: { fields: ownerMembers } },
  inviteEmails: { arrayValue: { values: [] } },
  invites: { arrayValue: { values: [] } },
  inviteRoles: { mapValue: { fields: {} } },
  inviteExpiries: { mapValue: { fields: {} } },
};

const createOwner = await req('POST', `${BASE}/gabinetes?documentId=${gid}`, { fields: baseFields }, owner.token);
ok(createOwner.status === 200, `conta normal cria o próprio gabinete (${createOwner.status}) ${createOwner.text.slice(0, 160)}`);

ok(
  (await req('POST', `${BASE}/gabinetes?documentId=emp${stamp.toString(36)}`, {
    fields: {
      ...baseFields,
      ownerUid: { stringValue: employee.uid },
      memberUids: { arrayValue: { values: [{ stringValue: employee.uid }] } },
    },
  }, employeeWithClaims.token)).status === 403,
  'conta employeeOnly não pode criar gabinete',
);

const membersWithColab = {
  mapValue: {
    fields: {
      ...ownerMembers,
      [colab.uid]: {
        mapValue: {
          fields: {
            role: { stringValue: 'contabilista' },
            email: { stringValue: colabEmail },
            addedAt: { integerValue: String(now + 1) },
          },
        },
      },
      [employee.uid]: {
        mapValue: {
          fields: {
            role: { stringValue: 'contabilista' },
            email: { stringValue: employeeEmail },
            addedAt: { integerValue: String(now + 2) },
          },
        },
      },
    },
  },
};
const addMembers = {
  memberUids: { arrayValue: { values: [
    { stringValue: owner.uid },
    { stringValue: colab.uid },
    { stringValue: employee.uid },
  ] } },
  members: membersWithColab,
  updatedAt: { integerValue: String(now + 3) },
};
const addMembersResult = await req('PATCH', `${BASE}/gabinetes/${gid}?updateMask.fieldPaths=memberUids&updateMask.fieldPaths=members&updateMask.fieldPaths=updatedAt`, { fields: addMembers }, owner.token);
ok(addMembersResult.status === 200, `dono adiciona membro normal e conta técnica (${addMembersResult.status}) ${addMembersResult.text.slice(0, 160)}`);

const chunk = {
  list: { arrayValue: { values: [] } },
  updatedAt: { integerValue: String(now + 4) },
  chunk: { integerValue: '0' },
};
ok(
  (await req('PATCH', `${BASE}/empresas/${gid}/chunks/0`, { fields: chunk }, colab.token)).status === 200,
  'membro normal acede aos dados do gabinete',
);
ok(
  (await req('PATCH', `${BASE}/empresas/${gid}/chunks/0`, { fields: chunk }, employeeWithClaims.token)).status === 200,
  'conta técnica membro acede aos dados do gabinete',
);
ok(
  (await req('PATCH', `${BASE}/empresas/${gid}/chunks/0`, { fields: chunk }, intruder.token)).status === 403,
  'intruso não acede aos dados do gabinete',
);

const escalation = {
  members: {
    mapValue: {
      fields: {
        ...ownerMembers,
        [colab.uid]: {
          mapValue: { fields: { role: { stringValue: 'admin' }, email: { stringValue: colabEmail } } },
        },
      },
    },
  },
};
ok(
  (await req('PATCH', `${BASE}/gabinetes/${gid}?updateMask.fieldPaths=members`, { fields: escalation }, colab.token)).status === 403,
  'colaborador não se promove a admin',
);

const credentialId = `cred_${stamp.toString(16).padEnd(24, 'f').slice(0, 24)}`;
const adminWrite = (path, fields) => req('PATCH', `${BASE}/${path}`, { fields }, 'owner');
ok(
  (await adminWrite(`employeeCredentials/${credentialId}`, {
    credentialId: { stringValue: credentialId },
    gabineteId: { stringValue: gid },
    uid: { stringValue: employee.uid },
    status: { stringValue: 'active' },
  })).status === 200,
  'conta de serviço prepara credencial administrativa',
);
ok(
  (await req('GET', `${BASE}/employeeCredentials/${credentialId}`, null, employeeWithClaims.token)).status === 403,
  'conta técnica não lê o documento privado da credencial',
);
ok(
  (await adminWrite(`employeeProfiles/${employee.uid}`, {
    credentialId: { stringValue: credentialId },
    gabineteId: { stringValue: gid },
    email: { stringValue: 'pessoa@empresa.pt' },
    status: { stringValue: 'active' },
  })).status === 200,
  'conta de serviço prepara perfil técnico',
);
ok(
  (await req('GET', `${BASE}/employeeProfiles/${employee.uid}`, null, employeeWithClaims.token)).status === 200,
  'conta técnica lê apenas o próprio perfil',
);
ok(
  (await req('GET', `${BASE}/employeeProfiles/${employee.uid}`, null, intruder.token)).status === 403,
  'outro utilizador não lê perfil técnico alheio',
);

ok(
  (await adminWrite('convites/legado-token', { email: { stringValue: 'antigo@empresa.pt' } })).status === 200,
  'conta de serviço ainda consegue preparar fixture de convite legado',
);
ok(
  (await req('GET', `${BASE}/convites/legado-token`, null, owner.token)).status === 403,
  'convites antigos já não são legíveis pelo cliente',
);
ok(
  (await req('PATCH', `${BASE}/convites/legado-token?updateMask.fieldPaths=email`, {
    fields: { email: { stringValue: 'novo@empresa.pt' } },
  }, owner.token)).status === 403,
  'cliente não consegue alterar convite antigo',
);

const appAdmin = await signup('admin@estudo360.pt');
const updateId = `qa-update-${stamp}`;
const updateFields = {
  text: { stringValue: 'Nota permanente QA' },
  atualizado: { booleanValue: false },
  aprovado: { booleanValue: false },
  createdAt: { integerValue: String(Date.now()) },
  autor: { stringValue: 'proximos:semana-03-11' },
};
ok(
  (await req('POST', `${BASE}/updates?documentId=${updateId}`, { fields: updateFields }, appAdmin.token)).status === 200,
  'admin cria uma versão dos próximos passos',
);
ok(
  (await req('PATCH', `${BASE}/updates/${updateId}?updateMask.fieldPaths=text`, {
    fields: { text: { stringValue: 'Tentativa de alteração' } },
  }, appAdmin.token)).status === 403,
  'versão guardada não pode ser alterada',
);
ok(
  (await req('DELETE', `${BASE}/updates/${updateId}`, null, appAdmin.token)).status === 403,
  'versão guardada não pode ser apagada',
);

await req('DELETE', `${BASE}/gabinetes/${gid}`, null, owner.token);
console.log(fails ? `\nFAIL — ${fails} falha(s)` : '\nPASS — regras de acessos da equipa OK');
process.exit(fails ? 1 : 0);
