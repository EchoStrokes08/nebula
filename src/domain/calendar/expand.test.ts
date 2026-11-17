import { toDayKey as d } from '@/lib/dates';

import { expandEvents, localMinutes, type CalendarEvent } from './expand';

const ev = (p: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'e',
  title: 'Clase',
  startsAt: '2026-10-19T07:00:00.000Z', // lunes 09:00 en Madrid (horario de verano)
  endsAt: '2026-10-19T08:30:00.000Z',
  allDay: false,
  tz: 'Europe/Madrid',
  category: 'estudio',
  recurrence: null,
  recurrenceUntil: null,
  source: 'manual',
  ...p,
});

describe('expansión de eventos', () => {
  it('evento simple dentro y fuera del rango', () => {
    expect(expandEvents([ev({})], d('2026-10-19'), d('2026-10-19'), 'Europe/Madrid')).toHaveLength(1);
    expect(expandEvents([ev({})], d('2026-10-20'), d('2026-10-25'), 'Europe/Madrid')).toHaveLength(0);
  });

  it('recurrencia semanal mantiene las 09:00 locales tras el cambio de hora', () => {
    const occ = expandEvents([ev({ recurrence: 'FREQ=WEEKLY' })], d('2026-10-19'), d('2026-11-02'), 'Europe/Madrid');
    expect(occ.map((o) => o.day)).toEqual(['2026-10-19', '2026-10-26', '2026-11-02']);
    for (const o of occ) expect(localMinutes(o.start, 'Europe/Madrid')).toBe(9 * 60);
    // Antes del 25-oct: UTC+2; después: UTC+1
    expect(occ[0]!.start.toISOString()).toBe('2026-10-19T07:00:00.000Z');
    expect(occ[1]!.start.toISOString()).toBe('2026-10-26T08:00:00.000Z');
    expect(occ[1]!.end.getTime() - occ[1]!.start.getTime()).toBe(90 * 60_000);
  });

  it('respeta la fecha final y los días de la semana', () => {
    const occ = expandEvents([ev({ recurrence: 'FREQ=WEEKLY;BYDAY=MO,WE', recurrenceUntil: d('2026-10-28') })], d('2026-10-19'), d('2026-11-30'), 'Europe/Madrid');
    expect(occ.map((o) => o.day)).toEqual(['2026-10-19', '2026-10-21', '2026-10-26', '2026-10-28']);
  });

  it('eventos diarios antiguos se expanden solo en el rango', () => {
    const occ = expandEvents([ev({ startsAt: '2025-01-06T07:00:00.000Z', endsAt: '2025-01-06T07:30:00.000Z', recurrence: 'FREQ=DAILY' })], d('2026-11-16'), d('2026-11-18'), 'Europe/Madrid');
    expect(occ.map((o) => o.day)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18']);
  });
});
