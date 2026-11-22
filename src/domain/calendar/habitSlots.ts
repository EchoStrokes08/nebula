import { isPaused, targetAt } from '@/domain/habits/evaluate';
import type { HabitDef } from '@/domain/habits/types';
import { minutesOf } from '@/lib/time';
import { dayRange, weekdayOf, type DayKey } from '@/lib/dates';

export interface HabitSlot { id: string; name: string; day: DayKey; start: number; end: number; allDay: boolean }
export interface AvailabilitySlot { day: DayKey; start: number; end: number }

/**
 * Hábitos diarios en la agenda: cada día que tocan (según sus días programados, sin pausas ni
 * archivados). Con hora de recordatorio se colocan a esa hora (duración del objetivo si es de
 * minutos, 30 min si no); sin hora aparecen como «todo el día». Un bloque aceptado en Planificar
 * (`planned`, por día y hábito) manda sobre todo lo anterior ese día, también para semanales.
 */
export function habitSlots(
  habits: (HabitDef & { reminderTime?: string | null })[],
  from: DayKey,
  to: DayKey,
  planned: Record<string, Record<string, { start: number; end: number }>> = {},
): HabitSlot[] {
  const out: HabitSlot[] = [];
  for (const h of habits) {
    if (h.archived) continue;
    for (const day of dayRange(from, to)) {
      if (day < h.startDay || isPaused(h, day)) continue;
      const block = planned[day]?.[h.id];
      if (block) {
        out.push({ id: h.id, name: h.name, day, start: block.start, end: block.end, allDay: false });
        continue;
      }
      const target = targetAt(h, day);
      if (!target || target.period !== 'day') continue;
      if (h.scheduleDays.length && !h.scheduleDays.includes(weekdayOf(day))) continue;
      if (h.reminderTime) {
        const start = minutesOf(h.reminderTime.slice(0, 5));
        const len = h.kind === 'duration' ? Math.min(180, Math.max(15, target.target)) : 30;
        out.push({ id: h.id, name: h.name, day, start, end: Math.min(24 * 60, start + len), allDay: false });
      } else {
        out.push({ id: h.id, name: h.name, day, start: 0, end: 24 * 60, allDay: true });
      }
    }
  }
  return out;
}

/** Franjas de disponibilidad (por día de la semana) desplegadas en días concretos. */
export function availabilitySlots(windows: { weekday: number; start: string; end: string }[], from: DayKey, to: DayKey): AvailabilitySlot[] {
  const out: AvailabilitySlot[] = [];
  for (const day of dayRange(from, to)) {
    for (const w of windows) if (w.weekday === weekdayOf(day)) out.push({ day, start: minutesOf(w.start.slice(0, 5)), end: w.end.slice(0, 5) === '23:59' ? 24 * 60 : minutesOf(w.end.slice(0, 5)) });
  }
  return out;
}
