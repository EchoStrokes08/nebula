import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';

import { routeForNotification } from '@/domain/notifications/route';

import type { NotificationsAdapter, NotificationPermission } from './notifications.types';

const CHANNELS = {
  recordatorios: { name: 'Recordatorios', importance: AndroidImportance.HIGH },
  enfoque: { name: 'Sesiones de enfoque', importance: AndroidImportance.HIGH },
  social: { name: 'Amigos y retos', importance: AndroidImportance.DEFAULT },
} as const;

/**
 * Android 13+ informa `denied` antes de la primera petición; mientras `canAskAgain` sea cierto
 * todavía se puede preguntar, así que se trata como «sin decidir».
 */
export const toPermission = (s: { status: string; canAskAgain?: boolean }): NotificationPermission =>
  s.status === 'granted' ? 'granted' : s.status === 'denied' && s.canAskAgain === false ? 'denied' : 'undetermined';

let listening = false;
let openHandler: ((route: string) => void) | null = null;

export const notifications: NotificationsAdapter = {
  async init() {
    Notifications.setNotificationHandler({
      // Con la app abierta, el aviso social ya llega por tiempo real: el push no se repite.
      handleNotification: async (n) => {
        const push = (n.request.trigger as { type?: string } | null)?.type === 'push';
        return push
          ? { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }
          : { shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false };
      },
    });
    for (const [id, c] of Object.entries(CHANNELS)) {
      await Notifications.setNotificationChannelAsync(id, { name: c.name, importance: c.importance, lightColor: '#8055E8' });
    }
    // Tocar una notificación abre su pantalla (también si la app estaba cerrada).
    const open = (r: Notifications.NotificationResponse | null) => {
      if (!r) return;
      // Los push de FCM traen la pantalla en `data.route`; los locales, en su identificador.
      const route = (r.notification.request.content.data as { route?: unknown } | null)?.route;
      openHandler?.(typeof route === 'string' && route.startsWith('/') ? route : routeForNotification(r.notification.request.identifier));
      // Evita volver a abrir la misma notificación en el siguiente arranque.
      try { Notifications.clearLastNotificationResponse(); } catch { /* no disponible */ }
    };
    if (!listening) {
      listening = true;
      Notifications.addNotificationResponseReceivedListener(open);
      try { open(Notifications.getLastNotificationResponse()); } catch { /* sin respuesta previa */ }
    }
  },
  async getPermission() {
    return toPermission(await Notifications.getPermissionsAsync());
  },
  async requestPermission() {
    return toPermission(await Notifications.requestPermissionsAsync());
  },
  async schedule(n) {
    if (n.at.getTime() <= Date.now()) return;
    await Notifications.cancelScheduledNotificationAsync(n.id).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { title: n.title, body: n.body, data: { id: n.id } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.at, channelId: n.channel ?? 'recordatorios' },
    });
  },
  async cancel(id) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  },
  async cancelPrefix(prefix) {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(all.filter((n) => n.identifier.startsWith(prefix)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  },
  setOpenHandler(fn) {
    openHandler = fn;
  },
  async show(title, body) {
    await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
  },
};
