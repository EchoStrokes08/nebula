import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { nextOccurrence } from '@/domain/tasks/recurrence';
import { useAuth } from '@/features/auth/session';

import * as api from './api';

export const taskKeys = { all: (uid?: string) => ['tasks', uid] as const };

export function useTasks() {
  const uid = useAuth((s) => s.session?.user.id);
  return useQuery({ queryKey: taskKeys.all(uid), queryFn: api.fetchTasks, enabled: !!uid });
}

/** Mutación genérica que refresca tareas (y metas, cuyo progreso puede depender de ellas). */
export function useTaskMutation<TArgs, TResult = unknown>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  const uid = useAuth((s) => s.session?.user.id);
  return useMutation({
    mutationFn: fn,
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: taskKeys.all(uid) }), qc.invalidateQueries({ queryKey: ['goals', uid] })]),
  });
}

/** Completar/reabrir con actualización optimista. Las recurrentes generan la siguiente en el servidor. */
export function useToggleTask() {
  const qc = useQueryClient();
  const uid = useAuth((s) => s.session?.user.id);
  return useMutation({
    mutationFn: async (t: api.Task) => {
      if (t.status === 'done') return api.updateTask(t.id, { status: 'todo' });
      const next = t.recurrence && t.dueDate ? nextOccurrence(t.recurrence, t.dueDate) : null;
      await api.completeTask(t.id, next);
    },
    onMutate: async (t) => {
      await qc.cancelQueries({ queryKey: taskKeys.all(uid) });
      const prev = qc.getQueryData<api.Task[]>(taskKeys.all(uid));
      qc.setQueryData<api.Task[]>(taskKeys.all(uid), (old = []) =>
        old.map((x) => (x.id === t.id ? { ...x, status: t.status === 'done' ? 'todo' : 'done', completedAt: t.status === 'done' ? null : new Date().toISOString() } : x)),
      );
      return { prev };
    },
    onError: (_e, _t, ctx) => ctx?.prev && qc.setQueryData(taskKeys.all(uid), ctx.prev),
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: taskKeys.all(uid) }), qc.invalidateQueries({ queryKey: ['goals', uid] })]),
  });
}

/** Enfoque acumulado en la tarea; se refresca al guardar una sesión vinculada. */
export function useTaskFocus(taskId: string | null | undefined) {
  const uid = useAuth((s) => s.session?.user.id);
  return useQuery({ queryKey: ['task_focus', uid, taskId], queryFn: () => api.fetchTaskFocus(taskId!), enabled: !!uid && !!taskId });
}
