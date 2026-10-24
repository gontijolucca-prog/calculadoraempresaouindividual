// Proxy server-side do AI Contabilista → OpenCode Go (mimo-v2.5), com
// fallback para OpenRouter (:free) e OmniRoute (gateway multi-provider)
// quando o Go está em limite/indisponível.
//
// Cadeia: 1) Kilo Gateway (kilo-auto/free → small, ~2–4 s, custo zero) →
//         2) OpenCode Go (mimo-v2.5) → 3) OpenRouter (:free) →
//         4) OmniRoute (modelo "auto" — roteia por 90+ providers free).
//
// Porquê um proxy: a chave da API NUNCA pode ir para o cliente (site estático).
// Aqui ela vive como secret do Cloudflare Pages (env.OPENCODE_GO_KEY) e o
// browser fala apenas com /api/chat.
//
// Sugestões de melhoria: quando o modelo responde com um bloco de acção
// "suggestion", o proxy também envia a sugestão para o webhook de log
// (env.FEEDBACK_WEBHOOK_URL + env.FEEDBACK_TOKEN) — fonte de verdade para a
// equipa trabalhar nos updates. É best-effort: falhas silenciosas.
//
// Defesas (o bot é público): allowlist de origem, limites de payload, rate-limit
// best-effort por IP.

import { KILO_ENDPOINT, KILO_MODELS, GO_MODELS, OPENROUTER_FALLBACK_MODELS, OMNIROUTE_MODELS } from '../_models';
import { pareceTerDadosCliente } from '../_privacidade';
import { SYSTEM_PROMPT } from '../_systemPrompt';
import { KNOWLEDGE_BASE } from '../_kb';

interface Env {
  KILO_API_KEY?: string;       // opcional: sem chave usa o free anónimo
  OPENCODE_GO_KEY?: string;
  OPENROUTER_API_KEY?: string; // fallback legado
  OMNIROUTE_URL?: string;      // gateway OmniRoute (ex.: https://media.pontofinal.site/__omni)
  OMNIROUTE_API_KEY?: string;  // chave de API do OmniRoute
  FEEDBACK_WEBHOOK_URL?: string; // log de sugestões (VPS)
  FEEDBACK_TOKEN?: string;       // token do webhook de log
}

// Endpoints (OpenAI-compatible).
const GO_ENDPOINT = 'https://opencode.ai/zen/go/v1/chat/completions';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

type Msg = { role: 'user' | 'assistant' | 'system'; content: string };


// ── Limites (proteção da chave partilhada) ────────────────────────────────
const MAX_MESSAGES = 24;        // turnos de conversa aceites
const MAX_CHARS_PER_MSG = 4000; // por mensagem
const MAX_CONTEXT_CHARS = 6000; // contexto-app anonimizado
const MAX_OUTPUT_TOKENS = 1600;
const PROVIDER_TIMEOUT_MS = 20_000; // por tentativa; abaixo do limite da Pages Function // reasoning + resposta (mimo-v2.5 é modelo de reasoning)

// Origens autorizadas a usar o proxy.
const ALLOWED_HOST_SUFFIXES = [
  'estudo360.pt',
  'estudo360.pages.dev', // previews/produção Cloudflare Pages
  'localhost',
  '127.0.0.1',
];

// Rate-limit best-effort, por isolate (não durável — endurecer com KV se preciso).
const RL_WINDOW_MS = 60_000;
const RL_MAX = 20; // pedidos por IP por janela
const rlHits = new Map<string, number[]>();

function hostAllowed(value: string | null): boolean {
  if (!value) return false;
  try {
    const host = new URL(value).hostname;
    return ALLOWED_HOST_SUFFIXES.some((s) => host === s || host.endsWith('.' + s));
  } catch {
    return false;
  }
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
  if (rlHits.size > 5000) rlHits.clear(); // teto de memória
  return arr.length > RL_MAX;
}

/** Extrai acções "suggestion" do bloco <<<ACTIONS ... ACTIONS>>> da resposta. */
function extractSuggestions(reply: string): { title: string; detail: string; area?: string }[] {
  const out: { title: string; detail: string; area?: string }[] = [];
  const open = reply.indexOf('<<<ACTIONS');
  if (open === -1) return out;
  let rest = reply.slice(open + '<<<ACTIONS'.length);
  const close = rest.indexOf('ACTIONS>>>');
  if (close !== -1) rest = rest.slice(0, close);
  let jsonStr = rest.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  if (!jsonStr.startsWith('[')) {
    const a = jsonStr.indexOf('[');
    const b = jsonStr.lastIndexOf(']');
    if (a !== -1 && b > a) jsonStr = jsonStr.slice(a, b + 1);
  }
  try {
    const parsed: unknown = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      for (const a of parsed) {
        if (a && typeof a === 'object' && (a as any).type === 'suggestion' && typeof (a as any).title === 'string') {
          out.push({
            title: String((a as any).title).slice(0, 200),
            detail: String((a as any).detail ?? '').slice(0, 1500),
            area: typeof (a as any).area === 'string' ? String((a as any).area).slice(0, 120) : undefined,
          });
        }
      }
    }
  } catch {
    /* sem sugestões parseáveis — ignora */
  }
  return out;
}

