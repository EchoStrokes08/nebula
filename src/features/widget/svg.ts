import type { HeatDay } from '@/domain/widget/today';

/**
 * Dibujos de los widgets como SVG en texto (los widgets de Android no pueden usar react-native-svg).
 * Todo es geometría simple; los textos van aparte con TextWidget para usar las fuentes de Nebula.
 */

const n = (x: number) => Math.round(x * 100) / 100;

/** AndroidSVG entiende mejor color + opacidad que `rgba()`: se convierte al final. */
export function toSvgPaint(svg: string): string {
  return svg.replace(/(fill|stroke)="rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)"/g, (_m, attr: string, r: string, g: string, b: string, a: string) => {
    const hex = [r, g, b].map((v) => Number(v).toString(16).padStart(2, '0')).join('').toUpperCase();
    return `${attr}="#${hex}" ${attr}-opacity="${a}"`;
  });
}
const clamp01 = (p: number) => (Number.isFinite(p) ? Math.max(0, Math.min(1, p)) : 0);

/** Cálido como la racha 🔥: ámbar → coral → rosa. */
export const WARM = { from: '#FFC56B', mid: '#FF8A5C', to: '#FF6FB5' } as const;

/** Anillo de progreso con degradado y, opcionalmente, una marca de ritmo (0..1 del periodo transcurrido). */
export function ringSvg(size: number, stroke: number, progress: number, opts: { track?: string; from?: string; to?: string; marker?: number } = {}): string {
  const p = clamp01(progress);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const mid = size / 2;
  const from = opts.from ?? WARM.from;
  const to = opts.to ?? WARM.to;
  const arc = p > 0
    ? `<circle cx="${n(mid)}" cy="${n(mid)}" r="${n(r)}" fill="none" stroke="url(#g)" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${n(c * p)} ${n(c)}" transform="rotate(-90 ${n(mid)} ${n(mid)})"/>`
    : '';
  const m = opts.marker !== undefined && opts.marker > 0 && opts.marker < 1
    ? `<circle cx="${n(mid + r * Math.sin(2 * Math.PI * opts.marker))}" cy="${n(mid - r * Math.cos(2 * Math.PI * opts.marker))}" r="${n(stroke / 2 + 1)}" fill="#FFFFFF" stroke="#1A1030" stroke-width="1.5"/>`
    : '';
  return toSvgPaint(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><circle cx="${n(mid)}" cy="${n(mid)}" r="${n(r)}" fill="none" stroke="${opts.track ?? 'rgba(255,255,255,0.12)'}" stroke-width="${stroke}"/>${arc}${m}</svg>`);
}

/**
 * Icono de cada fila del widget «Hoy», todos de 30 × 30 y trazo 2:
 * - casilla redondeada para los de un toque (vacía o rellena con ✓);
 * - anillo de progreso para los acumulativos o de minutos (con ✓ al completarse).
 */
export function rowIconSvg(kind: 'check' | 'ring', color: string, done: boolean, progress = 0): string {
  const s = 30;
  const check = `<path d="M9.5 15.5l3.6 3.6 7.4-7.6" fill="none" stroke="#130C24" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (kind === 'check') {
    return toSvgPaint(done
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><rect x="2" y="2" width="26" height="26" rx="8" fill="${color}"/>${check}</svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><rect x="3" y="3" width="24" height="24" rx="7.5" fill="none" stroke="${color}" stroke-width="2"/></svg>`);
  }
  if (done) return toSvgPaint(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><circle cx="15" cy="15" r="13" fill="${color}"/>${check}</svg>`);
  const r = 12;
  const c = 2 * Math.PI * r;
  const p = clamp01(progress);
  const arc = p > 0 ? `<circle cx="15" cy="15" r="${r}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="${n(Math.max(c * p, 2))} ${n(c)}" transform="rotate(-90 15 15)"/>` : '';
  return toSvgPaint(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><circle cx="15" cy="15" r="${r}" fill="none" stroke="${color}" stroke-opacity="0.28" stroke-width="2.6"/>${arc}<circle cx="15" cy="15" r="2.2" fill="${color}"/></svg>`);
}

/** Barra redondeada con degradado cálido. */
export function barSvg(width: number, height: number, progress: number, track = 'rgba(255,255,255,0.10)'): string {
  const w = Math.max(1, Math.round(width));
  const p = clamp01(progress);
  const fill = p > 0 ? `<rect x="0" y="0" width="${n(Math.max(height, w * p))}" height="${height}" rx="${height / 2}" fill="url(#g)"/>` : '';
  return toSvgPaint(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}" viewBox="0 0 ${w} ${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${WARM.from}"/><stop offset="0.6" stop-color="${WARM.mid}"/><stop offset="1" stop-color="${WARM.to}"/></linearGradient></defs><rect x="0" y="0" width="${w}" height="${height}" rx="${height / 2}" fill="${track}"/>${fill}</svg>`);
}

/** Escala del mapa de constancia: de apagado a la luz cálida de un día completo. */
export const HEAT_LEVELS = ['rgba(255,255,255,0.07)', '#3B2A63', '#6A45C2', '#A987FF', '#FFB37A'] as const;

export function heatLevel(ratio: number | null): number {
  if (ratio === null) return -1;
  if (ratio <= 0) return 0;
  if (ratio < 0.5) return 1;
  if (ratio < 0.85) return 2;
  if (ratio < 1) return 3;
  return 4;
}

/** Cuadrícula semanas × 7 días (columnas = semanas). `days` viene ordenado y en múltiplos de 7. */
export function heatmapSvg(days: HeatDay[], today: string, cell: number, gap: number): string {
  const weeks = Math.ceil(days.length / 7);
  const w = weeks * cell + (weeks - 1) * gap;
  const h = 7 * cell + 6 * gap;
  const rx = n(cell * 0.28);
  const rects = days.map((d, i) => {
    const x = n(Math.floor(i / 7) * (cell + gap));
    const y = n((i % 7) * (cell + gap));
    if (d.future) return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="${rx}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
    const level = heatLevel(d.ratio);
    const fill = level < 0 ? 'rgba(255,255,255,0.035)' : HEAT_LEVELS[level];
    const ring = d.day === today ? ` stroke="#FFFFFF" stroke-width="1.5"` : '';
    return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="${rx}" fill="${fill}"${ring}/>`;
  });
  return toSvgPaint(`<svg xmlns="http://www.w3.org/2000/svg" width="${n(w)}" height="${n(h)}" viewBox="0 0 ${n(w)} ${n(h)}">${rects.join('')}</svg>`);
}

/** Leyenda «menos → más» del mapa. */
export function legendSvg(cell: number, gap: number): string {
  const w = HEAT_LEVELS.length * cell + (HEAT_LEVELS.length - 1) * gap;
  return toSvgPaint(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${cell}" viewBox="0 0 ${w} ${cell}">${HEAT_LEVELS.map((c, i) => `<rect x="${i * (cell + gap)}" y="0" width="${cell}" height="${cell}" rx="${n(cell * 0.28)}" fill="${c}"/>`).join('')}</svg>`);
}

/** Iconos lineales (24 × 24, estilo de la app) para la barra de accesos. */
const ICON_PATHS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  timer: '<path d="M10 2h4M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
  book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  play: '<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/>',
} as const;
export type IconName = keyof typeof ICON_PATHS;

export function iconSvg(name: IconName, color: string, size = 24): string {
  return toSvgPaint(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name]}</svg>`);
}

/**
 * Decoración del fondo «cósmico» (como la tarjeta de la órbita de la app): resplandor rosa
 * arriba a la derecha, cian abajo a la izquierda y unas estrellas fijas. Va encima del
 * degradado nativo; si el lanzador da un tamaño algo distinto, solo se desplaza el adorno.
 */
export function cosmicSvg(width: number, height: number): string {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const stars: [number, number, number][] = [[0.08, 0.12, 1.2], [0.46, 0.07, 1], [0.63, 0.3, 1.3], [0.9, 0.2, 1.5], [0.94, 0.62, 1], [0.55, 0.9, 1.2], [0.2, 0.78, 1], [0.75, 0.5, 0.9]];
  return toSvgPaint(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><radialGradient id="p" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FF8AD8" stop-opacity="0.42"/><stop offset="1" stop-color="#FF8AD8" stop-opacity="0"/></radialGradient><radialGradient id="c" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#7DF3FF" stop-opacity="0.22"/><stop offset="1" stop-color="#7DF3FF" stop-opacity="0"/></radialGradient></defs><circle cx="${n(w * 0.92)}" cy="${n(h * 0.02)}" r="${n(Math.max(w, h) * 0.42)}" fill="url(#p)"/><circle cx="${n(w * 0.05)}" cy="${n(h * 1.02)}" r="${n(Math.max(w, h) * 0.45)}" fill="url(#c)"/>${stars.map(([x, y, r]) => `<circle cx="${n(w * x)}" cy="${n(h * y)}" r="${r}" fill="#FFFFFF" fill-opacity="0.8"/>`).join('')}</svg>`);
}
