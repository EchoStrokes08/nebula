import { useMemo } from 'react';

import { useEvents, useFocusSessions } from '@/features/agenda/hooks';
import { useMyChallenges } from '@/features/challenges/hooks';
import { useGoalSummaries } from '@/features/goals/hooks';
import { useHabitsData, useHabitSummaries } from '@/features/habits/hooks';
import { useTimeZone } from '@/features/habits/useToday';
import { buildInsights } from '@/features/intelligence/insights';
import { useJournal } from '@/features/journal/api';
import { useMyProfile } from '@/features/profile/useMyProfile';
import { usePreferences } from '@/features/profile/usePreferences';
import { useTasks } from '@/features/tasks/hooks';

import { buildAssistantContext } from './buildContext';

/** Reúne todo lo que la app sabe de la persona y lo compacta para el asistente. */
export function useAssistantContext() {
  const { summaries, today, isLoading: habitsLoading } = useHabitSummaries();
  const { habits, logs } = useHabitsData();
  const tasks = useTasks();
  const goals = useGoalSummaries();
  const events = useEvents();
  const focus = useFocusSessions();
  const challenges = useMyChallenges();
  const prefs = usePreferences();
  const profile = useMyProfile();
  const journal = useJournal();
  const tz = useTimeZone();

  const insights = useMemo(() => buildInsights(habits.data ?? [], logs.data ?? [], tasks.data ?? [], today), [habits.data, logs.data, tasks.data, today]);

  const build = () =>
    buildAssistantContext({
      now: new Date(),
      today,
      tz,
      name: profile.data?.display_name?.split(' ')[0] ?? null,
      prefs: prefs.data,
      about: prefs.data?.aiAbout ?? '',
      tone: prefs.data?.aiTone ?? 'cercano',
      habits: summaries ?? [],
      logs: logs.data ?? [],
      tasks: tasks.data ?? [],
      goals: goals.summaries ?? [],
      events: events.data ?? [],
      focus: focus.data ?? [],
      challenges: challenges.data ?? [],
      journal: journal.data ?? [],
      insights,
      shareJournal: prefs.data?.aiShareJournal ?? false,
    });

  // Vista previa memorizada para el resumen visible; al enviar se reconstruye con la hora exacta.
  const preview = useMemo(() => {
    try { return build(); } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaries, logs.data, tasks.data, goals.summaries, events.data, focus.data, challenges.data, journal.data, prefs.data, profile.data, insights, today, tz]);

  return {
    build,
    preview,
    insights,
    prefs,
    name: profile.data?.display_name?.split(' ')[0] ?? null,
    isLoading: habitsLoading || tasks.isLoading || prefs.isLoading,
    refetch: () => Promise.all([habits.refetch(), logs.refetch(), tasks.refetch()]),
  };
}
