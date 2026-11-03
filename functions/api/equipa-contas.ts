import {
  AccessError,
  alterarPasswordPropria,
  atualizarCredencial,
  criarCredencial,
  jsonResponse,
  migrarConvitesLegados,
  origemPermitida,
  removerAcesso,
  reporPassword,
  corsHeaders,
} from '../_equipaAccess';

type PagesFunction = (ctx: { request: Request; env: Record<string, unknown> }) => Promise<Response>;

function classificarErro(error: unknown): AccessError {
  if (error instanceof AccessError) return error;
  const raw = String((error as Error)?.message || error || '');
  if (/FIREBASE_SERVICE_ACCOUNT_JSON|FIREBASE_API_KEY|OAuth Google|Firebase Auth Admin/i.test(raw)) {
    return new AccessError('servico_acessos_indisponivel', 503);
  }
  return new AccessError('falha_servidor', 500);
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
  try {
    const action = String(body.action || '').trim();
    switch (action) {
      case 'criar':
        return jsonResponse(await criarCredencial(request, env, body), 201, origin);
      case 'atualizar':
        return jsonResponse(await atualizarCredencial(request, env, body), 200, origin);
      case 'repor_password':
        return jsonResponse(await reporPassword(request, env, body), 200, origin);
      case 'alterar_password':
        return jsonResponse(await alterarPasswordPropria(request, env, body), 200, origin);
      case 'remover':
        return jsonResponse(await removerAcesso(request, env, body), 200, origin);
      case 'migrar_convites':
        return jsonResponse(await migrarConvitesLegados(request, env), 200, origin);
      default:
        return jsonResponse({ erro: 'acao_invalida' }, 400, origin);
    }
  } catch (error) {
    const mapped = classificarErro(error);
    return jsonResponse({ erro: mapped.codigo }, mapped.status, origin);
  }
};
