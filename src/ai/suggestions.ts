// Memória de sugestões do AI Contabilista.
// Quando um utilizador pede uma melhoria ao Estudo 360, o bot regista-a aqui.
// Persiste em Firestore (coleção `ai_suggestions`) para a equipa de dev ler na
// vista de administração. Se a escrita na cloud falhar (ex.: regras ainda não
// publicadas, ou offline), guarda em fila no localStorage — nada se perde.

import {
  collection, addDoc, getDocs, query, orderBy, limit, doc, updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Suggestion {
  id?: string;
  title: string;
  detail: string;
  area?: string;
  autor?: string;        // quem sugeriu (se conhecido)
  vista?: string;        // que vista estava aberta
  createdAt: number;
  status: 'novo' | 'visto' | 'feito';
  origem: 'cloud' | 'local';
}

const LOCAL_KEY = 'estudo360:ai_suggestions_queue';

function loadLocalQueue(): Suggestion[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as Suggestion[]) : [];
  } catch {
    return [];
  }
}

function saveLocalQueue(list: Suggestion[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(-200)));
  } catch {
    /* storage cheio — ignora */
  }
}

/** Regista uma sugestão. Devolve true se foi para a cloud, false se ficou local. */
export async function registerSuggestion(input: {
  title: string; detail: string; area?: string; autor?: string; vista?: string;
}): Promise<{ cloud: boolean }> {
  const base: Suggestion = {
    title: input.title.slice(0, 200),
    detail: input.detail.slice(0, 1500),
    area: input.area?.slice(0, 120),
    autor: input.autor?.slice(0, 100),
    vista: input.vista?.slice(0, 60),
    createdAt: Date.now(),
    status: 'novo',
    origem: 'cloud',
  };

  try {
    // Sem campos `undefined` (o Firestore rejeita-os).
    const doc: Record<string, unknown> = {
      title: base.title, detail: base.detail, createdAt: base.createdAt, status: base.status,
    };
    if (base.area) doc.area = base.area;
    if (base.autor) doc.autor = base.autor;
    if (base.vista) doc.vista = base.vista;
    await addDoc(collection(db, 'ai_suggestions'), doc);
    return { cloud: true };
  } catch {
    // Fila local — a vista admin mostra-a à mesma.
    const q = loadLocalQueue();
    q.push({ ...base, origem: 'local' });
    saveLocalQueue(q);
    return { cloud: false };
  }
}

/** Lê as sugestões (cloud + fila local) para a vista de administração. */
export async function listSuggestions(): Promise<Suggestion[]> {
  const local = loadLocalQueue();
  let cloud: Suggestion[] = [];
  try {
    const snap = await getDocs(
      query(collection(db, 'ai_suggestions'), orderBy('createdAt', 'desc'), limit(200)),
    );
    cloud = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        title: data.title ?? '',
        detail: data.detail ?? '',
        area: data.area,
        autor: data.autor,
        vista: data.vista,
        createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
        status: (data.status as Suggestion['status']) ?? 'novo',
        origem: 'cloud' as const,
      };
    });
  } catch {
    cloud = [];
  }
  return [...cloud, ...local].sort((a, b) => b.createdAt - a.createdAt);
}

/** Atualiza o estado de uma sugestão na cloud (novo → visto → feito). */
export async function setSuggestionStatus(id: string, status: Suggestion['status']): Promise<boolean> {
  try {
    await updateDoc(doc(db, 'ai_suggestions', id), { status });
    return true;
  } catch {
    return false;
  }
}
