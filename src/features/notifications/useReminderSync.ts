import { useEffect } from 'react';

import { atLocal, expandEvents, localMinutes } from '@/domain/calendar/expand';
import { chooseMessage } from '@/domain/motivation/engine';
import { applyPrefs, habitCandidates, weeklySummaryCandidate, type Candidate } from '@/domain/notifications/schedule';
import { useEvents } from '@/features/agenda/hooks';
import { useHabitSummaries } from '@/features/habits/hooks';
import { useTimeZone } from '@/features/habits/useToday';
import { usePreferences } from '@/features/profile/usePreferences';
import { useTasks } from '@/features/tasks/hooks';
import { useNotes } from '@/features/notes/api';
import { minutesOf } from '@/lib/time';
import { addDays, type DayKey } from '@/lib/dates';
import { notifications } from '@/platform/notifications';

let synchronizedSignature: string | null = null;
const HORIZON_DAYS = 7;
const MAX_TOTAL = 60; // por debajo del límite de alarmas de Android

/**
 * Mantiene programados en el dispositivo los recordatorios de los próximos 7 días (hábitos,
 * tareas, eventos y resumen semanal) según las preferencias. Solo reprograma si algo cambió.
 */
export function useReminderSync() {
  const prefs = usePreferences();
  const tz = useTimeZone();
  const { summaries, today } = useHabitSummaries();
  const tasks = useTasks();
  const events = useEvents();
  // Las notas no bloquean el resto de recordatorios si su consulta falla.
  const notes = useNotes().data;

  useEffect(() => {
    if (!prefs.data || !summaries || !tasks.data || !events.data) return;
    const p = prefs.data;
    const intensity = p.motivationIntensity;
    const body = (name: string) => p.notifications.motivation === false ? 'Tienes este hábito pendiente.' : chooseMessage({ intensity, moment: 'inicio', hour: 12, habitoPendiente: name }, name.length)?.text ?? 'Es un buen momento para hacerlo.';

    const candidates: Candidate[] = [
      ...habitCandidates(
        summaries
          .filter((s) => !s.habit.archived && s.habit.reminderTime && s.current.status !== 'paused')
          .map((s) => ({ id: s.habit.id, name: s.habit.name, time: s.habit.reminderTime!, scheduleDays: s.habit.scheduleDays, doneToday: s.current.status === 'met' })),
        today,
        tz,
        HORIZON_DAYS,
        body,
      ),
      ...tasks.data
        .filter((t) => t.reminderAt && (t.status === 'todo' || t.status === 'in_progress'))
        .map((t) => ({ id: `nebula-task-${t.id}`, kind: 'tasks' as const, at: new Date(t.reminderAt!), title: t.title, body: t.dueTime ? `Vence a las ${t.dueTime.slice(0, 5)}.` : 'Tienes esta tarea pendiente.', weight: t.priority + 1 })),
      ...expandEvents(events.data.filter((e) => e.reminderMinutes !== null), today, addDays(today, HORIZON_DAYS), tz).map((o) => {
        const ev = events.data!.find((e) => e.id === o.eventId)!;
        return {
          id: `nebula-event-${o.eventId}-${o.start.getTime()}`,
          kind: 'events' as const,
          at: new Date(o.start.getTime() - (ev.reminderMinutes ?? 0) * 60_000),
          title: o.title,
          body: ev.reminderMinutes ? `Empieza a las ${String(Math.floor(localMinutes(o.start, tz) / 60)).padStart(2, '0')}:${String(localMinutes(o.start, tz) % 60).padStart(2, '0')}.` : 'Empieza ahora.',
          weight: 5,
        };
      }),
      ...(notes ?? [])
        .filter((n) => n.remind && !n.done && n.day && n.atTime)
        .map((n) => ({ id: `nebula-note-${n.id}`, kind: 'tasks' as const, at: atLocal(n.day as DayKey, minutesOf(n.atTime!), tz), title: 'Nota', body: n.text.slice(0, 140), weight: 4 })),
      ...weeklySummaryCandidate(p.weeklyReviewDay ?? null, today, tz),
    ];

    const planned = applyPrefs(
      candidates,
      {
        enabled: { habits: p.notifications.habits, tasks: p.notifications.tasks, events: p.notifications.events, weekly_summary: p.notifications.weekly_summary },
        quietStart: p.quietHoursStart,
        quietEnd: p.quietHoursEnd,
        maxPerDay: p.maxNotificationsPerDay,
        tz,
      },
      new Date(),
    ).slice(0, MAX_TOTAL);

    const signature = JSON.stringify(planned.map((c) => [c.id, c.at.getTime(), c.title]));
    let cancelled = false;
    (async () => {
      if ((await notifications.getPermission()) !== 'granted') return;
      if (synchronizedSignature === signature || cancelled) return;
      await notifications.cancelPrefix('nebula-');
      for (const c of planned) { if (cancelled) return; await notifications.schedule({ id: c.id, title: c.title, body: c.body, at: c.at, channel: 'recordatorios' }); }
      if (!cancelled) synchronizedSignature = signature;
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [prefs.data, summaries, tasks.data, events.data, notes, today, tz]);
}

/** Tras cambiar permisos o preferencias, fuerza la reprogramación. */
export const resetReminderSignature = async () => { synchronizedSignature = null; };
