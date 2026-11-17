import { toDayKey } from '@/lib/dates';

import { progressText, unitLabel } from './format';

const r = (value: number, target: number, status: 'met' | 'pending' = 'pending', progress = value / target) => ({
  start: toDayKey('2026-11-18'),
  end: toDayKey('2026-11-18'),
  value,
  target,
  status,
  progress,
});

describe('textos de progreso', () => {
  it('muestra el avance con su unidad y periodo', () => {
    expect(progressText('duration', null, r(20, 30), 'day')).toBe('20 / 30 min hoy');
    expect(progressText('quantity', 'vasos', r(5, 8), 'day')).toBe('5 / 8 vasos hoy');
    expect(progressText('frequency', null, r(2, 3), 'week')).toBe('2 / 3 veces esta semana');
    expect(progressText('cumulative', 'km', r(42.5, 100), 'month')).toBe('42,5 / 100 km este mes');
    expect(progressText('binary', null, r(1, 1, 'met'), 'day')).toBe('Hecho hoy');
  });

  it('en reducción distingue «sin registrar» de «0»', () => {
    expect(progressText('reduction', 'cafés', r(0, 2, 'pending', 0), 'day')).toMatch(/sin registrar/);
    expect(progressText('reduction', 'cafés', r(1, 2, 'pending', 1), 'day')).toBe('1 de 2 cafés hoy');
    expect(unitLabel('flexible', null)).toBe('sesiones');
  });
});
