/**
 * Gerador de propostas (cards) → OpenCode Go com fallback OpenRouter.
 *
 * O browser envia o brief (dados do escritório, cliente e preços já calculados)
 * e recebe JSON com cards. A chave vive aqui como secret do Cloudflare Pages.
 *
 * Contrato: { cards: [{ kind, title, subtitle, body, items: [{label,value,note}] }] }
 * `mode: 'plan'` → deck completo; `mode: 'rewrite'` → um único card.
 */
import { GO_MODELS, OPENROUTER_FALLBACK_MODELS } from '../_models';

interface Env {
  OPENCODE_GO_KEY?: string;
  OPENROUTER_API_KEY?: string;
}

const GO_ENDPOINT = 'https://opencode.ai/zen/go/v1/chat/completions';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const ALLOWED_HOST_SUFFIXES = ['estudo360.pt', 'estudo360.pages.dev', 'localhost', '127.0.0.1'];

const RL_WINDOW_MS = 60_000;
const RL_MAX = 30;
const rlHits = new Map<string, number[]>();

const MAX_BRIEF_CHARS = 12_000;
const MAX_OUTPUT_TOKENS = 2200;
const MAX_CARDS = 12;

const KINDS = ['cover', 'section', 'bullets', 'stats', 'pricing', 'timeline', 'contact'];

const SYSTEM_PROMPT = `És redator de propostas comerciais de contabilidade em Portugal. Escreves em português europeu, claro e concreto, sem clichés de marketing.

Devolves SEMPRE JSON válido, sem markdown, com esta forma:
{"cards":[{"kind":"cover|section|bullets|stats|pricing|timeline|contact","title":"...","subtitle":"...","body":"...","items":[{"label":"...","value":"...","note":"..."}]}]}

Regras:
- 7 a 8 cards. O primeiro é "cover". O último é "contact". Sê breve: cada card é um slide, não um parágrafo.
- Usa só os tipos listados. "bullets", "stats", "pricing", "timeline" e "contact" precisam de "items".
- Não inventes preços nem números: usa exatamente os valores de "totais.linhas". No card "pricing" copia os itens e o subtotal tal como vêm.
- Não inventes serviços que não estejam em "servicos".
- Não menciones IA, Gamma, modelos, prompts nem o facto de seres um modelo.
- title ≤ 70 caracteres, body ≤ 280, cada label ≤ 60, value ≤ 40, note ≤ 90. Não repitas o título no body.
- Nada de HTML. Não inventes datas, anos nem nomes de pessoas.`;

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
  if (rlHits.size > 5000) rlHits.clear();
  return arr.length > RL_MAX;
}

/** Extrai o objeto JSON mesmo quando o modelo mete texto à volta. */
export function parseCardsJson(text: string): unknown[] | null {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  if (!s.startsWith('{')) {
    const a = s.indexOf('{');
    const b = s.lastIndexOf('}');
    if (a === -1 || b <= a) return null;
    s = s.slice(a, b + 1);
  }
  try {
    const parsed = JSON.parse(s) as { cards?: unknown };
    if (Array.isArray(parsed.cards)) return parsed.cards.slice(0, MAX_CARDS);
  } catch {
    // resposta truncada (limite de tokens) — salva os cards completos
  }
  return repairCards(s);
}

/** Recupera objetos de card completos de um JSON cortado a meio. */
function repairCards(s: string): unknown[] | null {
  const start = s.indexOf('[');
  if (start === -1) return null;
  const out: unknown[] = [];
  let depth = 0;
  let objStart = -1;
  let inStr = false;
  let esc = false;
  for (let i = start + 1; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && objStart >= 0) {
        try { out.push(JSON.parse(s.slice(objStart, i + 1))); } catch { /* ignora card partido */ }
        objStart = -1;
      }
    }
  }
  return out.length ? out.slice(0, MAX_CARDS) : null;
}

interface ProviderResult {
  cards: unknown[];
  provider: string;
}

