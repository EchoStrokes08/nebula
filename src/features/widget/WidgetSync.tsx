import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { trimLogs } from '@/domain/widget/today';
import { addDays } from '@/lib/dates';
import { useAuth } from '@/features/auth/session';
import { useHabitsData } from '@/features/habits/hooks';
import { useTimeZone } from '@/features/habits/useToday';
import { useMyProfile } from '@/features/profile/useMyProfile';
import { useTasks } from '@/features/tasks/hooks';
import { refreshTodayWidget } from '@/platform/widget';

import { clearWidgetSnapshot, writeWidgetSnapshot } from './snapshot';

/** Mantiene al día la instantánea del widget «Hoy» (Android). No pinta nada. */
export function WidgetSync() {
  return Platform.OS === 'android' ? <AndroidWidgetSync /> : null;
}

function AndroidWidgetSync() {
  const uid = useAuth((s) => s.session?.user.id);
  const { habits, logs, today } = useHabitsData();
  const tz = useTimeZone();
  const weekStartsOn = useMyProfile().data?.week_starts_on ?? 1;
  const tasks = useTasks();
  const hadUser = useRef(false);

  // Al cerrar sesión, el widget deja de mostrar los hábitos de esa cuenta.
  useEffect(() => {
    if (uid) { hadUser.current = true; return; }
    if (!hadUser.current) return;
    hadUser.current = false;
    void clearWidgetSnapshot().then(refreshTodayWidget);
  }, [uid]);

  useEffect(() => {
    if (!uid || !habits.data || !logs.data) return;
    const timer = setTimeout(() => {
      void writeWidgetSnapshot({
        v: 1,
        uid,
        tz,
        weekStartsOn,
        savedAt: Date.now(),
        habits: habits.data,
        logs: trimLogs(logs.data, today).map((l) => ({ id: l.id, clientId: l.clientId, habitId: l.habitId, dayKey: l.dayKey, value: l.value })),
        // Solo lo que necesitan las órbitas de semana y mes: ni títulos ni notas.
        tasks: (tasks.data ?? []).filter((t) => t.dueDate && t.dueDate >= addDays(today, -40)).map((t) => ({ status: t.status, dueDate: t.dueDate })),
      }).then(refreshTodayWidget);
    }, 500);
    return () => clearTimeout(timer);
  }, [uid, habits.data, logs.data, tasks.data, today, tz, weekStartsOn]);

  // Al salir de la app se redibuja: así el widget refleja lo último aunque no hubiera cambios.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'background') void refreshTodayWidget(); });
    return () => sub.remove();
  }, []);

  return null;
}
