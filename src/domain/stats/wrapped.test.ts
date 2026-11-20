import type { HabitKind, HabitTarget } from '@/domain/habits/types';
import { dayRange, toDayKey as d } from '@/lib/dates';

import { wrapped, wrappedRange, type WrappedInput } from './wrapped';

const habit = (id: string, days: string[], kind: HabitKind = 'binary', target: Partial<HabitTarget> = {}) => ({
  id, name: id, kind, unit: null, scheduleDays: [], startDay: d('2026-11-01'),
  targets: [{ validFrom: d('2026-11-01'), period: 'day' as const, target: 1, ...target }], pauses: [],
  logs: days.map((x) => ({ dayKey: d(x), value: 1 })),
});
const input = (extra: Partial<WrappedInput> = {}): WrappedInput => ({
  habits: [], focus: [], tasksDone: [], from: d('2026-11-01'), to: d('2026-11-30'), today: d('2026-11-20'), ...extra,
});

describe('wrapped', () => {
  it('no cuenta días futuros y calcula constancia y días perfectos', () => {
    const all = dayRange(d('2026-11-01'), d('2026-11-19'));
    const r = wrapped(input({ habits: [habit('leer', all), habit('correr', all.slice(0, 10))] }));
    expect(r.days).toBe(20);
    expect(r.perfectDays).toBe(10);
    expect(r.completionRate).toBeCloseTo(29 / 38);
    expect(r.habitChecks).toBe(29);
  });

  it('elige el hábito estrella y la racha más larga del periodo', () => {
    const r = wrapped(input({ habits: [habit('leer', ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-10']), habit('agua', ['2026-11-05', '2026-11-06'])] }));
    expect(r.star).toEqual({ name: 'leer', met: 4 });
    expect(r.bestStreak).toEqual({ name: 'leer', days: 3 });
  });

  it('suma tareas y enfoque del periodo y omite la franja sin datos suficientes', () => {
    const r = wrapped(input({
      tasksDone: [{ day: d('2026-11-03') }, { day: d('2026-10-30') }],
      focus: [{ day: d('2026-11-03'), minutes: 50, startHour: 9, endedEarly: false }, { day: d('2026-11-04'), minutes: 0, startHour: 9, endedEarly: true }],
    }));
    expect(r.tasksCompleted).toBe(1);
    expect(r.focusMinutes).toBe(50);
    expect(r.focusSessions).toBe(1);
    expect(r.focusWindow).toBeNull();
    expect(r.bestWeekday).toBeNull();
  });

  it('un periodo vacío no inventa nada', () => {
    const r = wrapped(input());
    expect(r).toMatchObject({ activeDays: 0, completionRate: null, star: null, bestStreak: null, tasksCompleted: 0 });
  });
});

describe('wrappedRange', () => {
  it('mes en curso, o el anterior los 3 primeros días', () => {
    expect(wrappedRange('mes', d('2026-11-20'))).toEqual({ from: '2026-11-01', to: '2026-11-30', label: 'noviembre 2026' });
    expect(wrappedRange('mes', d('2026-12-02'))).toMatchObject({ from: '2026-11-01', label: 'noviembre 2026' });
    expect(wrappedRange('mes', d('2027-01-01'))).toMatchObject({ from: '2026-12-01', to: '2026-12-31' });
  });
  it('año en curso, o el anterior la primera semana de enero', () => {
    expect(wrappedRange('año', d('2026-11-20'))).toEqual({ from: '2026-01-01', to: '2026-12-31', label: '2026' });
    expect(wrappedRange('año', d('2027-01-05')).label).toBe('2026');
  });
});
