import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

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
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
