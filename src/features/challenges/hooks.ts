import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/session';
import { useSocialMutation } from '@/features/social/hooks';

import * as api from './api';

export function useMyChallenges() {
  const uid = useAuth((s) => s.session?.user.id);
  return useQuery({ queryKey: ['challenges', uid], queryFn: () => api.fetchMyChallenges(uid!), enabled: !!uid });
}

/** Clasificación en vivo: se refresca cada minuto mientras la pantalla está abierta. */
export function useStandings(id: string, enabled = true) {
  return useQuery({ queryKey: ['standings', id], queryFn: () => api.fetchStandings(id), enabled, refetchInterval: 60_000 });
}

export function usePeople(id: string) {
  return useQuery({ queryKey: ['challenge_people', id], queryFn: () => api.fetchPeople(id) });
}

export function useResults(id: string, enabled: boolean) {
  return useQuery({ queryKey: ['challenge_results', id], queryFn: () => api.fetchResults(id), enabled });
}

export function usePactConfirmations(id: string, enabled: boolean) {
  return useQuery({ queryKey: ['pact_confirmations', id], queryFn: () => api.fetchPactConfirmations(id), enabled });
}

export const useChallengeMutation = useSocialMutation;
