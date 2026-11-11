/**
 * Notas da reunião — escrita sem conta.
 *
 * O dono do gabinete recebe um link com uma chave (`?k=…`). A chave não é
 * guardada em lado nenhum: o servidor só conhece o SHA-256 dela, em
 * `notasPainel/reuniao`. Sem chave, a página é só de leitura.
 *
 * Cada gravação cria um documento novo em `updates` (append-only): nenhuma
 * versão anterior pode ser alterada ou apagada, nem pelo próprio servidor.
 */
import { firestoreList, getFirestoreDoc, patchFirestoreDoc } from '../_firebaseAdmin';

type Env = Record<string, unknown>;

const ORIGENS = new Set([
  'https://estudo360.pt',
  'https://www.estudo360.pt',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3011',
  'http://localhost:3012',
  'http://127.0.0.1:3011',
  'http://127.0.0.1:3012',
]);

/** 64 hex chars. Rejeita cedo para não gastar hashing com lixo. */
export function chaveValida(chave: unknown): chave is string {
  return typeof chave === 'string' && /^[a-f0-9]{32,64}$/i.test(chave);
}

export async function sha256Hex(texto: string): Promise<string> {
  const data = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparação em tempo constante para não revelar o prefixo correto. */
export function iguaisSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    },
  });
}

export async function onRequestOptions({ request }: { request: Request }): Promise<Response> {
  const origin = request.headers.get('Origin');
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': ORIGENS.has(String(origin)) ? String(origin) : 'https://estudo360.pt',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/** Limite simples por instância: trava rajadas sem bloquear o uso normal. */
const GRAVACOES = new Map<string, number[]>();
function limiteDeEscrita(ip: string): boolean {
  const agora = Date.now();
  const janela = (GRAVACOES.get(ip) || []).filter((t) => agora - t < 60 * 60 * 1000);
  janela.push(agora);
  GRAVACOES.set(ip, janela);
  if (GRAVACOES.size > 500) GRAVACOES.clear();
  return janela.length > 40;
}

export async function onRequestGet({ request, env }: { request: Request; env: Env }): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const permitido = ORIGENS.has(String(origin)) ? String(origin) : null;
  const marcador = url.searchParams.get('m') || '';

  if (!/^[a-z0-9:_-]{4,64}$/.test(marcador)) return json({ erro: 'marcador_invalido' }, 400, permitido);

  try {
    // Leitura aberta a quem tem a página (o link é o segredo). A escrita
    // continua a exigir a chave; esta rota só devolve texto de notas.
    const docs = await firestoreList(env, 'updates');
    const entries = docs
      .filter((doc) => doc.data.autor === marcador && typeof doc.data.text === 'string' && String(doc.data.text).trim())
      .map((doc) => ({
        id: doc.path.split('/').pop() || '',
        text: String(doc.data.text),
        createdAt: Number(doc.data.createdAt) || 0,
      }))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20);
    return json({ ok: true, entries }, 200, permitido);
  } catch (e) {
    return json({ erro: 'servico_indisponivel', detalhe: e instanceof Error ? e.message : String(e) }, 502, permitido);
  }
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  const origin = request.headers.get('Origin');
  const permitido = ORIGENS.has(String(origin)) ? String(origin) : null;

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return json({ erro: 'json_invalido' }, 400, permitido); }

  const texto = typeof body.texto === 'string' ? body.texto.trim() : '';
  const marcador = typeof body.marcador === 'string' ? body.marcador : 'proximos:semana-03-11';

  if (!texto) return json({ erro: 'texto_vazio' }, 400, permitido);
  if (texto.length > 4000) return json({ erro: 'texto_longo' }, 400, permitido);
  if (!/^[a-z0-9:_-]{4,64}$/.test(marcador)) return json({ erro: 'marcador_invalido' }, 400, permitido);
  // Escreve quem tem a página: o link é o segredo. Cada gravação é uma versão
  // nova (append-only), por isso nada se perde, mesmo com escrita aberta.
  if (limiteDeEscrita(request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'sem-ip')) {
    return json({ erro: 'demasiadas_gravacoes' }, 429, permitido);
  }

  try {
    const id = `nota_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    await patchFirestoreDoc(env, `updates/${id}`, {
      text: texto,
      atualizado: false,
      aprovado: false,
      createdAt: Date.now(),
      autor: marcador,
    });
    return json({ ok: true, id }, 200, permitido);
  } catch (e) {
    return json({ erro: 'servico_indisponivel', detalhe: e instanceof Error ? e.message : String(e) }, 502, permitido);
  }
}
