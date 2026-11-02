#!/usr/bin/env node
/**
 * Teste de regressão das regras Firestore (produção ou projeto indicado).
 * - convidado aceita convite (auto-adesão) → 200
 * - convidado recusa convite → 200
 * - convidado tenta alterar membros junto com a recusa → 403
 * - não convidado tenta entrar → 403
 * Uso: FIREBASE_API_KEY=... GABINETE_PROJECT=estudo360-app node scripts/audit-regras.mjs
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
const ok = (cond, label) => { console.log(`${cond ? '✓' : '✗'} ${label}`); if (!cond) fails++; };
async function req(method, url, body, token) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, text: await res.text() };
}
async function signup(email) {
  const r = await req('POST', `${AUTH_BASE}/accounts:signUp?key=${KEY}`, { email, password: 'Teste12345!', returnSecureToken: true });
  const j = JSON.parse(r.text); if (!j.idToken) throw new Error(j.error?.message || 'signup falhou');
  return { uid: j.localId, token: j.idToken };
}
const stamp = Date.now();
const gid = `qa${stamp.toString(36)}`;
const ownerEmail = `qaowner+${stamp}@estudo360.pt`;
const colabEmail = `qacolab+${stamp}@estudo360.pt`;
const owner = await signup(ownerEmail);
const colab = await signup(colabEmail);
const intruder = await signup(`qaintruzo+${stamp}@estudo360.pt`);
const now = Date.now();
const fields = {
  ownerUid: { stringValue: owner.uid }, nome: { stringValue: 'QA Regras' },
  createdAt: { integerValue: String(now) }, updatedAt: { integerValue: String(now) },
  memberUids: { arrayValue: { values: [{ stringValue: owner.uid }] } },
  members: { mapValue: { fields: { [owner.uid]: { mapValue: { fields: { role: { stringValue: 'admin' } } } } } } },
  invites: { arrayValue: { values: [{ mapValue: { fields: { email: { stringValue: colabEmail }, role: { stringValue: 'contabilista' } } } }] } },
  inviteEmails: { arrayValue: { values: [{ stringValue: colabEmail }] } },
  inviteRoles: { mapValue: { fields: { [colabEmail]: { stringValue: 'estagiaria' } } } },
  inviteExpiries: { mapValue: { fields: { [colabEmail]: { integerValue: String(now + 7 * 86400000) } } } },
};
ok((await req('POST', `${BASE}/gabinetes?documentId=${gid}`, { fields }, owner.token)).status === 200, 'dono cria gabinete');
const patch = (body, mask, token) => req('PATCH', `${BASE}/gabinetes/${gid}?${mask}`, { fields: body }, token);
const decline = {
  inviteEmails: { arrayValue: { values: [] } },
  inviteRoles: { mapValue: { fields: {} } },
  inviteExpiries: { mapValue: { fields: {} } },
  updatedAt: { integerValue: String(now + 1) },
};
ok((await patch(decline, 'updateMask.fieldPaths=inviteEmails&updateMask.fieldPaths=inviteRoles&updateMask.fieldPaths=inviteExpiries&updateMask.fieldPaths=updatedAt', colab.token)).status === 200, 'convidado recusa convite');
// O dono volta a convidar para testar a auto-adesão.
const reinvite = {
  inviteEmails: { arrayValue: { values: [{ stringValue: colabEmail }] } },
  invites: fields.invites,
  inviteRoles: fields.inviteRoles,
  inviteExpiries: fields.inviteExpiries,
  updatedAt: { integerValue: String(now + 2) },
};
ok((await patch(reinvite, 'updateMask.fieldPaths=inviteEmails&updateMask.fieldPaths=invites&updateMask.fieldPaths=inviteRoles&updateMask.fieldPaths=inviteExpiries&updateMask.fieldPaths=updatedAt', owner.token)).status === 200, 'dono volta a convidar');
const joinBase = {
  memberUids: { arrayValue: { values: [{ stringValue: owner.uid }, { stringValue: colab.uid }] } },
  members: { mapValue: { fields: { [owner.uid]: fields.members.mapValue.fields[owner.uid], [colab.uid]: { mapValue: { fields: { role: { stringValue: 'estagiaria' } } } } } } },
  inviteEmails: { arrayValue: { values: [] } },
  inviteRoles: { mapValue: { fields: {} } },
  inviteExpiries: { mapValue: { fields: {} } },
  updatedAt: { integerValue: String(now + 3) },
};
const joinMask = 'updateMask.fieldPaths=memberUids&updateMask.fieldPaths=members&updateMask.fieldPaths=inviteEmails&updateMask.fieldPaths=inviteRoles&updateMask.fieldPaths=inviteExpiries&updateMask.fieldPaths=updatedAt';
const promotedJoin = {
  ...joinBase,
  members: { mapValue: { fields: { [owner.uid]: fields.members.mapValue.fields[owner.uid], [colab.uid]: { mapValue: { fields: { role: { stringValue: 'contabilista' } } } } } } },
};
ok((await patch(promotedJoin, joinMask, colab.token)).status === 403, 'convidado não pode trocar o cargo do convite');
ok((await patch(joinBase, joinMask, colab.token)).status === 200, 'convidado aceita com o cargo atribuído');
const badJoin = { ...decline, memberUids: { arrayValue: { values: [{ stringValue: owner.uid }, { stringValue: intruder.uid }] } } };
ok((await patch(badJoin, 'updateMask.fieldPaths=inviteEmails&updateMask.fieldPaths=updatedAt&updateMask.fieldPaths=memberUids', intruder.token)).status === 403, 'intruso sem convite não entra');
const escalate = { members: { mapValue: { fields: { [colab.uid]: { mapValue: { fields: { role: { stringValue: 'admin' } } } } } } } };
ok((await patch(escalate, 'updateMask.fieldPaths=members', colab.token)).status === 403, 'colaborador não se promove a admin');
const chunk = {
  list: { arrayValue: { values: [] } },
  updatedAt: { integerValue: String(now + 4) },
  chunk: { integerValue: '0' },
};
ok((await req('PATCH', `${BASE}/empresas/${gid}/chunks/0`, { fields: chunk }, colab.token)).status === 200, 'membro lê/escreve a carteira partilhada');
ok((await req('PATCH', `${BASE}/empresas/${gid}/chunks/0`, { fields: chunk }, intruder.token)).status === 403, 'intruso não acede à carteira do gabinete');
const settings = { contabilidadeLda: { integerValue: '123' } };
ok((await req('PATCH', `${BASE}/gabinetes/${gid}/settings/pricing`, { fields: settings }, owner.token)).status === 200, 'dono atualiza preços do gabinete');
ok((await req('PATCH', `${BASE}/gabinetes/${gid}/settings/pricing`, { fields: settings }, colab.token)).status === 403, 'estagiária não altera preços do gabinete');
await req('DELETE', `${BASE}/gabinetes/${gid}`, null, owner.token);
console.log(fails ? `\nFAIL — ${fails} falha(s)` : '\nPASS — regras de convites/roles OK');
process.exit(fails ? 1 : 0);
