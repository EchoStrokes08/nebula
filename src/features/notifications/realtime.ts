import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/data/supabase';
import { inQuietHours } from '@/domain/notifications/schedule';
import { useAuth } from '@/features/auth/session';
import { useTimeZone } from '@/features/habits/useToday';
import { usePreferences } from '@/features/profile/usePreferences';
import { notifications } from '@/platform/notifications';

let channelSeq = 0;

/** Minutos locales actuales en la zona indicada. */
function nowMinutes(tz: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  return Number(parts.find((p) => p.type === 'hour')!.value) * 60 + Number(parts.find((p) => p.type === 'minute')!.value);
}

/** ¿Se debe mostrar un aviso del sistema para una notificación social nueva? */
export function shouldAlertSocial(prefs: { social: boolean; quietStart: string | null; quietEnd: string | null; tz: string } | null, minutes = prefs ? nowMinutes(prefs.tz) : 0) {
  if (!prefs?.social) return false;
  return !inQuietHours(minutes, prefs.quietStart, prefs.quietEnd);
}

/**
 * Cambios sociales en tiempo real. RLS filtra lo que llega: el cliente solo recibe filas que puede
 * consultar. Una notificación nueva se muestra como aviso del sistema mientras la app esté abierta
 * (en escritorio también minimizada en la bandeja), respetando preferencias y horas de silencio.
 */
export function useSocialRealtime() {
  const uid = useAuth((s) => s.session?.user.id);
  const qc = useQueryClient();
  const prefs = usePreferences().data;
  const tz = useTimeZone();
  const alertPrefs = prefs ? { social: !!prefs.notifications.social, quietStart: prefs.quietHoursStart, quietEnd: prefs.quietHoursEnd, tz } : null;
  const key = JSON.stringify(alertPrefs);
  useEffect(() => {
    if (!uid || !supabase) return;
    const client = supabase;
    const current = key ? JSON.parse(key) : null;
    // Tema único por suscripción: `removeChannel` es asíncrono y, si el efecto se vuelve a montar
    // (al volver a una pantalla congelada, p. ej. tras borrar un hábito), `channel()` devolvería el
    // canal anterior ya suscrito y añadirle `postgres_changes` lanza una excepción que tumba la app.
    const channel = client.channel(`social:${uid}:${++channelSeq}`);
    const refresh = () => { for (const k of ['notifications', 'friend_requests', 'friends', 'challenges', 'standings', 'challenge_people', 'challenge_results', 'rooms']) void qc.invalidateQueries({ queryKey: [k] }); };
    for (const table of ['notifications', 'friend_requests', 'challenges', 'challenge_participants', 'challenge_results', 'focus_rooms', 'focus_room_members']) channel.on('postgres_changes', { event: '*', schema: 'public', table }, refresh);
    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, (payload) => {
      const row = payload.new as { title?: string; body?: string };
      if (row.title && shouldAlertSocial(current)) void notifications.show(row.title, row.body ?? '');
    });
    channel.subscribe();
    return () => { void client.removeChannel(channel); };
  }, [uid, qc, key]);
}
