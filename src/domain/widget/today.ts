import { evaluatePeriod, recentPeriods, streaks, targetAt } from '@/domain/habits/evaluate';
import type { HabitDef, PeriodResult } from '@/domain/habits/types';
import { periodOrbit, type OrbitTask, type PeriodOrbit } from '@/domain/stats/orbits';
import { addDays, dayKeyOf, diffDays, startOfWeek, type DayKey } from '@/lib/dates';

/**
 * Widget «Hoy» de Android: la app guarda una instantánea de hábitos y registros recientes y el
 * widget recalcula el día con las mismas reglas que la app (también tras medianoche, sin abrirla).
 */
export const WIDGET_HISTORY_DAYS = 62;
/** Días de registros que guarda la instantánea: 16 semanas completas del mapa de constancia. */
export const MAP_WEEKS = 16;
const MAP_DAYS = MAP_WEEKS * 7 + 6;

export interface WidgetHabit extends HabitDef {
  name: string;
  color: string;
}

export interface WidgetLog {
  id: string;
  clientId?: string;
  habitId: string;
  dayKey: DayKey;
  value: number;
}

export interface WidgetSnapshot {
  v: 1;
  uid: string;
  tz: string;
  weekStartsOn: number;
  habits: WidgetHabit[];
  logs: WidgetLog[];
  /** Solo estado y fecha límite de las tareas (para las órbitas de semana y mes). */
  tasks?: OrbitTask[];
  savedAt: number;
}

export interface WidgetItem {
  id: string;
  name: string;
  color: string;
  done: boolean;
  /** Binarios y de frecuencia se marcan con un toque; el resto abre el hábito en la app. */
  toggleable: boolean;
  /** «2/3 esta semana», «15/30 min»… o null si no aporta (binario diario). */
  detail: string | null;
  /** 0..1 del periodo en curso (para el anillo de los acumulativos). */
  progress: number;
  streak: number;
}

const HIDDEN = new Set<PeriodResult['status']>(['paused', 'notScheduled', 'beforeStart']);
const PERIOD_WORD = { day: '', week: ' esta semana', month: ' este mes' } as const;

function detailFor(h: WidgetHabit, r: PeriodResult): string | null {
  const period = (targetAt(h, r.start) ?? h.targets[0])?.period ?? 'day';
  if (h.kind === 'binary' && period === 'day') return null;
  const unit = h.kind === 'frequency' || h.kind === 'binary' || h.kind === 'flexible' ? '' : h.unit ? ` ${h.unit}` : h.kind === 'duration' ? ' min' : '';
  if (h.kind === 'reduction') return `${fmt(r.value)}/${fmt(r.target)}${unit} máx.`;
  return `${fmt(r.value)}/${fmt(r.target)}${unit}${PERIOD_WORD[period]}`;
}
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

export const widgetToday = (s: Pick<WidgetSnapshot, 'tz'>, now: Date): DayKey => dayKeyOf(now, s.tz);

/** Hábitos de hoy: pendientes primero (en el orden del usuario) y cumplidos al final. */
export function widgetItems(s: WidgetSnapshot, now: Date): { today: DayKey; items: WidgetItem[]; done: number } {
  const today = widgetToday(s, now);
  const items: WidgetItem[] = [];
  for (const h of s.habits) {
    if (h.archived) continue;
    const own = s.logs.filter((l) => l.habitId === h.id);
    const current = evaluatePeriod(h, own, today, today, s.weekStartsOn);
    if (HIDDEN.has(current.status)) continue;
    items.push({
      id: h.id,
      name: h.name,
      color: h.color,
      done: current.status === 'met',
      toggleable: h.kind === 'binary' || h.kind === 'frequency',
      detail: detailFor(h, current),
      progress: current.progress,
      streak: streaks(recentPeriods(h, own, today, WIDGET_HISTORY_DAYS, s.weekStartsOn)).current,
    });
  }
  const pending = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);
  return { today, items: [...pending, ...done], done: done.length };
}

export type ToggleOp =
  | { op: 'insert'; habitId: string; dayKey: DayKey; value: number }
  | { op: 'delete'; ids: string[] };

/**
 * Qué hace un toque en el widget: si ya hay registro hoy, lo deshace; si no, registra 1.
 * Solo para hábitos marcables (binario y frecuencia); los demás se abren en la app.
 */
export function toggleFor(s: WidgetSnapshot, habitId: string, now: Date): ToggleOp | null {
  const h = s.habits.find((x) => x.id === habitId);
  if (!h || h.archived || (h.kind !== 'binary' && h.kind !== 'frequency')) return null;
  const today = widgetToday(s, now);
  const todays = s.logs.filter((l) => l.habitId === habitId && l.dayKey === today && l.value > 0);
  if (todays.length > 0) return { op: 'delete', ids: todays.map((l) => l.clientId ?? l.id) };
  return { op: 'insert', habitId, dayKey: today, value: 1 };
}

