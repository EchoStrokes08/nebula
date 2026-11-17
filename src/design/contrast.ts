/** Contraste WCAG 2.x entre dos colores (#RRGGBB o rgba sobre un fondo opaco). */

type RGB = [number, number, number];

function parse(color: string): { rgb: RGB; alpha: number } {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex?.[1]) {
    const n = parseInt(hex[1], 16);
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: 1 };
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(color);
  if (rgba) {
    return {
      rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])],
      alpha: rgba[4] === undefined ? 1 : Number(rgba[4]),
    };
  }
  throw new Error(`Color no soportado: ${color}`);
}

/** Mezcla un color (posiblemente translúcido) sobre un fondo opaco. */
export function flatten(color: string, background: string): RGB {
  const fg = parse(color);
  const bg = parse(background).rgb;
  return fg.rgb.map((c, i) => Math.round(c * fg.alpha + bg[i]! * (1 - fg.alpha))) as RGB;
}

function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(foreground: string, background: string, base = '#000000'): number {
  const bg = flatten(background, base);
  const bgHex = `#${bg.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  const fg = flatten(foreground, bgHex);
  const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}
