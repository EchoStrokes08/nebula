import { addDays, weekdayOf, type DayKey } from '@/lib/dates';

import { evaluatePeriod, recentPeriods, targetAt } from './evaluate';
import { minimumFor } from './recovery';
import type { HabitDef, HabitLog, PeriodResult } from './types';

/**
 * Recomendaciones adaptativas de hábitos (F04-020, PDF §2.02, F11-012).
 * Reglas explicables con umbral mínimo de datos; nunca se aplican solas.
 */
export type AdaptiveChange =
  | { type: 'target'; target: number }
  | { type: 'days'; days: number[] }
  | { type: 'time'; time: string }
  | { type: 'none' };

export interface AdaptiveRecommendation {
  id: string;
  kind: 'minimum' | 'days' | 'time' | 'duration' | 'frequency' | 'split';
  title: string;
  reason: string;
  /** Descripción del cambio antes de aplicarlo (vista previa). */
  preview: string;
  change: AdaptiveChange;
}

export interface TimedLog extends HabitLog { loggedAt?: string }
export interface AdaptiveInput { habit: HabitDef & { reminderTime?: string | null }; logs: TimedLog[]; today: DayKey; timeZone: string; weekStartsOn?: number }

export const MIN_DAILY_PERIODS = 14;
export const MIN_WEEKLY_PERIODS = 6;
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const SLOTS = [
  { from: 5, to: 12, label: 'por la mañana' },
  { from: 12, to: 15, label: 'a mediodía' },
  { from: 15, to: 20, label: 'por la tarde' },
  { from: 20, to: 29, label: 'por la noche' },
] as const;

const closed = (ps: PeriodResult[]) => ps.filter((p) => p.status === 'met' || p.status === 'missed' || p.status === 'partial');
const rate = (ps: PeriodResult[]) => (ps.length ? ps.filter((p) => p.status === 'met').length / ps.length : 0);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };
const niceStep = (v: number) => (v >= 30 ? Math.round(v / 5) * 5 : v >= 5 ? Math.round(v) : Math.round(v * 2) / 2);

function localHour(iso: string, timeZone: string): { hour: number; weekday: number } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23', weekday: 'short' }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.find((p) => p.type === 'weekday')?.value ?? '');
  return Number.isFinite(hour) && wd >= 0 ? { hour, weekday: wd } : null;
}
const slotOf = (hour: number) => SLOTS.findIndex((s) => (hour >= s.from && hour < s.to) || (hour + 24 >= s.from && hour + 24 < s.to));

