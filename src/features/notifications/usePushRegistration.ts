import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/features/auth/session';
import { registerPush } from '@/platform/push';

/** Registra el dispositivo para avisos push; reintenta al volver a la app (p. ej. tras dar permiso). */
export function usePushRegistration() {
  const uid = useAuth((s) => s.session?.user.id);
  useEffect(() => {
    if (!uid) return;
    void registerPush();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void registerPush(); });
    return () => sub.remove();
  }, [uid]);
}
