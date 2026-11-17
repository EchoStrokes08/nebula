import { toDayKey as d } from '@/lib/dates';

import { bestWeekday, compareRecent, weekdayDistribution, weeklySeries } from './stats';
import type { HabitDef } from './types';

const habit: HabitDef = {
  id: 'h',
  name: 'Leer',
  kind: 'binary',
  scheduleDays: [],
  startDay: d('2026-10-01'),
  targets: [{ validFrom: d('2026-10-01'), period: 'day', target: 1 }],
  pauses: [],
};

describe('estadísticas de hábito', () => {
  it('serie semanal con tasa de días cumplidos', () => {
    // semana del 9 al 15 de nov: 4 de 7 cumplidos
    const logs = ['09', '10', '12', '14'].map((x) => ({ dayKey: d(`2026-11-${x}`), value: 1 }));
    const s = weeklySeries(habit, logs, d('2026-11-18'), 3);
    expect(s.map((w) => w.weekStart)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    expect(s[1]!.rate).toBeCloseTo(4 / 7);
    expect(s[0]!.rate).toBe(0);
  });

  it('compara semanas cerradas recientes con las anteriores', () => {
    const pts = [0.2, 0.2, 0.4, 0.4, 0.9].map((rate, i) => ({ weekStart: d('2026-11-01'), rate, total: i }));
    const c = compareRecent(pts, 2);
    expect(c.current).toBeCloseTo(0.4);
    expect(c.previous).toBeCloseTo(0.2);
    expect(c.delta).toBeCloseTo(0.2);
  });

  it('mejor día solo con datos suficientes y sin empate', () => {
    const tuesdays = ['2026-11-03', '2026-11-10', '2026-11-17', '2026-10-27', '2026-10-20'];
    const others = ['2026-11-02', '2026-11-04', '2026-11-05'];
    const counts = weekdayDistribution([...tuesdays, ...others].map((x) => ({ dayKey: d(x), value: 1 })));
    expect(counts[2]).toBe(5);
    expect(bestWeekday(counts)).toBe(2);
    expect(bestWeekday([1, 1, 0, 0, 0, 0, 0])).toBeNull();
  });
});
