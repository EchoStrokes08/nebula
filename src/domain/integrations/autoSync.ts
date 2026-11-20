/** Cada cuánto se resincroniza el calendario automáticamente (minutos; 0 = nunca). */
export const SYNC_INTERVALS = [
  { minutes: 0, label: 'Nunca' },
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hora' },
  { minutes: 180, label: '3 horas' },
  { minutes: 360, label: '6 horas' },
  { minutes: 720, label: '12 horas' },
  { minutes: 1440, label: '1 día' },
] as const;

export const DEFAULT_SYNC_MINUTES = 30;

/** Lee el intervalo guardado; si falta o no es una opción válida, usa el de por defecto. */
export function parseSyncMinutes(raw: string | null | undefined): number {
  if (raw == null || raw === '') return DEFAULT_SYNC_MINUTES;
  const n = Number(raw);
  return SYNC_INTERVALS.some((o) => o.minutes === n) ? n : DEFAULT_SYNC_MINUTES;
}

/** ¿Toca sincronizar? `last` es la marca (ms) de la última sincronización correcta. */
export function syncDue(last: number, minutes: number, now = Date.now()): boolean {
  if (minutes <= 0) return false;
  return now - last >= minutes * 60_000;
}
