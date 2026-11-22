import type { HabitDef, HabitKind, HabitLog, HabitPeriod } from '@/domain/habits/types';
import { toDayKey as d } from '@/lib/dates';

import { evaluatePeriod } from '@/domain/habits/evaluate';

import { dayOrbit, orbitWindow, periodOrbit, type OrbitTask } from './orbits';

const habit = (id: string, kind: HabitKind, period: HabitPeriod = 'day', target = 1, extra: Partial<HabitDef> = {}): HabitDef => ({
  id,
  name: id,
  kind,
  scheduleDays: [],
  startDay: d('2026-10-01'),
  targets: [{ validFrom: d('2026-10-01'), period, target }],
  pauses: [],
  ...extra,
});
const TODAY = d('2026-11-18'); // miércoles; semana lunes 16 – domingo 22
const logs = (map: Record<string, HabitLog[]>) => (id: string) => map[id] ?? [];

describe('orbitWindow', () => {
  it('semana según el primer día elegido y mes natural', () => {
    expect(orbitWindow('week', TODAY, 1)).toEqual({ start: '2026-11-16', end: '2026-11-22' });
    expect(orbitWindow('week', TODAY, 0)).toEqual({ start: '2026-11-15', end: '2026-11-21' });
    expect(orbitWindow('month', TODAY, 1)).toEqual({ start: '2026-11-01', end: '2026-11-30' });
  });
});

describe('periodOrbit', () => {
  it('hábito diario: cada día de la semana es una unidad, también los que faltan', () => {
    const h = habit('cama', 'binary');
    const r = periodOrbit([h], logs({ cama: [{ dayKey: d('2026-11-16'), value: 1 }, { dayKey: d('2026-11-17'), value: 1 }] }), [], 'week', TODAY);
    expect(r).toMatchObject({ total: 7, done: 2, remaining: 5, daysLeft: 5 });
    expect(r.elapsed).toBeCloseTo(3 / 7);
    // Lleva 2 de las 3 que tocaban hasta hoy (incluido).
    expect(r.pace).toBeCloseTo(2 - 3);
  });

  it('respeta días programados y pausas', () => {
    const h = habit('gym', 'binary', 'day', 1, { scheduleDays: [1, 3, 5], pauses: [{ from: d('2026-11-20'), to: d('2026-11-20') }] });
    const r = periodOrbit([h], logs({}), [], 'week', TODAY);
    expect(r.total).toBe(2); // lunes y miércoles; el viernes está en pausa
  });

  it('duración diaria suma progreso parcial', () => {
    const h = habit('leer', 'duration', 'day', 30);
    const r = periodOrbit([h], logs({ leer: [{ dayKey: TODAY, value: 15 }] }), [], 'week', TODAY);
    expect(r.done).toBeCloseTo(0.5);
    expect(r.remaining).toBe(7);
  });

  it('hábito semanal cuenta una vez y su progreso es fraccionario', () => {
    const h = habit('correr', 'frequency', 'week', 3);
    const r = periodOrbit([h], logs({ correr: [{ dayKey: d('2026-11-16'), value: 1 }] }), [], 'week', TODAY);
    expect(r.total).toBe(1);
    expect(r.done).toBeCloseTo(1 / 3);
  });

  it('en el mes, un hábito semanal cuenta las semanas que tocan el mes', () => {
    const h = habit('correr', 'frequency', 'week', 3);
    const r = periodOrbit([h], logs({}), [], 'month', TODAY);
    // Noviembre 2026 con semanas de lunes: 26 oct–1 nov, 2, 9, 16, 23 y 30 nov.
    expect(r.total).toBe(6);
  });

  it('tareas con fecha límite en la ventana; las canceladas no cuentan', () => {
    const tasks: OrbitTask[] = [
      { status: 'done', dueDate: d('2026-11-17') },
      { status: 'todo', dueDate: d('2026-11-21') },
      { status: 'cancelled', dueDate: d('2026-11-19') },
      { status: 'todo', dueDate: d('2026-11-30') },
      { status: 'todo', dueDate: null },
    ];
    const week = periodOrbit([], logs({}), tasks, 'week', TODAY);
    expect(week.tasks).toEqual({ done: 1, total: 2 });
    expect(week.progress).toBeCloseTo(0.5);
    expect(periodOrbit([], logs({}), tasks, 'month', TODAY).tasks).toEqual({ done: 1, total: 3 });
  });

  it('archivados, sin objetivo o posteriores a la ventana no cuentan', () => {
    const r = periodOrbit(
      [habit('a', 'binary', 'day', 1, { archived: true }), habit('b', 'binary', 'day', 1, { startDay: d('2026-12-01'), targets: [{ validFrom: d('2026-12-01'), period: 'day', target: 1 }] })],
      logs({}),
      [],
      'week',
      TODAY,
    );
    expect(r).toMatchObject({ total: 0, progress: 0, remaining: 0 });
  });

  it('un hábito que empieza a mitad de semana solo cuenta desde su inicio', () => {
    const h = habit('nuevo', 'binary', 'day', 1, { startDay: TODAY, targets: [{ validFrom: TODAY, period: 'day', target: 1 }] });
    expect(periodOrbit([h], logs({}), [], 'week', TODAY).total).toBe(5);
  });
});

describe('dayOrbit', () => {
  const cur = (h: HabitDef, l: HabitLog[]) => ({ habit: h, result: evaluatePeriod(h, l, TODAY, TODAY) });

  it('un hábito a medias suma su progreso parcial, no solo los cumplidos', () => {
    const r = dayOrbit([
      cur(habit('leer', 'duration', 'day', 30), [{ dayKey: TODAY, value: 15 }]),
      cur(habit('cama', 'binary'), [{ dayKey: TODAY, value: 1 }]),
    ]);
    expect(r).toMatchObject({ done: 1, total: 2 });
    expect(r.progress).toBeCloseTo(0.75);
  });

  it('semanales a medias, reducción pendiente y días no programados', () => {
    const r = dayOrbit([
      cur(habit('correr', 'frequency', 'week', 3), [{ dayKey: d('2026-11-16'), value: 1 }]),
      cur(habit('azucar', 'reduction', 'day', 2), [{ dayKey: TODAY, value: 1 }]),
      cur(habit('gym', 'binary', 'day', 1, { scheduleDays: [0] }), []),
    ]);
    expect(r.total).toBe(2);
    expect(r.progress).toBeCloseTo(1 / 3 / 2);
  });
});
