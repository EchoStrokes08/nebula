import type { HeatDay, WidgetItem } from '@/domain/widget/today';
import { toDayKey } from '@/lib/dates';

import { heatmapLayout } from './ExtraWidgets';
import { barSvg, heatLevel, heatmapSvg, ringSvg, rowIconSvg, toSvgPaint } from './svg';
import { rowHeight, visibleRows } from './TodayWidget';

const item = (name: string, detail: string | null = null, streak = 0): WidgetItem => ({ id: name, name, color: 'violet', done: false, toggleable: true, detail, progress: 0, streak });

describe('dibujos SVG del widget', () => {
  it('convierte rgba() en color + opacidad para AndroidSVG', () => {
    expect(toSvgPaint('<rect fill="rgba(255,255,255,0.07)" stroke="rgba(10, 0, 171, 0.5)"/>')).toBe('<rect fill="#FFFFFF" fill-opacity="0.07" stroke="#0A00AB" stroke-opacity="0.5"/>');
    expect(ringSvg(100, 10, 0.5)).not.toContain('rgba(');
  });

  it('anillo: sin arco a 0 %, con arco y marca de ritmo si se piden', () => {
    expect(ringSvg(100, 10, 0)).not.toContain('url(#g)"');
    const half = ringSvg(100, 10, 0.5, { marker: 0.25 });
    expect(half).toContain('stroke-dasharray');
    expect(half.match(/<circle/g)).toHaveLength(3);
  });

  it('iconos de fila coherentes: casilla para un toque, anillo para acumulativos', () => {
    expect(rowIconSvg('check', '#A987FF', false)).toContain('<rect');
    expect(rowIconSvg('check', '#A987FF', true)).toContain('<path');
    expect(rowIconSvg('ring', '#A987FF', false, 0.3)).toContain('stroke-dasharray');
    expect(rowIconSvg('ring', '#A987FF', true)).toContain('<path');
  });

  it('barra y mapa de calor', () => {
    expect(barSvg(200, 8, 0)).not.toContain('url(#g)"/>');
    expect(heatLevel(null)).toBe(-1);
    expect([0, 0.3, 0.6, 0.9, 1].map(heatLevel)).toEqual([0, 1, 2, 3, 4]);
    const svg = heatmapSvg([{ day: toDayKey('2026-11-16'), ratio: 1, future: false }, ...Array.from({ length: 6 }, (_, i): HeatDay => ({ day: toDayKey(`2026-11-${17 + i}`), ratio: null, future: i > 1 }))], '2026-11-18', 10, 2);
    expect(svg.match(/<rect/g)).toHaveLength(7);
    expect(svg).toContain('stroke="#FFFFFF"'); // hoy resaltado
  });
});

describe('maquetación del widget «Hoy»', () => {
  it('los títulos largos ocupan dos líneas y el detalle suma alto', () => {
    expect(rowHeight(item('Leer'), 320)).toBe(52);
    expect(rowHeight(item('Lectura de artículos de data science (papers)', '0/15 min'), 320)).toBe(75);
  });

  it('cuenta las filas que caben para avisar de las que quedan debajo', () => {
    const items = [item('Tender la cama'), item('Leer', '0/15 min'), item('Agua', '2/8 vasos'), item('Meditar')];
    expect(visibleRows(items, 320, 1000)).toBe(4);
    expect(visibleRows(items, 320, 136)).toBe(2);
    expect(visibleRows(items, 320, 90)).toBe(1);
  });

  it('el mapa de constancia ajusta celdas y semanas al tamaño', () => {
    expect(heatmapLayout(330, 180)).toEqual({ cell: 12, gap: 3, weeks: 11, side: true });
    expect(heatmapLayout(250, 180)).toMatchObject({ side: false, weeks: 15 });
    expect(heatmapLayout(250, 220).weeks).toBeLessThanOrEqual(16);
  });
});
