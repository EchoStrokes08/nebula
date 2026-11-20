import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { db, unwrap, unwrapOne } from '@/data/db';
import { useAuth } from '@/features/auth/session';

export interface Preferences {
  interests: string[];
  activeDays: number[];
  focusWindows: { start: string; end: string }[];
  motivationIntensity: 'balanced' | 'demanding' | 'intense';
  notifications: { habits: boolean; tasks: boolean; events: boolean; social: boolean; weekly_summary: boolean; motivation?: boolean };
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  maxNotificationsPerDay: number;
  aiEnabled: boolean;
  weeklyReviewDay: number | null;
  onboardingGoals: string[];
  aiAbout: string;
  aiTone: 'cercano' | 'directo' | 'motivador' | 'tranquilo';
  aiShareJournal: boolean;
  /** Frase principal elegida en Motivación para mostrarse en Hoy. */
  featuredPhrase: string | null;
}

const map = (r: Record<string, unknown>): Preferences => ({
  interests: r.interests as string[],
  activeDays: r.active_days as number[],
  focusWindows: r.focus_windows as Preferences['focusWindows'],
  motivationIntensity: r.motivation_intensity as Preferences['motivationIntensity'],
  notifications: r.notifications as Preferences['notifications'],
  quietHoursStart: (r.quiet_hours_start as string | null)?.slice(0, 5) ?? null,
  quietHoursEnd: (r.quiet_hours_end as string | null)?.slice(0, 5) ?? null,
  maxNotificationsPerDay: r.max_notifications_per_day as number,
  aiEnabled: r.ai_enabled as boolean,
  weeklyReviewDay: (r.weekly_review_day as number | null) ?? null,
  onboardingGoals: (r.onboarding_goals as string[]) ?? [],
  aiAbout: (r.ai_about as string | undefined) ?? '',
  aiTone: (r.ai_tone as Preferences['aiTone'] | undefined) ?? 'cercano',
  aiShareJournal: (r.ai_share_journal as boolean | undefined) ?? false,
  featuredPhrase: (r.featured_phrase as string | null | undefined) ?? null,
});

export function usePreferences() {
  const uid = useAuth((s) => s.session?.user.id);
  return useQuery({
    queryKey: ['preferences', uid],
    enabled: !!uid,
    queryFn: async () => map(unwrapOne(await db().from('user_preferences').select('*').eq('user_id', uid!).single())),
  });
}

export function useUpdatePreferences() {
  const uid = useAuth((s) => s.session?.user.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      unwrap(await db().from('user_preferences').update(patch).eq('user_id', uid!));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['preferences', uid] }),
  });
}
