import { addDays, dayRange, diffDays, type DayKey } from '@/lib/dates';
import { evaluatePeriod, targetAt } from '@/domain/habits/evaluate';
import type { HabitDef, HabitLog } from '@/domain/habits/types';

/** Cumplimiento diario de hábitos diarios: periodos cumplidos / evaluables por día. */
export function dailyCompletion(habits: (HabitDef & { logs: HabitLog[] })[], from: DayKey, to: DayKey, today: DayKey): Map<DayKey, { met: number; evaluated: number }> {
  const out = new Map<DayKey, { met: number; evaluated: number }>();
  for (const day of dayRange(from, to)) {
    let met = 0;
    let evaluated = 0;
    for (const h of habits) {
      if (h.archived || day < h.startDay) continue;
      const t = targetAt(h, day);
      if (!t || t.period !== 'day') continue;
      const r = evaluatePeriod(h, h.logs, day, today);
      if (r.status === 'met' || r.status === 'partial' || r.status === 'missed') {
        evaluated += 1;
        if (r.status === 'met') met += 1;
      } else if (r.status === 'pending' && r.progress >= 1) {
        evaluated += 1;
        met += 1;
      }
    }
    out.set(day, { met, evaluated });
  }
  return out;
}

export interface PeriodStats {
  completionRate: number | null;
  focusMinutes: number;
  tasksCompleted: number;
  activeDays: number;
}

export interface StatsInput {
  completion: Map<DayKey, { met: number; evaluated: number }>;
  focus: { day: DayKey; minutes: number }[];
  tasksDone: { day: DayKey }[];
}

export function periodStats(input: StatsInput, from: DayKey, to: DayKey): PeriodStats {
  let met = 0;
  let evaluated = 0;
  const active = new Set<string>();
  for (const day of dayRange(from, to)) {
    const c = input.completion.get(day);
    if (c) {
      met += c.met;
      evaluated += c.evaluated;
      if (c.met > 0) active.add(day);
    }
  }
  const focus = input.focus.filter((f) => f.day >= from && f.day <= to);
  for (const f of focus) if (f.minutes > 0) active.add(f.day);
  const tasks = input.tasksDone.filter((t) => t.day >= from && t.day <= to);
  for (const t of tasks) active.add(t.day);
  return {
    completionRate: evaluated ? met / evaluated : null,
    focusMinutes: focus.reduce((a, f) => a + f.minutes, 0),
    tasksCompleted: tasks.length,
    activeDays: active.size,
  };
}

/** Diferencia con el periodo anterior de igual longitud. */
export function compare(current: PeriodStats, previous: PeriodStats) {
  const pct = (a: number, b: number) => (b > 0 ? (a - b) / b : null);
  return {
    completion: current.completionRate !== null && previous.completionRate !== null ? current.completionRate - previous.completionRate : null,
    focus: pct(current.focusMinutes, previous.focusMinutes),
    tasks: pct(current.tasksCompleted, previous.tasksCompleted),
  };
}

export const previousRange = (from: DayKey, to: DayKey): [DayKey, DayKey] => {
  const len = diffDays(from, to) + 1;
  return [addDays(from, -len), addDays(from, -1)];
};

/** Distribución (top N + «otros») de minutos por etiqueta. */
export function distribution(entries: { label: string; minutes: number }[], top = 5): { label: string; minutes: number; share: number }[] {
  const sums = new Map<string, number>();
  for (const e of entries) sums.set(e.label, (sums.get(e.label) ?? 0) + e.minutes);
  const total = [...sums.values()].reduce((a, b) => a + b, 0);
  if (!total) return [];
  const sorted = [...sums.entries()].sort((a, b) => b[1] - a[1]);
  const head = sorted.slice(0, top);
  const rest = sorted.slice(top).reduce((a, [, v]) => a + v, 0);
  const out = head.map(([label, minutes]) => ({ label, minutes, share: minutes / total }));
  if (rest) out.push({ label: 'Otros', minutes: rest, share: rest / total });
  return out;
}

// ---- Perfil de productividad (F07-010) --------------------------------------------------------

export const MIN_SESSIONS_FOR_PATTERNS = 8;

/** Franja de 2 h con más minutos de enfoque completado (solo con datos suficientes). */
export function bestFocusWindow(sessions: { startHour: number; minutes: number; endedEarly: boolean }[]): { from: number; to: number; share: number } | null {
  if (sessions.length < MIN_SESSIONS_FOR_PATTERNS) return null;
  const bins = new Array(12).fill(0) as number[];
  for (const s of sessions) if (!s.endedEarly) bins[Math.floor(s.startHour / 2)]! += s.minutes;
  const total = bins.reduce((a, b) => a + b, 0);
  if (!total) return null;
  const max = Math.max(...bins);
  const i = bins.indexOf(max);
  return { from: i * 2, to: i * 2 + 2, share: max / total };
}

