import { db, unwrap, unwrapOne } from '@/data/db';
import type { DayKey } from '@/lib/dates';

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';

export interface Task {
  id: string;
  goalId: string | null;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: number;
  dueDate: DayKey | null;
  dueTime: string | null;
  estimateMinutes: number | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  recurrence: string | null;
  reminderAt: string | null;
  postponedCount: number;
  sortOrder: number;
  completedAt: string | null;
  createdAt: string;
  subtasks: { id: string; title: string; done: boolean; sortOrder: number }[];
  tags: { id: string; name: string }[];
  dependsOn: string[];
}

const SELECT =
  'id, goal_id, title, notes, status, priority, due_date, due_time, estimate_minutes, scheduled_start, scheduled_end, recurrence, reminder_at, postponed_count, sort_order, completed_at, created_at, subtasks(id, title, done, sort_order), task_tags(tags(id, name)), deps:task_dependencies!task_dependencies_task_id_fkey(depends_on)';

type Row = Record<string, unknown> & {
  subtasks: { id: string; title: string; done: boolean; sort_order: number }[];
  task_tags: { tags: { id: string; name: string } | null }[];
  deps: { depends_on: string }[];
};

function map(r: Row): Task {
  return {
    id: r.id as string,
    goalId: (r.goal_id as string) ?? null,
    title: r.title as string,
    notes: (r.notes as string) ?? null,
    status: r.status as TaskStatus,
    priority: r.priority as number,
    dueDate: (r.due_date as DayKey) ?? null,
    dueTime: (r.due_time as string) ?? null,
    estimateMinutes: (r.estimate_minutes as number) ?? null,
    scheduledStart: (r.scheduled_start as string) ?? null,
    scheduledEnd: (r.scheduled_end as string) ?? null,
    recurrence: (r.recurrence as string) ?? null,
    reminderAt: (r.reminder_at as string) ?? null,
    postponedCount: r.postponed_count as number,
    sortOrder: r.sort_order as number,
    completedAt: (r.completed_at as string) ?? null,
    createdAt: r.created_at as string,
    subtasks: [...r.subtasks].sort((a, b) => a.sort_order - b.sort_order).map((s) => ({ id: s.id, title: s.title, done: s.done, sortOrder: s.sort_order })),
    tags: r.task_tags.map((t) => t.tags).filter((t): t is { id: string; name: string } => !!t),
    dependsOn: r.deps.map((d) => d.depends_on),
  };
}

export async function fetchTasks(): Promise<Task[]> {
  const data = unwrap(await db().from('tasks').select(SELECT).order('sort_order').order('created_at'));
  return (data as unknown as Row[]).map(map);
}

export interface TaskInput {
  title: string;
  notes?: string | null;
  priority: number;
  dueDate?: DayKey | null;
  dueTime?: string | null;
  estimateMinutes?: number | null;
  recurrence?: string | null;
  reminderAt?: string | null;
  goalId?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
}

const toRow = (t: Partial<TaskInput>) => ({
  ...(t.title !== undefined && { title: t.title }),
  ...(t.notes !== undefined && { notes: t.notes || null }),
  ...(t.priority !== undefined && { priority: t.priority }),
  ...(t.dueDate !== undefined && { due_date: t.dueDate }),
  ...(t.dueTime !== undefined && { due_time: t.dueTime }),
  ...(t.estimateMinutes !== undefined && { estimate_minutes: t.estimateMinutes }),
  ...(t.recurrence !== undefined && { recurrence: t.recurrence }),
  ...(t.reminderAt !== undefined && { reminder_at: t.reminderAt }),
  ...(t.goalId !== undefined && { goal_id: t.goalId }),
  ...(t.scheduledStart !== undefined && { scheduled_start: t.scheduledStart }),
  ...(t.scheduledEnd !== undefined && { scheduled_end: t.scheduledEnd }),
});

