import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { evaluatePeriod, consistency, recentPeriods, streaks } from '@/domain/habits/evaluate';
import { recoveryProposal } from '@/domain/habits/recovery';
import { enqueueLog, pendingLogs, removePendingLog } from '@/data/offline/runtime';
import { useAuth } from '@/features/auth/session';
import { useMyProfile } from '@/features/profile/useMyProfile';
import type { DayKey } from '@/lib/dates';
import { uuid } from '@/lib/ids';

import * as api from './api';
import { useTimeZone, useToday } from './useToday';

const keys = {
  habits: (uid?: string) => ['habits', uid] as const,
  logs: (uid?: string) => ['habit_logs', uid] as const,
};

export function useHabitsData() {
  const uid = useAuth((s) => s.session?.user.id);
  const today = useToday();
  const habits = useQuery({ queryKey: keys.habits(uid), queryFn: api.fetchHabits, enabled: !!uid });
  const logs = useQuery({ queryKey: keys.logs(uid), queryFn: async () => {
    const remote = await api.fetchLogs(today);
    const pending = await pendingLogs(uid!);
    const deleted = new Set(pending.filter((p) => p.op === 'delete').map((p) => p.clientId));
    return [...remote.filter((r) => !deleted.has(r.id) && !deleted.has(r.clientId ?? '')), ...pending.filter((p) => p.op !== 'delete' && !remote.some((r) => r.clientId === p.clientId)).map((p) => ({
      id: p.clientId, clientId: p.clientId, habitId: p.habitId, dayKey: p.dayKey as DayKey, value: p.value,
      note: p.note ?? null, source: 'manual' as const, loggedAt: new Date().toISOString(),
    }))];
  }, enabled: !!uid });
  return { habits, logs, today };
}

/** Vista calculada de cada hábito para hoy: progreso del periodo, constancia, racha y recuperación. */
export function useHabitSummaries() {
  const { habits, logs, today } = useHabitsData();
  const weekStartsOn = useMyProfile().data?.week_starts_on ?? 1;
  const summaries = useMemo(() => {
    if (!habits.data || !logs.data) return null;
    return habits.data.map((h) => {
      const own = logs.data.filter((l) => l.habitId === h.id);
      const current = evaluatePeriod(h, own, today, today, weekStartsOn);
      const periods = recentPeriods(h, own, today, 60, weekStartsOn);
      return {
        habit: h,
        logs: own,
        todayLogs: own.filter((l) => l.dayKey === today),
        current,
        consistency30: consistency(recentPeriods(h, own, today, 31, weekStartsOn).slice(1)),
        streak: streaks(periods),
        recovery: recoveryProposal(h, own, today),
      };
    });
  }, [habits.data, logs.data, today, weekStartsOn]);
  return {
    summaries,
    today,
    isLoading: habits.isLoading || logs.isLoading,
    error: habits.error ?? logs.error,
    refetch: () => Promise.all([habits.refetch(), logs.refetch()]),
  };
}

export type HabitSummary = NonNullable<ReturnType<typeof useHabitSummaries>['summaries']>[number];

/** Registrar con actualización optimista; devuelve el `clientId` para poder deshacer. */
export function useLogHabit() {
  const qc = useQueryClient();
  const uid = useAuth((s) => s.session?.user.id);
  const tz = useTimeZone();
  return useMutation({
    networkMode: 'always',
    mutationFn: async (v: { clientId: string; habitId: string; dayKey: DayKey; value: number; note?: string | null }) => {
      if (!uid) throw new Error('Inicia sesión para registrar.');
      await enqueueLog(uid, { ...v, tz });
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: keys.logs(uid) });
      const prev = qc.getQueryData<api.LogRecord[]>(keys.logs(uid));
      qc.setQueryData<api.LogRecord[]>(keys.logs(uid), (old = []) => [
        ...old,
        { id: v.clientId, habitId: v.habitId, dayKey: v.dayKey, value: v.value, note: v.note ?? null, source: 'manual', loggedAt: new Date().toISOString() },
      ]);
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(keys.logs(uid), ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.logs(uid) }),
  });
}

export const newClientId = uuid;

export function useUndoLog() {
  const qc = useQueryClient();
  const uid = useAuth((s) => s.session?.user.id);
  return useMutation({
    networkMode: 'always',
    mutationFn: async (idOrClientId: string) => {
      if (!uid) throw new Error('Inicia sesión para deshacer.');
      await removePendingLog(uid, idOrClientId);
    },
    onMutate: async (clientId) => {
      await qc.cancelQueries({ queryKey: keys.logs(uid) });
      const prev = qc.getQueryData<api.LogRecord[]>(keys.logs(uid));
      qc.setQueryData<api.LogRecord[]>(keys.logs(uid), (old = []) => old.filter((l) => l.id !== clientId && l.clientId !== clientId));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(keys.logs(uid), ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.logs(uid) }),
  });
}

/** Mutaciones generales del hábito: refrescan hábitos y registros al terminar. */
export function useHabitMutation<TArgs>(fn: (args: TArgs) => Promise<unknown>) {
  const qc = useQueryClient();
  const uid = useAuth((s) => s.session?.user.id);
  return useMutation({
    mutationFn: fn,
    onSettled: () =>
      Promise.all([qc.invalidateQueries({ queryKey: keys.habits(uid) }), qc.invalidateQueries({ queryKey: keys.logs(uid) })]),
  });
}
