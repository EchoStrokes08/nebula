import { toDayKey as d } from '@/lib/dates';

import { bestFocusWindow, bestSessionLength, commitmentReview, compare, dailyCompletion, distractionPatterns, distribution, periodStats, previousRange } from './stats';

describe('estadísticas', () => {
  const habit = {
    id: 'h',
    name: 'Leer',
    kind: 'binary' as const,
    scheduleDays: [],
    startDay: d('2026-11-09'),
    targets: [{ validFrom: d('2026-11-09'), period: 'day' as const, target: 1 }],
    pauses: [],
    logs: ['09', '10', '12'].map((x) => ({ dayKey: d(`2026-11-${x}`), value: 1 })),
  };
  const completion = dailyCompletion([habit], d('2026-11-09'), d('2026-11-15'), d('2026-11-18'));

  it('cumplimiento solo con registros reales', () => {
    const s = periodStats({ completion, focus: [{ day: d('2026-11-10'), minutes: 50 }], tasksDone: [{ day: d('2026-11-11') }] }, d('2026-11-09'), d('2026-11-15'));
    expect(s.completionRate).toBeCloseTo(3 / 7);
    expect(s).toMatchObject({ focusMinutes: 50, tasksCompleted: 1, activeDays: 4 });
    expect(periodStats({ completion: new Map(), focus: [], tasksDone: [] }, d('2026-11-09'), d('2026-11-15')).completionRate).toBeNull();
  });

  it('compara con el periodo anterior', () => {
    expect(previousRange(d('2026-11-09'), d('2026-11-15'))).toEqual(['2026-11-02', '2026-11-08']);
    const c = compare({ completionRate: 0.6, focusMinutes: 300, tasksCompleted: 5, activeDays: 5 }, { completionRate: 0.5, focusMinutes: 200, tasksCompleted: 0, activeDays: 3 });
    expect(c.completion).toBeCloseTo(0.1);
    expect(c.focus).toBeCloseTo(0.5);
    expect(c.tasks).toBeNull();
  });

  it('distribución con «otros»', () => {
    const r = distribution([{ label: 'a', minutes: 60 }, { label: 'b', minutes: 30 }, { label: 'c', minutes: 10 }], 2);
    expect(r.map((x) => x.label)).toEqual(['a', 'b', 'Otros']);
    expect(r[0]!.share).toBeCloseTo(0.6);
  });

  it('patrones solo con datos suficientes', () => {
    const few = Array.from({ length: 5 }, () => ({ startHour: 9, minutes: 40, endedEarly: false }));
    expect(bestFocusWindow(few)).toBeNull();
    const many = [...Array.from({ length: 6 }, () => ({ startHour: 21, minutes: 40, endedEarly: false })), ...Array.from({ length: 3 }, () => ({ startHour: 9, minutes: 30, endedEarly: false }))];
    expect(bestFocusWindow(many)).toMatchObject({ from: 20, to: 22 });
    const lengths = [...Array.from({ length: 4 }, () => ({ minutes: 40, endedEarly: false })), ...Array.from({ length: 4 }, () => ({ minutes: 90, endedEarly: true })), { minutes: 15, endedEarly: false }];
    expect(bestSessionLength(lengths)).toMatchObject({ from: 35, to: 50, completion: 1 });
  });

  it('radar: frecuencia y abandono', () => {
    const logs = [
      ...Array.from({ length: 3 }, () => ({ kind: 'notificaciones', abandoned: true, minutes: 5 })),
      ...Array.from({ length: 4 }, () => ({ kind: 'redes', abandoned: false, minutes: 10 })),
    ];
    const p = distractionPatterns(logs)!;
    expect(p.mostFrequent.kind).toBe('redes');
    expect(p.abandonsMost).toEqual({ kind: 'notificaciones', n: 3 });
    expect(p.minutesLost).toBe(55);
    expect(distractionPatterns(logs.slice(0, 4))).toBeNull();
  });

  it('revisión de compromisos de la semana', () => {
    const r = commitmentReview(
      {
        tasks: [
          { id: 'a', dueDate: d('2026-11-10'), status: 'done' },
          { id: 'b', dueDate: d('2026-11-20'), status: 'todo' },
          { id: 'c', dueDate: d('2026-11-12'), status: 'cancelled' },
          { id: 'e', dueDate: d('2026-11-14'), status: 'todo' },
        ],
        history: [
          { taskId: 'a', event: 'completed', oldDue: null, newDue: null, atDay: d('2026-11-10') },
          { taskId: 'b', event: 'due_changed', oldDue: d('2026-11-11'), newDue: d('2026-11-20'), atDay: d('2026-11-11') },
          { taskId: 'c', event: 'cancelled', oldDue: null, newDue: null, atDay: d('2026-11-12') },
        ],
      },
      d('2026-11-09'),
      d('2026-11-15'),
    );
    expect(r).toMatchObject({ completed: ['a'], rescheduled: ['b'], abandoned: ['c'], pending: ['e'] });
    expect(r.promised.sort()).toEqual(['a', 'b', 'c', 'e']);
    expect(r.keptRate).toBe(0.25);
  });
});
