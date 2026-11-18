/**
 * Planificación robusta de un plan para una meta: el modelo propone fechas, pero no conoce bien
 * la carga real de la persona ni respeta siempre el orden. Aquí se corrigen sin IA:
 *  - ninguna tarea antes de hoy ni antes de las tareas de las que depende;
 *  - solo en los días activos de la persona;
 *  - sin pasar del tope diario de minutos, contando las tareas que ya tiene ese día;
 *  - los hitos quedan en orden y no antes de su última tarea.
 * Este archivo no importa nada: lo comparten la app y la Edge Function (Deno).
 */

export interface ScheduleTask { day: string | null; minutes: number | null; after: number[]; milestone: number | null }
export interface SchedulePlan { day: string | null; milestones: (string | { title: string; day: string | null })[]; tasks: ScheduleTask[]; adjustments?: string[] }
export interface ScheduleContext {
  today: string;
  /** 0 = domingo … 6 = sábado. Vacío = todos los días. */
  activeDays: number[];
  /** Minutos ya comprometidos por día (tareas abiertas con fecha y estimación). */
  busy: Record<string, number>;
  /** Minutos máximos al día entre lo existente y el plan. */
  dailyCap?: number;
}

const DAY_MS = 86400000;
const DEFAULT_MINUTES = 30;
export const DEFAULT_DAILY_CAP = 120;
const SEARCH_DAYS = 400;

const toTime = (d: string) => Date.parse(`${d}T00:00:00Z`);
const valid = (d: string | null | undefined): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(toTime(d));
export const addDays = (d: string, n: number) => new Date(toTime(d) + n * DAY_MS).toISOString().slice(0, 10);
const weekday = (d: string) => new Date(toTime(d)).getUTCDay();
const later = (a: string, b: string) => (a >= b ? a : b);

/** Corrige las fechas del plan en sitio y devuelve los ajustes hechos, en lenguaje llano. */
export function schedulePlan(plan: SchedulePlan, ctx: ScheduleContext): string[] {
  const notes: string[] = [];
  const cap = Math.max(30, ctx.dailyCap ?? DEFAULT_DAILY_CAP);
  const active = new Set(ctx.activeDays.length ? ctx.activeDays : [0, 1, 2, 3, 4, 5, 6]);
  const load: Record<string, number> = { ...ctx.busy };
  let moved = 0;
  let filled = 0;

  // Dependencias solo hacia tareas anteriores: así no hay ciclos y el orden del plan manda.
  plan.tasks.forEach((t, i) => { t.after = [...new Set(t.after.filter((j) => j < i))]; });

  plan.tasks.forEach((t, i) => {
    const minutes = t.minutes ?? DEFAULT_MINUTES;
    let earliest = ctx.today;
    for (const j of t.after) { const dep = plan.tasks[j]?.day; if (valid(dep)) earliest = later(earliest, dep); }
    // Mantiene el orden del plan: una tarea no va antes que la anterior.
    const prev = i > 0 ? plan.tasks[i - 1]!.day : null;
    if (valid(prev)) earliest = later(earliest, prev);
    let day = valid(t.day) ? later(t.day, earliest) : earliest;
    let guard = 0;
    // Busca el primer día activo con hueco. Si una sola tarea supera el tope, va en un día libre.
    while (guard++ < SEARCH_DAYS && (!active.has(weekday(day)) || ((load[day] ?? 0) + minutes > cap && (load[day] ?? 0) > 0))) day = addDays(day, 1);
    if (!valid(t.day)) filled++;
    else if (day !== t.day) moved++;
    t.day = day;
    load[day] = (load[day] ?? 0) + minutes;
  });
  if (moved) notes.push(`Moví ${moved} ${moved === 1 ? 'tarea' : 'tareas'} para respetar tus días activos, el orden y un máximo de ${cap} min al día.`);
  if (filled) notes.push(`Puse fecha a ${filled} ${filled === 1 ? 'tarea que no tenía' : 'tareas que no tenían'}.`);

  // Hitos: no antes de su última tarea y siempre en orden creciente.
  let floor = ctx.today;
  plan.milestones = plan.milestones.map((m, k) => {
    const item = typeof m === 'string' ? { title: m, day: null as string | null } : { ...m };
    const own = plan.tasks.filter((t) => t.milestone === k && valid(t.day)).map((t) => t.day!).sort();
    let day = valid(item.day) ? item.day : own.length ? own[own.length - 1]! : null;
    if (day && own.length) day = later(day, own[own.length - 1]!);
    if (day) { day = later(day, floor); floor = day; }
    return { title: item.title, day };
  });

  // Fecha objetivo: si el trabajo no cabe, se avisa y se propone una realista.
  const last = [...plan.tasks.map((t) => t.day), ...plan.milestones.map((m) => (typeof m === 'string' ? null : m.day))].filter(valid).sort().pop();
  if (valid(plan.day) && plan.day < ctx.today) plan.day = null;
  if (last && valid(plan.day) && last > plan.day) {
    notes.push(`Con tu ritmo actual el plan termina el ${last}, después de la fecha objetivo (${plan.day}); la he movido para que sea realista.`);
    plan.day = last;
  }
  plan.adjustments = [...(plan.adjustments ?? []), ...notes].slice(0, 10);
  return notes;
}

/** Minutos ya comprometidos por día a partir de las tareas abiertas del contexto. */
export function busyFromTasks(tasks: { status: string; due: string | null; estimate: number | null }[]): Record<string, number> {
  const busy: Record<string, number> = {};
  for (const t of tasks) {
    if (!t.due || t.status === 'done' || t.status === 'cancelled') continue;
    busy[t.due] = (busy[t.due] ?? 0) + (t.estimate ?? DEFAULT_MINUTES);
  }
  return busy;
}
