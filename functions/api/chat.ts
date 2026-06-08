// Proxy server-side do AI Contabilista → OpenRouter (modelos GRÁTIS).
//
// Porquê um proxy: a chave da API NUNCA pode ir para o cliente (site estático).
// Aqui ela vive como secret do Cloudflare Pages (env.OPENROUTER_API_KEY) e o
// browser fala apenas com /api/chat.
//
// Defesas (o bot é público): allowlist de origem, limites de payload, rate-limit
// best-effort por IP, e percurso da cadeia de modelos free quando há 429.

import { FREE_MODELS } from '../_models';
import { SYSTEM_PROMPT } from '../_systemPrompt';
import { KNOWLEDGE_BASE } from '../_kb';

interface Env {
  OPENROUTER_API_KEY?: string;
}

type Msg = { role: 'user' | 'assistant' | 'system'; content: string };

// ── Limites (proteção da chave partilhada) ────────────────────────────────
const MAX_MESSAGES = 24;        // turnos de conversa aceites
const MAX_CHARS_PER_MSG = 4000; // por mensagem
const MAX_CONTEXT_CHARS = 6000; // contexto-app anonimizado
const MAX_OUTPUT_TOKENS = 1100; // texto curto + bloco de ações/replies sem cortar a meio

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

  // 2) Chave configurada?
  if (!env.OPENROUTER_API_KEY) {
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

  // 6) Percorre a cadeia de modelos free; salta em 429/erro/corpo vazio.
  let lastErr = 'sem_resposta';
  for (const model of FREE_MODELS) {
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://estudo360.pt',
          'X-Title': 'Estudo 360 — AI Contabilista',
        },
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
      const reply: string = data?.choices?.[0]?.message?.content?.trim() || '';
      if (!reply) {
        lastErr = 'corpo_vazio';
        continue; // modelos de "reasoning" às vezes devolvem content vazio
      }

      return json({ reply, model }, 200, origin);
    } catch (e) {
      lastErr = e instanceof Error ? e.message : 'excecao';
      continue;
    }
  }

  return json(
    {
      error: lastErr,
      reply: 'Os modelos gratuitos estão todos ocupados neste momento. Tenta de novo daqui a um minuto — é normal acontecer nas horas de ponta.',
    },
    503,
    origin,
  );
};
