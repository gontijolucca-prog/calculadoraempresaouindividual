// Modelos do AI Contabilista.
//
// Provider principal: OpenCode Go (zen/go) — mimo-v2.5 (mesmo modelo do Pi).
// Endpoint: https://opencode.ai/zen/go/v1/chat/completions (OpenAI-compatible).
//
// Fallback: quando o OpenCode Go falha (429/limite semanal, 5xx), o proxy
// tenta o OpenRouter com modelos gratuitos (:free) para nunca deixar o bot
// em baixo. A cadeia está ordenada por fiabilidade/preferência.
// Kilo AI Gateway — OpenAI-compatible. Os modelos `kilo-auto/*` são routers:
// `free` escolhe um modelo gratuito (sem chave, 200 req/h por IP) e `small`
// resolve num modelo pequeno e rápido (gemma free). Vêm primeiro porque
// respondem em ~2–4 s, contra dezenas de segundos dos modelos de raciocínio.
export const KILO_ENDPOINT = 'https://ai-gateway.kilo.ai/api/v1/chat/completions';

// Ordem por velocidade medida (23/10, mesma pergunta fiscal):
//   kilo-auto/small ~2,0 s (gemma-4-26b) · kilo-auto/free ~5,5 s (dots-3, reasoning)
// O `free` fica como segundo: se o `small` falhar, ainda respondemos de graça.
export const KILO_MODELS: string[] = [
  'kilo-auto/small',
  'kilo-auto/free',
];

// Nota de privacidade: o `kilo-auto/free` pode encaminhar para fornecedores que
// registam os pedidos. O contexto da app vai anonimizado; não enviar dados de
// clientes (NIF, moradas, valores) no texto da pergunta.

export const GO_MODELS: string[] = [
  'mimo-v2.5',
];

export const OPENROUTER_FALLBACK_MODELS: string[] = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'openai/gpt-oss-120b:free',
  'qwen/qwen3-next-80b:free',
  'google/gemma-4-31b:free',
  'z-ai/glm-4.5-air:free',
  'nousresearch/hermes-3-405b:free',
];

// OmniRoute — gateway multi-provider: o modelo "auto" roteia por 90+ providers
// free (quota esgotada num provider, desliza para o próximo automaticamente).
export const OMNIROUTE_MODELS: string[] = [
  'auto',
  'auto/fast',
  'auto/cheap',
];