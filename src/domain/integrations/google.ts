import type { ImportedEvent } from './ics';

/** Evento tal como lo devuelve la API de Google Calendar (`events.list` con `singleEvents=true`). */
export interface GoogleEvent {
  id: string;
  status?: string;
  summary?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
}

const MAX_SPAN = 14 * 86_400_000; // límite de duración de calendar_events

/**
 * Convierte los eventos de un calendario de Google al formato de importación de Nebula.
 * Las repeticiones (diarias, semanales, mensuales) ya llegan expandidas como instancias.
 * Los de día completo se guardan a medianoche UTC, igual que los de ICS.
 */
export function mapGoogleEvents(calendarId: string, items: GoogleEvent[], calendarTz = 'UTC'): ImportedEvent[] {
  const out: ImportedEvent[] = [];
  for (const e of items) {
    if (!e.id || e.status === 'cancelled' || !e.start || !e.end) continue;
    const allDay = !!e.start.date && !e.start.dateTime;
    const startIso = allDay ? `${e.start.date}T00:00:00.000Z` : e.start.dateTime;
    const endIso = allDay ? `${e.end.date ?? e.start.date}T00:00:00.000Z` : e.end.dateTime;
    if (!startIso || !endIso) continue;
    const start = new Date(startIso);
    let end = new Date(endIso);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) continue;
    if (end.getTime() <= start.getTime()) end = new Date(start.getTime() + (allDay ? 86_400_000 : 15 * 60_000));
    if (end.getTime() - start.getTime() > MAX_SPAN) end = new Date(start.getTime() + MAX_SPAN);
    out.push({
      external_id: `${calendarId}:${e.id}`.slice(0, 500),
      title: (e.summary?.trim() || 'Ocupado').slice(0, 160),
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      all_day: allDay,
      tz: allDay ? 'UTC' : (e.start.timeZone || calendarTz || 'UTC').slice(0, 64),
    });
  }
  return out;
}

/** Trocea en lotes (la función de importación admite como mucho 500 eventos por llamada). */
export function chunks<T>(list: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
