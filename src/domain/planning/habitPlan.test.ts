import type { HabitDef, HabitKind, HabitLog, HabitPeriod } from '@/domain/habits/types';
import { addDays, toDayKey as d } from '@/lib/dates';

import { habitsForPlan, isHabitPlanId } from './habitPlan';

const TODAY = d('2026-11-18'); // miércoles
const TOMORROW = addDays(TODAY, 1);
const habit = (id: string, kind: HabitKind, period: HabitPeriod = 'day', target = 1, extra: Partial<HabitDef & { reminderTime: string | null }> = {}) => ({
  id,
  name: id,
  kind,
  scheduleDays: [],
  startDay: d('2026-11-01'),
  targets: [{ validFrom: d('2026-11-01'), period, target }],
  pauses: [],
  reminderTime: null,
  ...extra,
});
const logs = (map: Record<string, HabitLog[]>) => (id: string) => map[id] ?? [];

describe('habitsForPlan', () => {
  it('incluye los diarios pendientes y deja fuera los cumplidos, archivados y de reducción', () => {
    const r = habitsForPlan(
      [habit('cama', 'binary'), habit('hecho', 'binary'), habit('viejo', 'binary', 'day', 1, { archived: true }), habit('azucar', 'reduction', 'day', 2)],
      logs({ hecho: [{ dayKey: TODAY, value: 1 }] }),
      TODAY,
      TODAY,
    );
    expect(r.map((h) => h.habitId)).toEqual(['cama']);
    expect(r[0]).toMatchObject({ id: 'habit:cama', minutes: 15, why: 'hábito de hoy', fixedAt: null });
    expect(r[0]!.task.daysToDue).toBe(0);
    expect(isHabitPlanId(r[0]!.id)).toBe(true);
  });

  it('duración: reserva lo que falta', () => {
    const [r] = habitsForPlan([habit('leer', 'duration', 'day', 30)], logs({ leer: [{ dayKey: TODAY, value: 10 }] }), TODAY, TODAY);
    expect(r).toMatchObject({ minutes: 20, why: 'hábito de hoy: faltan 20 min' });
  });

  it('mañana: respeta días programados y lo hecho hoy no cuenta', () => {
    const h = [habit('gym', 'binary', 'day', 1, { scheduleDays: [4] }), habit('cama', 'binary'), habit('yoga', 'binary', 'day', 1, { scheduleDays: [3] })];
    const r = habitsForPlan(h, logs({ cama: [{ dayKey: TODAY, value: 1 }] }), TOMORROW, TODAY);
    expect(r.map((x) => x.habitId)).toEqual(['gym', 'cama']);
    expect(r[0]!.why).toBe('hábito de mañana');
  });

  it('con hora propia queda fijo', () => {
    const [r] = habitsForPlan([habit('meditar', 'binary', 'day', 1, { reminderTime: '07:30' })], logs({}), TODAY, TODAY);
    expect(r!.fixedAt).toBe(7 * 60 + 30);
  });

  it('semanales: solo si les falta algo y con lo que falta en el motivo', () => {
    const h = [habit('correr', 'frequency', 'week', 3), habit('nadar', 'frequency', 'week', 1), habit('gym', 'flexible', 'week', 3, { targets: [{ validFrom: d('2026-11-01'), period: 'week', target: 3, sessionMin: 45 }] })];
    const r = habitsForPlan(h, logs({ correr: [{ dayKey: d('2026-11-16'), value: 1 }], nadar: [{ dayKey: d('2026-11-17'), value: 1 }] }), TODAY, TODAY);
    expect(r.map((x) => x.habitId)).toEqual(['correr', 'gym']);
    expect(r[0]!.why).toBe('te faltan 2 veces esta semana');
    expect(r[0]!.task.daysToDue).toBe(4); // la semana cierra el domingo 22
    expect(r[1]!.minutes).toBe(45);
  });
});
