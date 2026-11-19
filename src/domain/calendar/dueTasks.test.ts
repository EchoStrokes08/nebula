import type { DayKey } from '@/lib/dates';

import { dueTaskSlots, type DueTaskInput } from './dueTasks';

const d = (s: string) => s as DayKey;
const task = (o: Partial<DueTaskInput>): DueTaskInput => ({
  id: 't', title: 'Tarea', status: 'todo', dueDate: d('2026-11-19'), dueTime: null, scheduledStart: null, scheduledEnd: null, ...o,
});

describe('dueTaskSlots', () => {
  it('pone las tareas sin hora como «todo el día» y las con hora a esa hora', () => {
    const r = dueTaskSlots([task({ id: 'a' }), task({ id: 'b', dueTime: '18:00:00' })], d('2026-11-19'), d('2026-11-19'));
    expect(r).toEqual([
      { id: 'a', title: 'Tarea', day: '2026-11-19', start: 0, end: 1440, allDay: true },
      { id: 'b', title: 'Tarea', day: '2026-11-19', start: 1080, end: 1110, allDay: false },
    ]);
  });

  it('omite hechas, canceladas, fuera de rango, sin fecha y las ya planificadas', () => {
    const r = dueTaskSlots(
      [
        task({ id: 'hecha', status: 'done' }),
        task({ id: 'cancelada', status: 'cancelled' }),
        task({ id: 'fuera', dueDate: d('2026-11-25') }),
        task({ id: 'sin', dueDate: null }),
        task({ id: 'plan', scheduledStart: '2026-11-19T09:00:00Z', scheduledEnd: '2026-11-19T10:00:00Z' }),
      ],
      d('2026-11-18'),
      d('2026-11-20'),
    );
    expect(r).toEqual([]);
  });

  it('no se sale del día con horas tardías', () => {
    const [s] = dueTaskSlots([task({ dueTime: '23:50' })], d('2026-11-19'), d('2026-11-19'));
    expect(s?.end).toBeLessThanOrEqual(1440);
  });

  it('repite las vencidas pendientes en el día de hoy', () => {
    const r = dueTaskSlots(
      [task({ id: 'vencida', dueDate: d('2026-11-10'), dueTime: '09:00' }), task({ id: 'hecha', dueDate: d('2026-11-10'), status: 'done' }), task({ id: 'hoy' })],
      d('2026-11-19'),
      d('2026-11-19'),
      d('2026-11-19'),
    );
    expect(r.map((s) => [s.id, s.day, s.allDay, !!s.overdue])).toEqual([
      ['vencida', '2026-11-19', true, true],
      ['hoy', '2026-11-19', true, false],
    ]);
  });

  it('en una semana con hoy, la vencida sale su día y también hoy', () => {
    const r = dueTaskSlots([task({ id: 'v', dueDate: d('2026-11-17') })], d('2026-11-16'), d('2026-11-22'), d('2026-11-19'));
    expect(r.map((s) => [s.day, !!s.overdue])).toEqual([
      ['2026-11-19', true],
      ['2026-11-17', false],
    ]);
  });

  it('sin hoy en el rango no añade vencidas', () => {
    expect(dueTaskSlots([task({ dueDate: d('2026-11-01') })], d('2026-11-20'), d('2026-11-20'), d('2026-11-19'))).toEqual([]);
  });
});
