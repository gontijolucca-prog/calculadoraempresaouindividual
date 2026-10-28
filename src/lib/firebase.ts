import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager, enableIndexedDbPersistence, getFirestore } from 'firebase/firestore';
import { initializeAuth, getAuth, connectAuthEmulator, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';

// ⚠ SECURITY: Move to env vars in production.
// These are Firebase Web API keys (not secrets), but should still be
// restricted to specific domains in Firebase Console.
const firebaseConfig = {
  apiKey: (import.meta as any)?.env?.VITE_FIREBASE_API_KEY || "AIzaSyChJKEBjPKZcRVF4R_n07UoUB9QO0q_EzM",
  authDomain: (import.meta as any)?.env?.VITE_FIREBASE_AUTH_DOMAIN || "estudo360-app.firebaseapp.com",
  projectId: (import.meta as any)?.env?.VITE_FIREBASE_PROJECT_ID || "estudo360-app",
  storageBucket: (import.meta as any)?.env?.VITE_FIREBASE_STORAGE_BUCKET || "estudo360-app.firebasestorage.app",
  messagingSenderId: (import.meta as any)?.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "297215704391",
  appId: (import.meta as any)?.env?.VITE_FIREBASE_APP_ID || "1:297215704391:web:74168b37a27cc99669a062",
  measurementId: (import.meta as any)?.env?.VITE_FIREBASE_MEASUREMENT_ID || ""
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
// Auth preso a browserLocalPersistence (localStorage) — evita o deadlock de
// inicialização multi-aba da persistência por IndexedDB (authStateReady nunca resolve).
let _auth;
try {
  _auth = initializeAuth(app, { persistence: [browserLocalPersistence, browserSessionPersistence] });
} catch {
  _auth = getAuth(app); // HMR/re-init
}
export const auth = _auth;

// Emuladores locais — só em `vite dev` com VITE_FIREBASE_EMULATORS=1 (nunca em builds).
// O curto-circuito por `window` mantém isto seguro em Node (testes) — em runtime
// o Vite dev injeta `import.meta.env` no topo de cada módulo servido.
const EMULADORES_ATIVOS = typeof window !== 'undefined'
  && import.meta.env.DEV
  && import.meta.env.VITE_FIREBASE_EMULATORS === '1';
if (EMULADORES_ATIVOS) {
  try {
    connectFirestoreEmulator(db, '127.0.0.1', 8180);
    connectAuthEmulator(auth, 'http://127.0.0.1:9199', { disableWarnings: true });
    console.info('[firebase] emuladores locais ligados (auth 9199 / firestore 8180)');
  } catch (e) {
    console.warn('[firebase] falha ao ligar emuladores:', e);
  }
}

// Helper para UI: estado da ligação live
export function onFirestoreError(cb: (err: unknown) => void) {
  if (typeof window !== 'undefined') {
    window.addEventListener('estudo360:cloud-sync', ((e: CustomEvent) => cb(e.detail)) as EventListener);
    return () => window.removeEventListener('estudo360:cloud-sync', ((e: CustomEvent) => cb(e.detail)) as EventListener);
  }
  return () => {};
}
