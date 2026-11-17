import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db, unwrap } from '@/data/db';
import { useAuth } from '@/features/auth/session';
import type { DayKey } from '@/lib/dates';
export interface JournalEntry { id: string; day_key: DayKey; kind: 'daily' | 'weekly'; achievements: string; difficulties: string; learnings: string; next_step: string; goal_id: string | null }
export function useJournal() {
  const uid = useAuth((s) => s.session?.user.id);
  return useQuery({ queryKey: ['journal', uid], enabled: !!uid, queryFn: async () => unwrap(await db().from('journal_entries').select('*').order('day_key', { ascending: false }).limit(365)) as JournalEntry[] });
}
export function useSaveJournal() {
  const qc = useQueryClient(); const uid = useAuth((s) => s.session?.user.id);
  return useMutation({ mutationFn: async (entry: Omit<JournalEntry, 'id'>) => {
    unwrap(await db().from('journal_entries').upsert({ ...entry, user_id: uid }, { onConflict: 'user_id,day_key,kind' }));
  }, onSuccess: () => qc.invalidateQueries({ queryKey: ['journal', uid] }) });
}
