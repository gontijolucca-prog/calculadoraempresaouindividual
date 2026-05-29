/**
 * Reparação idempotente de mojibake (UTF-8 lido como Latin-1 e re-codificado).
 *
 * Caso típico: um SAF-T em UTF-8 cujo conteúdo foi, em algum passo, interpretado
 * como Latin-1 e voltou a ser gravado em UTF-8 — "Atlântico" fica "AtlÃ¢ntico",
 * "Prestações" fica "PrestaÃ§Ãµes". Esta função deteta os marcadores (Ã/Â/â€),
 * reinterpreta a string como bytes Latin-1 e volta a descodificar em UTF-8.
 *
 * É segura para texto já correcto: só atua se houver marcadores, se TODOS os
 * code points couberem num byte, e só aceita o resultado se a descodificação
 * UTF-8 for válida (fatal) E reduzir o "ruído". Strings legítimas como "JOÃO"
 * (Ã seguido de byte inválido em UTF-8) falham a descodificação fatal e ficam
 * intactas.
 */
export function repairMojibake(s: string): string {
  if (!s || typeof s !== 'string') return s;
  if (!/Ã.|Â.|â€/.test(s)) return s;                  // sem marcadores → nada a fazer
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 0xff) return s;             // não é reinterpretável como Latin-1
  }
  try {
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const noise = (x: string) => (x.match(/[ÃÂ]|â€/g) || []).length;
    return noise(decoded) < noise(s) ? decoded : s;   // só aceita se ficou mais limpo
  } catch {
    return s;                                         // bytes não formam UTF-8 válido
  }
}
