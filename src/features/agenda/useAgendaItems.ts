import { expandEvents, localMinutes } from '@/domain/calendar/expand';
import { findConflicts } from '@/domain/planning/intervals';
import { useTasks } from '@/features/tasks/hooks';
import { useTimeZone } from '@/features/habits/useToday';
import { dayKeyOf, dayRange, type DayKey } from '@/lib/dates';

import { useEvents, useFocusSessions } from './hooks';

export type AgendaKind = 'event' | 'task' | 'focus';

export interface AgendaItem {
  key: string;
  kind: AgendaKind;
  refId: string;
  title: string;
  day: DayKey;
  start: number; // minutos locales
  end: number;
  allDay: boolean;
  category?: string;
  imported?: boolean;
  conflict: boolean;
}

/** Elementos de la agenda entre dos días (incl.) en la zona del usuario, con conflictos marcados. */
export function useAgendaItems(from: DayKey, to: DayKey) {
  const tz = useTimeZone();
  const events = useEvents();
  const tasks = useTasks();
  const focus = useFocusSessions();
  const items: AgendaItem[] = [];

  const pushSpan = (base: Omit<AgendaItem, 'day' | 'start' | 'end' | 'conflict'>, start: Date, end: Date) => {
    // Divide los elementos que cruzan medianoche.
    const d0 = dayKeyOf(start, tz);
    const d1 = dayKeyOf(new Date(end.getTime() - 1), tz);
    for (const day of dayRange(d0, d1)) {
      if (day < from || day > to) continue;
      const s = day === d0 ? localMinutes(start, tz) : 0;
      const e = day === d1 ? localMinutes(end, tz) || 24 * 60 : 24 * 60;
      items.push({ ...base, key: `${base.key}-${day}`, day, start: s, end: Math.max(e, s + 15), conflict: false });
    }
  };

  for (const o of expandEvents(events.data ?? [], from, to, tz)) {
    pushSpan({ key: `e-${o.eventId}-${o.start.toISOString()}`, kind: 'event', refId: o.eventId, title: o.title, allDay: o.allDay, category: o.category, imported: o.source !== 'manual' }, o.start, o.end);
  }
  for (const t of tasks.data ?? []) {
    if (!t.scheduledStart || !t.scheduledEnd || t.status === 'cancelled') continue;
    pushSpan({ key: `t-${t.id}`, kind: 'task', refId: t.id, title: t.title, allDay: false }, new Date(t.scheduledStart), new Date(t.scheduledEnd));
  }
  for (const f of focus.data ?? []) {
    if (!f.endedAt || f.focusedSeconds < 60) continue;
    pushSpan({ key: `f-${f.id}`, kind: 'focus', refId: f.id, title: 'Sesión de enfoque', allDay: false }, new Date(f.startedAt), new Date(f.endedAt));
  }

  // Conflictos: eventos o bloques planificados que se solapan (no se marcan sesiones ya hechas).
  for (const day of dayRange(from, to)) {
    const candidates = items.filter((i) => i.day === day && !i.allDay && i.kind !== 'focus');
    for (const [a, b] of findConflicts(candidates.map((i) => ({ id: i.key, start: i.start, end: i.end })))) {
      for (const i of items) if (i.key === a.id || i.key === b.id) i.conflict = true;
    }
  }

  return {
    items: items.sort((a, b) => a.day.localeCompare(b.day) || a.start - b.start),
    isLoading: events.isLoading || tasks.isLoading,
    error: events.error ?? tasks.error,
  };
}
