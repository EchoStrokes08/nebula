import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { goalProgress } from '@/domain/goals/progress';
import { useAuth } from '@/features/auth/session';
import { useHabitsData } from '@/features/habits/hooks';
import { useTasks } from '@/features/tasks/hooks';

import * as api from './api';

export const goalKeys = { all: (uid?: string) => ['goals', uid] as const };

export function useGoals() {
  const uid = useAuth((s) => s.session?.user.id);
  return useQuery({ queryKey: goalKeys.all(uid), queryFn: api.fetchGoals, enabled: !!uid });
}

export function useGoalMutation<TArgs, TResult = unknown>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  const uid = useAuth((s) => s.session?.user.id);
  return useMutation({
    mutationFn: fn,
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: goalKeys.all(uid) }),
        qc.invalidateQueries({ queryKey: ['tasks', uid] }),
        qc.invalidateQueries({ queryKey: ['habits', uid] }),
      ]),
  });
}

/** Metas con su progreso calculado a partir de hitos, eventos, tareas y hábitos vinculados. */
export function useGoalSummaries() {
  const goals = useGoals();
  const tasks = useTasks();
  const { habits, logs } = useHabitsData();
  const summaries = goals.data?.map((g) => {
    const linkedTasks = (tasks.data ?? []).filter((t) => t.goalId === g.id);
    const linkedHabits = (habits.data ?? []).filter((h) => h.goalId === g.id);
    // Los hábitos de duración/cantidad con la misma unidad que la meta suman a su progreso.
    const habitContribution =
      g.metric === 'quantity'
        ? (logs.data ?? [])
            .filter((l) => linkedHabits.some((h) => h.id === l.habitId && (h.unit === g.metricUnit || (h.kind === 'duration' && g.metricUnit === 'min'))))
            .filter((l) => l.loggedAt >= g.createdAt)
            .reduce((a, l) => a + l.value, 0)
        : 0;
    const progress = goalProgress({
      metric: g.metric,
      metricTarget: g.metricTarget,
      progressEvents: g.progressEvents,
      milestones: g.milestones.map((m) => ({ done: !!m.doneAt })),
      tasks: linkedTasks,
      habitContribution,
    });
    return { goal: g, progress, linkedTasks, linkedHabits };
  });
  return {
    summaries,
    isLoading: goals.isLoading || tasks.isLoading,
    error: goals.error ?? tasks.error,
    refetch: () => Promise.all([goals.refetch(), tasks.refetch()]),
  };
}

export type GoalSummary = NonNullable<ReturnType<typeof useGoalSummaries>['summaries']>[number];