/** Envia sugestões para o webhook de log (best-effort, timeout curto). */
async function relaySuggestions(env: Env, sugs: { title: string; detail: string; area?: string }[]): Promise<void> {
  const url = env.FEEDBACK_WEBHOOK_URL;
  const token = env.FEEDBACK_TOKEN;
  if (!url || !sugs.length) return;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Feedback-Token': token } : {}),
      },
      body: JSON.stringify({ suggestions: sugs }),
      signal: controller.signal,
    }).catch(() => {});
    clearTimeout(timer);
  } catch {
    /* best-effort — nunca bloqueia a resposta */
  }
}

export const onRequestOptions = async ({ request }: { request: Request }) =>
  new Response(null, { status: 204, headers: corsHeaders(request.headers.get('Origin')) });

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const origin = request.headers.get('Origin');
  const referer = request.headers.get('Referer');

  // 1) Origem — só o nosso site usa o proxy.
  if (!hostAllowed(origin) && !hostAllowed(referer)) {
    return json({ error: 'origem_nao_autorizada' }, 403, origin);
  }

  // 2) Chave configurada? (OpenCode Go primeiro; OpenRouter como fallback)
  const hasGo = !!env.OPENCODE_GO_KEY;
  const hasOpenRouter = !!env.OPENROUTER_API_KEY;
  const hasOmni = !!(env.OMNIROUTE_URL && env.OMNIROUTE_API_KEY);
  // Sem guarda de configuração: o Kilo (kilo-auto/free) responde sem chave.
  // Se todos os providers falharem, o pedido acaba com a mensagem de "ocupado".

  // 3) Rate-limit best-effort.
  const ip = request.headers.get('CF-Connecting-IP') || 'desconhecido';
  if (rateLimited(ip)) {
    return json({ error: 'rate_limit', reply: 'Estás a enviar mensagens muito depressa. Espera um instante e tenta de novo.' }, 429, origin);
  }

  // 4) Payload.
  let payload: { messages?: Msg[]; appContext?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'json_invalido' }, 400, origin);
  }

  const raw = Array.isArray(payload.messages) ? payload.messages : [];
  const messages: Msg[] = raw
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS_PER_MSG) }));

  if (messages.length === 0) {
    return json({ error: 'sem_mensagens' }, 400, origin);
  }

  const appContext = typeof payload.appContext === 'string'
    ? payload.appContext.slice(0, MAX_CONTEXT_CHARS)
    : '';

  // 5) Mensagens finais (prompt do sistema vive no servidor — o cliente não o controla).
  const systemContent =
    SYSTEM_PROMPT + '\n\n' + KNOWLEDGE_BASE +
    (appContext ? `\n\n# Contexto atual da aplicação (anonimizado)\n${appContext}` : '');

  const finalMessages: Msg[] = [{ role: 'system', content: systemContent }, ...messages];

  // 6) Se o Kilo falhar, os providers antigos: OpenCode Go → OpenRouter (:free) → OmniRoute.
  //    Salta em 429/erro/corpo vazio e passa ao próximo modelo da cadeia.
  let lastErr = 'sem_resposta';

  const tryProvider = async (
    endpoint: string,
    authKey: string,
    models: string[],
    isOpenRouter: boolean,
    extraHeaders: Record<string, string> = {},
  ): Promise<{ ok: boolean; reply?: string; model?: string }> => {
    for (const model of models) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...extraHeaders,
        };
        // Kilo responde sem chave (free anónimo); os outros exigem Bearer.
        if (authKey) headers['Authorization'] = `Bearer ${authKey}`;
        if (!endpoint.includes('kilo.ai')) {
          // OpenCode Go exige um id de sessão; sem isto responde 400 MissingSessionID.
          headers['x-opencode-session'] = `estudo360-chat-${crypto.randomUUID()}`;
        }
        if (isOpenRouter) {
          headers['HTTP-Referer'] = 'https://estudo360.pt';
          headers['X-Title'] = 'Estudo 360 - AI Contabilista'; // ASCII: headers não aceitam travessão
        }
        // Timeout por tentativa: um provider pendurado não pode comer o pedido
        // todo e impedir o fallback seguinte.
        const ctrl = new AbortController();
        timer = setTimeout(() => ctrl.abort(), PROVIDER_TIMEOUT_MS);
        const r = await fetch(endpoint, {
          method: 'POST',
          signal: ctrl.signal,
          headers,
          body: JSON.stringify({
            model,
            messages: finalMessages,
            max_tokens: MAX_OUTPUT_TOKENS,
            temperature: 0.4,
            stream: false, // OmniRoute devolve SSE por omissão; queremos JSON
          }),
        });

        if (r.status === 429 || r.status >= 500) {
          lastErr = `modelo_indisponivel_${r.status}`;
          continue; // próximo modelo da cadeia
        }
        if (!r.ok) {
          lastErr = `erro_${r.status}`;
          continue;
        }

        const data: any = await r.json();
        const msg = data?.choices?.[0]?.message;
        let reply: string = (msg?.content || '').trim();
        // Modelos de reasoning (mimo-v2.5, OmniRoute): às vezes devolvem content
        // vazio e põem tudo no campo `reasoning` (OpenCode Go) ou
        // `reasoning_content` (OmniRoute). Nesse caso usamos o raciocínio como
        // resposta em vez de saltar para o próximo modelo.
        if (!reply && msg?.reasoning) {
          reply = (msg.reasoning as string).trim();
          reply = reply.length > 600 ? reply.slice(0, 600).trimEnd() + '…' : reply;
        }
        if (!reply && msg?.reasoning_content) {
          reply = (msg.reasoning_content as string).trim();
          reply = reply.length > 600 ? reply.slice(0, 600).trimEnd() + '…' : reply;
        }
        if (!reply) {
          lastErr = 'corpo_vazio';
          continue; // sem conteúdo nenhum
        }

        return { ok: true, reply, model };
      } catch (e) {
        lastErr = e instanceof Error ? e.message : 'excecao';
        // Log do servidor (não vai para o cliente): ajuda a ver qual provider caiu.
        console.warn(`[chat] ${model} falhou: ${lastErr}`);
        continue;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    return { ok: false };
  };

  // Kilo Gateway primeiro: routers `kilo-auto/*` respondem em segundos e o free
  // não custa nada. Sem chave configurada usa o modo anónimo (200/h por IP).
  //
  // Privacidade: o free pode passar por fornecedores que registam os pedidos.
  // Se a pergunta (ou o contexto da app) traz dados de cliente — NIF/NIPC com
  // 9 dígitos, mesmo com pontos/espaços, ou IBAN — não vai para lá: segue para
  // os providers com contrato.
  const temDadosCliente = pareceTerDadosCliente(finalMessages, appContext);
  const kiloKey = (env.KILO_API_KEY || '').trim();
  const kilo = temDadosCliente
    ? { ok: false }
    : await tryProvider(KILO_ENDPOINT, kiloKey, KILO_MODELS, false, {
      'HTTP-Referer': 'https://estudo360.pt',
      'X-Title': 'Estudo 360 - AI Contabilista', // ASCII: cabeçalho não aceita travessão
    });
  if (kilo.ok && kilo.reply) {
    return json({ reply: kilo.reply, model: kilo.model, provider: 'kilo' }, 200, origin);
  }

  // OpenCode Go (preferido).
  if (hasGo) {
    const go = await tryProvider(GO_ENDPOINT, env.OPENCODE_GO_KEY!, GO_MODELS, false);
    if (go.ok) {
      const sugs = extractSuggestions(go.reply!);
      if (sugs.length) await relaySuggestions(env, sugs);
      return json({ reply: go.reply, model: go.model, provider: 'go' }, 200, origin);
    }
  }

  // Os fallbacks seguintes são gratuitos (registam pedidos). Com dados de
  // cliente no texto não são usados: sem Go, dizemos que não enviamos.
  const podeGratuitos = !temDadosCliente;

  // Fallback 1: OpenRouter (:free) — mantém o bot vivo quando o Go está em limite.
  if (hasOpenRouter && podeGratuitos) {
    const or = await tryProvider(OPENROUTER_ENDPOINT, env.OPENROUTER_API_KEY!, OPENROUTER_FALLBACK_MODELS, true);
    if (or.ok) {
      const sugs = extractSuggestions(or.reply!);
      if (sugs.length) await relaySuggestions(env, sugs);
      return json({ reply: or.reply, model: or.model, provider: 'openrouter' }, 200, origin);
    }
  }

  // Fallback 2: OmniRoute (gateway multi-provider) — modelo "auto" roteia por
  // 90+ providers free; quota esgotada num, desliza para o próximo. Última rede.
  if (env.OMNIROUTE_URL && env.OMNIROUTE_API_KEY && podeGratuitos) {
    const orUrl = env.OMNIROUTE_URL.replace(/\/$/, '') + '/v1/chat/completions';
    const omni = await tryProvider(orUrl, env.OMNIROUTE_API_KEY, OMNIROUTE_MODELS, false);
    if (omni.ok) {
      const sugs = extractSuggestions(omni.reply!);
      if (sugs.length) await relaySuggestions(env, sugs);
      return json({ reply: omni.reply, model: omni.model, provider: 'omniroute' }, 200, origin);
    }
  }

  if (temDadosCliente) {
    return json(
      {
        error: 'privacidade',
        reply: 'Esta pergunta tem dados de cliente (NIF/IBAN). Por privacidade não a envio para modelos gratuitos — tire os dados identificativos e tente de novo.',
      },
      503,
      origin,
    );
  }

  return json(
    {
      error: lastErr,
      reply: 'O modelo está ocupado neste momento. Tenta de novo daqui a um instante.',
    },
    503,
    origin,
  );
};