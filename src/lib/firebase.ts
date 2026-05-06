import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBxc-JFWwxlauY6U4A3IKTxxd5UFiDzjhI",
  authDomain: "recofatima-ferramenta.firebaseapp.com",
  projectId: "recofatima-ferramenta",
  storageBucket: "recofatima-ferramenta.firebasestorage.app",
  messagingSenderId: "561979864363",
  appId: "1:561979864363:web:4577c584f4802261c0016e",
  measurementId: "G-D1BG1SJSL7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
