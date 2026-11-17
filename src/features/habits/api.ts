import { supabase } from '@/data/supabase';
import { addDays, type DayKey } from '@/lib/dates';
import type { HabitDef, HabitKind, HabitLog, HabitPeriod, HabitTarget } from '@/domain/habits/types';
import type { UserColor } from '@/design/tokens';

export interface HabitRecord extends HabitDef {
  description: string | null;
  icon: string;
  color: UserColor;
  priority: number;
  sortOrder: number;
  goalId: string | null;
  /** Hora del recordatorio diario (HH:MM) o null. */
  reminderTime: string | null;
}

export interface LogRecord extends HabitLog {
  id: string;
  habitId: string;
  clientId?: string;
  note: string | null;
  source: 'manual' | 'timer' | 'integration';
  loggedAt: string;
}

/** Ventana de historial que se carga para listas y detalle (suficiente para 12 semanas + mes actual). */
export const HISTORY_DAYS = 120;

function db() {
  if (!supabase) throw new Error('Supabase no está configurado');
  return supabase;
}

type HabitRow = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: UserColor;
  kind: HabitKind;
  unit: string | null;
  schedule_days: number[];
  start_day: string;
  priority: number;
  sort_order: number;
  goal_id: string | null;
  suggested_time: string | null;
  status: 'active' | 'archived';
  habit_targets: { valid_from: string; period: HabitPeriod; target: string | number; session_min: string | number | null; min_target: string | number | null }[];
  habit_pauses: { from_day: string; to_day: string | null }[];
};

const num = (v: string | number | null) => (v === null ? null : Number(v));

export function mapHabit(r: HabitRow): HabitRecord {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    icon: r.icon,
    color: r.color,
    kind: r.kind,
    unit: r.unit,
    scheduleDays: r.schedule_days,
    startDay: r.start_day as DayKey,
    priority: r.priority,
    sortOrder: r.sort_order,
    goalId: r.goal_id,
    reminderTime: r.suggested_time ? r.suggested_time.slice(0, 5) : null,
    archived: r.status === 'archived',
    targets: r.habit_targets.map(
      (t): HabitTarget => ({
        validFrom: t.valid_from as DayKey,
        period: t.period,
        target: Number(t.target),
        sessionMin: num(t.session_min),
        minTarget: num(t.min_target),
      }),
    ),
    pauses: r.habit_pauses.map((p) => ({ from: p.from_day as DayKey, to: (p.to_day as DayKey | null) ?? null })),
  };
}

export async function fetchHabits(): Promise<HabitRecord[]> {
  const { data, error } = await db()
    .from('habits')
    .select('id, name, description, icon, color, kind, unit, schedule_days, start_day, priority, sort_order, goal_id, suggested_time, status, habit_targets(valid_from, period, target, session_min, min_target), habit_pauses(from_day, to_day)')
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  // Un hábito sin objetivo no es evaluable (datos dañados): se omite en lugar de romper la vista.
  return (data as unknown as HabitRow[]).map(mapHabit).filter((h) => h.targets.length > 0);
}

export async function fetchLogs(today: DayKey): Promise<LogRecord[]> {
  const { data, error } = await db()
    .from('habit_logs')
    .select('id, client_id, habit_id, day_key, value, note, source, logged_at')
    .gte('day_key', addDays(today, -HISTORY_DAYS))
    .order('logged_at');
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    habitId: r.habit_id,
    clientId: r.client_id,
    dayKey: r.day_key as DayKey,
    value: Number(r.value),
    note: r.note,
    source: r.source,
    loggedAt: r.logged_at,
  }));
}

export interface NewHabit {
  name: string;
  description?: string;
  kind: HabitKind;
  unit?: string | null;
  icon: string;
  color: UserColor;
  scheduleDays: number[];
  startDay: DayKey;
  priority: number;
  period: HabitPeriod;
  target: number;
  sessionMin?: number | null;
  minTarget?: number | null;
  reminderTime?: string | null;
}

