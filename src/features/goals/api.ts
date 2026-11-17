import { db, unwrap, unwrapOne } from '@/data/db';
import type { UserColor } from '@/design/tokens';
import type { GoalMetric } from '@/domain/goals/progress';
import type { DayKey } from '@/lib/dates';

export type GoalStatus = 'active' | 'paused' | 'completed' | 'abandoned';

export interface Goal {
  id: string;
  kind: 'goal' | 'project';
  title: string;
  description: string | null;
  expectedOutcome: string | null;
  targetDate: DayKey | null;
  metric: GoalMetric;
  metricTarget: number | null;
  metricUnit: string | null;
  status: GoalStatus;
  visibility: 'private' | 'friends' | 'public';
  color: UserColor;
  completedAt: string | null;
  createdAt: string;
  milestones: { id: string; title: string; dueDate: DayKey | null; doneAt: string | null; sortOrder: number }[];
  progressEvents: { id: string; delta: number; note: string | null; createdAt: string }[];
}

type Row = Record<string, unknown> & {
  milestones: { id: string; title: string; due_date: string | null; done_at: string | null; sort_order: number }[];
  goal_progress_events: { id: string; delta: string | number; note: string | null; created_at: string }[];
};

const map = (r: Row): Goal => ({
  id: r.id as string,
  kind: r.kind as Goal['kind'],
  title: r.title as string,
  description: (r.description as string) ?? null,
  expectedOutcome: (r.expected_outcome as string) ?? null,
  targetDate: (r.target_date as DayKey) ?? null,
  metric: r.metric as GoalMetric,
  metricTarget: r.metric_target === null ? null : Number(r.metric_target),
  metricUnit: (r.metric_unit as string) ?? null,
  status: r.status as GoalStatus,
  visibility: r.visibility as Goal['visibility'],
  color: r.color as UserColor,
  completedAt: (r.completed_at as string) ?? null,
  createdAt: r.created_at as string,
  milestones: [...r.milestones]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((m) => ({ id: m.id, title: m.title, dueDate: (m.due_date as DayKey) ?? null, doneAt: m.done_at, sortOrder: m.sort_order })),
  progressEvents: r.goal_progress_events
    .map((e) => ({ id: e.id, delta: Number(e.delta), note: e.note, createdAt: e.created_at }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
});

export async function fetchGoals(): Promise<Goal[]> {
  const data = unwrap(
    await db()
      .from('goals')
      .select('*, milestones(id, title, due_date, done_at, sort_order), goal_progress_events(id, delta, note, created_at)')
      .order('created_at'),
  );
  return (data as unknown as Row[]).map(map);
}

export interface GoalInput {
  kind: 'goal' | 'project';
  title: string;
  description?: string | null;
  expectedOutcome?: string | null;
  targetDate?: DayKey | null;
  metric: GoalMetric;
  metricTarget?: number | null;
  metricUnit?: string | null;
  visibility: 'private' | 'friends' | 'public';
  color: UserColor;
}

const toRow = (g: Partial<GoalInput>) => ({
  ...(g.kind !== undefined && { kind: g.kind }),
  ...(g.title !== undefined && { title: g.title }),
  ...(g.description !== undefined && { description: g.description || null }),
  ...(g.expectedOutcome !== undefined && { expected_outcome: g.expectedOutcome || null }),
  ...(g.targetDate !== undefined && { target_date: g.targetDate }),
  ...(g.metric !== undefined && { metric: g.metric }),
  ...(g.metricTarget !== undefined && { metric_target: g.metricTarget }),
  ...(g.metricUnit !== undefined && { metric_unit: g.metricUnit || null }),
  ...(g.visibility !== undefined && { visibility: g.visibility }),
  ...(g.color !== undefined && { color: g.color }),
});

export async function createGoal(g: GoalInput & { milestones?: string[] }): Promise<string> {
  const { id } = unwrapOne(await db().from('goals').insert(toRow(g)).select('id').single());
  if (g.milestones?.length) unwrap(await db().from('milestones').insert(g.milestones.map((title, i) => ({ goal_id: id, title, sort_order: i }))));
  return id;
}

export async function updateGoal(id: string, patch: Partial<GoalInput> & { status?: GoalStatus }) {
  const completed = patch.status === 'completed' ? { completed_at: new Date().toISOString() } : patch.status ? { completed_at: null } : {};
  unwrap(await db().from('goals').update({ ...toRow(patch), ...(patch.status && { status: patch.status }), ...completed }).eq('id', id));
}

export async function deleteGoal(id: string) {
  unwrap(await db().from('goals').delete().eq('id', id));
}

export async function addMilestone(goalId: string, title: string, sortOrder: number, dueDate: DayKey | null = null) {
  unwrap(await db().from('milestones').insert({ goal_id: goalId, title, sort_order: sortOrder, due_date: dueDate }));
}
export async function setMilestoneDone(id: string, done: boolean) {
  unwrap(await db().from('milestones').update({ done_at: done ? new Date().toISOString() : null }).eq('id', id));
}
export async function deleteMilestone(id: string) {
  unwrap(await db().from('milestones').delete().eq('id', id));
}

export async function addProgress(goalId: string, delta: number, note: string | null) {
  unwrap(await db().from('goal_progress_events').insert({ goal_id: goalId, delta, note }));
}

export async function linkHabitToGoal(habitId: string, goalId: string | null) {
  unwrap(await db().from('habits').update({ goal_id: goalId }).eq('id', habitId));
}
