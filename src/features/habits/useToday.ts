import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useMyProfile } from '@/features/profile/useMyProfile';
import { dayKeyOf, type DayKey } from '@/lib/dates';

/** Zona horaria efectiva: la del perfil o, mientras carga, la del dispositivo. */
export function useTimeZone(): string {
  const profile = useMyProfile();
  return profile.data?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}

/** Día civil actual; se recalcula al volver la app a primer plano y cada minuto (cambio de día). */
export function useToday(): DayKey {
  const tz = useTimeZone();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const sub = AppState.addEventListener('change', (s) => s === 'active' && tick());
    const id = setInterval(tick, 60_000);
    return () => {
      sub.remove();
      clearInterval(id);
    };
  }, []);
  return dayKeyOf(now, tz);
}
