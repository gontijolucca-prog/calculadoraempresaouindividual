/**
 * Paleta exclusiva dos documentos exportados.
 * Todas as cores são azul ou branco; os tons claros resultam da mistura com branco.
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
