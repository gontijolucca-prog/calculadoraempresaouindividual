// Proxy Gamma — o browser fala com /api/gama (mesma origem) e o servidor
// reencaminha para public-api.gamma.app (v0.2). Porquê: a API do Gamma não
// devolve cabeçalhos CORS (o fetch direto do browser falha) e o CSP do app
// só permite connect-src 'self'. A chave do gabinete vem no corpo do pedido
// e só é usada para autenticar no Gamma — não fica guardada no servidor.
//
// Ações (POST JSON):
//  - { action:'create', inputText, key }   → cria a geração (deck), devolve { id }
//  - { action:'status', generationId, key } → devolve o estado (status, gammaUrl, …)

const ALLOWED_HOST_SUFFIXES = [
  'estudo360.pt',
  'estudo360.pages.dev',
  'localhost',
  '127.0.0.1',
];

const GAMMA_BASE = 'https://public-api.gamma.app/v0.2/generations';
const MAX_INPUT_CHARS = 60_000;
const RL_WINDOW_MS = 60_000;
// Limites por ação: o poll de uma geração faz ~20 pedidos/min (1 a cada 3s);
// o limite do status tem de aguentar várias gerações em paralelo no mesmo IP,
// por isso é bem mais alto do que o do create.
const RL_MAX_CREATE = 30;
const RL_MAX_STATUS = 150;
const rlHits = new Map<string, number[]>();

function hostAllowed(value: string | null): boolean {
  if (!value) return false;
  try {
    const host = new URL(value).hostname;
    return ALLOWED_HOST_SUFFIXES.some((s) => host === s || host.endsWith('.' + s));
  } catch { return false; }
}

function corsHeaders(origin: string | null): Record<string, string> {
  const ok = hostAllowed(origin);
  return {
    'Access-Control-Allow-Origin': ok && origin ? origin : 'https://estudo360.pt',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

function rateLimited(key: string, max: number): boolean {
  const now = Date.now();
  const arr = (rlHits.get(key) ?? []).filter((t) => now - t < RL_WINDOW_MS);
  arr.push(now);
  rlHits.set(key, arr);
  if (rlHits.size > 5000) rlHits.clear();
  return arr.length > max;
}

function gammaHeaders(key: string): Record<string, string> {
  return { 'X-API-KEY': key, Authorization: `Bearer ${key}` };
}

async function relay(r: Response, origin: string | null): Promise<Response> {
  const text = await r.text();
  return new Response(text, {
    status: r.status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export const onRequestOptions = async ({ request }: { request: Request }) =>
  new Response(null, { status: 204, headers: corsHeaders(request.headers.get('Origin')) });

export const onRequestPost = async (ctx: { request: Request }) => {
  const { request } = ctx;
  const origin = request.headers.get('Origin');
  const referer = request.headers.get('Referer');
  if (!hostAllowed(origin) && !hostAllowed(referer)) {
    return json({ error: 'origem_nao_autorizada' }, 403, origin);
  }
  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'json_invalido' }, 400, origin); }

  const action = String(body.action || '').trim();
  if (!['create', 'status'].includes(action)) return json({ error: 'acao_invalida' }, 400, origin);

  const ip = request.headers.get('CF-Connecting-IP') || 'desconhecido';
  if (rateLimited(`${ip}:${action}`, action === 'create' ? RL_MAX_CREATE : RL_MAX_STATUS)) {
    return json({ error: 'rate_limit' }, 429, origin);
  }

  const key = String(body.key || '').trim();
  if (!key) return json({ error: 'key_em_falta' }, 400, origin);

  if (action === 'create') {
    const inputText = String(body.inputText || '');
    if (!inputText.trim()) return json({ error: 'input_em_falta' }, 400, origin);
    if (inputText.length > MAX_INPUT_CHARS) return json({ error: 'input_demasiado_longo' }, 400, origin);
    let r: Response;
    try {
      r = await fetch(GAMMA_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...gammaHeaders(key) },
        body: JSON.stringify({
          inputText,
          textMode: 'generate',
          format: 'presentation',
          cardOptions: { dimensions: '16x9' },
          sharingOptions: { workspaceAccess: 'view' },
        }),
      });
    } catch (e: any) {
      return json({ error: 'rede', detail: String(e?.message || e) }, 502, origin);
    }
    return relay(r, origin);
  }

  const generationId = String(body.generationId || '').trim();
  if (!generationId) return json({ error: 'generation_em_falta' }, 400, origin);
  let r: Response;
  try {
    r = await fetch(`${GAMMA_BASE}/${encodeURIComponent(generationId)}`, { headers: gammaHeaders(key) });
  } catch (e: any) {
    return json({ error: 'rede', detail: String(e?.message || e) }, 502, origin);
  }
  return relay(r, origin);
};
