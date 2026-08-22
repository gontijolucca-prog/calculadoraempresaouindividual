// Modelos do AI Contabilista.
//
// Provider principal: OpenCode Go (zen/go) — mimo-v2.5 (mesmo modelo do Pi).
// Endpoint: https://opencode.ai/zen/go/v1/chat/completions (OpenAI-compatible).
//
// Fallback: quando o OpenCode Go falha (429/limite semanal, 5xx), o proxy
// tenta o OpenRouter com modelos gratuitos (:free) para nunca deixar o bot
// em baixo. A cadeia está ordenada por fiabilidade/preferência.
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