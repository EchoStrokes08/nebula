import { recentPeriods } from '@/domain/habits/evaluate';
import { minimumFor } from '@/domain/habits/recovery';
import { addDays, dayKeyOf, type DayKey } from '@/lib/dates';
import type { HabitRecord, LogRecord } from '@/features/habits/api';
import type { Task } from '@/features/tasks/api';
import type { ProposedAction } from '@/domain/capture/actions';

export interface Insight { id: string; title: string; reason: string; action: ProposedAction | null; habitId?: string; suggestedTarget?: number }
/** Heurísticas explicables; no infieren salud ni predicen conductas. */
export function buildInsights(habits: HabitRecord[], logs: LogRecord[], tasks: Task[], today: DayKey): Insight[] {
  const out: Insight[] = [];
  const pending = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress');
  for (const t of pending.filter((t) => t.postponedCount >= 3)) out.push({
    id: `friction-${t.id}`, title: `Divide «${t.title}»`, reason: `La has aplazado ${t.postponedCount} veces. Prueba a definir un primer paso de 15 minutos.`,
    action: { type: 'create_task', title: `Primer paso: ${t.title}`.slice(0, 160), day: today, time: null, minutes: 15, priority: t.priority, recurrence: null },
  });
  const due = pending.filter((t) => t.dueDate && t.dueDate <= today);
  const load = due.reduce((sum, t) => sum + (t.estimateMinutes ?? 30), 0);
  if (load > 8 * 60) out.push({ id: 'overload', title: 'Tu día supera ocho horas de tareas', reason: `${due.length} tareas suman ${load} min (se asumen 30 min donde falta estimación). Revisa el plan en modo Esencial y decide qué aplazar.`, action: null });
  for (const h of habits.filter((h) => !h.archived && h.kind !== 'reduction')) {
    const periods = recentPeriods(h, logs.filter((l) => l.habitId === h.id), today, 29).slice(1).filter((p) => ['met', 'missed', 'partial'].includes(p.status));
    if (periods.length < 14) continue;
    const recent = periods.slice(0, 7), previous = periods.slice(7, 14);
    if (previous.length < 7) continue;
    const rate = (p: typeof periods) => p.filter((x) => x.status === 'met').length / p.length;
    if (rate(recent) < 0.5 && rate(previous) - rate(recent) >= 0.25) {
      const target = h.targets.filter((t) => t.validFrom <= today).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
      if (!target || target.period !== 'day') continue;
      const suggested = Math.min(target.target, minimumFor(h, target.target, target.minTarget));
      out.push({ id: `consistency-${h.id}`, title: `Prueba una versión menor de «${h.name}»`, reason: `Cumpliste ${recent.filter((p) => p.status === 'met').length}/7 periodos recientes frente a ${previous.filter((p) => p.status === 'met').length}/7 anteriores. Sugerencia basada en 14 periodos cerrados; el historial se conserva.`, action: null, habitId: h.id, suggestedTarget: suggested });
    }
  }
  return out.slice(0, 10);
}
export function weeklySummary(tasks: Task[], logs: LogRecord[], today: DayKey, tz = 'UTC') {
  const from = addDays(today, -6);
  const done = tasks.filter((t) => t.completedAt && dayKeyOf(new Date(t.completedAt), tz) >= from && dayKeyOf(new Date(t.completedAt), tz) <= today).length;
  const records = logs.filter((l) => l.dayKey >= from && l.dayKey <= today);
  return { from, to: today, tasksCompleted: done, habitRecords: records.length, activeDays: new Set(records.map((l) => l.dayKey)).size };
}
