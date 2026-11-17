export type GoalMetric = 'quantity' | 'milestones' | 'tasks';

export interface GoalProgressInput {
  metric: GoalMetric;
  metricTarget: number | null;
  progressEvents: { delta: number }[];
  milestones: { done: boolean }[];
  tasks: { status: 'todo' | 'in_progress' | 'done' | 'cancelled' }[];
  /** Contribución de hábitos vinculados (misma unidad), si la meta es de cantidad. */
  habitContribution?: number;
}

/** Progreso acumulado de una meta (REGLAS_NEGOCIO §7). Sin datos, `ratio` es null (no 0 %). */
export function goalProgress(g: GoalProgressInput): { value: number; target: number; ratio: number | null } {
  if (g.metric === 'quantity') {
    const target = g.metricTarget ?? 0;
    const value = g.progressEvents.reduce((a, e) => a + e.delta, 0) + (g.habitContribution ?? 0);
    return { value, target, ratio: target > 0 ? Math.max(0, Math.min(1, value / target)) : null };
  }
  if (g.metric === 'milestones') {
    const target = g.milestones.length;
    const value = g.milestones.filter((m) => m.done).length;
    return { value, target, ratio: target ? value / target : null };
  }
  const counted = g.tasks.filter((t) => t.status !== 'cancelled');
  const value = counted.filter((t) => t.status === 'done').length;
  return { value, target: counted.length, ratio: counted.length ? value / counted.length : null };
}
