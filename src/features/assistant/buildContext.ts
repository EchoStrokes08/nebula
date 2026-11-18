import { TZDate } from '@date-fns/tz';

import { assistantContextSchema, type AssistantContext, type AssistantTone } from '@/domain/assistant/context';
import { expandEvents, type CalendarEvent } from '@/domain/calendar/expand';
import { recentPeriods } from '@/domain/habits/evaluate';
import { analyzeDag } from '@/domain/tasks/dag';
import { compareTasks } from '@/domain/tasks/listing';
import type { HabitSummary } from '@/features/habits/hooks';
import type { LogRecord } from '@/features/habits/api';
import type { Task } from '@/features/tasks/api';
import type { GoalSummary } from '@/features/goals/hooks';
import type { FocusSessionRecord } from '@/features/agenda/api';
import type { Challenge } from '@/features/challenges/api';
import type { JournalEntry } from '@/features/journal/api';
import type { Preferences } from '@/features/profile/usePreferences';
import type { Insight } from '@/features/intelligence/insights';
import { addDays, dayKeyOf, dayRange, weekdayOf, type DayKey } from '@/lib/dates';

export interface AssistantSources {
  now: Date;
  today: DayKey;
  tz: string;
  name: string | null;
  prefs: Preferences | null | undefined;
  about: string;
  tone: AssistantTone;
  habits: HabitSummary[];
  logs: LogRecord[];
  tasks: Task[];
  goals: GoalSummary[];
  events: CalendarEvent[];
  focus: FocusSessionRecord[];
  challenges: Challenge[];
  journal: JournalEntry[];
  insights: Insight[];
  /** El diario solo viaja si la persona lo activa expresamente. */
  shareJournal: boolean;
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const cut = (s: string | null | undefined, n: number) => (s ?? '').trim().replace(/\s+/g, ' ').slice(0, n);
const hhmm = (d: Date, tz: string) => {
  const z = new TZDate(d.getTime(), tz);
  return `${String(z.getHours()).padStart(2, '0')}:${String(z.getMinutes()).padStart(2, '0')}`;
};
const open = (t: Task) => t.status === 'todo' || t.status === 'in_progress';

export function partOfDay(hour: number): AssistantContext['now']['partOfDay'] {
  if (hour < 6) return 'madrugada';
  if (hour < 13) return 'mañana';
  if (hour < 20) return 'tarde';
  return 'noche';
}

/**
 * Resume el estado de la app para el asistente: compacto (cabe holgado en la ventana del modelo),
 * con IDs reales para que pueda proponer cambios sobre tareas existentes, y validado con el mismo
 * esquema que el servidor.
 */
export function buildAssistantContext(src: AssistantSources): AssistantContext {
  const { today, tz } = src;
  const from = addDays(today, -6);
  const week = dayRange(from, today);
  const time = hhmm(src.now, tz);

  // --- Semana: tareas completadas, hábitos cumplidos y minutos de enfoque por día.
  const doneOn = (t: Task) => (t.completedAt ? dayKeyOf(new Date(t.completedAt), tz) : null);
  const focusOn = (s: FocusSessionRecord) => dayKeyOf(new Date(s.startedAt), tz);
  const active = src.habits.filter((h) => !h.habit.archived);
  const periodsByHabit = new Map(active.map((h) => [h.habit.id, recentPeriods(h.habit, h.logs, today, 7)]));
  const perDay = week.map((d) => {
    let met = 0;
    let due = 0;
    for (const periods of periodsByHabit.values()) {
      const p = periods.find((x) => x.start <= d && x.end >= d && x.start === x.end);
      if (!p || ['paused', 'notScheduled', 'beforeStart'].includes(p.status)) continue;
      due += 1;
      if (p.status === 'met') met += 1;
    }
    return {
      day: d,
      habitsMet: met,
      habitsDue: due,
      tasksDone: src.tasks.filter((t) => doneOn(t) === d).length,
      focusMinutes: Math.round(src.focus.filter((s) => focusOn(s) === d).reduce((a, s) => a + s.focusedSeconds, 0) / 60),
    };
  });
  const records = src.logs.filter((l) => l.dayKey >= from && l.dayKey <= today);

  // --- Tareas abiertas: primero las urgentes y prioritarias; con su bloqueo por dependencias.
  const dag = analyzeDag(
    src.tasks.map((t) => ({ id: t.id, done: !open(t) })),
    src.tasks.flatMap((t) => t.dependsOn.map((d) => ({ taskId: t.id, dependsOn: d }))),
  );
  const goalTitle = new Map(src.goals.map((g) => [g.goal.id, g.goal.title]));
  const tasks = src.tasks.filter(open).sort(compareTasks).slice(0, 30).map((t) => ({
    id: t.id,
    title: cut(t.title, 120),
    status: t.status,
    priority: t.priority,
    due: t.dueDate,
    dueTime: t.dueTime?.slice(0, 5) ?? null,
    estimate: t.estimateMinutes,
    scheduled: t.scheduledStart ? `${dayKeyOf(new Date(t.scheduledStart), tz)} ${hhmm(new Date(t.scheduledStart), tz)}` : null,
    postponed: t.postponedCount,
    blocked: dag.blocked.has(t.id),
    goal: t.goalId ? cut(goalTitle.get(t.goalId), 120) || null : null,
    subtasks: t.subtasks.length ? `${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}` : null,
  }));
  const recentlyDone = src.tasks
    .filter((t) => t.status === 'done' && (doneOn(t) ?? '') >= from)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .slice(0, 12)
    .map((t) => cut(t.title, 120));

  // --- Hábitos con racha, constancia y estado de hoy.
  const habits = active
    .sort((a, b) => b.habit.priority - a.habit.priority)
    .slice(0, 25)
    .map((h) => {
      const target = h.habit.targets.filter((t) => t.validFrom <= today).sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
      return {
        id: h.habit.id,
        name: cut(h.habit.name, 80),
        kind: h.habit.kind,
        period: target?.period ?? 'day',
        target: target?.target ?? 1,
        unit: h.habit.unit ? cut(h.habit.unit, 24) : null,
        today: h.current.status,
        todayValue: Math.max(0, h.current.value),
        streak: h.streak.current,
        bestStreak: h.streak.best,
        consistency30: h.consistency30.ratio,
        days: h.habit.scheduleDays,
        reminder: h.habit.reminderTime?.slice(0, 5) ?? null,
        struggling: !!h.recovery || (h.consistency30.ratio !== null && h.consistency30.evaluated >= 7 && h.consistency30.ratio < 0.4),
      };
    });

  // --- Metas activas con su progreso y el siguiente hito.
  const goals = src.goals
    .filter((g) => g.goal.status === 'active')
    .slice(0, 12)
    .map((g) => {
      const ms = [...g.goal.milestones].sort((a, b) => a.sortOrder - b.sortOrder);
      return {
        id: g.goal.id,
        title: cut(g.goal.title, 120),
        kind: g.goal.kind,
        progress: Math.max(0, Math.min(1, g.progress.ratio ?? 0)),
        targetDate: g.goal.targetDate,
        milestones: `${ms.filter((m) => m.doneAt).length}/${ms.length}`,
        nextMilestone: cut(ms.find((m) => !m.doneAt)?.title, 120) || null,
        openTasks: g.linkedTasks.filter(open).length,
      };
    });

  // --- Agenda de hoy y los próximos 6 días.
  const agenda = expandEvents(src.events, today, addDays(today, 6), tz)
    .filter((o) => o.end.getTime() > src.now.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 30)
    .map((o) => ({
      title: cut(o.title, 120),
      day: dayKeyOf(o.start, tz),
      start: o.allDay ? null : hhmm(o.start, tz),
      end: o.allDay ? null : hhmm(o.end, tz),
      category: cut(o.category, 30),
    }));

  const challenges = src.challenges
    .filter((c) => c.status === 'active' || c.status === 'pending')
    .filter((c) => c.myStatus === 'accepted' || c.myStatus === 'invited')
    .slice(0, 8)
    .map((c) => ({ title: cut(c.title, 120), kind: c.kind, metric: c.metric, status: c.status, endsOn: c.endsOn, unit: cut(c.unit, 24) }));

  const journal = src.shareJournal
    ? src.journal.filter((j) => j.day_key >= addDays(today, -13)).slice(0, 4).map((j) => ({
        day: j.day_key,
        achievements: cut(j.achievements, 300),
        difficulties: cut(j.difficulties, 300),
        learnings: cut(j.learnings, 300),
        nextStep: cut(j.next_step, 300),
      }))
    : [];

  return assistantContextSchema.parse({
    now: { day: today, time, weekday: WEEKDAYS[weekdayOf(today)], timezone: tz.slice(0, 64), partOfDay: partOfDay(Number(time.slice(0, 2))) },
    person: {
      name: src.name ? cut(src.name, 60) : null,
      about: cut(src.about, 1500),
      tone: src.tone,
      interests: (src.prefs?.interests ?? []).slice(0, 20).map((s) => cut(s, 40)),
      goals: (src.prefs?.onboardingGoals ?? []).slice(0, 12).map((s) => cut(s, 60)),
      activeDays: src.prefs?.activeDays ?? [],
      focusWindows: (src.prefs?.focusWindows ?? []).slice(0, 8).map((w) => ({ start: w.start.slice(0, 5), end: w.end.slice(0, 5) })),
      motivation: src.prefs?.motivationIntensity ?? 'balanced',
    },
    week: {
      from,
      to: today,
      tasksCompleted: perDay.reduce((a, d) => a + d.tasksDone, 0),
      habitRecords: records.length,
      activeDays: new Set(records.map((l) => l.dayKey)).size,
      focusMinutes: perDay.reduce((a, d) => a + d.focusMinutes, 0),
      perDay,
    },
    habits,
    tasks,
    recentlyDone,
    goals,
    agenda,
    challenges,
    journal,
    insights: src.insights.slice(0, 8).map((i) => cut(`${i.title}: ${i.reason}`, 300)),
  });
}

/** Cifras para el resumen visible «Nebula conoce…». */
export function contextCounts(c: AssistantContext) {
  return { habits: c.habits.length, tasks: c.tasks.length, goals: c.goals.length, events: c.agenda.length, challenges: c.challenges.length, journal: c.journal.length };
}
