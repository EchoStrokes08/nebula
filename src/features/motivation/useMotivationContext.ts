import type { MotivationContext } from '@/domain/motivation/engine';
import { useGoalSummaries } from '@/features/goals/hooks';
import { formatNumber, unitLabel } from '@/features/habits/format';
import { useHabitSummaries } from '@/features/habits/hooks';
import { usePreferences } from '@/features/profile/usePreferences';
import { useTasks } from '@/features/tasks/hooks';
import { diffDays } from '@/lib/dates';

/** Reúne solo hechos reales del usuario para el motor de mensajes. */
export function useMotivationContext(moment: MotivationContext['moment']): MotivationContext | null {
  const prefs = usePreferences();
  const { summaries, today } = useHabitSummaries();
  const tasks = useTasks();
  const goals = useGoalSummaries();
  if (!prefs.data) return null;
  const open = (tasks.data ?? []).filter((t) => t.status === 'todo' || t.status === 'in_progress');
  const mostPostponed = [...open].sort((a, b) => b.postponedCount - a.postponedCount)[0];
  const pendingHabit = summaries?.find((s) => !s.habit.archived && s.current.status === 'pending');
  const rec = summaries?.find((s) => s.recovery);
  const nearGoal = goals.summaries
    ?.filter((g) => g.goal.status === 'active' && g.goal.targetDate && g.progress.ratio !== null && g.progress.ratio < 1)
    .map((g) => ({ g, days: diffDays(today, g.goal.targetDate!) }))
    .filter((x) => x.days >= 0)
    .sort((a, b) => a.days - b.days)[0];
  const bestStreak = Math.max(0, ...(summaries ?? []).map((s) => s.streak.current));
  return {
    intensity: prefs.data.motivationIntensity,
    moment,
    hour: new Date().getHours(),
    pendientes: open.filter((t) => t.dueDate && t.dueDate <= today).length || undefined,
    tareaAplazada: mostPostponed && mostPostponed.postponedCount >= 3 ? { titulo: mostPostponed.title, aplazamientos: mostPostponed.postponedCount } : undefined,
    habitoPendiente: pendingHabit?.habit.name,
    recuperacion: rec?.recovery
      ? {
          habito: rec.habit.name.toLowerCase(),
          dias: rec.recovery.missedInARow,
          minimo: rec.habit.kind === 'binary' ? 'una sola vez' : `${formatNumber(rec.recovery.suggestedTarget)} ${unitLabel(rec.habit.kind, rec.habit.unit)}`,
        }
      : undefined,
    metaProxima: nearGoal
      ? {
          titulo: nearGoal.g.goal.title,
          dias: nearGoal.days,
          restante: `${formatNumber(Math.max(0, nearGoal.g.progress.target - nearGoal.g.progress.value))} ${nearGoal.g.goal.metric === 'quantity' ? (nearGoal.g.goal.metricUnit ?? '') : nearGoal.g.goal.metric === 'milestones' ? 'hitos' : 'tareas'}`,
        }
      : undefined,
    racha: bestStreak || undefined,
  };
}
