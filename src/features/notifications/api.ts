import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { db, unwrap } from '@/data/db';
import { useAuth } from '@/features/auth/session';

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  data: Record<string, string>;
  readAt: string | null;
  createdAt: string;
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  const rows = unwrap(await db().from('notifications').select('*').order('created_at', { ascending: false }).limit(100)) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    kind: r.kind as string,
    title: r.title as string,
    body: r.body as string,
    data: r.data as Record<string, string>,
    readAt: (r.read_at as string) ?? null,
    createdAt: r.created_at as string,
  }));
}

export function useNotifications() {
  const uid = useAuth((s) => s.session?.user.id);
  return useQuery({ queryKey: ['notifications', uid], queryFn: fetchNotifications, enabled: !!uid, refetchInterval: 60_000 });
}

export function useMarkRead() {
  const uid = useAuth((s) => s.session?.user.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[] | 'all') => {
      const q = db().from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
      unwrap(ids === 'all' ? await q : await q.in('id', ids));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['notifications', uid] }),
  });
}
