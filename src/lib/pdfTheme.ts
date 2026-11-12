/**
 * Paleta exclusiva dos documentos exportados.
 * O tom principal é o accent do escritório (Definições → Cor primária); os
 * restantes tons são derivados dele — nunca há azul misturado com vermelho.
 */
export const PDF_COLORS = {
  blue: '#0677FF',
  dark: '#003B8F',
  medium: '#2D69B3',
  light: '#EAF3FF',
  pale: '#F7FBFF',
  line: '#C9DFFF',
  white: '#FFFFFF',
} as const;

export const PDF_RGB = {
  blue: [6, 119, 255] as [number, number, number],
  dark: [0, 59, 143] as [number, number, number],
  medium: [45, 105, 179] as [number, number, number],
  light: [234, 243, 255] as [number, number, number],
  pale: [247, 251, 255] as [number, number, number],
  line: [201, 223, 255] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
} as const;

export interface PaletaPdf {
  blue: string;
  dark: string;
  medium: string;
  light: string;
  pale: string;
  line: string;
  white: string;
}

function hexValido(cor?: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(cor || '').trim());
  return m ? `#${m[1].toLowerCase()}` : null;
}

function canais(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Mistura `a` com `b`; `peso` é a quantidade de `b` (0–1). */
function misturar(a: string, b: string, peso: number): string {
  const [r1, g1, b1] = canais(a);
  const [r2, g2, b2] = canais(b);
  const p = Math.max(0, Math.min(1, peso));
  const c = (x: number, y: number) => Math.round(x + (y - x) * p).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

/**
 * Paleta derivada do accent do escritório. `dark` e `medium` escurecem o tom
 * para texto/títulos; `light`, `pale` e `line` clareiam-no para fundos e filetes.
 */
export function paletaPdf(accent?: string): PaletaPdf {
  const a = hexValido(accent) || PDF_COLORS.blue;
  return {
    blue: a,
    dark: misturar(a, '#000000', 0.55),
    medium: misturar(a, '#000000', 0.25),
    light: misturar(a, '#FFFFFF', 0.92),
    pale: misturar(a, '#FFFFFF', 0.97),
    line: misturar(a, '#FFFFFF', 0.72),
    white: '#FFFFFF',
  };
}

/** A mesma paleta em RGB, para o jsPDF. */
export function paletaRgb(accent?: string) {
  const p = paletaPdf(accent);
  const conv = (hex: string) => {
    const [r, g, b] = canais(hex);
    return [r, g, b] as [number, number, number];
  };
  return {
    blue: conv(p.blue),
    dark: conv(p.dark),
    medium: conv(p.medium),
    light: conv(p.light),
    pale: conv(p.pale),
    line: conv(p.line),
    white: [255, 255, 255] as [number, number, number],
  };
}
