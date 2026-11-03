/**
 * Migração única dos convites antigos para o sistema de credenciais da equipa.
 *
 * Por omissão faz apenas dry-run. Para aplicar:
 *   FIREBASE_SERVICE_ACCOUNT_JSON='...' npm run migrar:equipa -- --apply
 */
import {
  deleteFirestoreDoc,
  firestoreList,
  patchFirestoreDoc,
} from '../functions/_firebaseAdmin';

const env = {
  FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '',
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'estudo360-app',
  FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST || '',
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST || '',
};

if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  console.error('Falta FIREBASE_SERVICE_ACCOUNT_JSON.');
  process.exit(1);
}

const aplicar = process.argv.includes('--apply');
const convites = await firestoreList(env, 'convites');
const gabinetes = await firestoreList(env, 'gabinetes');

console.log(`Modo: ${aplicar ? 'APLICAR' : 'dry-run'}`);
console.log(`Convites antigos encontrados: ${convites.length}`);
console.log(`Gabinetes com metadados a limpar: ${gabinetes.length}`);

if (!aplicar) {
  console.log('Nada foi alterado. Repita com --apply para executar.');
  process.exit(0);
}

let convitesRemovidos = 0;
for (const convite of convites) {
  try {
    await deleteFirestoreDoc(env, convite.path);
    convitesRemovidos++;
  } catch (error) {
    console.error(`Falhou remover ${convite.path}:`, (error as Error).message);
  }
}

let gabinetesLimpos = 0;
for (const gabinete of gabinetes) {
  const id = gabinete.path.split('/').pop();
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
  } catch (error) {
    console.error(`Falhou limpar ${id}:`, (error as Error).message);
  }
}

console.log(`Convites removidos: ${convitesRemovidos}`);
console.log(`Gabinetes limpos: ${gabinetesLimpos}`);
if (convitesRemovidos !== convites.length || gabinetesLimpos !== gabinetes.length) {
  process.exitCode = 1;
}
