import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { db, unwrap } from '@/data/db';
import { useAuth } from '@/features/auth/session';

import { useMyProfile } from './useMyProfile';

export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/**
 * Decide si hay que adoptar la zona del dispositivo: solo cuando el perfil conserva el valor por
 * defecto `UTC` (p. ej. alta con Google, que no envía zona). Si el usuario eligió otra zona, no se
 * toca (viajar no reescribe su calendario; puede cambiarla en Configuración).
 */
export function shouldAdoptDeviceZone(profileTz: string | undefined, device: string, confirmed = false): boolean {
  return !confirmed && profileTz === 'UTC' && device !== 'UTC' && device.length > 0;
}

export function useTimezoneSync() {
  const uid = useAuth((s) => s.session?.user.id);
  const profile = useMyProfile();
  const qc = useQueryClient();
  const tz = profile.data?.timezone;
  useEffect(() => {
    const device = deviceTimeZone();
    if (!uid || !shouldAdoptDeviceZone(tz, device, profile.data?.timezone_confirmed)) return;
    (async () => {
      unwrap(await db().from('profiles').update({ timezone: device, timezone_confirmed: true }).eq('id', uid));
      await qc.invalidateQueries({ queryKey: ['profile', uid] });
    })().catch(() => {});
  }, [uid, tz, profile.data?.timezone_confirmed, qc]);
}
