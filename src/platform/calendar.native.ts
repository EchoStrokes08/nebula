import * as Calendar from 'expo-calendar';
import { dayKeyOf, startOfDayInstant } from '@/lib/dates';
import type { ImportedEvent } from '@/domain/integrations/ics';
export const canReadDeviceCalendar = true;
export async function readDeviceCalendar(): Promise<ImportedEvent[]> {
  const permission = await Calendar.requestCalendarPermissions();
  if (!permission.granted) throw new Error('Permite el acceso al calendario desde los ajustes del dispositivo.');
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  const from = new Date(); const to = new Date(from.getTime() + 90 * 86400000);
  const events = await Calendar.listEvents(calendars.map((c) => c.id), from, to);
  return events.slice(0, 500).map((e) => ({ external_id: `${e.calendarId}:${e.id}:${new Date(e.startDate).toISOString()}`, title: e.title || 'Sin título', starts_at: new Date(e.startDate).toISOString(), ends_at: new Date(e.endDate).toISOString(), all_day: e.allDay, tz: e.timeZone || 'UTC' })).filter((e) => {
    // Verifica zona/fechas antes de presentar la propuesta.
    try { return startOfDayInstant(dayKeyOf(new Date(e.starts_at), e.tz), e.tz).getTime() > 0 && new Date(e.ends_at) > new Date(e.starts_at); } catch { return false; }
  });
}
