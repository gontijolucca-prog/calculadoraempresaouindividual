import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager, enableIndexedDbPersistence, getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// ⚠ SECURITY: Move to env vars in production.
// These are Firebase Web API keys (not secrets), but should still be
// restricted to specific domains in Firebase Console.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBxc-JFWwxlauY6U4A3IKTxxd5UFiDzjhI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "recofatima-ferramenta.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "recofatima-ferramenta",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "recofatima-ferramenta.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "561979864363",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:561979864363:web:4577c584f4802261c0016e",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-D1BG1SJSL7"
};

const app = initializeApp(firebaseConfig);

// Firestore com cache persistente offline-first (IndexedDB) — torna a app
// "reliable memory": tudo fica guardado localmente e sincroniza live quando há rede.
// Usa persistentLocalCache (SDK v12) com fallback para enableIndexedDbPersistence.
let _db;
try {
  _db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentSingleTabManager(undefined) }),
  });
} catch {
  // Já inicializado (HMR) ou ambiente sem IndexedDB
  _db = getFirestore(app);
  try { enableIndexedDbPersistence(_db).catch(() => {}); } catch {}
}

export const db = _db;
export const auth = getAuth(app);

// Helper para UI: estado da ligação live
export function onFirestoreError(cb: (err: unknown) => void) {
  if (typeof window !== 'undefined') {
    window.addEventListener('estudo360:cloud-sync', ((e: CustomEvent) => cb(e.detail)) as EventListener);
    return () => window.removeEventListener('estudo360:cloud-sync', ((e: CustomEvent) => cb(e.detail)) as EventListener);
  }
  return () => {};
}
