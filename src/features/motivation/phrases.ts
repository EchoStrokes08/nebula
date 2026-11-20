import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { db, unwrap } from '@/data/db';
import { resolvePhrase, type OwnPhrase, type Phrase } from '@/domain/motivation/catalog';
import { useAuth } from '@/features/auth/session';
import { usePreferences, useUpdatePreferences } from '@/features/profile/usePreferences';

const key = (uid?: string) => ['motivation-phrases', uid] as const;

/** Frases propias del usuario (sección Motivación). */
export function useOwnPhrases() {
  const uid = useAuth((s) => s.session?.user.id);
  return useQuery({
    queryKey: key(uid),
    enabled: !!uid,
    queryFn: async () => unwrap(await db().from('motivation_phrases').select('id, text, author').order('created_at', { ascending: false })) as OwnPhrase[],
  });
}

export function useAddPhrase() {
  const uid = useAuth((s) => s.session?.user.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { text: string; author: string }) =>
      (unwrap(await db().from('motivation_phrases').insert({ text: p.text.trim(), author: p.author.trim() || null }).select('id').single()) as { id: string }).id,
    onSettled: () => qc.invalidateQueries({ queryKey: key(uid) }),
  });
}

export function useDeletePhrase() {
  const uid = useAuth((s) => s.session?.user.id);
  const qc = useQueryClient();
  const prefs = usePreferences();
  const update = useUpdatePreferences();
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await db().from('motivation_phrases').delete().eq('id', id));
      // Si era la principal, Hoy vuelve al mensaje contextual.
      if (prefs.data?.featuredPhrase === `propia:${id}`) await update.mutateAsync({ featured_phrase: null });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key(uid) }),
  });
}

/** Frase principal elegida (o null si no hay o ya no existe). */
export function useFeaturedPhrase(): Phrase | null {
  const prefs = usePreferences();
  const own = useOwnPhrases();
  return resolvePhrase(prefs.data?.featuredPhrase, own.data ?? []);
}
