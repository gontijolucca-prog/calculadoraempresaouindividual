// Proxy TOConline — evita CORS e protege o segredo (Basic Auth) no servidor.
//
// O browser fala com /api/toconline (mesma origem). Aqui o servidor
// reencaminha para o TOConline com as credenciais do gabinete.
//
// Porquê: fetch direto do browser para TOConline falha por CORS e expõe
// o client_secret via btoa() no bundle. Assim o segredo só viaja até
// estudo360.pt (TLS) e o TOConline vê o pedido do servidor, sem CORS.
//
// Ações:
//  - {action:'exchange', oauthUrl, clientId, secret, code}
//  - {action:'refresh', oauthUrl, clientId, secret, refreshToken}
//  - {action:'customers', apiUrl, accessToken}

const ALLOWED_HOST_SUFFIXES = [
  'estudo360.pt',
  'estudo360.pages.dev',
  'localhost',
  '127.0.0.1',
];

const RL_WINDOW_MS = 60_000;
const RL_MAX = 30;
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

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (rlHits.get(ip) ?? []).filter((t) => now - t < RL_WINDOW_MS);
  arr.push(now);
  rlHits.set(ip, arr);
  if (rlHits.size > 5000) rlHits.clear();
  return arr.length > RL_MAX;
}

function isAllowedTocUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    return h.includes('toconline');
  } catch { return false; }
}

function basicAuth(clientId: string, secret: string): string {
  return 'Basic ' + btoa(`${clientId}:${secret}`);
}

function mapTocCustomer(it: any) {
  const a = it?.attributes ?? {};
  return {
    nome: String(a.business_name ?? a.name ?? '').trim(),
    nif: String(a.tax_registration_number ?? a.fiscal_id ?? '').replace(/\D/g, ''),
    email: a.email ?? undefined,
    telefone: a.mobile_number ?? a.phone_number ?? undefined,
    morada: a.address_detail ?? undefined,
    localidade: a.city ?? undefined,
    codigoPostal: a.postcode ?? undefined,
  };
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
  const ip = request.headers.get('CF-Connecting-IP') || 'desconhecido';
  if (rateLimited(ip)) return json({ error: 'rate_limit' }, 429, origin);

  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'json_invalido' }, 400, origin); }

  const action = String(body.action || '').trim();
  if (!['exchange', 'refresh', 'customers'].includes(action)) {
    return json({ error: 'acao_invalida' }, 400, origin);
  }

  // ── exchange / refresh ──
  if (action === 'exchange' || action === 'refresh') {
    const oauthUrl = String(body.oauthUrl || '').trim().replace(/\/$/, '');
    const clientId = String(body.clientId || '').trim();
    const secret = String(body.secret || '').trim();
    if (!oauthUrl || !clientId || !secret) return json({ error: 'credenciais_em_falta' }, 400, origin);
    if (!isAllowedTocUrl(oauthUrl)) return json({ error: 'oauth_url_invalido' }, 400, origin);

    const params = new URLSearchParams();
    if (action === 'exchange') {
      const code = String(body.code || '').trim();
      if (!code) return json({ error: 'code_em_falta' }, 400, origin);
      params.set('grant_type', 'authorization_code');
      params.set('code', code);
      params.set('scope', 'commercial');
      if (body.redirectUri) params.set('redirect_uri', String(body.redirectUri));
    } else {
      const rt = String(body.refreshToken || '').trim();
      if (!rt) return json({ error: 'refresh_em_falta' }, 400, origin);
      params.set('grant_type', 'refresh_token');
      params.set('refresh_token', rt);
      params.set('scope', 'commercial');
    }

    let r: Response;
    try {
      r = await fetch(`${oauthUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          Authorization: basicAuth(clientId, secret),
        },
        body: params.toString(),
      });
    } catch (e: any) {
      return json({ error: 'rede', detail: String(e?.message || e) }, 502, origin);
    }
    const text = await r.text();
    let j: any;
    try { j = JSON.parse(text); } catch { j = { raw: text }; }
    if (!r.ok) return json({ error: 'toconline_recusou', status: r.status, detail: j }, r.status, origin);
    if (!j.access_token) return json({ error: 'sem_access_token', detail: j }, 502, origin);
    return json(j, 200, origin);
  }

  // ── customers ──
  if (action === 'customers') {
    const apiUrl = String(body.apiUrl || '').trim().replace(/\/$/, '');
    const accessToken = String(body.accessToken || '').trim();
    if (!apiUrl || !accessToken) return json({ error: 'parametros_em_falta' }, 400, origin);
    if (!isAllowedTocUrl(apiUrl)) return json({ error: 'api_url_invalido' }, 400, origin);

    const out: any[] = [];
    let page = 1;
    for (let guard = 0; guard < 25; guard++) {
      let r: Response;
      try {
        r = await fetch(`${apiUrl}/customers?page[number]=${page}&page[size]=100`, {
          headers: {
            'Content-Type': 'application/vnd.api+json',
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        });
      } catch (e: any) {
        return json({ error: 'rede', detail: String(e?.message || e) }, 502, origin);
      }
      if (r.status === 401) {
        return json({ error: 'nao_autorizado', status: 401 }, 401, origin);
      }
      if (!r.ok) {
        const t = await r.text();
        return json({ error: 'toconline_erro', status: r.status, detail: t.slice(0, 2000) }, r.status, origin);
      }
      let j: any;
      try { j = await r.json(); } catch { j = {}; }
      const items = Array.isArray(j.data) ? j.data : [];
      if (!items.length) break;
      for (const it of items) out.push(mapTocCustomer(it));
      const totalPages = j.meta?.totalPages ?? j.meta?.['total-pages'];
      if (items.length < 100 || (typeof totalPages === 'number' && page >= totalPages)) break;
      page++;
    }
    return json({ data: out }, 200, origin);
  }

  return json({ error: 'nao_implementado' }, 500, origin);
};
