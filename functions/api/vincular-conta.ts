import {
  AccessError,
  corsHeaders,
  jsonResponse,
  origemPermitida,
  vincularContaNormal,
} from '../_equipaAccess';

type PagesFunction = (ctx: { request: Request; env: Record<string, unknown> }) => Promise<Response>;

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
  try {
    return jsonResponse(await vincularContaNormal(request, env, body), 200, origin);
  } catch (error) {
    if (error instanceof AccessError) {
      return jsonResponse({ erro: error.codigo }, error.status, origin);
    }
    const raw = String((error as Error)?.message || error || '');
    if (/FIREBASE_SERVICE_ACCOUNT_JSON|FIREBASE_API_KEY|OAuth Google|Firebase Auth Admin/i.test(raw)) {
      return jsonResponse({ erro: 'servico_acessos_indisponivel' }, 503, origin);
    }
    return jsonResponse({ erro: 'falha_vinculacao' }, 502, origin);
  }
};
