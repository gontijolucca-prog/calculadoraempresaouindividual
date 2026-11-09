/**
 * Accent do escritório aplicado ao site inteiro.
 *
 * Uma única variável (`--accent`) alimenta todos os `bg-[var(--accent)]`,
 * `text-[var(--accent)]` e derivados. Trocar a cor em Definições não obriga a
 * recompilar nada: escreve-se no `:root` e o browser repinta.
 *
 * As variantes `-strong`, `-soft` e `-ring` são calculadas a partir da cor
 * base para os estados hover/active e para os fundos ténues.
 */
const PADRAO = '#0677FF';

type RGB = { r: number; g: number; b: number };

export function hexValido(cor: string | null | undefined): string | null {
  if (!cor) return null;
  const c = cor.trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c) ? c : null;
}

export function hexToRgb(hex: string): RGB | null {
  const c = hexValido(hex);
  if (!c) return null;
  const h = c.slice(1);
  const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** Escurece (fator < 1) ou clareia (fator > 1) mantendo o matiz. */
export function ajustarLuminosidade(hex: string, fator: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const mix = (n: number) => (fator < 1 ? n * fator : n + (255 - n) * (fator - 1));
  const to2 = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${to2(mix(rgb.r))}${to2(mix(rgb.g))}${to2(mix(rgb.b))}`;
}

export function rgbaDe(hex: string, alfa: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const a = Math.max(0, Math.min(1, alfa));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

/**
 * Aplica a cor ao documento. Passar null/vazio repõe o azul da marca.
 * Devolve a cor efetivamente aplicada.
 */
export function applyAccent(cor: string | null | undefined): string {
  const accent = hexValido(cor) || PADRAO;
  if (typeof document === 'undefined') return accent;
  const root = document.documentElement;
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-strong', ajustarLuminosidade(accent, 0.78));
  root.style.setProperty('--accent-soft', rgbaDe(accent, 0.10));
  root.style.setProperty('--accent-ring', rgbaDe(accent, 0.30));
  // `--brand-blue` continua a ser usada por CSS antigo e pelos gráficos.
  root.style.setProperty('--brand-blue', accent);
  return accent;
}

export const ACCENT_PADRAO = PADRAO;
