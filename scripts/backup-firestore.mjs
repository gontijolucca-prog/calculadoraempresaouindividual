#!/usr/bin/env node
/**
 * Cópia de segurança do Firestore — dump completo, comprimido e cifrado.
 *
 * - Lê todas as coleções com a conta de serviço (Firestore REST v1).
 * - Guarda o documento cru (`name` + `fields`), para o restauro ser fiel.
 * - GZIP + AES-256-GCM com uma chave que só existe nos segredos.
 * - O ficheiro resultante pode ir para um artefacto do GitHub sem expor dados
 *   (o repositório é público; o conteúdo é ilegível sem a chave).
 *
 * Variáveis:
 *   FIREBASE_SERVICE_ACCOUNT_JSON  JSON (ou base64 do JSON) da conta de serviço
 *   BACKUP_KEY                     frase-chave do backup (>= 32 caracteres)
 *   BACKUP_OUT                     caminho de saída (por omissão ./backup.enc)
 *
 * Uso: node scripts/backup-firestore.mjs
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

const OUT = process.env.BACKUP_OUT || './firestore-backup.json.gz.enc';
const KEY = String(process.env.BACKUP_KEY || '');
if (KEY.length < 32) {
  console.error('BACKUP_KEY ausente ou curta (mínimo 32 caracteres).');
  process.exit(1);
}

const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
if (!raw) {
  console.error('FIREBASE_SERVICE_ACCOUNT_JSON ausente.');
  process.exit(1);
}
const sa = (() => {
  try { return JSON.parse(raw); } catch {}
  try { return JSON.parse(Buffer.from(raw, 'base64').toString('utf8')); } catch {}
  console.error('FIREBASE_SERVICE_ACCOUNT_JSON não é JSON nem base64 de JSON.');
  process.exit(1);
})();

const b64url = (input) => Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = b64url(signer.sign(String(sa.private_key).replace(/\\n/g, '\n')));
  const assertion = `${header}.${claims}.${signature}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`token ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.access_token;
}

async function dump(token) {
  const project = sa.project_id;
  const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
  const docs = [];
  let pageToken = '';
  do {
    const url = new URL(base);
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`list ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    for (const doc of data.documents || []) docs.push(doc);
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return docs;
}

function encrypt(text) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(KEY, salt, 32);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(text), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from('E360B1'), salt, iv, tag, body]);
}

const token = await accessToken();
const docs = await dump(token);
if (!docs.length) {
  console.error('Sem documentos — abortar para não guardar um backup vazio.');
  process.exit(2);
}
const payload = JSON.stringify({ project: sa.project_id, exportedAt: new Date().toISOString(), count: docs.length, documents: docs });
const compressed = (await import('node:zlib')).gzipSync(Buffer.from(payload), { level: 9 });
fs.writeFileSync(OUT, encrypt(compressed));
console.log(`OK ${docs.length} documentos · ${(compressed.length / 1024).toFixed(0)} KB comprimidos · ${OUT}`);
