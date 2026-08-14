// Cadeia de modelos do OpenCode Go (zen/go) para o AI Contabilista.
//
// Endpoint: https://opencode.ai/zen/go/v1/chat/completions (OpenAI-compatible).
// O provider OpenCode Go usa a chave OPENCODE_GO_KEY (auth do opencode local).
// Ordem: deepseek-v4-flash (rápido, diário) → flash-free (fallback) → pro (último recurso).
export const FREE_MODELS: string[] = [
  'deepseek-v4-flash',
  'deepseek-v4-flash-free',
  'deepseek-v4-pro',
];
