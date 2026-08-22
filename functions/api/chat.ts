// Proxy server-side do AI Contabilista → OpenCode Go (mimo-v2.5), com
// fallback para OpenRouter (:free) quando o Go está em limite/indisponível.
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

import { GO_MODELS, OPENROUTER_FALLBACK_MODELS } from '../_models';
import { SYSTEM_PROMPT } from '../_systemPrompt';
import { KNOWLEDGE_BASE } from '../_kb';

interface Env {
  OPENCODE_GO_KEY?: string;
  OPENROUTER_API_KEY?: string; // fallback legado
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
const MAX_OUTPUT_TOKENS = 1600; // reasoning + resposta (mimo-v2.5 é modelo de reasoning)

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
  if (!hasGo && !hasOpenRouter) {
    return json({ error: 'config', reply: 'O AI Contabilista ainda não está configurado neste ambiente. Avisa a equipa.' }, 503, origin);
  }

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

  // 6) Percorre os providers: OpenCode Go primeiro, OpenRouter (:free) como fallback.
  //    Salta em 429/erro/corpo vazio e passa ao próximo modelo da cadeia.
  let lastErr = 'sem_resposta';

  const tryProvider = async (
    endpoint: string,
    authKey: string,
    models: string[],
    isOpenRouter: boolean,
  ): Promise<{ ok: boolean; reply?: string; model?: string }> => {
    for (const model of models) {
      try {
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${authKey}`,
          'Content-Type': 'application/json',
        };
        if (isOpenRouter) {
          headers['HTTP-Referer'] = 'https://estudo360.pt';
          headers['X-Title'] = 'Estudo 360 — AI Contabilista';
        }
        const r = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: finalMessages,
            max_tokens: MAX_OUTPUT_TOKENS,
            temperature: 0.4,
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
        // mimo-v2.5 é modelo de reasoning: às vezes devolve content vazio e põe
        // tudo no campo `reasoning`. Nesse caso usamos o reasoning como resposta
        // em vez de saltar para o próximo modelo.
        if (!reply && msg?.reasoning) {
          reply = (msg.reasoning as string).trim();
          reply = reply.length > 600 ? reply.slice(0, 600).trimEnd() + '…' : reply;
        }
        if (!reply) {
          lastErr = 'corpo_vazio';
          continue; // sem conteúdo nenhum (nem content nem reasoning)
        }

        return { ok: true, reply, model };
      } catch (e) {
        lastErr = e instanceof Error ? e.message : 'excecao';
        continue;
      }
    }
    return { ok: false };
  };

  // OpenCode Go (preferido).
  if (hasGo) {
    const go = await tryProvider(GO_ENDPOINT, env.OPENCODE_GO_KEY!, GO_MODELS, false);
    if (go.ok) {
      const sugs = extractSuggestions(go.reply!);
      if (sugs.length) await relaySuggestions(env, sugs);
      return json({ reply: go.reply, model: go.model, provider: 'go' }, 200, origin);
    }
  }

  // Fallback: OpenRouter (:free) — mantém o bot vivo quando o Go está em limite.
  if (hasOpenRouter) {
    const or = await tryProvider(OPENROUTER_ENDPOINT, env.OPENROUTER_API_KEY!, OPENROUTER_FALLBACK_MODELS, true);
    if (or.ok) {
      const sugs = extractSuggestions(or.reply!);
      if (sugs.length) await relaySuggestions(env, sugs);
      return json({ reply: or.reply, model: or.model, provider: 'openrouter' }, 200, origin);
    }
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