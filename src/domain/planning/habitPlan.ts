import { evaluatePeriod, targetAt } from '@/domain/habits/evaluate';
import type { HabitDef, HabitLog } from '@/domain/habits/types';
import { minutesOf } from '@/lib/time';
import { diffDays, type DayKey } from '@/lib/dates';

import type { PlanTask } from './scheduler';

/**
 * Hábitos dentro del plan del día (REGLAS_NEGOCIO §8). Entran los que tocan ese día y no están
 * cumplidos: los diarios como «de hoy» y los semanales/mensuales solo si aún les falta algo en su
 * periodo. Los de reducción no se planifican (no hay nada que hacer, solo no pasarse).
 * Los diarios con hora propia ya ocupan su hueco en la agenda: se muestran fijos, no se mueven.
 */
export const HABIT_PREFIX = 'habit:';
/** Minutos por defecto para un hábito sin duración (binario, cantidad, veces). */
export const HABIT_DEFAULT_MINUTES = 15;

export interface HabitPlanItem {
  /** Id para el planificador: `habit:<id>` (no choca con los ids de tareas). */
  id: string;
  habitId: string;
  title: string;
  minutes: number;
  /** Por qué entra en el plan, en lenguaje llano. */
  why: string;
  /** Hora propia (minutos locales): ya está en la agenda y no se recoloca. */
  fixedAt: number | null;
  task: PlanTask;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

export function habitsForPlan(
  habits: (HabitDef & { reminderTime?: string | null })[],
  logsFor: (habitId: string) => HabitLog[],
  day: DayKey,
  today: DayKey,
  weekStartsOn = 1,
): HabitPlanItem[] {
  const out: HabitPlanItem[] = [];
  for (const h of habits) {
    if (h.archived || h.kind === 'reduction') continue;
    const t = targetAt(h, day);
    if (!t) continue;
    const r = evaluatePeriod(h, logsFor(h.id), day, today, weekStartsOn);
    if (r.status !== 'pending' && r.status !== 'missed' && r.status !== 'partial') continue;
    const left = Math.max(0, r.target - r.value);
    if (left <= 0) continue;
    const label = day === today ? 'hoy' : 'mañana';
    let minutes: number;
    let why: string;
    if (t.period === 'day') {
      minutes = h.kind === 'duration' ? clamp(Math.ceil(left), 5, 180) : HABIT_DEFAULT_MINUTES;
      why = h.kind === 'duration' && r.value > 0 ? `hábito de ${label}: faltan ${fmt(left)} min` : `hábito de ${label}`;
    } else {
      const daysLeft = Math.max(1, diffDays(day, r.end) + 1);
      const word = t.period === 'week' ? 'esta semana' : 'este mes';
      if (h.kind === 'flexible') minutes = clamp(t.sessionMin ?? 30, 10, 180);
      else if (h.kind === 'duration' || (h.kind === 'cumulative' && (h.unit === 'min' || !h.unit))) minutes = clamp(Math.ceil(left / daysLeft / 5) * 5, 10, 120);
      else minutes = HABIT_DEFAULT_MINUTES * (h.kind === 'frequency' ? 1 : 2);
      const unit = h.kind === 'frequency' || h.kind === 'flexible' ? (left === 1 ? ' vez' : ' veces') : h.unit ? ` ${h.unit}` : h.kind === 'duration' ? ' min' : '';
      why = `te ${left === 1 ? 'falta' : 'faltan'} ${fmt(left)}${unit} ${word}`;
    }
    const fixedAt = t.period === 'day' && h.reminderTime ? minutesOf(h.reminderTime.slice(0, 5)) : null;
    const id = `${HABIT_PREFIX}${h.id}`;
    out.push({
      id,
      habitId: h.id,
      title: h.name,
      minutes,
      why,
      fixedAt,
      task: {
        id,
        title: h.name,
        minutes,
        // Los diarios tocan ese mismo día; los demás «vencen» al cerrar su periodo.
        priority: 2,
        daysToDue: t.period === 'day' ? 0 : diffDays(day, r.end),
        unlocks: 0,
        pendingPrereqs: [],
      },
    });
  }
  return out;
}

export const isHabitPlanId = (id: string) => id.startsWith(HABIT_PREFIX);
