import {
  AccessError,
  corsHeaders,
  jsonResponse,
  loginTecnico,
  origemPermitida,
} from '../_equipaAccess';
import { hashEmail } from '../_firebaseAdmin';

type PagesFunction = (ctx: { request: Request; env: Record<string, unknown> }) => Promise<Response>;

const RL_WINDOW_MS = 60_000;
const RL_MAX = 12;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((at) => now - at < RL_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > RL_MAX;
}

export const onRequestOptions: PagesFunction = async ({ request }) =>
  new Response(null, { status: 204, headers: corsHeaders(request.headers.get('Origin')) });

export const onRequestPost: PagesFunction = async ({ request, env }) => {
  const origin = request.headers.get('Origin');
  if (!origemPermitida(origin, request.headers.get('Referer'))) {
    return jsonResponse({ erro: 'origem_nao_autorizada' }, 403, origin);
  }
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    body = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return jsonResponse({ erro: 'json_invalido' }, 400, origin);
  }
  const email = String(body.email || '').trim().toLowerCase();
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const emailHash = await hashEmail(email).catch(() => '');
  if (rateLimited(`${ip}:${emailHash}`)) {
    return jsonResponse({ erro: 'demasiadas_tentativas' }, 429, origin);
  }
  try {
    return jsonResponse(await loginTecnico(env, body), 200, origin);
  } catch (error) {
    if (error instanceof AccessError) {
      return jsonResponse({ erro: error.codigo }, error.status, origin);
    }
    const raw = String((error as Error)?.message || error || '');
    if (/FIREBASE_SERVICE_ACCOUNT_JSON|FIREBASE_API_KEY|OAuth Google|Firebase Auth Admin/i.test(raw)) {
      return jsonResponse({ erro: 'servico_acessos_indisponivel' }, 503, origin);
    }
    return jsonResponse({ erro: 'credenciais_invalidas' }, 401, origin);
  }
};
