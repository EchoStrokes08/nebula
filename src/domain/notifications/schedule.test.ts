import { toDayKey as d } from '@/lib/dates';

import { applyPrefs, habitCandidates, inQuietHours, weeklySummaryCandidate, type Candidate, type NotifPrefs } from './schedule';

const tz = 'Europe/Madrid';
const prefs = (p: Partial<NotifPrefs> = {}): NotifPrefs => ({
  enabled: { habits: true, tasks: true, events: true, weekly_summary: true },
  quietStart: '22:00',
  quietEnd: '07:00',
  maxPerDay: 8,
  tz,
  ...p,
});
const c = (id: string, iso: string, kind: Candidate['kind'] = 'tasks', weight = 3): Candidate => ({ id, kind, at: new Date(iso), title: id, body: '', weight });
const now = new Date('2026-11-18T06:00:00Z');

describe('horas de silencio', () => {
  it('cruzan medianoche', () => {
    expect(inQuietHours(23 * 60, '22:00', '07:00')).toBe(true);
    expect(inQuietHours(6 * 60, '22:00', '07:00')).toBe(true);
    expect(inQuietHours(12 * 60, '22:00', '07:00')).toBe(false);
    expect(inQuietHours(12 * 60, null, null)).toBe(false);
  });

  it('un recordatorio en silencio se mueve al final; un evento en silencio se descarta', () => {
    // 23:30 Madrid = 22:30Z
    const r = applyPrefs([c('t', '2026-11-18T22:30:00Z'), c('e', '2026-11-18T22:30:00Z', 'events')], prefs(), now);
    expect(r.map((x) => [x.id, x.at.toISOString()])).toEqual([['t', '2026-11-19T06:00:00.000Z']]); // 07:00 Madrid
  });
});

describe('preferencias', () => {
  it('respeta tipos desactivados, el pasado y el máximo diario por importancia', () => {
    const list = [c('pasada', '2026-11-18T05:00:00Z'), c('h1', '2026-11-18T09:00:00Z', 'habits', 2), c('t1', '2026-11-18T10:00:00Z'), c('t2', '2026-11-18T11:00:00Z')];
    expect(applyPrefs(list, prefs({ maxPerDay: 2 }), now).map((x) => x.id)).toEqual(['t1', 't2']);
    expect(applyPrefs(list, prefs({ enabled: { habits: true, tasks: false, events: true, weekly_summary: true } }), now).map((x) => x.id)).toEqual(['h1']);
    expect(applyPrefs(list, prefs({ maxPerDay: 0 }), now)).toEqual([]);
  });
});

describe('candidatos', () => {
  it('hábitos solo en sus días y no hoy si ya está hecho', () => {
    const r = habitCandidates([{ id: 'h', name: 'Leer', time: '21:00', scheduleDays: [1, 3], doneToday: true }], d('2026-11-16'), tz, 7, (n) => `Toca ${n}`);
    expect(r.map((x) => x.id)).toEqual(['nebula-habit-h-2026-11-18']); // lunes 16 hecho → miércoles 18
    expect(r[0]!.at.toISOString()).toBe('2026-11-18T20:00:00.000Z');
  });
  it('resumen semanal el día configurado a las 19:00', () => {
    expect(weeklySummaryCandidate(0, d('2026-11-18'), tz)[0]!.at.toISOString()).toBe('2026-11-22T18:00:00.000Z');
    expect(weeklySummaryCandidate(null, d('2026-11-18'), tz)).toEqual([]);
  });
});
it('conserva la hora civil al programar en el cambio de horario de verano', () => {
  const candidates = habitCandidates([{ id: 'h', name: 'Leer', time: '09:00', scheduleDays: [], doneToday: false }], '2026-03-08' as import('@/lib/dates').DayKey, 'America/New_York', 1, () => 'Leer');
  expect(candidates[0]!.at.toISOString()).toBe('2026-03-08T13:00:00.000Z');
});
