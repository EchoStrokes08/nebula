import { addDays, dayRange, diffDays, startOfMonth, startOfWeek, type DayKey } from '@/lib/dates';

import type { HabitDef, HabitLog, HabitPeriod, HabitTarget, PeriodResult } from './types';

/** Versión del objetivo vigente al inicio de un periodo (D-08: los cambios no reescriben el pasado). */
export function targetAt(habit: HabitDef, day: DayKey): HabitTarget | null {
  let best: HabitTarget | null = null;
  for (const t of habit.targets) {
    if (t.validFrom <= day && (!best || t.validFrom > best.validFrom)) best = t;
  }
  return best ?? null;
}

export function periodBounds(day: DayKey, period: HabitPeriod, weekStartsOn: number): { start: DayKey; end: DayKey } {
  if (period === 'day') return { start: day, end: day };
  if (period === 'week') {
    const start = startOfWeek(day, weekStartsOn);
    return { start, end: addDays(start, 6) };
  }
  const start = startOfMonth(day);
  const [y, m] = start.split('-').map(Number) as [number, number];
  const next = (m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`) as DayKey;
  return { start, end: addDays(next, -1) };
}

export function isPaused(habit: HabitDef, day: DayKey): boolean {
  return habit.pauses.some((p) => p.from <= day && (p.to === null || day <= p.to));
}

function isScheduled(habit: HabitDef, day: DayKey): boolean {
  if (habit.scheduleDays.length === 0) return true;
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return habit.scheduleDays.includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay());
}

/**
 * Evalúa el periodo que contiene `day`.
 * `today` decide si el periodo está cerrado (missed/partial) o en curso (pending).
 */
export function evaluatePeriod(
  habit: HabitDef,
  logs: HabitLog[],
  day: DayKey,
  today: DayKey,
  weekStartsOn = 1,
): PeriodResult {
  const t = targetAt(habit, day) ?? targetAt(habit, habit.startDay) ?? habit.targets[0];
  if (!t) throw new Error(`El hábito ${habit.id} no tiene objetivo`);
  const { start, end } = periodBounds(day, t.period, weekStartsOn);
  const base = { start, end, target: t.target };

  if (end < habit.startDay) return { ...base, status: 'beforeStart', value: 0, progress: 0 };
  if (t.period === 'day') {
    if (isPaused(habit, day)) return { ...base, status: 'paused', value: 0, progress: 0 };
    if (!isScheduled(habit, day)) return { ...base, status: 'notScheduled', value: 0, progress: 0 };
  } else {
    // Un periodo largo cuenta como pausado si estuvo pausado entero.
    const days = dayRange(start, end).filter((d) => d >= habit.startDay);
    if (days.length > 0 && days.every((d) => isPaused(habit, d))) {
      return { ...base, status: 'paused', value: 0, progress: 0 };
    }
  }

  const inPeriod = logs.filter((l) => l.dayKey >= start && l.dayKey <= end && !isPaused(habit, l.dayKey));
  const closed = end < today;
  const sum = inPeriod.reduce((acc, l) => acc + l.value, 0);

  if (habit.kind === 'reduction') {
    if (inPeriod.length === 0) {
      return { ...base, status: closed ? 'unknown' : 'pending', value: 0, progress: 0 };
    }
    const ok = sum <= t.target;
    if (!ok) return { ...base, status: closed ? 'missed' : 'pending', value: sum, progress: 0 };
    // Dentro del límite: el periodo en curso aún puede superarse, así que sigue pendiente.
    return { ...base, status: closed ? 'met' : 'pending', value: sum, progress: 1 };
  }

  let value: number;
  switch (habit.kind) {
    case 'binary':
      value = inPeriod.some((l) => l.value > 0) ? 1 : 0;
      break;
    case 'frequency':
      value = inPeriod.filter((l) => l.value > 0).length;
      break;
    case 'flexible': {
      const perDay = new Map<string, number>();
      for (const l of inPeriod) perDay.set(l.dayKey, (perDay.get(l.dayKey) ?? 0) + l.value);
      const min = t.sessionMin ?? 0;
      value = [...perDay.values()].filter((v) => v > 0 && v >= min).length;
      break;
    }
    default:
      value = sum; // duration, quantity, cumulative
  }

  const target = habit.kind === 'binary' ? 1 : t.target;
  const progress = target > 0 ? Math.min(1, value / target) : 0;
  if (value >= target) return { ...base, target, status: 'met', value, progress };
  if (!closed) return { ...base, target, status: 'pending', value, progress };
  return { ...base, target, status: value > 0 ? 'partial' : 'missed', value, progress };
}

/** Periodos (más recientes primero) desde `today` hacia atrás hasta `habit.startDay`, como máximo `limit`. */
export function recentPeriods(
  habit: HabitDef,
  logs: HabitLog[],
  today: DayKey,
  limit: number,
  weekStartsOn = 1,
): PeriodResult[] {
  const out: PeriodResult[] = [];
  let cursor = today;
  while (out.length < limit && cursor >= habit.startDay) {
    const r = evaluatePeriod(habit, logs, cursor, today, weekStartsOn);
    out.push(r);
    cursor = addDays(r.start, -1);
  }
  return out;
}

const COUNTED = new Set(['met', 'partial', 'missed']);

/**
 * Constancia: % de periodos cerrados cumplidos en la ventana. No cuentan pausas, días no
 * programados, el periodo en curso ni los días de reducción sin registro.
 */
export function consistency(periods: PeriodResult[]): { met: number; evaluated: number; ratio: number | null } {
  const evaluated = periods.filter((p) => COUNTED.has(p.status));
  const met = evaluated.filter((p) => p.status === 'met').length;
  return { met, evaluated: evaluated.length, ratio: evaluated.length ? met / evaluated.length : null };
}

/**
 * Racha actual y mejor. Pausas y días no programados no rompen ni suman; el periodo en curso
 * suma si ya está cumplido y no rompe si sigue pendiente. Un `unknown` corta la racha
 * (no se puede afirmar que se cumplió).
 */
export function streaks(periodsNewestFirst: PeriodResult[]): { current: number; best: number } {
  let current = 0;
  let best = 0;
  let run = 0;
  let currentOpen = true;
  for (const p of periodsNewestFirst) {
    if (p.status === 'paused' || p.status === 'notScheduled' || p.status === 'beforeStart') continue;
    if (p.status === 'pending' && currentOpen && run === 0) continue;
    if (p.status === 'met') {
      run += 1;
      best = Math.max(best, run);
      if (currentOpen) current = run;
    } else {
      currentOpen = false;
      run = 0;
    }
  }
  return { current, best };
}

/** Días transcurridos desde el último periodo cumplido (para el modo recuperación). */
export function daysSinceLastMet(periodsNewestFirst: PeriodResult[], today: DayKey): number | null {
  const last = periodsNewestFirst.find((p) => p.status === 'met');
  return last ? diffDays(last.end, today) : null;
}
