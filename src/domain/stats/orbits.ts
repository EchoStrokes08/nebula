import { evaluatePeriod, periodBounds } from '@/domain/habits/evaluate';
import type { HabitDef, HabitLog, PeriodResult } from '@/domain/habits/types';
import { addDays, diffDays, type DayKey } from '@/lib/dates';

/**
 * Órbitas de la semana y del mes (REGLAS_NEGOCIO §4): cuánto llevas y cuánto falta para cerrar
 * bien el periodo. Cada periodo de hábito que cae en la ventana cuenta como una unidad (un día de
 * un hábito diario, la semana de uno semanal…) y suma su progreso parcial; cada tarea con fecha
 * límite en la ventana cuenta como otra unidad. Los días futuros cuentan en el total: así se ve
 * lo que queda por delante, no solo lo que ya pasó.
 */
export type OrbitScope = 'week' | 'month';

export interface OrbitTask {
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  dueDate: DayKey | null;
}

export interface PeriodOrbit {
  scope: OrbitScope;
  start: DayKey;
  end: DayKey;
  /** Unidades cumplidas (con progreso parcial) y totales. */
  done: number;
  total: number;
  /** 0..1 */
  progress: number;
  /** Unidades que faltan, redondeadas hacia arriba. */
  remaining: number;
  habits: { done: number; total: number };
  tasks: { done: number; total: number };
  /** Días que quedan contando hoy. */
  daysLeft: number;
  /** Parte del periodo ya transcurrida (contando hoy entero): 0..1. */
  elapsed: number;
  /** Diferencia con el ritmo uniforme, en unidades (positivo = por delante). */
  pace: number;
}

const SKIP = new Set<PeriodResult['status']>(['paused', 'notScheduled', 'beforeStart']);

export function orbitWindow(scope: OrbitScope, today: DayKey, weekStartsOn: number) {
  return periodBounds(today, scope, weekStartsOn);
}

/** Crédito de un periodo: 1 si se cumplió; si no, su progreso (la reducción solo cuenta al cerrarse). */
function credit(habit: HabitDef, r: PeriodResult): number {
  if (r.status === 'met') return 1;
  if (habit.kind === 'reduction') return 0;
  return r.status === 'unknown' ? 0 : Math.max(0, Math.min(1, r.progress));
}

export function periodOrbit(
  habits: HabitDef[],
  logsFor: (habitId: string) => HabitLog[],
  tasks: OrbitTask[],
  scope: OrbitScope,
  today: DayKey,
  weekStartsOn = 1,
): PeriodOrbit {
  const { start, end } = orbitWindow(scope, today, weekStartsOn);
  const h = { done: 0, total: 0 };
  for (const habit of habits) {
    if (habit.archived || !habit.targets.length || end < habit.startDay) continue;
    const logs = logsFor(habit.id);
    let cursor = start < habit.startDay ? habit.startDay : start;
    while (cursor <= end) {
      const r = evaluatePeriod(habit, logs, cursor, today, weekStartsOn);
      if (!SKIP.has(r.status)) {
        h.total += 1;
        h.done += credit(habit, r);
      }
      // Un periodo semanal que empezó en el mes anterior también cuenta (una vez).
      cursor = addDays(r.end, 1);
    }
  }
  const t = { done: 0, total: 0 };
  for (const task of tasks) {
    if (task.status === 'cancelled' || !task.dueDate || task.dueDate < start || task.dueDate > end) continue;
    t.total += 1;
    if (task.status === 'done') t.done += 1;
  }
  const done = h.done + t.done;
  const total = h.total + t.total;
  const length = diffDays(start, end) + 1;
  const passed = Math.max(0, Math.min(length, diffDays(start, today) + 1));
  const elapsed = passed / length;
  return {
    scope,
    start,
    end,
    done,
    total,
    progress: total ? done / total : 0,
    remaining: Math.max(0, Math.ceil(total - done - 1e-9)),
    habits: { done: round1(h.done), total: h.total },
    tasks: t,
    daysLeft: length - passed + 1,
    elapsed,
    pace: done - total * elapsed,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
