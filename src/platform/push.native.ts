import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/data/supabase';

/**
 * Registra el token de Firebase Cloud Messaging de este dispositivo para la cuenta actual.
 * Sin permiso de notificaciones o sin google-services.json en el build, no hace nada.
 */
let current: string | null = null;
let rotation: { remove(): void } | null = null;

const save = async (token: string) => {
  if (!supabase) return;
  const { error } = await supabase.rpc('register_push_token', { p_token: token });
  if (!error) current = token;
};

export async function registerPush(): Promise<void> {
  if (Platform.OS !== 'android' || !supabase) return;
  try {
    if ((await Notifications.getPermissionsAsync()).status !== 'granted') return;
    const { data } = await Notifications.getDevicePushTokenAsync();
    if (typeof data === 'string' && data.length >= 20 && data !== current) await save(data);
    // FCM puede rotar el token: el nuevo sustituye al anterior.
    rotation ??= Notifications.addPushTokenListener(({ data: next }) => { if (typeof next === 'string' && next !== current) void save(next); });
  } catch { /* Build sin Firebase o sin Google Play Services: los avisos llegan con la app abierta. */ }
}

/** Antes de cerrar sesión: este dispositivo deja de recibir los avisos de la cuenta. */
export async function unregisterPush(): Promise<void> {
  const token = current;
  if (!token || !supabase) return;
  current = null;
  await Promise.race([
    supabase.rpc('unregister_push_token', { p_token: token }),
    new Promise((r) => setTimeout(r, 4000)),
  ]).catch(() => undefined);
}
