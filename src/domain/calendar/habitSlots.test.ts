import { toDayKey } from '@/lib/dates';

import { availabilitySlots, habitSlots } from './habitSlots';

const base = { kind: 'binary' as const, startDay: toDayKey('2026-01-01'), pauses: [], targets: [{ validFrom: toDayKey('2026-01-01'), period: 'day' as const, target: 1 }] };

describe('hábitos y disponibilidad en la agenda', () => {
  it('coloca los hábitos diarios los días que tocan, a su hora o todo el día', () => {
    const slots = habitSlots([
      { ...base, id: 'leer', name: 'Leer', scheduleDays: [], reminderTime: '21:00' },
      { ...base, id: 'gym', name: 'Gimnasio', scheduleDays: [1, 3], reminderTime: null },
      { ...base, id: 'medita', name: 'Meditar', kind: 'duration', scheduleDays: [], reminderTime: '07:30:00', targets: [{ validFrom: toDayKey('2026-01-01'), period: 'day', target: 20 }] },
      { ...base, id: 'semanal', name: 'Correr', kind: 'frequency', scheduleDays: [], targets: [{ validFrom: toDayKey('2026-01-01'), period: 'week', target: 3 }] },
      { ...base, id: 'pausado', name: 'Pausado', scheduleDays: [], pauses: [{ from: toDayKey('2026-11-01'), to: null }] },
      { ...base, id: 'archivado', name: 'Viejo', scheduleDays: [], archived: true },
    ], toDayKey('2026-11-16'), toDayKey('2026-11-17'));
    expect(slots).toEqual([
      { id: 'leer', name: 'Leer', day: '2026-11-16', start: 1260, end: 1290, allDay: false },
      { id: 'leer', name: 'Leer', day: '2026-11-17', start: 1260, end: 1290, allDay: false },
      { id: 'gym', name: 'Gimnasio', day: '2026-11-16', start: 0, end: 1440, allDay: true },
      { id: 'medita', name: 'Meditar', day: '2026-11-16', start: 450, end: 470, allDay: false },
      { id: 'medita', name: 'Meditar', day: '2026-11-17', start: 450, end: 470, allDay: false },
    ]);
  });
  it('un bloque aceptado en Planificar manda ese día (también en semanales)', () => {
    const slots = habitSlots([
      { ...base, id: 'gym', name: 'Gimnasio', scheduleDays: [], reminderTime: null },
      { ...base, id: 'semanal', name: 'Correr', kind: 'frequency', scheduleDays: [], targets: [{ validFrom: toDayKey('2026-01-01'), period: 'week', target: 3 }] },
    ], toDayKey('2026-11-16'), toDayKey('2026-11-17'), { '2026-11-17': { gym: { start: 600, end: 615 }, semanal: { start: 1080, end: 1100 } } });
    expect(slots).toEqual([
      { id: 'gym', name: 'Gimnasio', day: '2026-11-16', start: 0, end: 1440, allDay: true },
      { id: 'gym', name: 'Gimnasio', day: '2026-11-17', start: 600, end: 615, allDay: false },
      { id: 'semanal', name: 'Correr', day: '2026-11-17', start: 1080, end: 1100, allDay: false },
    ]);
  });
  it('despliega las franjas de disponibilidad por día de la semana', () => {
    expect(availabilitySlots([{ weekday: 1, start: '09:00:00', end: '13:00:00' }, { weekday: 2, start: '20:00', end: '23:59' }], toDayKey('2026-11-16'), toDayKey('2026-11-17'))).toEqual([
      { day: '2026-11-16', start: 540, end: 780 },
      { day: '2026-11-17', start: 1200, end: 1440 },
    ]);
  });
});