/** Crea hábito y primer objetivo en una sola transacción (RPC `create_habit`). */
export async function createHabit(h: NewHabit): Promise<string> {
  const { data, error } = await db().rpc('create_habit', {
    p_name: h.name,
    p_kind: h.kind,
    p_period: h.period,
    p_target: h.target,
    p_start_day: h.startDay,
    p_description: h.description || null,
    p_unit: h.unit || null,
    p_icon: h.icon,
    p_color: h.color,
    p_schedule_days: h.scheduleDays,
    p_priority: h.priority,
    p_suggested_time: h.reminderTime ?? null,
    p_session_min: h.sessionMin ?? null,
    p_min_target: h.minTarget ?? null,
  });
  if (error) throw error;
  return data as string;
}

/** Nueva versión del objetivo desde `from` (las anteriores no se modifican). */
export async function setTarget(habitId: string, from: DayKey, t: Omit<HabitTarget, 'validFrom'>) {
  const { error } = await db()
    .from('habit_targets')
    .upsert(
      { habit_id: habitId, valid_from: from, period: t.period, target: t.target, session_min: t.sessionMin ?? null, min_target: t.minTarget ?? null },
      { onConflict: 'habit_id,valid_from', ignoreDuplicates: false },
    );
  if (error) throw error;
}

export async function updateHabit(id: string, patch: Partial<{ name: string; description: string | null; icon: string; color: UserColor; schedule_days: number[]; priority: number; status: 'active' | 'archived'; suggested_time: string | null }>) {
  const { error } = await db().from('habits').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteHabit(id: string) {
  const { error } = await db().from('habits').delete().eq('id', id);
  if (error) throw error;
}

export async function insertLog(input: { clientId: string; habitId: string; dayKey: DayKey; value: number; tz: string; note?: string | null; source?: 'manual' | 'timer' }) {
  const { error } = await db().from('habit_logs').upsert(
    {
      client_id: input.clientId,
      habit_id: input.habitId,
      day_key: input.dayKey,
      value: input.value,
      tz: input.tz,
      note: input.note ?? null,
      source: input.source ?? 'manual',
    },
    { onConflict: 'user_id,client_id', ignoreDuplicates: true },
  );
  if (error) throw error;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Borra un registro por su id o por su `client_id`: un registro recién creado (optimista)
 * solo conoce su `client_id` hasta que se recarga la lista.
 */
export async function deleteLogByAnyId(idOrClientId: string) {
  if (!UUID_RE.test(idOrClientId)) throw new Error('Identificador de registro no válido');
  const { error } = await db().from('habit_logs').delete().or(`id.eq.${idOrClientId},client_id.eq.${idOrClientId}`);
  if (error) throw error;
}

export async function deleteLog(id: string) {
  const { error } = await db().from('habit_logs').delete().eq('id', id);
  if (error) throw error;
}

export async function updateLog(id: string, patch: { value?: number; note?: string | null; day_key?: DayKey }) {
  const { error } = await db().from('habit_logs').update(patch).eq('id', id);
  if (error) throw error;
}

export async function pauseHabit(habitId: string, from: DayKey, to: DayKey | null) {
  const { error } = await db().from('habit_pauses').insert({ habit_id: habitId, from_day: from, to_day: to });
  if (error) throw error;
}

/**
 * Reanudar: la pausa abierta termina ayer (hoy vuelve a contar). Si la pausa empezó hoy
 * no llegó a cubrir ningún día cerrado y se elimina.
 */
export async function resumeHabit(habitId: string, today: DayKey) {
  const closeOld = await db()
    .from('habit_pauses')
    .update({ to_day: addDays(today, -1) })
    .eq('habit_id', habitId)
    .is('to_day', null)
    .lt('from_day', today);
  if (closeOld.error) throw closeOld.error;
  const dropNew = await db().from('habit_pauses').delete().eq('habit_id', habitId).is('to_day', null).gte('from_day', today);
  if (dropNew.error) throw dropNew.error;
}

/** Registros desde un día (para estadísticas anuales). Solo lo necesario para agregar. */
export async function fetchLogsSince(from: DayKey): Promise<{ habitId: string; dayKey: DayKey; value: number }[]> {
  const { data, error } = await db().from('habit_logs').select('habit_id, day_key, value').gte('day_key', from).limit(20000);
  if (error) throw error;
  return (data ?? []).map((r) => ({ habitId: r.habit_id, dayKey: r.day_key as DayKey, value: Number(r.value) }));
}
