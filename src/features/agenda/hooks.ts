import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/session';

import * as api from './api';

export const agendaKeys = {
  events: (uid?: string) => ['events', uid] as const,
  availability: (uid?: string) => ['availability', uid] as const,
  schedule: (uid?: string) => ['availability', uid, 'schedule'] as const,
  focus: (uid?: string) => ['focus_sessions', uid] as const,
  distractions: (uid?: string) => ['distractions', uid] as const,
};

export function useEvents() {
  const uid = useAuth((s) => s.session?.user.id);
  return useQuery({ queryKey: agendaKeys.events(uid), queryFn: api.fetchEvents, enabled: !!uid });
}

export function useAvailability() {
  const uid = useAuth((s) => s.session?.user.id);
  return useQuery({ queryKey: agendaKeys.availability(uid), queryFn: api.fetchAvailability, enabled: !!uid });
}

/** Horario (tu día + ocupado). Comparte prefijo con las franjas para invalidarse juntos. */
export function useSchedule() {
  const uid = useAuth((s) => s.session?.user.id);
  return useQuery({ queryKey: agendaKeys.schedule(uid), queryFn: api.fetchSchedule, enabled: !!uid });
}

const NINETY_DAYS = 90 * 86_400_000;

export function useFocusSessions() {
  const uid = useAuth((s) => s.session?.user.id);
  return useQuery({ queryKey: agendaKeys.focus(uid), queryFn: () => api.fetchFocusSessions(new Date(Date.now() - NINETY_DAYS).toISOString()), enabled: !!uid });
}

export function useDistractions() {
  const uid = useAuth((s) => s.session?.user.id);
  return useQuery({ queryKey: agendaKeys.distractions(uid), queryFn: () => api.fetchDistractions(new Date(Date.now() - NINETY_DAYS).toISOString()), enabled: !!uid });
}

export function useAgendaMutation<TArgs, TResult = unknown>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  const uid = useAuth((s) => s.session?.user.id);
  return useMutation({
    mutationFn: fn,
    onSettled: () =>
      Promise.all(
        [agendaKeys.events(uid), agendaKeys.availability(uid), agendaKeys.focus(uid), agendaKeys.distractions(uid), ['tasks', uid], ['habit_logs', uid]].map((k) =>
          qc.invalidateQueries({ queryKey: k }),
        ),
      ),
  });
}