export async function createTask(t: TaskInput & { subtasks?: string[]; tagNames?: string[]; dependsOn?: string[] }): Promise<string> {
  const { id } = unwrapOne(await db().from('tasks').insert({ ...toRow(t), sort_order: Date.now() / 1000 }).select('id').single());
  try {
    if (t.subtasks?.length) unwrap(await db().from('subtasks').insert(t.subtasks.map((title, i) => ({ task_id: id, title, sort_order: i }))));
    if (t.tagNames?.length) await setTaskTags(id, t.tagNames);
    const deps = [...new Set(t.dependsOn ?? [])].filter((d) => d !== id);
    if (deps.length) unwrap(await db().from('task_dependencies').insert(deps.map((d) => ({ task_id: id, depends_on: d }))));
  } catch (e) {
    // Sin la tarea a medias: un reintento la crearía otra vez y quedaría duplicada.
    await db().from('tasks').delete().eq('id', id);
    throw e;
  }
  return id;
}

export async function updateTask(id: string, patch: Partial<TaskInput> & { status?: TaskStatus; sortOrder?: number }) {
  unwrap(
    await db()
      .from('tasks')
      .update({ ...toRow(patch), ...(patch.status && { status: patch.status }), ...(patch.sortOrder !== undefined && { sort_order: patch.sortOrder }) })
      .eq('id', id),
  );
}

export async function completeTask(id: string, nextDue: DayKey | null) {
  return unwrap(await db().rpc('complete_task', { p_task: id, p_next_due: nextDue })) as string | null;
}

export async function deleteTask(id: string) {
  unwrap(await db().from('tasks').delete().eq('id', id));
}

export async function addSubtask(taskId: string, title: string, sortOrder: number) {
  unwrap(await db().from('subtasks').insert({ task_id: taskId, title, sort_order: sortOrder }));
}
export async function toggleSubtask(id: string, done: boolean) {
  unwrap(await db().from('subtasks').update({ done }).eq('id', id));
}
export async function deleteSubtask(id: string) {
  unwrap(await db().from('subtasks').delete().eq('id', id));
}

/** Sustituye las etiquetas de la tarea (crea las que no existan). */
export async function setTaskTags(taskId: string, names: string[]) {
  const clean = [...new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean))].slice(0, 10);
  unwrap(await db().from('task_tags').delete().eq('task_id', taskId));
  if (!clean.length) return;
  unwrap(await db().from('tags').upsert(clean.map((name) => ({ name })), { onConflict: 'user_id,name', ignoreDuplicates: true }));
  const tags = unwrap(await db().from('tags').select('id, name').in('name', clean)) as { id: string; name: string }[];
  unwrap(await db().from('task_tags').insert(tags.map((t) => ({ task_id: taskId, tag_id: t.id }))));
}

export async function addDependency(taskId: string, dependsOn: string) {
  unwrap(await db().from('task_dependencies').insert({ task_id: taskId, depends_on: dependsOn }));
}
export async function removeDependency(taskId: string, dependsOn: string) {
  unwrap(await db().from('task_dependencies').delete().eq('task_id', taskId).eq('depends_on', dependsOn));
}

export interface TaskHistoryEntry {
  taskId: string;
  event: 'created' | 'due_changed' | 'completed' | 'reopened' | 'cancelled';
  oldDue: DayKey | null;
  newDue: DayKey | null;
  at: string;
}

export async function fetchTaskHistory(sinceIso: string): Promise<TaskHistoryEntry[]> {
  const rows = unwrap(await db().from('task_history').select('task_id, event, old_due, new_due, at').gte('at', sinceIso).order('at')) as {
    task_id: string;
    event: TaskHistoryEntry['event'];
    old_due: string | null;
    new_due: string | null;
    at: string;
  }[];
  return rows.map((r) => ({ taskId: r.task_id, event: r.event, oldDue: r.old_due as DayKey | null, newDue: r.new_due as DayKey | null, at: r.at }));
}