/** Aplica la operación a la instantánea (actualización optimista del widget). */
export function applyToggle(s: WidgetSnapshot, op: ToggleOp, clientId: string): WidgetSnapshot {
  if (op.op === 'insert') {
    return { ...s, logs: [...s.logs, { id: clientId, clientId, habitId: op.habitId, dayKey: op.dayKey, value: op.value }] };
  }
  const gone = new Set(op.ids);
  return { ...s, logs: s.logs.filter((l) => !gone.has(l.clientId ?? l.id) && !gone.has(l.id)) };
}

/** Recorta los registros a la ventana que el widget necesita (instantánea pequeña). */
export function trimLogs<T extends { dayKey: DayKey }>(logs: T[], today: DayKey): T[] {
  // 16 semanas para el mapa de constancia (cabe en lo que carga la app: 120 días).
  const from = addDays(today, -MAP_DAYS);
  return logs.filter((l) => l.dayKey >= from);
}

/** Órbitas para el widget «Órbita»: día (hábitos de hoy), semana y mes, y la mejor racha. */
export function widgetOrbits(s: WidgetSnapshot, now: Date): { today: DayKey; day: { done: number; total: number; progress: number }; week: PeriodOrbit; month: PeriodOrbit; streak: number } {
  const { today, items, done } = widgetItems(s, now);
  const logsFor = (id: string) => s.logs.filter((l) => l.habitId === id);
  return {
    today,
    day: { done, total: items.length, progress: items.length ? done / items.length : 0 },
    week: periodOrbit(s.habits, logsFor, s.tasks ?? [], 'week', today, s.weekStartsOn),
    month: periodOrbit(s.habits, logsFor, s.tasks ?? [], 'month', today, s.weekStartsOn),
    streak: Math.max(0, ...items.map((i) => i.streak)),
  };
}

export interface HeatDay {
  day: DayKey;
  /** Parte de los hábitos diarios cumplidos ese día; null si no tocaba ninguno o aún no ha llegado. */
  ratio: number | null;
  future: boolean;
}

/**
 * Mapa de constancia (tipo calendario de contribuciones): `weeks` columnas que terminan en la
 * semana actual, cada una de 7 días empezando por el primer día de la semana del usuario.
 * Solo cuentan los hábitos diarios (los semanales no tienen un «día» que pintar).
 */
export function widgetHeatmap(s: WidgetSnapshot, now: Date, weeks: number): { today: DayKey; days: HeatDay[] } {
  const today = widgetToday(s, now);
  const first = addDays(startOfWeek(today, s.weekStartsOn), -7 * (weeks - 1));
  const daily = s.habits.filter((h) => !h.archived && h.targets.length);
  const byHabit = new Map(daily.map((h) => [h.id, s.logs.filter((l) => l.habitId === h.id)]));
  const days: HeatDay[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const day = addDays(first, i);
    if (day > today) {
      days.push({ day, ratio: null, future: true });
      continue;
    }
    let met = 0;
    let count = 0;
    for (const h of daily) {
      if (targetAt(h, day)?.period !== 'day' || day < h.startDay) continue;
      const r = evaluatePeriod(h, byHabit.get(h.id) ?? [], day, today, s.weekStartsOn);
      if (HIDDEN.has(r.status) || r.status === 'unknown') continue;
      // Una reducción no se puede dar por cumplida hasta que acaba el día: hoy no se pinta.
      if (r.status === 'pending' && day === today && h.kind === 'reduction') continue;
      count += 1;
      if (r.status === 'met') met += 1;
    }
    days.push({ day, ratio: count ? met / count : null, future: false });
  }
  return { today, days };
}

/** Días seguidos (hasta ayer, y hoy si ya está completo) con todos los hábitos diarios hechos. */
export function perfectDays(days: HeatDay[], today: DayKey): number {
  let n = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i]!;
    if (d.future || d.ratio === null) continue;
    if (d.ratio >= 1) n += 1;
    else if (d.day === today) continue;
    else break;
  }
  return n;
}

/** Qué ofrecer en el widget «Enfoque»: el hábito de minutos pendiente de hoy al que más le falta. */
export function focusSuggestion(s: WidgetSnapshot, now: Date): { habitId: string; name: string; leftMinutes: number } | null {
  const today = widgetToday(s, now);
  let best: { habitId: string; name: string; leftMinutes: number } | null = null;
  for (const h of s.habits) {
    if (h.archived || (h.kind !== 'duration' && h.kind !== 'flexible')) continue;
    const r = evaluatePeriod(h, s.logs.filter((l) => l.habitId === h.id), today, today, s.weekStartsOn);
    if (r.status !== 'pending') continue;
    const t = targetAt(h, today);
    const left = h.kind === 'flexible' ? (t?.sessionMin ?? 25) : t?.period === 'day' ? r.target - r.value : Math.ceil((r.target - r.value) / Math.max(1, diffDays(today, r.end) + 1));
    if (left > 0 && (!best || left > best.leftMinutes)) best = { habitId: h.id, name: h.name, leftMinutes: Math.round(left) };
  }
  return best;
}
