import { toDayKey as d } from '@/lib/dates';

import { recentPeriods, streaks } from './evaluate';
import { restDaysOf, restOffer } from './rest';
import type { HabitDef, HabitKind, HabitTarget } from './types';

const habit = (kind: HabitKind = 'binary', target: Partial<HabitTarget> = {}, extra: Partial<HabitDef> = {}): HabitDef => ({
  id: 'h', name: 'Leer', kind, unit: null, scheduleDays: [], startDay: d('2026-11-01'),
  targets: [{ validFrom: d('2026-11-01'), period: 'day', target: 1, ...target }], pauses: [], ...extra,
});
const TODAY = d('2026-11-18'); // miércoles; semana lun 16 – dom 22

describe('restOffer', () => {
  it('ofrece hoy y mañana si no se ha descansado esta semana', () => {
    expect(restOffer(habit(), [], TODAY).options.map((o) => o.label)).toEqual(['hoy', 'mañana']);
  });

  it('uno por semana: si ya descansaste el lunes, no hay más esta semana', () => {
    const h = habit('binary', {}, { pauses: [{ from: d('2026-11-16'), to: d('2026-11-16') }] });
    const r = restOffer(h, [], TODAY);
    expect(r.usedThisWeek).toBe('2026-11-16');
    expect(r.options).toEqual([]);
  });

  it('el domingo puede reservar el lunes, que es de la semana siguiente', () => {
    const sunday = d('2026-11-22');
    const h = habit('binary', {}, { pauses: [{ from: d('2026-11-16'), to: d('2026-11-16') }] });
    expect(restOffer(h, [], sunday).options.map((o) => o.day)).toEqual(['2026-11-23']);
  });

  it('hoy no si ya está cumplido; tampoco días no programados o ya pausados', () => {
    expect(restOffer(habit(), [{ dayKey: TODAY, value: 1 }], TODAY).options.map((o) => o.label)).toEqual(['mañana']);
    expect(restOffer(habit('binary', {}, { scheduleDays: [4] }), [], TODAY).options.map((o) => o.label)).toEqual(['mañana']); // jueves
    expect(restOffer(habit('binary', {}, { pauses: [{ from: d('2026-11-10'), to: null }] }), [], TODAY).options).toEqual([]);
  });

  it('no se ofrece en hábitos semanales ni archivados', () => {
    expect(restOffer(habit('frequency', { period: 'week', target: 3 }), [], TODAY).unavailable).toMatch(/diarios/);
    expect(restOffer(habit('binary', {}, { archived: true }), [], TODAY).unavailable).toBeTruthy();
  });

  it('una pausa larga no cuenta como descanso', () => {
    expect(restDaysOf(habit('binary', {}, { pauses: [{ from: d('2026-11-10'), to: d('2026-11-12') }, { from: d('2026-11-14'), to: d('2026-11-14') }] }))).toEqual(['2026-11-14']);
  });
});

it('el día de descanso no rompe la racha (y no suma)', () => {
  const logs = ['2026-11-15', '2026-11-16', '2026-11-18'].map((x) => ({ dayKey: d(x), value: 1 }));
  const rested = habit('binary', {}, { pauses: [{ from: d('2026-11-17'), to: d('2026-11-17') }] });
  expect(streaks(recentPeriods(rested, logs, TODAY, 30)).current).toBe(3);
  expect(streaks(recentPeriods(habit(), logs, TODAY, 30)).current).toBe(1);
});
