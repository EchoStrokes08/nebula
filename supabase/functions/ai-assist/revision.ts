import type { SupabaseClient } from '@supabase/supabase-js';
import { milestoneOf, type PlanAction } from '../../../src/domain/capture/actions.ts';

type ExistingItem = { id: string; title: string; editable: boolean; version?: string };

export async function loadRevision(client: SupabaseClient, userId: string, goalId: string) {
  const goalResult = await client.from('goals')
    .select('id,title,description,expected_outcome,target_date,metric,metric_target,metric_unit,ai_plan_summary,updated_at')
    .eq('user_id', userId).eq('id', goalId).in('status', ['active', 'paused']).maybeSingle();
  if (goalResult.error) throw new Error('goal lookup failed');
  if (!goalResult.data) return null;
  const [milestones, tasks, habits] = await Promise.all([
    client.from('milestones').select('id,title,due_date,done_at').eq('goal_id', goalId).order('sort_order').limit(30),
    client.from('tasks').select('id,title,notes,status,due_date,scheduled_start,recurrence,estimate_minutes,updated_at,subtasks(title,done),task_dependencies!task_dependencies_task_id_fkey(depends_on)')
      .eq('user_id', userId).eq('goal_id', goalId).neq('status', 'cancelled').order('created_at', { ascending: false }).limit(45),
    client.from('habits').select('id,name,description,kind,unit,schedule_days,updated_at').eq('user_id', userId)
      .eq('goal_id', goalId).eq('status', 'active').order('sort_order').limit(16),
  ]);
  if (milestones.error || tasks.error || habits.error) throw new Error('goal work lookup failed');
  return {
    goal: goalResult.data,
    milestones: milestones.data.map((m) => ({ ...m, version: m.due_date ?? undefined, editable: !m.done_at })),
    tasks: tasks.data.map(({ notes, subtasks, ...t }) => ({
      ...t, notes: notes?.slice(0, 450), subtasks: subtasks.slice(0, 8),
      version: t.updated_at,
      editable: t.status === 'todo' && !t.scheduled_start && !t.recurrence && !subtasks.some((s) => s.done),
    })),
    habits: habits.data.map((h) => ({ ...h, title: h.name, version: h.updated_at, editable: true })),
  };
}

export type GoalRevision = NonNullable<Awaited<ReturnType<typeof loadRevision>>>;

function matchItems(items: ExistingItem[], proposals: { title: string; replaceId?: string; originalTitle?: string; originalVersion?: string }[]) {
  const used = new Set<string>();
  for (const p of proposals) {
    delete p.originalTitle;
    delete p.originalVersion;
    const existing = p.replaceId
      ? items.find((item) => item.id === p.replaceId)
      : items.find((item) => item.title.trim().toLowerCase() === p.title.trim().toLowerCase());
    if (!existing) {
      if (p.replaceId) return false;
      continue;
    }
    if (!existing.editable || used.has(existing.id)) return false;
    used.add(existing.id);
    p.replaceId = existing.id;
    p.originalTitle = existing.title;
    p.originalVersion = existing.version;
  }
  return true;
}

/** La meta y las referencias definitivas salen de Supabase, no de la respuesta de la IA. */
export function prepareRevision(plan: PlanAction, revision: GoalRevision): boolean {
  const milestones = plan.milestones.map(milestoneOf);
  if (!matchItems(revision.milestones, milestones) || !matchItems(revision.tasks, plan.tasks) || !matchItems(revision.habits, plan.habits)) return false;
  const hasEditable = [...revision.milestones, ...revision.tasks, ...revision.habits].some((item) => item.editable);
  if (hasEditable && ![...milestones, ...plan.tasks, ...plan.habits].some((item) => item.replaceId)) return false;
  plan.milestones = milestones;
  plan.goalId = revision.goal.id;
  plan.goal = revision.goal.title;
  plan.revisionId = crypto.randomUUID();
  plan.revisionVersion = revision.goal.updated_at;
  return true;
}

export function clearRevision(plan: PlanAction) {
  delete plan.revisionId;
  delete plan.revisionVersion;
  for (const item of [...plan.milestones.filter((m) => typeof m !== 'string'), ...plan.tasks, ...plan.habits]) {
    delete item.replaceId;
    delete item.originalTitle;
    delete item.originalVersion;
  }
}
