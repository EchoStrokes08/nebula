import { addDays, startOfWeek, weekdayOf, type DayKey } from '@/lib/dates';

import { evaluatePeriod, targetAt } from './evaluate';
import type { HabitDef, HabitLog } from './types';

export interface WeekPoint {
  weekStart: DayKey;
  /** 0..1: días cumplidos / días evaluables (diarios) o progreso del periodo (semanales/mensuales). */
  rate: number | null;
  /** Suma de lo registrado en la semana (para tipos con cantidad). */
  total: number;
}

/** Serie semanal (más antigua primero) para la tendencia. */
export function weeklySeries(habit: HabitDef, logs: HabitLog[], today: DayKey, weeks = 8, weekStartsOn = 1): WeekPoint[] {
  const thisWeek = startOfWeek(today, weekStartsOn);
  const out: WeekPoint[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const start = addDays(thisWeek, -7 * w);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) => d <= today && d >= habit.startDay);
    const total = logs.filter((l) => l.dayKey >= start && l.dayKey <= addDays(start, 6)).reduce((a, l) => a + l.value, 0);
    if (days.length === 0) {
      out.push({ weekStart: start, rate: null, total });
      continue;
    }
    const t = targetAt(habit, days[0]!);
    if (t && t.period !== 'day') {
      const r = evaluatePeriod(habit, logs, days[days.length - 1]!, today, weekStartsOn);
      out.push({ weekStart: start, rate: r.status === 'paused' ? null : habit.kind === 'reduction' ? (r.status === 'missed' ? 0 : r.status === 'met' ? 1 : null) : r.progress, total });
      continue;
    }
    let met = 0;
    let evaluated = 0;
    for (const d of days) {
      const r = evaluatePeriod(habit, logs, d, today, weekStartsOn);
      if (r.status === 'met' || r.status === 'partial' || r.status === 'missed') {
        evaluated += 1;
        if (r.status === 'met') met += 1;
      }
    }
    out.push({ weekStart: start, rate: evaluated ? met / evaluated : null, total });
  }
  return out;
}

/** Cambio entre las últimas `n` semanas cerradas y las `n` anteriores (puntos porcentuales). */
export function compareRecent(series: WeekPoint[], n = 4): { current: number | null; previous: number | null; delta: number | null } {
  const closed = series.slice(0, -1); // la semana en curso no se compara
  const avg = (xs: WeekPoint[]) => {
    const v = xs.map((x) => x.rate).filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const current = avg(closed.slice(-n));
  const previous = avg(closed.slice(-2 * n, -n));
  return { current, previous, delta: current !== null && previous !== null ? current - previous : null };
}

/** Días con registro (>0) por día de la semana (0 = domingo). */
export function weekdayDistribution(logs: HabitLog[]): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const seen = new Set<string>();
  for (const l of logs) {
    if (l.value <= 0 || seen.has(l.dayKey)) continue;
    seen.add(l.dayKey);
    counts[weekdayOf(l.dayKey)]! += 1;
  }
  return counts;
}

/** Mejor día solo si hay datos suficientes (≥ 8 días con registro) y destaca claramente. */
export function bestWeekday(counts: number[]): number | null {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total < 8) return null;
  const max = Math.max(...counts);
  const winners = counts.filter((c) => c === max).length;
  return winners === 1 ? counts.indexOf(max) : null;
}
