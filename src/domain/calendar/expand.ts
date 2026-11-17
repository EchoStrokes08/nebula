import { TZDate } from '@date-fns/tz';

import { addDays, dayKeyOf, diffDays, startOfDayInstant, type DayKey } from '@/lib/dates';
import { nextOccurrence } from '@/domain/tasks/recurrence';

export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: string; // ISO
  endsAt: string;
  allDay: boolean;
  tz: string;
  category: string;
  recurrence: string | null;
  recurrenceUntil: DayKey | null;
  source: 'manual' | 'device_calendar' | 'ics';
}

export interface Occurrence {
  eventId: string;
  title: string;
  category: string;
  start: Date;
  end: Date;
  allDay: boolean;
  source: CalendarEvent['source'];
  /** Día civil (zona del evento) de esta ocurrencia. */
  day: DayKey;
}

/** Hora local (minutos desde medianoche) de un instante en una zona. */
export function localMinutes(instant: Date, tz: string): number {
  const z = new TZDate(instant.getTime(), tz);
  return z.getHours() * 60 + z.getMinutes();
}

/** Instante para un día civil + minutos locales en una zona. */
export function atLocal(day: DayKey, minutes: number, tz: string): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(new TZDate(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0, tz).getTime());
}

/**
 * Expande eventos (con recurrencia) a ocurrencias que intersectan [from, to] (días civiles,
 * inclusivo) en la zona del usuario. Cada repetición conserva la **hora local** del evento en su
 * propia zona, también al cruzar cambios de horario.
 */
export function expandEvents(events: CalendarEvent[], from: DayKey, to: DayKey, userTz: string, maxPerEvent = 400): Occurrence[] {
  const out: Occurrence[] = [];
  const rangeStart = startOfDayInstant(from, userTz).getTime();
  const rangeEnd = startOfDayInstant(addDays(to, 1), userTz).getTime();
  for (const e of events) {
    const start = new Date(e.startsAt);
    const end = new Date(e.endsAt);
    const durationMs = end.getTime() - start.getTime();
    const firstDay = dayKeyOf(start, e.tz);
    const startMin = localMinutes(start, e.tz);
    const push = (day: DayKey) => {
      const s = e.allDay ? startOfDayInstant(day, e.tz) : atLocal(day, startMin, e.tz);
      const en = new Date(s.getTime() + durationMs);
      if (en.getTime() > rangeStart && s.getTime() < rangeEnd) {
        out.push({ eventId: e.id, title: e.title, category: e.category, start: s, end: en, allDay: e.allDay, source: e.source, day });
      }
    };
    if (!e.recurrence) {
      push(firstDay);
      continue;
    }
    // Avanza ocurrencias hasta pasar el rango (o el límite de recurrencia).
    let day: DayKey | null = firstDay;
    let n = 0;
    const lastDay = e.recurrenceUntil && e.recurrenceUntil < to ? e.recurrenceUntil : to;
    // Salto rápido para eventos diarios muy antiguos.
    if (e.recurrence.startsWith('FREQ=DAILY') && !e.recurrence.includes('INTERVAL')) {
      const gap = diffDays(firstDay, addDays(from, -1));
      if (gap > 0) day = addDays(firstDay, gap);
    }
    while (day && day <= lastDay && n < maxPerEvent) {
      push(day);
      day = nextOccurrence(e.recurrence, day);
      n += 1;
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}