async function callProvider(
  endpoint: string,
  key: string,
  models: string[],
  jsonMode: boolean,
  messages: { role: string; content: string }[],
  session: string,
  timeoutMs: number,
): Promise<ProviderResult | null> {
  for (const model of models) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          // OpenCode Go exige um id de sessão para encaminhar o pedido.
          'x-opencode-session': session,
          ...(endpoint.includes('openrouter')
            ? { 'HTTP-Referer': 'https://estudo360.pt', 'X-Title': 'Estudo 360 — Fazer Proposta' }
            : {}),
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.6,
          max_tokens: MAX_OUTPUT_TOKENS,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        console.log('[deck] http', res.status, (await res.text().catch(() => '')).slice(0, 200));
        continue;
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string; reasoning?: string; reasoning_content?: string } }[];
      };
      const msg = data.choices?.[0]?.message;
      const raw = (msg?.content || msg?.reasoning || msg?.reasoning_content || '').trim();
      if (!raw) { console.log('[deck] resposta vazia', model); continue; }
      const cards = parseCardsJson(raw) ?? parseCardsJson(msg?.reasoning_content || '');
      if (cards && cards.length) return { cards, provider: `${endpoint.includes('openrouter') ? 'openrouter' : 'go'}:${model}` };
      console.log('[deck] json inválido', model);
    } catch {
      // modelo indisponível/timeout — tenta o próximo
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

export const onRequestOptions = async ({ request }: { request: Request }) =>
  new Response(null, { status: 204, headers: corsHeaders(request.headers.get('Origin')) });

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const origin = request.headers.get('Origin');

  // 1) Origem
  if (origin && !hostAllowed(origin)) return json({ error: 'origem_nao_autorizada' }, 403, origin);

  // 2) Chaves
  if (!env.OPENCODE_GO_KEY && !env.OPENROUTER_API_KEY) {
    return json({ error: 'config', cards: null }, 503, origin);
  }

  // 3) Rate limit
  const ip = request.headers.get('CF-Connecting-IP') || 'desconhecido';
  if (rateLimited(ip)) {
    return json({ error: 'rate_limit', cards: null }, 429, origin);
  }

  let payload: { mode?: string; brief?: unknown; card?: unknown; instruction?: string };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'json_invalido' }, 400, origin);
  }

  const mode = payload.mode === 'rewrite' ? 'rewrite' : 'plan';
  const brief = JSON.stringify(payload.brief ?? {}).slice(0, MAX_BRIEF_CHARS);
  if (!brief || brief === '{}') return json({ error: 'sem_brief' }, 400, origin);

  const userContent =
    mode === 'rewrite'
      ? `Reescreve APENAS este card, mantendo o tipo e o preço se for "pricing". Devolve {"cards":[card]}.\n\nBRIEF:\n${brief}\n\nCARD ATUAL:\n${JSON.stringify(payload.card ?? {})}\n\nINSTRUÇÃO: ${String(payload.instruction || 'melhora o texto, mais concreto e humano').slice(0, 400)}`
      : `Gera a proposta completa a partir deste brief.\n\nBRIEF:\n${brief}`;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];

  const session = `estudo360-deck-${crypto.randomUUID()}`;
  const go = env.OPENCODE_GO_KEY
    ? await callProvider(GO_ENDPOINT, env.OPENCODE_GO_KEY, GO_MODELS, true, messages, session, 75_000)
    : null;
  if (go) return json({ cards: go.cards, provider: go.provider }, 200, origin);

  const or = env.OPENROUTER_API_KEY
    ? await callProvider(OPENROUTER_ENDPOINT, env.OPENROUTER_API_KEY, OPENROUTER_FALLBACK_MODELS, false, messages, session, 35_000)
    : null;
  if (or) return json({ cards: or.cards, provider: or.provider }, 200, origin);

  return json({ error: 'sem_resposta', cards: null }, 503, origin);
};
