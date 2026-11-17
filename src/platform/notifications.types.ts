export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

export interface ScheduledNotification {
  /** Identificador propio y estable (p. ej. `focus-end`, `task-<id>`): reprogramar lo reemplaza. */
  id: string;
  title: string;
  body: string;
  at: Date;
  channel?: 'recordatorios' | 'enfoque' | 'social';
}

export interface NotificationsAdapter {
  init(): Promise<void>;
  getPermission(): Promise<NotificationPermission>;
  requestPermission(): Promise<NotificationPermission>;
  schedule(n: ScheduledNotification): Promise<void>;
  cancel(id: string): Promise<void>;
  /** Cancela todas las programadas cuyo id empiece por el prefijo. */
  cancelPrefix(prefix: string): Promise<void>;
  /** Navegación al tocar una notificación (la registra el layout raíz). */
  setOpenHandler(fn: (route: string) => void): void;
  /** Muestra una notificación inmediata. */
  show(title: string, body: string): Promise<void>;
}
