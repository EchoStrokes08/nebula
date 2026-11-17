import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { PermissionState } from '@/components/feedback/PermissionState';
import { resetReminderSignature } from '@/features/notifications/useReminderSync';
import { notifications } from '@/platform/notifications';
import type { NotificationPermission } from '@/platform/notifications.types';

/** «Ahora no» se recuerda en el dispositivo para no insistir. */
const useDismiss = create<{ dismissed: boolean; dismiss(): void }>()(
  persist((set) => ({ dismissed: false, dismiss: () => set({ dismissed: true }) }), { name: 'nebula-notif-prompt', storage: createJSONStorage(() => AsyncStorage) }),
);

/** Pide el permiso si aún no se ha decidido. Devuelve el estado final. */
export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  const current = await notifications.getPermission();
  if (current !== 'undetermined') return current;
  const result = await notifications.requestPermission();
  if (result === 'granted') await resetReminderSignature();
  return result;
}

/**
 * Explicación previa al permiso de notificaciones (F09-005). Solo en Android: en escritorio las
 * notificaciones del sistema no requieren permiso.
 */
export function NotificationPrompt() {
  const [status, setStatus] = useState<NotificationPermission | null>(null);
  const { dismissed, dismiss } = useDismiss();
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void notifications.getPermission().then(setStatus).catch(() => {});
  }, []);
  if (Platform.OS === 'web' || dismissed || status === null || status === 'granted') return null;
  const denied = status === 'denied';
  return (
    <PermissionState
      title="Recordatorios y fin de sesión"
      reason="Nebula te avisa solo de lo que tú programes: hábitos, tareas, eventos y el final de tus bloques de enfoque. Respeta tus horas de silencio."
      denied={denied}
      onSkip={dismiss}
      onRequest={() => {
        if (denied) void Linking.openSettings();
        else void ensureNotificationPermission().then(setStatus);
      }}
    />
  );
}
