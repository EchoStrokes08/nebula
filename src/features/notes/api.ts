import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { db, unwrap } from '@/data/db';
import type { Note, NoteColor } from '@/domain/notes/board';
import { useAuth } from '@/features/auth/session';
import type { DayKey } from '@/lib/dates';

export type { Note, NoteColor };

const map = (r: Record<string, unknown>): Note => ({
  id: r.id as string,
  text: r.text as string,
  color: r.color as NoteColor,
  day: (r.day as DayKey | null) ?? null,
  atTime: (r.at_time as string | null)?.slice(0, 5) ?? null,
  remind: r.remind as boolean,
  done: r.done as boolean,
  createdAt: r.created_at as string,
});

export interface NoteInput { text: string; color: NoteColor; day: DayKey | null; atTime: string | null; remind: boolean }
const row = (n: Partial<NoteInput> & { done?: boolean }) => ({
  ...(n.text !== undefined ? { text: n.text.trim() } : {}),
  ...(n.color !== undefined ? { color: n.color } : {}),
  ...(n.day !== undefined ? { day: n.day } : {}),
  ...(n.atTime !== undefined ? { at_time: n.atTime } : {}),
  ...(n.remind !== undefined ? { remind: n.remind } : {}),
  ...(n.done !== undefined ? { done: n.done } : {}),
});

export const noteKeys = { all: (uid?: string) => ['notes', uid] as const };

/** Notas pendientes y las hechas en los últimos 7 días (para poder deshacer). */
export async function fetchNotes(): Promise<Note[]> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const rows = unwrap(await db().from('notes').select('*').or(`done.eq.false,updated_at.gte.${since}`).order('created_at', { ascending: false }).limit(200)) as Record<string, unknown>[];
  return rows.map(map);
}

export function useNotes() {
  const uid = useAuth((s) => s.session?.user.id);
  return useQuery({ queryKey: noteKeys.all(uid), queryFn: fetchNotes, enabled: !!uid, retry: 1 });
}

export function useSaveNote() {
  const uid = useAuth((s) => s.session?.user.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<NoteInput> & { id?: string; done?: boolean }) => {
      if (id) unwrap(await db().from('notes').update(row(input)).eq('id', id));
      else unwrap(await db().from('notes').insert(row(input)));
    },
    onMutate: async ({ id, ...input }) => {
      if (!id) return;
      await qc.cancelQueries({ queryKey: noteKeys.all(uid) });
      qc.setQueryData<Note[]>(noteKeys.all(uid), (old = []) => old.map((n) => (n.id === id ? { ...n, ...input } : n)));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: noteKeys.all(uid) }),
  });
}

export function useDeleteNote() {
  const uid = useAuth((s) => s.session?.user.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { unwrap(await db().from('notes').delete().eq('id', id)); },
    onMutate: (id) => qc.setQueryData<Note[]>(noteKeys.all(uid), (old = []) => old.filter((n) => n.id !== id)),
    onSettled: () => qc.invalidateQueries({ queryKey: noteKeys.all(uid) }),
  });
}
