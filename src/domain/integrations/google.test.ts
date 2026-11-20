import { chunks, mapGoogleEvents } from './google';

describe('importación de Google Calendar', () => {
  it('convierte eventos con hora, de día completo e instancias repetidas; omite cancelados', () => {
    const out = mapGoogleEvents('primary', [
      { id: 'a', summary: 'Clase', start: { dateTime: '2026-11-20T09:00:00+01:00', timeZone: 'Europe/Madrid' }, end: { dateTime: '2026-11-20T10:30:00+01:00' } },
      { id: 'b', summary: 'Vacaciones', start: { date: '2026-12-22' }, end: { date: '2026-12-24' } },
      { id: 'gym_20261121T170000Z', summary: 'Gimnasio', start: { dateTime: '2026-11-21T18:00:00+01:00' }, end: { dateTime: '2026-11-21T19:00:00+01:00' } },
      { id: 'c', status: 'cancelled', summary: 'Anulado', start: { dateTime: '2026-11-20T12:00:00Z' }, end: { dateTime: '2026-11-20T13:00:00Z' } },
      { id: 'd', start: { dateTime: '2026-11-20T12:00:00Z' }, end: { dateTime: '2026-11-20T13:00:00Z' } },
    ], 'Europe/Madrid');
    expect(out).toEqual([
      { external_id: 'primary:a', title: 'Clase', starts_at: '2026-11-20T08:00:00.000Z', ends_at: '2026-11-20T09:30:00.000Z', all_day: false, tz: 'Europe/Madrid' },
      { external_id: 'primary:b', title: 'Vacaciones', starts_at: '2026-12-22T00:00:00.000Z', ends_at: '2026-12-24T00:00:00.000Z', all_day: true, tz: 'UTC' },
      { external_id: 'primary:gym_20261121T170000Z', title: 'Gimnasio', starts_at: '2026-11-21T17:00:00.000Z', ends_at: '2026-11-21T18:00:00.000Z', all_day: false, tz: 'Europe/Madrid' },
      { external_id: 'primary:d', title: 'Ocupado', starts_at: '2026-11-20T12:00:00.000Z', ends_at: '2026-11-20T13:00:00.000Z', all_day: false, tz: 'Europe/Madrid' },
    ]);
  });
  it('respeta los límites de la base de datos (duración y orden)', () => {
    const [long, zero] = mapGoogleEvents('c', [
      { id: 'x', summary: 'Curso', start: { date: '2026-11-01' }, end: { date: '2026-12-31' } },
      { id: 'y', summary: 'Hito', start: { dateTime: '2026-11-20T09:00:00Z' }, end: { dateTime: '2026-11-20T09:00:00Z' } },
    ]);
    expect(new Date(long!.ends_at).getTime() - new Date(long!.starts_at).getTime()).toBe(14 * 86_400_000);
    expect(zero!.ends_at).toBe('2026-11-20T09:15:00.000Z');
  });
  it('trocea en lotes de 500', () => {
    expect(chunks(Array.from({ length: 1201 }, (_, i) => i)).map((c) => c.length)).toEqual([500, 500, 201]);
  });
});
