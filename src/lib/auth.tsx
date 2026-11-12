import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  type User,
} from 'firebase/auth';
import { auth, db } from './firebase';
import { collection, addDoc } from 'firebase/firestore';
import { setActiveGabineteId } from './gabinetes';
import {
  alterarPasswordTecnica,
  claimsTecnicas,
  lerPerfilTecnico,
  loginTecnico,
  subscreverPerfilTecnico,
  type EmployeeAccessProfile,
} from './equipaAcesso';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  accessLoading: boolean;
  employeeProfile: EmployeeAccessProfile | null;
  accountEmail: string;
  signInWithEmail: (email: string, password: string, remember?: boolean) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  reloadUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}


/** Continue URL do email: volta ao site certo depois de confirmar ou repor. */
function acoesEmail(motivo: 'verificado' | 'recuperado'): { url: string; handleCodeInApp: boolean } {
  const base = typeof window !== 'undefined' && import.meta.env.DEV ? window.location.origin : 'https://estudo360.pt';
  return { url: `${base}/?email=${motivo}`, handleCodeInApp: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessLoading, setAccessLoading] = useState(true);
  const [employeeProfile, setEmployeeProfile] = useState<EmployeeAccessProfile | null>(null);
  const [accountEmailOverride, setAccountEmailOverride] = useState('');
  const profileUnsubRef = useRef<(() => void) | null>(null);
  const loginEmailHintRef = useRef('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      profileUnsubRef.current?.();
      profileUnsubRef.current = null;
      setUser(u);
      setEmployeeProfile(null);
      if (!u) {
        setAccountEmailOverride('');
        setLoading(false);
        setAccessLoading(false);
        return;
      }

      setAccessLoading(true);
      try {
        const token = await u.getIdTokenResult();
        const claims = claimsTecnicas(token.claims as Record<string, unknown>);
        if (claims) {
          setActiveEmployeeGabinete(claims.gabineteId);
          const perfil = await lerPerfilTecnico(u.uid).catch(() => null);
          setEmployeeProfile(perfil || {
            credentialId: claims.credentialId,
            gabineteId: claims.gabineteId,
            nome: u.displayName || 'Colaborador',
            email: loginEmailHintRef.current,
            role: '',
            status: 'active',
            createdAt: 0,
            updatedAt: 0,
          });
          profileUnsubRef.current = subscreverPerfilTecnico(
            u.uid,
            (novo) => {
              if (!novo) return;
              setEmployeeProfile(novo);
              if (novo.gabineteId) setActiveEmployeeGabinete(novo.gabineteId);
              if (novo.email) setAccountEmailOverride(novo.email);
            },
            () => {},
          );
        } else {
          const email = String(u.email || '');
          setAccountEmailOverride(email);
        }
      } finally {
        setLoading(false);
        setAccessLoading(false);
      }
    });
    return () => {
      profileUnsubRef.current?.();
      unsubscribe();
    };
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
        app: 'estudo360',
      });
    } catch { /* offline ou rules antigas — login continua */ }
  };

  const signInWithEmail = async (email: string, password: string, remember = true) => {
    // "Lembrar-me": sessão persistente (sobrevive a fechar o browser) vs sessão só desta janela.
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    loginEmailHintRef.current = email.trim().toLowerCase();
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      setAccountEmailOverride(email.trim().toLowerCase());
      if (cred.user) void logAuthEvent(cred.user, 'login');
    } catch (error) {
      const code = String((error as { code?: string })?.code || '');
      // `auth/invalid-email` acontece quando o utilizador não é um email: é o
      // caso normal dos logins criados pelo gabinete, que seguem para a API.
      const podeTentarAcessoGabinete = [
        'auth/invalid-credential',
        'auth/invalid-email',
        'auth/user-not-found',
        'auth/wrong-password',
      ].includes(code);
      if (!podeTentarAcessoGabinete) throw error;
      const tecnico = await loginTecnico(email.trim().toLowerCase(), password);
      setAccountEmailOverride(email.trim().toLowerCase());
      await signInWithCustomToken(auth, tecnico.token);
    }
  };

  const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
    auth.languageCode = 'pt-PT';
    loginEmailHintRef.current = email.trim().toLowerCase();
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName?.trim() && cred.user) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }
    if (cred.user) {
      void logAuthEvent(cred.user, 'signup');
      // Email de confirmação. Falha aqui não pode abortar o registo: o aviso
      // dentro da app permite reenviar.
      await sendEmailVerification(cred.user, acoesEmail('verificado')).catch(() => {});
    }
  };

  const logout = async () => {
    profileUnsubRef.current?.();
    profileUnsubRef.current = null;
    loginEmailHintRef.current = '';
    setEmployeeProfile(null);
    setAccountEmailOverride('');
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

  const resetPassword = async (email: string) => {
    auth.languageCode = 'pt-PT';
    try {
      await sendPasswordResetEmail(auth, email, acoesEmail('recuperado'));
    } catch (error) {
      const code = String((error as { code?: string })?.code || '');
      // Sem proteção de enumeração no projeto, um email desconhecido dá
      // user-not-found. A UI mostra sempre a mesma mensagem neutra — não
      // revelar se a conta existe.
      if (code === 'auth/user-not-found') return;
      throw error;
    }
  };

  /** Reenvia o email de confirmação da conta atual (aviso dentro da app). */
  const resendVerification = async () => {
    const u = auth.currentUser;
    if (!u) throw new Error('Sessão inválida.');
    if (!u.email) throw new Error('Esta conta não usa email — a password é reposta pelo gabinete.');
    if (u.emailVerified) return;
    auth.languageCode = 'pt-PT';
    await sendEmailVerification(u, acoesEmail('verificado'));
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!auth.currentUser) throw new Error('Sessão inválida.');
    if (employeeProfile) {
      await alterarPasswordTecnica(currentPassword, newPassword);
      return;
    }
    const email = auth.currentUser.email;
    if (!email) throw new Error('A conta não tem email associado.');
    const credential = EmailAuthProvider.credential(email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);
  };

  const reloadUser = async () => {
    if (auth.currentUser) await auth.currentUser.reload();
    // Força refresh do estado via onAuthStateChanged; atualiza user localmente
    setUser(auth.currentUser ? { ...auth.currentUser } as User : null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      accessLoading,
      employeeProfile,
      accountEmail: employeeProfile?.email || accountEmailOverride || user?.email || '',
      signInWithEmail,
      signUpWithEmail,
      logout,
      resetPassword,
      resendVerification,
      changePassword,
      reloadUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

function setActiveEmployeeGabinete(gabineteId: string) {
  try {
    setActiveGabineteId(gabineteId);
  } catch {
    // A vista volta a receber o gabinete pelas claims quando o storage falhar.
  }
}
