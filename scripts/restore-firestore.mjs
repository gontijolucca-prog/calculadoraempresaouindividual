#!/usr/bin/env node
/**
 * Restauro do backup do Firestore produzido por scripts/backup-firestore.mjs.
 *
 * Por omissão NÃO escreve nada: mostra o que faria.
 *   node scripts/restore-firestore.mjs backup.enc            # simulação
 *   node scripts/restore-firestore.mjs backup.enc --apply    # escreve
 *
 * Requer FIREBASE_SERVICE_ACCOUNT_JSON e BACKUP_KEY (os mesmos do backup).
 * O restauro repõe documento a documento (PATCH sem máscara = substitui os
 * campos) e não apaga documentos que existam a mais.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import zlib from 'node:zlib';

const file = process.argv[2];
const apply = process.argv.includes('--apply');
if (!file) {
  console.error('Uso: node scripts/restore-firestore.mjs <ficheiro.enc> [--apply]');
  process.exit(1);
}
const KEY = String(process.env.BACKUP_KEY || '');
if (KEY.length < 32) {
  console.error('BACKUP_KEY ausente ou curta.');
  process.exit(1);
}
const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
const sa = JSON.parse(raw || '{}');
if (!sa.client_email || !sa.private_key) {
  console.error('FIREBASE_SERVICE_ACCOUNT_JSON ausente ou inválido.');
  process.exit(1);
}

const blob = fs.readFileSync(file);
if (!blob.subarray(0, 6).equals(Buffer.from('E360B1'))) {
  console.error('Ficheiro não é um backup do Estudo360.');
  process.exit(1);
}
const salt = blob.subarray(6, 22);
const iv = blob.subarray(22, 34);
const tag = blob.subarray(34, 50);
const body = blob.subarray(50);
const key = crypto.scryptSync(KEY, salt, 32);
const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(tag);
const compressed = Buffer.concat([decipher.update(body), decipher.final()]);
const payload = JSON.parse(zlib.gunzipSync(compressed).toString('utf8'));
console.log(`Backup de ${payload.exportedAt} · ${payload.count} documentos · projeto ${payload.project}`);
if (!apply) {
  console.log('Simulação. Nada foi escrito. Repetir com --apply para repor.');
  process.exit(0);
}

const b64url = (input) => Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
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
const assertion = `${header}.${claims}.${b64url(signer.sign(String(sa.private_key).replace(/\\n/g, '\n')))}`;
const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
});
if (!tokenRes.ok) throw new Error(`token ${tokenRes.status}`);
const { access_token: token } = await tokenRes.json();

let done = 0;
let failed = 0;
for (const doc of payload.documents) {
  const name = String(doc.name || '');
  const path = name.split('/documents/')[1];
  if (!path) continue;
  const url = `https://firestore.googleapis.com/v1/${name}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: doc.fields || {} }),
  });
  if (res.ok) done++;
  else {
    failed++;
    if (failed < 5) console.error(`falhou ${path}: ${res.status}`);
  }
}
console.log(`Restaurados ${done} documentos · ${failed} falhas (não apaga os que existam a mais).`);
process.exit(failed ? 1 : 0);
