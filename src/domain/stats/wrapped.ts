import { recentPeriods, streaks, targetAt } from '@/domain/habits/evaluate';
import type { HabitDef, HabitLog } from '@/domain/habits/types';
import { addDays, dayRange, diffDays, type DayKey } from '@/lib/dates';

import { bestFocusWindow, dailyCompletion, periodStats } from './stats';

/**
 * Resumen mensual o anual («Wrapped»): solo datos reales del periodo, sin puntos ni niveles (D-05).
 * Si un dato no tiene muestra suficiente se omite en lugar de inventarlo.
 */
export interface WrappedInput {
  habits: (HabitDef & { name: string; logs: HabitLog[] })[];
  focus: { day: DayKey; minutes: number; startHour: number; endedEarly: boolean }[];
  tasksDone: { day: DayKey }[];
  from: DayKey;
  to: DayKey;
  today: DayKey;
  weekStartsOn?: number;
}

export interface Wrapped {
  days: number;
  activeDays: number;
  completionRate: number | null;
  /** Días en que se cumplieron todos los hábitos que tocaban. */
  perfectDays: number;
  habitChecks: number;
  star: { name: string; met: number } | null;
  bestStreak: { name: string; days: number } | null;
  tasksCompleted: number;
  focusMinutes: number;
  focusSessions: number;
  focusWindow: { from: number; to: number } | null;
  /** 0 = domingo. Solo con ≥ 3 semanas de datos. */
  bestWeekday: number | null;
}

const MIN_WEEKDAY_SAMPLES = 3;

export function wrapped(input: WrappedInput): Wrapped {
  const { from, today, weekStartsOn = 1 } = input;
  const to = input.to > today ? today : input.to;
  const habitsActive = input.habits.filter((h) => !h.archived || h.logs.some((l) => l.dayKey >= from));
  const completion = dailyCompletion(habitsActive, from, to, today);
  const base = periodStats({ completion, focus: input.focus, tasksDone: input.tasksDone }, from, to);

  let perfectDays = 0;
  const byWeekday = Array.from({ length: 7 }, () => ({ met: 0, evaluated: 0, days: 0 }));
  for (const day of dayRange(from, to)) {
    const c = completion.get(day);
    if (!c?.evaluated) continue;
    if (c.met === c.evaluated) perfectDays++;
    const wd = new Date(`${day}T12:00:00Z`).getUTCDay();
    byWeekday[wd]!.met += c.met;
    byWeekday[wd]!.evaluated += c.evaluated;
    byWeekday[wd]!.days++;
  }
  const ranked = byWeekday
    .map((w, i) => ({ i, rate: w.evaluated ? w.met / w.evaluated : -1, days: w.days }))
    .filter((w) => w.days >= MIN_WEEKDAY_SAMPLES)
    .sort((a, b) => b.rate - a.rate);

  let star: Wrapped['star'] = null;
  let bestStreak: Wrapped['bestStreak'] = null;
  let habitChecks = 0;
  const window = diffDays(from, to) + 1;
  for (const h of habitsActive) {
    habitChecks += h.logs.filter((l) => l.dayKey >= from && l.dayKey <= to && l.value > 0).length;
    // Periodos que empiezan dentro del rango (no cuentan rachas de antes del periodo).
    const periods = recentPeriods(h, h.logs, to, window + 31, weekStartsOn).filter((p) => p.start >= from && p.end <= to);
    const met = periods.filter((p) => p.status === 'met').length;
    if (met > 0 && (!star || met > star.met)) star = { name: h.name, met };
    const best = streaks(periods).best;
    if (targetAt(h, to)?.period === 'day' && best >= 2 && (!bestStreak || best > bestStreak.days)) bestStreak = { name: h.name, days: best };
  }

  const focus = input.focus.filter((f) => f.day >= from && f.day <= to);
  const fw = bestFocusWindow(focus.map((f) => ({ startHour: f.startHour, minutes: f.minutes, endedEarly: f.endedEarly })));
  return {
    days: diffDays(from, to) + 1,
    activeDays: base.activeDays,
    completionRate: base.completionRate,
    perfectDays,
    habitChecks,
    star,
    bestStreak,
    tasksCompleted: base.tasksCompleted,
    focusMinutes: base.focusMinutes,
    focusSessions: focus.filter((f) => f.minutes > 0).length,
    focusWindow: fw ? { from: fw.from, to: fw.to } : null,
    bestWeekday: ranked[0] && ranked[0].rate > 0 ? ranked[0].i : null,
  };
}

/** Periodo del resumen: el mes en curso (o el anterior durante sus 3 primeros días) y el año. */
export function wrappedRange(kind: 'mes' | 'año', today: DayKey): { from: DayKey; to: DayKey; label: string } {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  if (kind === 'año') {
    const year = m === 1 && d <= 7 ? y - 1 : y;
    return { from: `${year}-01-01` as DayKey, to: `${year}-12-31` as DayKey, label: String(year) };
  }
  const prev = d <= 3;
  const yy = prev && m === 1 ? y - 1 : y;
  const mm = prev ? (m === 1 ? 12 : m - 1) : m;
  const from = `${yy}-${String(mm).padStart(2, '0')}-01` as DayKey;
  const next = (mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, '0')}-01`) as DayKey;
  return { from, to: addDays(next, -1), label: `${MONTHS[mm - 1]} ${yy}` };
}
