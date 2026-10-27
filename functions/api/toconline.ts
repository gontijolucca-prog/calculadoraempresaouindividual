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

import { urlClientes, mapTocCustomer, explicarErroOauth } from '../_toc';

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
  if (!['connect', 'exchange', 'refresh', 'customers'].includes(action)) {
    return json({ error: 'acao_invalida' }, 400, origin);
  }

  // ── connect: faz o pedido /auth SEM seguir o redirect e lê o `code` do
  // header Location (processo documentado pela TOConline). Não precisa de
  // browser, de login nem de mudar o redirect registado.
  if (action === 'connect') {
    const oauthUrl = String(body.oauthUrl || '').trim().replace(/\/$/, '');
    const clientId = String(body.clientId || '').trim();
    const secret = String(body.secret || '').trim();
    const redirectUri = String(body.redirectUri || 'https://oauth.pstmn.io/v1/callback').trim();
    if (!oauthUrl || !clientId || !secret) return json({ error: 'credenciais_em_falta' }, 400, origin);
    if (!isAllowedTocUrl(oauthUrl)) return json({ error: 'oauth_url_invalido' }, 400, origin);

    let authUrl = oauthUrl;
    if (!authUrl.toLowerCase().endsWith('/auth')) authUrl = authUrl + '/auth';
    const qs = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'commercial',
    });

    let r: Response;
    try {
      r = await fetch(`${authUrl}?${qs.toString()}`, {
        method: 'GET',
        redirect: 'manual',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      return json({ error: 'rede', detail: String(e?.message || e) }, 502, origin);
    }
    const location = r.headers.get('Location') || r.headers.get('location') || '';
    const code = (() => {
      try { return new URL(location, authUrl).searchParams.get('code') || ''; } catch { return ''; }
    })();
    if (!code) {
      return json({ error: 'sem_code', status: r.status, detail: location.slice(0, 200) }, 502, origin);
    }

    // Troca o code por token (Basic auth), como no passo 3 da documentação.
    const params = new URLSearchParams();
    params.set('grant_type', 'authorization_code');
    params.set('code', code);
    params.set('scope', 'commercial');
    let tokenUrl = oauthUrl;
    if (!tokenUrl.toLowerCase().includes('/token')) tokenUrl = tokenUrl + '/token';
    let tr: Response;
    try {
      tr = await fetch(tokenUrl, {
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
    const text = await tr.text();
    let j: any;
    try { j = JSON.parse(text); } catch { j = { raw: text.slice(0, 400) }; }
    if (!tr.ok) return json({ error: 'toconline_recusou', motivo: explicarErroOauth(tr.status, j), status: tr.status, detail: j }, tr.status, origin);
    if (!j.access_token) return json({ error: 'sem_access_token', detail: j }, 502, origin);
    return json(j, 200, origin);
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
      // A documentação NÃO inclui redirect_uri na troca do código; enviá-lo
      // provoca 401 unauthorized_client no TOConline.
    } else {
      const rt = String(body.refreshToken || '').trim();
      if (!rt) return json({ error: 'refresh_em_falta' }, 400, origin);
      params.set('grant_type', 'refresh_token');
      params.set('refresh_token', rt);
      params.set('scope', 'commercial');
    }

    let tokenUrl = oauthUrl.replace(/\/$/, '');
    if (!tokenUrl.toLowerCase().includes('/token')) tokenUrl = tokenUrl + '/token';
    let r: Response;
    try {
      r = await fetch(tokenUrl, {
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
    if (!r.ok) {
      const explicado = explicarErroOauth(r.status, j);
      return json({ error: 'toconline_recusou', motivo: explicado, status: r.status, detail: j }, r.status, origin);
    }
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
    let firstRaw: any = null;
    let pagesFetched = 0;
    let lastMeta: any = null;
    let page = 1;
    for (let guard = 0; guard < 25; guard++) {
      const url = urlClientes(apiUrl, page);
      let r: Response;
      try {
        r = await fetch(url, {
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
      lastMeta = j.meta ?? null;
      const items = Array.isArray(j.data) ? j.data : Array.isArray(j.customers) ? j.customers : Array.isArray(j) ? j : [];
      if (!firstRaw && items.length) firstRaw = items[0];
      if (!items.length) break;
      // Recursos relacionados vêm em `included`: morada principal e email.
      const addresses = new Map<string, any>();
      const emails = new Map<string, any>();
      const defaults = new Map<string, any>();
      const isencoes = new Map<string, any>();
      for (const inc of Array.isArray(j.included) ? j.included : []) {
        if (inc?.type === 'addresses') addresses.set(String(inc.id), inc);
        else if (inc?.type === 'email_addresses') emails.set(String(inc.id), inc);
        else if (inc?.type === 'customers_defaults') defaults.set(String(inc.id), inc);
        else if (inc?.type === 'tax_exemption_reasons') isencoes.set(String(inc.id), inc);
      }
      for (const it of items) out.push(mapTocCustomer(it, { addresses, emails, defaults, isencoes }));
      pagesFetched++;
      const totalPages = j.meta?.totalPages ?? j.meta?.['total-pages'];
      if (items.length < 100 || (typeof totalPages === 'number' && page >= totalPages)) break;
      page++;
    }
    const debug = {
      pagesFetched,
      total: out.length,
      semNif: out.filter((x: any) => !x.nif).length,
      comMorada: out.filter((x: any) => !!x.morada).length,
      comLocalidade: out.filter((x: any) => !!x.localidade).length,
      comEmail: out.filter((x: any) => !!x.email).length,
      comTelefone: out.filter((x: any) => !!x.telefone).length,
      comContacto: out.filter((x: any) => !!x.contacto).length,
      isentosIva: out.filter((x: any) => x.isencaoIva).length,
      comEmailsExtra: out.filter((x: any) => (x.emails || []).length > 1).length,
      comMoradasExtra: out.filter((x: any) => (x.moradasExtra || []).length > 0).length,
      comMotivoIsencao: out.filter((x: any) => !!x.isencaoCodigo).length,
      comPrazoPagamento: out.filter((x: any) => typeof x.prazoPagamento === 'number').length,
      firstRawKeys: firstRaw ? Object.keys(firstRaw).slice(0, 30) : [],
      firstRawAttributesKeys: firstRaw?.attributes ? Object.keys(firstRaw.attributes).slice(0, 30) : [],
      firstRawSample: firstRaw ? JSON.stringify(firstRaw).slice(0, 1200) : null,
      meta: lastMeta,
    };
    return json({ data: out, debug }, 200, origin);
  }

  return json({ error: 'nao_implementado' }, 500, origin);
};
