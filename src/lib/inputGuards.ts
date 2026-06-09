// Guardas de entrada para os simuladores — impedem valores impossíveis SEM inventar
// regras fiscais. Só impõem constrangimentos OBJETIVOS: não-negatividade, contagens
// inteiras com piso, percentagens dentro do intervalo, e um valor que não pode
// exceder outro. Quando um limite é uma escolha fiscal incerta, NÃO se clampa aqui.

/** Limita um número a [min, max] (qualquer um opcional). Devolve 0 para NaN. */
export function clamp(value: number, min?: number, max?: number): number {
  let v = Number.isFinite(value) ? value : 0;
  if (min !== undefined && v < min) v = min;
  if (max !== undefined && v > max) v = max;
  return v;
}

/** Lê um <input> numérico e clampa-o (default: não-negativo). */
export function numInput(raw: string, min = 0, max?: number): number {
  return clamp(Number(raw) || 0, min, max);
}

/** Lê um <input> inteiro e clampa-o (default: não-negativo). */
export function intInput(raw: string, min = 0, max?: number): number {
  return clamp(Math.trunc(Number(raw) || 0), min, max);
}

/** Percentagem escrita pelo utilizador (0–100), opcionalmente com teto legal menor. */
export function pctInput(raw: string, maxPct = 100): number {
  return clamp(Number(raw) || 0, 0, maxPct);
}
