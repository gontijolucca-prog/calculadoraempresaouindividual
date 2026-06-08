// Cadeia de modelos GRÁTIS do OpenRouter para o AI Contabilista.
//
// Todos terminam em ":free" (custo €0). A ordem é por qualidade/instrução +
// disponibilidade observada. Os modelos free são frequentemente rate-limited
// upstream (HTTP 429) — por isso o proxy percorre a cadeia até um responder.
// Validado a 2026-06-08: gpt-oss-120b e gemma-4-31b responderam em PT-PT;
// llama-3.3-70b e qwen3-next estavam 429; glm-4.5-air devolveu corpo vazio.
export const FREE_MODELS: string[] = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'openai/gpt-oss-120b:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'google/gemma-4-31b-it:free',
  'z-ai/glm-4.5-air:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
];
