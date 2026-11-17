import { routeForNotification } from '@/domain/notifications/route';

import { getDesktopBridge } from './desktopBridge';
import type { NotificationsAdapter } from './notifications.types';

// Navegador de desarrollo: temporizadores de la pestaña (solo mientras esté abierta).
const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Escritorio: el proceso principal de Electron programa y muestra (sigue activo minimizado). */
export const notifications: NotificationsAdapter = {
  async init() {},
  async getPermission() {
    if (getDesktopBridge()) return 'granted'; // las notificaciones del sistema no requieren permiso en Windows/Linux
    if (typeof Notification === 'undefined') return 'denied';
    return Notification.permission === 'default' ? 'undetermined' : Notification.permission;
  },
  async requestPermission() {
    if (getDesktopBridge()) return 'granted';
    if (typeof Notification === 'undefined') return 'denied';
    const r = await Notification.requestPermission();
    return r === 'default' ? 'undetermined' : r;
  },
  async schedule(n) {
    const desktop = getDesktopBridge();
    if (desktop) return desktop.schedule({ id: n.id, title: n.title, body: n.body, at: n.at.getTime(), route: routeForNotification(n.id) });
    clearTimeout(timers.get(n.id));
    const delay = n.at.getTime() - Date.now();
    if (delay <= 0 || delay > 2_147_000_000) return;
    timers.set(n.id, setTimeout(() => notifications.show(n.title, n.body), delay));
  },
  async cancel(id) {
    const desktop = getDesktopBridge();
    if (desktop) return desktop.cancel(id);
    clearTimeout(timers.get(id));
    timers.delete(id);
  },
  async cancelPrefix(prefix) {
    const desktop = getDesktopBridge();
    if (desktop) return desktop.cancelPrefix(prefix);
    for (const id of [...timers.keys()]) if (id.startsWith(prefix)) await notifications.cancel(id);
  },
  // En escritorio el clic lo gestiona el proceso principal (abre la ruta directamente).
  setOpenHandler() {},
  async show(title, body) {
    const desktop = getDesktopBridge();
    if (desktop) return desktop.notify({ title, body });
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body });
  },
};
