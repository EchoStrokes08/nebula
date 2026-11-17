import { addDays, dayRange, dayKeyOf, weekdayOf, type DayKey } from '@/lib/dates';
import { atLocal } from '@/domain/calendar/expand';
import { minutesOf } from '@/lib/time';

export type NotifKind = 'habits' | 'tasks' | 'events' | 'weekly_summary';

export interface Candidate {
  id: string;
  kind: NotifKind;
  at: Date;
  title: string;
  body: string;
  /** Mayor = más importante cuando hay que recortar por el máximo diario. */
  weight: number;
}

export interface NotifPrefs {
  enabled: Record<NotifKind, boolean>;
  quietStart: string | null; // HH:MM
  quietEnd: string | null;
  maxPerDay: number;
  tz: string;
}

/** Minutos locales de un instante en la zona. */
function localMinutesOf(d: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === 'hour')!.value);
  const m = Number(parts.find((p) => p.type === 'minute')!.value);
  return h * 60 + m;
}

/** ¿Cae en horas de silencio? Admite franjas que cruzan medianoche (22:00–07:00). */
export function inQuietHours(minutes: number, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  const s = minutesOf(start);
  const e = minutesOf(end);
  if (s === e) return false;
  return s < e ? minutes >= s && minutes < e : minutes >= s || minutes < e;
}

/**
 * Aplica preferencias: descarta tipos desactivados, mueve lo que cae en silencio al final del
 * silencio (solo recordatorios de hábitos/tareas; los eventos que caen en silencio se descartan
 * porque moverlos los haría inútiles), descarta el pasado y limita por día (por peso y hora).
 */
export function applyPrefs(candidates: Candidate[], prefs: NotifPrefs, now: Date): Candidate[] {
  const out: Candidate[] = [];
  for (const c of candidates) {
    if (!prefs.enabled[c.kind]) continue;
    let at = c.at;
    const mins = localMinutesOf(at, prefs.tz);
    if (inQuietHours(mins, prefs.quietStart, prefs.quietEnd)) {
      if (c.kind === 'events') continue;
      const endMin = minutesOf(prefs.quietEnd!);
      const day = dayKeyOf(at, prefs.tz);
      at = atLocal(addDays(day, endMin <= mins ? 1 : 0), endMin, prefs.tz);
    }
    if (at.getTime() <= now.getTime()) continue;
    out.push({ ...c, at });
  }
  const byDay = new Map<string, Candidate[]>();
  const dayOf = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: prefs.tz }).format(d);
  for (const c of out) byDay.set(dayOf(c.at), [...(byDay.get(dayOf(c.at)) ?? []), c]);
  const kept: Candidate[] = [];
  for (const list of byDay.values()) {
    kept.push(...[...list].sort((a, b) => b.weight - a.weight || a.at.getTime() - b.at.getTime()).slice(0, Math.max(0, prefs.maxPerDay)));
  }
  return kept.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export interface HabitReminderSource {
  id: string;
  name: string;
  time: string; // HH:MM
  scheduleDays: number[]; // vacío = todos
  doneToday: boolean;
}

/** Recordatorios de hábitos para los próximos `days` días (hoy se omite si ya está hecho). */
export function habitCandidates(habits: HabitReminderSource[], today: DayKey, tz: string, days: number, body: (name: string) => string): Candidate[] {
  const out: Candidate[] = [];
  for (const h of habits) {
    for (const d of dayRange(today, addDays(today, days - 1))) {
      if (h.scheduleDays.length && !h.scheduleDays.includes(weekdayOf(d))) continue;
      if (d === today && h.doneToday) continue;
      out.push({ id: `nebula-habit-${h.id}-${d}`, kind: 'habits', at: atLocal(d, minutesOf(h.time), tz), title: h.name, body: body(h.name), weight: 2 });
    }
  }
  return out;
}

export function weeklySummaryCandidate(reviewDay: number | null, today: DayKey, tz: string): Candidate[] {
  if (reviewDay === null) return [];
  const d = dayRange(today, addDays(today, 6)).find((x) => weekdayOf(x) === reviewDay)!;
  return [{ id: `nebula-weekly-${d}`, kind: 'weekly_summary', at: atLocal(d, 19 * 60, tz), title: 'Tu semana en Nebula', body: 'Revisa lo que lograste y elige tus prioridades para la próxima.', weight: 1 }];
}
