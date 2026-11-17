import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/session';

import * as api from './api';

export const socialKeys = {
  friends: (u?: string) => ['friends', u] as const,
  requests: (u?: string) => ['friend_requests', u] as const,
  blocked: (u?: string) => ['blocked', u] as const,
  circles: (u?: string) => ['circles', u] as const,
  circleInvites: (u?: string) => ['circle_invites', u] as const,
};

export function useFriends() {
  const uid = useAuth((s) => s.session?.user.id);
  return useQuery({ queryKey: socialKeys.friends(uid), queryFn: api.myFriends, enabled: !!uid });
}
export function useFriendRequests() {
  const uid = useAuth((s) => s.session?.user.id);
  return useQuery({ queryKey: socialKeys.requests(uid), queryFn: api.myFriendRequests, enabled: !!uid });
}
export function useBlocked() {
  const uid = useAuth((s) => s.session?.user.id);
  return useQuery({ queryKey: socialKeys.blocked(uid), queryFn: api.myBlocked, enabled: !!uid });
}
export function useCircles() {
  const uid = useAuth((s) => s.session?.user.id);
  return useQuery({ queryKey: socialKeys.circles(uid), queryFn: api.myCircles, enabled: !!uid });
}
export function useCircleInvites() {
  const uid = useAuth((s) => s.session?.user.id);
  return useQuery({ queryKey: socialKeys.circleInvites(uid), queryFn: () => api.myCircleInvites(uid!), enabled: !!uid });
}

/** Cualquier mutación social refresca todo lo social (las acciones se afectan entre sí). */
export function useSocialMutation<TArgs, TResult = unknown>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  const uid = useAuth((s) => s.session?.user.id);
  return useMutation({
    mutationFn: fn,
    onSettled: () =>
      Promise.all(
        [...Object.values(socialKeys).map((k) => k(uid)), ['search'], ['challenges', uid], ['notifications', uid], ['circle_members']].map((k) => qc.invalidateQueries({ queryKey: k })),
      ),
  });
}

/** Traduce los errores de las funciones sociales (mensajes del servidor en español). */
export function socialError(e: unknown): string {
  const m = (e as { message?: string })?.message ?? '';
  const known = ['ya sois amigos', 'ya hay una solicitud pendiente', 'no disponible', 'demasiadas solicitudes hoy', 'solo puedes invitar a amigos', 'ya es miembro', 'ya hay una invitación pendiente', 'el reto ya no admite cambios', 'define tu objetivo personal', 'elige uno de tus hábitos', 'un duelo es entre dos personas', 'el reto no puede empezar en el pasado', 'invita entre 1 y 30 personas', 'no autorizado', 'el pacto no ha terminado', 'el hábito debe usar la misma unidad del reto'];
  const hit = known.find((k) => m.toLowerCase().includes(k));
  return hit ? hit[0]!.toUpperCase() + hit.slice(1) + '.' : 'No se pudo completar. Comprueba la conexión.';
}
