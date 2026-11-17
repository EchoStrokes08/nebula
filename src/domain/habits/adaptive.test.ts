import { addDays, type DayKey } from '@/lib/dates';

import { adaptiveRecommendations } from './adaptive';
import type { HabitDef } from './types';

const today = '2026-11-17' as DayKey; // martes
const base = (over: Partial<HabitDef> = {}): HabitDef => ({ id: 'h', name: 'Leer', kind: 'duration', unit: null, scheduleDays: [], startDay: addDays(today, -80), targets: [{ validFrom: addDays(today, -80), period: 'day', target: 60 }], pauses: [], ...over });
const days = (n: number) => Array.from({ length: n }, (_, i) => addDays(today, -(i + 1)));

describe('recomendaciones adaptativas', () => {
  it('no recomienda nada sin datos suficientes', () => {
    const r = adaptiveRecommendations({ habit: base({ startDay: addDays(today, -5), targets: [{ validFrom: addDays(today, -5), period: 'day', target: 60 }] }), logs: [], today, timeZone: 'UTC' });
    expect(r).toEqual({ status: 'insufficient', needed: 14, have: 5 });
  });
  it('propone un objetivo realista a partir de los periodos parciales', () => {
    const logs = days(20).map((d) => ({ dayKey: d, value: 30 }));
    const r = adaptiveRecommendations({ habit: base(), logs, today, timeZone: 'UTC' });
    if (r.status !== 'ok') throw new Error('esperaba ok');
    const rec = r.items.find((i) => i.kind === 'duration');
    expect(rec?.change).toEqual({ type: 'target', target: 30 });
    expect(r.items.some((i) => i.kind === 'split')).toBe(true);
  });
  it('sugiere quitar los días que casi nunca se cumplen', () => {
    // Cumple todos los días salvo los domingos.
    const logs = days(42).filter((d) => new Date(`${d}T12:00:00Z`).getUTCDay() !== 0).map((d) => ({ dayKey: d, value: 1 }));
    const r = adaptiveRecommendations({ habit: base({ kind: 'binary', targets: [{ validFrom: addDays(today, -80), period: 'day', target: 1 }] }), logs, today, timeZone: 'UTC' });
    if (r.status !== 'ok') throw new Error('esperaba ok');
    expect(r.items.find((i) => i.kind === 'days')?.change).toEqual({ type: 'days', days: [1, 2, 3, 4, 5, 6] });
  });
  it('detecta la franja horaria habitual con lenguaje de estimación', () => {
    const logs = days(20).map((d) => ({ dayKey: d, value: 1, loggedAt: `${d}T21:15:00Z` }));
    const r = adaptiveRecommendations({ habit: base({ kind: 'binary', targets: [{ validFrom: addDays(today, -80), period: 'day', target: 1 }] }), logs, today, timeZone: 'UTC' });
    if (r.status !== 'ok') throw new Error('esperaba ok');
    const rec = r.items.find((i) => i.kind === 'time');
    expect(rec?.change).toEqual({ type: 'time', time: '21:00' });
    expect(rec?.title).toBe('Planifícalo por la noche');
    expect(rec?.reason).toMatch(/estimación/);
  });
  it('señala la combinación día + franja («martes por la noche») cuando destaca', () => {
    const tuesdays = days(56).filter((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === 2);
    const logs = [...tuesdays, ...tuesdays.map((d) => addDays(d, -1))].map((d) => ({ dayKey: d, value: 1, loggedAt: `${d}T21:00:00Z` }))
      .concat(tuesdays.slice(0, 3).map((d) => ({ dayKey: addDays(d, -3), value: 1, loggedAt: `${addDays(d, -3)}T08:00:00Z` })));
    const r = adaptiveRecommendations({ habit: base({ kind: 'frequency', targets: [{ validFrom: addDays(today, -80), period: 'week', target: 2 }] }), logs, today, timeZone: 'UTC' });
    if (r.status !== 'ok') throw new Error('esperaba ok');
    expect(r.items.find((i) => i.kind === 'time')?.reason).toMatch(/martes por la noche/);
  });
  it('no repite la recomendación de horario si ya coincide', () => {
    const logs = days(20).map((d) => ({ dayKey: d, value: 1, loggedAt: `${d}T21:15:00Z` }));
    const habit = { ...base({ kind: 'binary', targets: [{ validFrom: addDays(today, -80), period: 'day', target: 1 }] }), reminderTime: '21:30' };
    const r = adaptiveRecommendations({ habit, logs, today, timeZone: 'UTC' });
    if (r.status !== 'ok') throw new Error('esperaba ok');
    expect(r.items.some((i) => i.kind === 'time')).toBe(false);
  });
  it('reduce la frecuencia semanal cuando casi nunca se cumple', () => {
    const logs = days(70).filter((_, i) => i % 7 === 0).map((d) => ({ dayKey: d, value: 1 }));
    const r = adaptiveRecommendations({ habit: base({ kind: 'frequency', targets: [{ validFrom: addDays(today, -80), period: 'week', target: 4 }] }), logs, today, timeZone: 'UTC' });
    if (r.status !== 'ok') throw new Error('esperaba ok');
    expect(r.items.find((i) => i.kind === 'frequency')?.change).toEqual({ type: 'target', target: 1 });
  });
});
