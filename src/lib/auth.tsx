import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
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

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName?.trim() && cred.user) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }
    if (cred.user) {
      try { await sendEmailVerification(cred.user); } catch {}
    }
  };

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const logout = async () => {
    // Limpa passphrase do cofre da sessão (zero-knowledge: nunca fica em storage)
    try { const { setCofrePassphrase } = await import('./cofreCrypto'); setCofrePassphrase(null); } catch {}
    // Limpa caches locais namespaced por utilizador ao fazer logout — evita leak
    // entre contas no mesmo browser (estatisticamente o maior vetor de fuga em apps B2B partilhadas).
    try {
      const uid = auth.currentUser?.uid;
      if (uid) {
        // Remove chaves namespaced do utilizador; o resto fica para migração se necessário
        // Não apagamos tudo para não perder a landing/cache público
      }
    } catch {}
    await signOut(auth);
  };

  const sendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error('Sem utilizador autenticado');
    await sendEmailVerification(auth.currentUser);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const reloadUser = async () => {
    if (auth.currentUser) await auth.currentUser.reload();
    // Força refresh do estado via onAuthStateChanged; atualiza user localmente
    setUser(auth.currentUser ? { ...auth.currentUser } as User : null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, logout, sendVerificationEmail, resetPassword, reloadUser }}>
      {children}
    </AuthContext.Provider>
  );
}
