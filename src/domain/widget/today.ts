import { evaluatePeriod, recentPeriods, streaks, targetAt } from '@/domain/habits/evaluate';
import type { HabitDef, PeriodResult } from '@/domain/habits/types';
import { addDays, dayKeyOf, type DayKey } from '@/lib/dates';

/**
 * Widget «Hoy» de Android: la app guarda una instantánea de hábitos y registros recientes y el
 * widget recalcula el día con las mismas reglas que la app (también tras medianoche, sin abrirla).
 */
export const WIDGET_HISTORY_DAYS = 62;

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
  const from = addDays(today, -WIDGET_HISTORY_DAYS - 31);
  return logs.filter((l) => l.dayKey >= from);
}
