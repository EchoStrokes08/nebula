import { startOfDayInstant, type DayKey } from '@/lib/dates';
import { minutesOf } from '@/lib/time';

/**
 * Instante del recordatorio: fecha + hora (09:00 si no hay hora) en la zona del usuario,
 * menos la antelación. Se suma a medianoche local para respetar cambios de hora.
 */
export function reminderInstant(due: DayKey, time: string | null, minutesBefore: number, tz: string): string {
  const start = startOfDayInstant(due, tz).getTime();
  return new Date(start + (minutesOf(time ?? '09:00') - minutesBefore) * 60_000).toISOString();
}