export function adaptiveRecommendations({ habit, logs, today, timeZone, weekStartsOn = 1 }: AdaptiveInput):
  { status: 'insufficient'; needed: number; have: number } | { status: 'ok'; items: AdaptiveRecommendation[] } {
  const t = targetAt(habit, today);
  if (!t || habit.archived || habit.kind === 'reduction') return { status: 'ok', items: [] };
  const daily = t.period === 'day';
  const periods = closed(recentPeriods(habit, logs, today, daily ? 56 : 12, weekStartsOn).slice(1));
  const needed = daily ? MIN_DAILY_PERIODS : MIN_WEEKLY_PERIODS;
  if (periods.length < needed) return { status: 'insufficient', needed, have: periods.length };

  const items: AdaptiveRecommendation[] = [];
  const recent = periods.slice(0, needed);
  const recentRate = rate(recent);

  // 1) Cantidad/duración realista: los periodos parciales muestran lo que sí se consigue.
  if ((habit.kind === 'duration' || habit.kind === 'quantity' || habit.kind === 'cumulative') && recentRate < 0.6) {
    const partials = recent.filter((p) => p.status === 'partial').map((p) => p.value);
    if (partials.length >= 5) {
      const m = niceStep(median(partials));
      if (m > 0 && m < t.target * 0.9 && m >= t.target * 0.3) {
        const unit = habit.kind === 'duration' ? 'min' : habit.unit ?? '';
        items.push({ id: `duration-${habit.id}-${m}`, kind: 'duration', title: `Ajusta el objetivo a ${m} ${unit}`.trim(), reason: `En ${partials.length} de los últimos ${recent.length} periodos registraste avance sin llegar a ${t.target}; la mediana fue ${m}. Un objetivo alcanzable mantiene la constancia.`, preview: `Objetivo: ${t.target} → ${m} ${unit} desde hoy (el historial no cambia).`, change: { type: 'target', target: m } });
      }
    }
  }

  // 2) Frecuencia semanal/mensual realista.
  if ((habit.kind === 'frequency' || habit.kind === 'flexible') && !daily && recentRate <= 0.34) {
    const counts = recent.map((p) => p.value);
    const m = Math.max(1, Math.round(median(counts)));
    if (m < t.target) items.push({ id: `frequency-${habit.id}-${m}`, kind: 'frequency', title: `Prueba con ${m} ${m === 1 ? 'vez' : 'veces'} por ${t.period === 'week' ? 'semana' : 'mes'}`, reason: `Solo cumpliste ${recent.filter((p) => p.status === 'met').length} de ${recent.length} periodos; lo habitual fue ${m}. Sube de nuevo cuando lo cumplas varias semanas seguidas.`, preview: `Objetivo: ${t.target} → ${m} por ${t.period === 'week' ? 'semana' : 'mes'}.`, change: { type: 'target', target: m } });
  }

  // 3) Días que casi nunca se cumplen (solo hábitos diarios con suficiente constancia el resto).
  if (daily) {
    const byDay = [0, 1, 2, 3, 4, 5, 6].map((d) => periods.filter((p) => weekdayOf(p.start) === d));
    const bad = byDay.map((ps, d) => ({ d, ps })).filter(({ ps }) => ps.length >= 3 && rate(ps) <= 0.25).map(({ d }) => d);
    const others = periods.filter((p) => !bad.includes(weekdayOf(p.start)));
    const scheduled = habit.scheduleDays.length ? habit.scheduleDays : [0, 1, 2, 3, 4, 5, 6];
    const next = scheduled.filter((d) => !bad.includes(d));
    if (bad.length && bad.length <= 3 && next.length >= 2 && rate(others) >= 0.6) {
      const names = bad.map((d) => DAY_NAMES[d]).join(', ');
      items.push({ id: `days-${habit.id}-${bad.join('')}`, kind: 'days', title: `Descansa los ${names}`, reason: `Los ${names} cumpliste como máximo 1 de cada 4 veces, frente a un ${Math.round(rate(others) * 100)} % el resto de días.`, preview: `Días: ${scheduled.map((d) => DAY_NAMES[d]!.slice(0, 3)).join(' ')} → ${next.map((d) => DAY_NAMES[d]!.slice(0, 3)).join(' ')}.`, change: { type: 'days', days: next } });
    }
  }

  // 4) Mejor horario (y combinación día + franja, p. ej. «martes por la noche»).
  const timed = logs.filter((l) => l.value > 0 && l.loggedAt && l.dayKey >= addDays(today, -56)).map((l) => localHour(l.loggedAt!, timeZone)).filter((x): x is { hour: number; weekday: number } => !!x);
  if (timed.length >= 10) {
    const bySlot = SLOTS.map((_, i) => timed.filter((x) => slotOf(x.hour) === i));
    const best = bySlot.map((xs, i) => ({ i, n: xs.length })).sort((a, b) => b.n - a.n)[0]!;
    if (best.n / timed.length >= 0.5) {
      const hours = bySlot[best.i]!.map((x) => x.hour);
      const hour = Math.round(median(hours)) % 24;
      const time = `${String(hour).padStart(2, '0')}:00`;
      const combos = new Map<string, number>();
      for (const x of bySlot[best.i]!) combos.set(String(x.weekday), (combos.get(String(x.weekday)) ?? 0) + 1);
      const top = [...combos.entries()].sort((a, b) => b[1] - a[1])[0];
      const combo = top && top[1] >= 4 && top[1] / timed.length >= 0.25 ? ` Destacan los ${DAY_NAMES[Number(top[0])]} ${SLOTS[best.i]!.label}.` : '';
      if (habit.reminderTime?.slice(0, 2) !== time.slice(0, 2)) {
        items.push({ id: `time-${habit.id}-${time}`, kind: 'time', title: `Planifícalo ${SLOTS[best.i]!.label}`, reason: `${best.n} de tus ${timed.length} registros recientes fueron ${SLOTS[best.i]!.label}.${combo} Es una estimación a partir de la hora en que registras.`, preview: `Horario sugerido: ${habit.reminderTime ?? 'sin hora'} → ${time}.`, change: { type: 'time', time } });
      }
    }
  }

  // 5) Dividir sesiones largas que se quedan a medias.
  if (habit.kind === 'duration' && daily && t.target >= 45 && recent.filter((p) => p.status === 'partial').length / recent.length >= 0.4) {
    const half = niceStep(t.target / 2);
    items.push({ id: `split-${habit.id}`, kind: 'split', title: `Divídelo en dos bloques de ${half} min`, reason: `En muchos días empiezas pero no llegas a ${t.target} min seguidos. Dos bloques separados suman igual y cuentan para el mismo objetivo.`, preview: 'Sin cambios en el objetivo: registra cada bloque por separado o usa dos sesiones de enfoque.', change: { type: 'none' } });
  }

  // 6) Versión mínima tras una caída clara (recientes vs. anteriores).
  const previous = periods.slice(needed, needed * 2);
  if (previous.length >= needed / 2 && recentRate < 0.5 && rate(previous) - recentRate >= 0.25 && !items.some((i) => i.change.type === 'target')) {
    const min = Math.min(t.target, minimumFor(habit, t.target, t.minTarget));
    if (min < t.target) items.push({ id: `minimum-${habit.id}-${min}`, kind: 'minimum', title: `Baja temporalmente a la versión mínima`, reason: `Cumpliste ${recent.filter((p) => p.status === 'met').length}/${recent.length} periodos recientes frente a ${previous.filter((p) => p.status === 'met').length}/${previous.length} anteriores.`, preview: `Objetivo: ${t.target} → ${min} desde hoy. Podrás volver a subirlo.`, change: { type: 'target', target: min } });
  }
  return { status: 'ok', items };
}

/** Evalúa el periodo de hoy (atajo para pruebas y vistas). */
export const todayStatus = (habit: HabitDef, logs: HabitLog[], today: DayKey, weekStartsOn = 1) => evaluatePeriod(habit, logs, today, today, weekStartsOn).status;
