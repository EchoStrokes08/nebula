import { analyzeDag } from '@/domain/tasks/dag';
import type { PlanTask } from '@/domain/planning/scheduler';
import { diffDays, type DayKey } from '@/lib/dates';

import type { Task } from './api';

/** Estimación usada cuando una tarea no tiene duración. */
export const DEFAULT_ESTIMATE = 30;

/** Tareas abiertas como candidatas del planificador, con urgencia relativa a `day`. */
export function toPlanTasks(all: Task[], day: DayKey, filter: (t: Task) => boolean = () => true): PlanTask[] {
  const dag = analyzeDag(all.map((t) => ({ id: t.id, done: t.status === 'done' || t.status === 'cancelled' })), all.flatMap((t) => t.dependsOn.map((d) => ({ taskId: t.id, dependsOn: d }))));
  return all
    .filter((t) => (t.status === 'todo' || t.status === 'in_progress') && filter(t))
    .map((t) => ({
      id: t.id,
      title: t.title,
      minutes: t.estimateMinutes ?? DEFAULT_ESTIMATE,
      priority: t.priority,
      daysToDue: t.dueDate ? diffDays(day, t.dueDate) : null,
      unlocks: dag.unlocks.get(t.id) ?? 0,
      pendingPrereqs: t.dependsOn.filter((d) => {
        const p = all.find((x) => x.id === d);
        return p && p.status !== 'done' && p.status !== 'cancelled';
      }),
    }));
}
