import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string, remember?: boolean) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  reloadUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}


/** Continue URL do email: volta ao site certo depois de confirmar. */
function acoesEmail(): { url: string; handleCodeInApp: boolean } {
  const base = typeof window !== 'undefined' && import.meta.env.DEV ? window.location.origin : 'https://estudo360.pt';
  return { url: `${base}/?verificado=1`, handleCodeInApp: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Registo de acessos (fire-and-forget: nunca bloqueia o login se falhar).
  // Cada utilizador só cria eventos próprios; só admin@estudo360.pt os lê.
  const logAuthEvent = async (u: User, type: 'signup' | 'login') => {
    try {
      await addDoc(collection(db, 'auth_events'), {
        uid: u.uid,
        email: u.email || '',
        type,
        at: Date.now(),
        verified: !!u.emailVerified,
        app: 'estudo360',
      });
    } catch { /* offline ou rules antigas — login continua */ }
  };

  const signInWithEmail = async (email: string, password: string, remember = true) => {
    // "Lembrar-me": sessão persistente (sobrevive a fechar o browser) vs sessão só desta janela.
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (cred.user) void logAuthEvent(cred.user, 'login');
  };

  const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
    auth.languageCode = 'pt-PT';
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName?.trim() && cred.user) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }
    if (cred.user) {
      void logAuthEvent(cred.user, 'signup');
    }
  };

  const logout = async () => {
    try { const { setCofrePassphrase } = await import('./cofreCrypto'); setCofrePassphrase(null); } catch {}
    try { const { clearGabineteMemoryCache } = await import('./gabinetes'); clearGabineteMemoryCache(); } catch {}
    try {
      // Limpa caches locais por prefixo — evita leak entre contas no mesmo browser
      const prefixes = [
        'estudo360:v1:gabinete:',
        'estudo360:v1:empresas',
        'estudo360:v1:currentEmpresaId',
        'estudo360:v1:syncOutbox',
        'estudo360:v1:auditQueue',
        'estudo360:v1:officeSettings',
        'estudo360:v1:honorariosConfig',
        'recofa_pricing',
      ];
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && prefixes.some(p => k.startsWith(p))) toRemove.push(k);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
      // Limpa Auth + cache persistente do Firestore entre contas.
      try {
        const dbs = await indexedDB.databases?.().catch(() => []);
        const alvos = (dbs || [])
          .map((d) => d.name || '')
          .filter((n) => n === 'firebaseLocalStorageDb' || n.startsWith('firestore/'));
        await Promise.all(alvos.map((name) => new Promise<void>((resolve) => {
          const req = indexedDB.deleteDatabase(name);
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
          req.onblocked = () => resolve();
        })));
      } catch {}
    } catch {}
    await signOut(auth);
  };

  // Verificação de email removida do produto: mantém-se a função para
  // compatibilidade, mas não envia nada nem bloqueia ninguém.
  const sendVerificationEmail = async () => { /* sem verificação */ };

  const resetPassword = async (email: string) => {
    auth.languageCode = 'pt-PT';
    await sendPasswordResetEmail(auth, email, acoesEmail());
  };

  const reloadUser = async () => {
    if (auth.currentUser) await auth.currentUser.reload();
    // Força refresh do estado via onAuthStateChanged; atualiza user localmente
    setUser(auth.currentUser ? { ...auth.currentUser } as User : null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithEmail, signUpWithEmail, logout, sendVerificationEmail, resetPassword, reloadUser }}>
      {children}
    </AuthContext.Provider>
  );
}
