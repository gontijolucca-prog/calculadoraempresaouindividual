/**
 * Recolha mínima de erros do cliente.
 * Sem terceiros: grava em `erros` (serviço), com limite por IP.
 * Nunca recebe dados de clientes: só mensagem, stack, URL e user-agent.
 */
import { patchFirestoreDoc } from '../_firebaseAdmin';

type Env = Record<string, unknown>;
const ORIGENS = new Set(['https://estudo360.pt', 'https://www.estudo360.pt', 'http://localhost:3000', 'http://127.0.0.1:3000']);
const HITS = new Map<string, number[]>();

function limitado(ip: string): boolean {
  const agora = Date.now();
  const janela = (HITS.get(ip) || []).filter((t) => agora - t < 10 * 60 * 1000);
  janela.push(agora);
  HITS.set(ip, janela);
  if (HITS.size > 500) HITS.clear();
  return janela.length > 20;
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  const origin = request.headers.get('Origin');
  if (!ORIGENS.has(String(origin))) return new Response(null, { status: 403 });
  const ip = request.headers.get('CF-Connecting-IP') || 'sem-ip';
  if (limitado(ip)) return new Response(null, { status: 429 });

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return new Response(null, { status: 400 }); }

  const corta = (v: unknown, n: number) => String(v ?? '').slice(0, n);
  const msg = corta(body.msg, 300);
  if (!msg) return new Response(null, { status: 400 });

  const id = `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await patchFirestoreDoc(env, `erros/${id}`, {
    msg,
    stack: corta(body.stack, 2000),
    url: corta(body.url, 300),
    ua: corta(request.headers.get('User-Agent'), 300),
    build: corta(body.build, 20),
    createdAt: Date.now(),
  }).catch(() => {});
  return new Response(null, { status: 204 });
}