/**
 * Duración de sesión con mejor tasa de finalización (radar, PDF §2.03: «Tus mejores sesiones
 * duran entre 35 y 50 minutos»). Requiere ≥ 3 sesiones por tramo para compararlo.
 */
export function bestSessionLength(sessions: { minutes: number; endedEarly: boolean }[]): { from: number; to: number; completion: number; n: number } | null {
  if (sessions.length < MIN_SESSIONS_FOR_PATTERNS) return null;
  const buckets: [number, number][] = [
    [0, 20],
    [20, 35],
    [35, 50],
    [50, 75],
    [75, 600],
  ];
  let best: { from: number; to: number; completion: number; n: number } | null = null;
  for (const [a, b] of buckets) {
    const inB = sessions.filter((s) => s.minutes >= a && s.minutes < b);
    if (inB.length < 3) continue;
    const completion = inB.filter((s) => !s.endedEarly).length / inB.length;
    if (!best || completion > best.completion || (completion === best.completion && inB.length > best.n)) best = { from: a, to: b, completion, n: inB.length };
  }
  return best;
}

/** Distracción más frecuente y la que más se asocia a abandonar la sesión (≥ 5 registros). */
export function distractionPatterns(logs: { kind: string; abandoned: boolean; minutes: number | null }[]) {
  if (logs.length < 5) return null;
  const by = new Map<string, { n: number; abandoned: number; minutes: number }>();
  for (const l of logs) {
    const x = by.get(l.kind) ?? { n: 0, abandoned: 0, minutes: 0 };
    x.n += 1;
    x.abandoned += l.abandoned ? 1 : 0;
    x.minutes += l.minutes ?? 0;
    by.set(l.kind, x);
  }
  const ranked = [...by.entries()].sort((a, b) => b[1].n - a[1].n);
  const abandonLeader = [...by.entries()].filter(([, v]) => v.abandoned >= 2).sort((a, b) => b[1].abandoned - a[1].abandoned)[0];
  return {
    total: logs.length,
    mostFrequent: { kind: ranked[0]![0], n: ranked[0]![1].n, share: ranked[0]![1].n / logs.length },
    minutesLost: [...by.values()].reduce((a, v) => a + v.minutes, 0),
    abandonsMost: abandonLeader ? { kind: abandonLeader[0], n: abandonLeader[1].abandoned } : null,
    byKind: ranked.map(([kind, v]) => ({ kind, n: v.n })),
  };
}

// ---- Revisión de compromisos (F07-014) -------------------------------------------------------

export interface CommitmentInput {
  tasks: { id: string; dueDate: DayKey | null; status: string }[];
  history: { taskId: string; event: 'created' | 'due_changed' | 'completed' | 'reopened' | 'cancelled'; oldDue: DayKey | null; newDue: DayKey | null; atDay: DayKey }[];
}

/**
 * Para la semana [from, to]: prometido = tareas con fecha en la semana (o que la tenían al
 * empezarla); completado, reprogramado (fecha movida fuera de la semana), abandonado
 * (cancelada) y pendiente.
 */
export function commitmentReview(input: CommitmentInput, from: DayKey, to: DayKey) {
  const inWeek = (d: DayKey | null) => d !== null && d >= from && d <= to;
  const promised = new Set<string>();
  for (const t of input.tasks) if (inWeek(t.dueDate)) promised.add(t.id);
  for (const h of input.history) {
    if (h.event === 'due_changed' && inWeek(h.oldDue)) promised.add(h.taskId);
    if (h.event === 'created' && inWeek(h.newDue)) promised.add(h.taskId);
  }
  const completed = new Set<string>();
  const rescheduled = new Set<string>();
  const abandoned = new Set<string>();
  for (const h of input.history) {
    if (!promised.has(h.taskId) || h.atDay < from || h.atDay > addDays(to, 1)) continue;
    if (h.event === 'completed') completed.add(h.taskId);
    if (h.event === 'reopened') completed.delete(h.taskId);
    if (h.event === 'cancelled') abandoned.add(h.taskId);
    if (h.event === 'due_changed' && inWeek(h.oldDue) && !inWeek(h.newDue)) rescheduled.add(h.taskId);
  }
  for (const t of input.tasks) if (promised.has(t.id) && t.status === 'done') completed.add(t.id);
  const pending = [...promised].filter((id) => !completed.has(id) && !abandoned.has(id) && !rescheduled.has(id));
  return {
    promised: [...promised],
    completed: [...completed],
    rescheduled: [...rescheduled].filter((id) => !completed.has(id)),
    abandoned: [...abandoned],
    pending,
    keptRate: promised.size ? completed.size / promised.size : null,
  };
}
