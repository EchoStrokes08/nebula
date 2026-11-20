import { addDays, type DayKey } from '@/lib/dates';

import { evaluatePeriod, isPaused, periodBounds, targetAt } from './evaluate';
import type { HabitDef, HabitLog } from './types';

/**
 * Día de descanso planificado (uno por semana, solo hoy o mañana). Es una pausa de un día: no
 * rompe la racha ni cuenta en la constancia, igual que cualquier pausa. Respeta D-05 porque se
 * decide antes de que el día termine y nunca se aplica a días pasados (no es un comodín retroactivo).
 */
export const RESTS_PER_WEEK = 1;

/** Días de descanso: pausas que empiezan y terminan el mismo día. */
export const restDaysOf = (habit: HabitDef): DayKey[] => habit.pauses.filter((p) => p.to !== null && p.from === p.to).map((p) => p.from);

export interface RestOffer {
  /** Días que se pueden marcar como descanso (hoy y/o mañana). */
  options: { day: DayKey; label: 'hoy' | 'mañana' }[];
  /** Descanso ya usado en la semana de hoy, si lo hay. */
  usedThisWeek: DayKey | null;
  /** null si el hábito no admite descansos (periodo semanal/mensual o archivado). */
  unavailable: string | null;
}

function scheduled(habit: HabitDef, day: DayKey): boolean {
  if (habit.scheduleDays.length === 0) return true;
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return habit.scheduleDays.includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay());
}

function usedInWeekOf(habit: HabitDef, day: DayKey, weekStartsOn: number): DayKey | null {
  const { start, end } = periodBounds(day, 'week', weekStartsOn);
  return restDaysOf(habit).find((d) => d >= start && d <= end) ?? null;
}

export function restOffer(habit: HabitDef, logs: HabitLog[], today: DayKey, weekStartsOn = 1): RestOffer {
  const used = usedInWeekOf(habit, today, weekStartsOn);
  if (habit.archived) return { options: [], usedThisWeek: used, unavailable: 'Está archivado.' };
  if (targetAt(habit, today)?.period !== 'day') return { options: [], usedThisWeek: used, unavailable: 'Solo para hábitos diarios: en los semanales ya eliges qué días hacerlo.' };

  const options: RestOffer['options'] = [];
  const candidates: { day: DayKey; label: 'hoy' | 'mañana' }[] = [{ day: today, label: 'hoy' }, { day: addDays(today, 1), label: 'mañana' }];
  for (const c of candidates) {
    if (c.day < habit.startDay || !scheduled(habit, c.day) || isPaused(habit, c.day)) continue;
    if (usedInWeekOf(habit, c.day, weekStartsOn)) continue;
    // Hoy solo si aún no está cumplido: descansar un día ya hecho no tiene sentido.
    if (c.label === 'hoy' && evaluatePeriod(habit, logs, today, today, weekStartsOn).status === 'met') continue;
    options.push(c);
  }
  return { options, usedThisWeek: used, unavailable: null };
}
