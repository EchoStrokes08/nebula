import { db, unwrap, unwrapOne } from '@/data/db';
import type { CalendarEvent } from '@/domain/calendar/expand';
import type { DayKey } from '@/lib/dates';

export interface EventRecord extends CalendarEvent {
  notes: string | null;
  location: string | null;
  reminderMinutes: number | null;
}

type Row = {
  id: string;
  title: string;
  notes: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  tz: string;
  category: string;
  recurrence: string | null;
  recurrence_until: string | null;
  reminder_minutes: number | null;
  source: CalendarEvent['source'];
};

const map = (r: Row): EventRecord => ({
  id: r.id,
  title: r.title,
  notes: r.notes,
  location: r.location,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  allDay: r.all_day,
  tz: r.tz,
  category: r.category,
  recurrence: r.recurrence,
  recurrenceUntil: r.recurrence_until as DayKey | null,
  reminderMinutes: r.reminder_minutes,
  source: r.source,
});

export async function fetchEvents(): Promise<EventRecord[]> {
  return (unwrap(await db().from('calendar_events').select('*').order('starts_at')) as Row[]).map(map);
}

export interface EventInput {
  title: string;
  notes?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  tz: string;
  category: string;
  recurrence: string | null;
  recurrenceUntil: DayKey | null;
  reminderMinutes: number | null;
}

const toRow = (e: EventInput) => ({
  title: e.title,
  notes: e.notes || null,
  location: e.location || null,
  starts_at: e.startsAt,
  ends_at: e.endsAt,
  all_day: e.allDay,
  tz: e.tz,
  category: e.category,
  recurrence: e.recurrence,
  recurrence_until: e.recurrenceUntil,
  reminder_minutes: e.reminderMinutes,
});

export async function createEvent(e: EventInput) {
  return unwrapOne(await db().from('calendar_events').insert(toRow(e)).select('id').single()).id as string;
}
export async function updateEvent(id: string, e: EventInput) {
  unwrap(await db().from('calendar_events').update(toRow(e)).eq('id', id));
}
export async function deleteEvent(id: string) {
  unwrap(await db().from('calendar_events').delete().eq('id', id));
}

export interface Window {
  id: string;
  weekday: number;
  start: string; // HH:MM
  end: string;
}

export async function fetchAvailability(): Promise<Window[]> {
  const rows = unwrap(await db().from('availability_windows').select('*').order('weekday').order('start_time')) as { id: string; weekday: number; start_time: string; end_time: string }[];
  return rows.map((r) => ({ id: r.id, weekday: r.weekday, start: r.start_time.slice(0, 5), end: r.end_time.slice(0, 5) }));
}

/** Sustituye todas las franjas por las indicadas. */
export async function saveAvailability(windows: Omit<Window, 'id'>[]) {
  unwrap(await db().from('availability_windows').delete().gte('weekday', 0));
  if (windows.length) unwrap(await db().from('availability_windows').insert(windows.map((w) => ({ weekday: w.weekday, start_time: w.start, end_time: w.end }))));
}

export interface FocusSessionRecord {
  id: string;
  mode: 'pomodoro' | 'custom' | 'long';
  plannedMinutes: number;
  startedAt: string;
  endedAt: string | null;
  focusedSeconds: number;
  pausedSeconds: number;
  status: 'active' | 'completed' | 'abandoned';
  endedEarly: boolean;
  habitId: string | null;
  taskId: string | null;
  note: string | null;
}

export async function fetchFocusSessions(sinceIso: string): Promise<FocusSessionRecord[]> {
  const rows = unwrap(await db().from('focus_sessions').select('*').gte('started_at', sinceIso).order('started_at', { ascending: false })) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    mode: r.mode as FocusSessionRecord['mode'],
    plannedMinutes: r.planned_minutes as number,
    startedAt: r.started_at as string,
    endedAt: (r.ended_at as string) ?? null,
    focusedSeconds: r.focused_seconds as number,
    pausedSeconds: r.paused_seconds as number,
    status: r.status as FocusSessionRecord['status'],
    endedEarly: r.ended_early as boolean,
    habitId: (r.habit_id as string) ?? null,
    taskId: (r.task_id as string) ?? null,
    note: (r.note as string) ?? null,
  }));
}

export async function saveFocusSession(s: {
  clientId: string;
  mode: FocusSessionRecord['mode'];
  plannedMinutes: number;
  startedAt: string;
  endedAt: string;
  focusedSeconds: number;
  pausedSeconds: number;
  endedEarly: boolean;
  habitId: string | null;
  taskId: string | null;
}): Promise<string> {
  const row = unwrapOne(
    await db()
      .from('focus_sessions')
      .upsert(
        {
          client_id: s.clientId,
          mode: s.mode,
          planned_minutes: Math.min(480, Math.max(1, s.plannedMinutes)),
          started_at: s.startedAt,
          ended_at: s.endedAt,
          focused_seconds: s.focusedSeconds,
          paused_seconds: s.pausedSeconds,
          status: s.focusedSeconds > 0 ? 'completed' : 'abandoned',
          ended_early: s.endedEarly,
          habit_id: s.habitId,
          task_id: s.taskId,
        },
        { onConflict: 'user_id,client_id' },
      )
      .select('id')
      .single(),
  );
  return row.id as string;
}

export const DISTRACTION_KINDS = [
  { v: 'notificaciones', l: 'Notificaciones' },
  { v: 'redes', l: 'Redes sociales' },
  { v: 'personas', l: 'Personas' },
  { v: 'ruido', l: 'Ruido' },
  { v: 'cansancio', l: 'Cansancio' },
  { v: 'hambre', l: 'Hambre' },
  { v: 'otra', l: 'Otra' },
] as const;
export type DistractionKind = (typeof DISTRACTION_KINDS)[number]['v'];

export async function logDistraction(d: { sessionId: string | null; kind: DistractionKind; durationMinutes: number | null; abandoned: boolean; note: string | null }) {
  unwrap(await db().from('distraction_logs').insert({ session_id: d.sessionId, kind: d.kind, duration_minutes: d.durationMinutes, abandoned_session: d.abandoned, note: d.note }));
}

export async function fetchDistractions(sinceIso: string) {
  return unwrap(await db().from('distraction_logs').select('id, session_id, kind, occurred_at, duration_minutes, abandoned_session, note').gte('occurred_at', sinceIso).order('occurred_at', { ascending: false })) as {
    id: string;
    session_id: string | null;
    kind: DistractionKind;
    occurred_at: string;
    duration_minutes: number | null;
    abandoned_session: boolean;
    note: string | null;
  }[];
}
