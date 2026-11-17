import type { DayKey } from '@/lib/dates';

import { recentPeriods, targetAt } from './evaluate';
import type { HabitDef, HabitLog } from './types';

export interface RecoveryProposal {
  /** Periodos programados consecutivos sin cumplir (sin contar el actual). */
  missedInARow: number;
  /** Objetivo mínimo sugerido para hoy. */
  suggestedTarget: number;
  unit: string | null;
}

/** Mínimo sugerido: el `minTarget` del usuario o ~25 % del objetivo, redondeado a algo razonable. */
export function minimumFor(habit: HabitDef, target: number, minTarget?: number | null): number {
  if (minTarget && minTarget > 0) return minTarget;
  if (habit.kind === 'binary' || habit.kind === 'frequency' || habit.kind === 'flexible') return 1;
  const raw = target * 0.25;
  if (habit.kind === 'duration') return Math.max(5, Math.round(raw / 5) * 5);
  return Math.max(1, Math.round(raw));
}

/**
 * Modo recuperación (REGLAS_NEGOCIO §4): solo para hábitos diarios activos con al menos
 * `threshold` días programados seguidos sin cumplir. No toca el historial.
 */
export function recoveryProposal(habit: HabitDef, logs: HabitLog[], today: DayKey, threshold = 2): RecoveryProposal | null {
  if (habit.archived || habit.kind === 'reduction') return null;
  const t = targetAt(habit, today);
  if (!t || t.period !== 'day') return null;
  const periods = recentPeriods(habit, logs, today, 60);
  if (periods[0]?.status === 'met' || periods[0]?.status === 'paused') return null;
  let missed = 0;
  for (const p of periods.slice(1)) {
    if (p.status === 'notScheduled') continue;
    if (p.status === 'missed') missed += 1;
    else break;
  }
  if (missed < threshold) return null;
  return { missedInARow: missed, suggestedTarget: minimumFor(habit, t.target, t.minTarget), unit: habit.unit ?? null };
}
