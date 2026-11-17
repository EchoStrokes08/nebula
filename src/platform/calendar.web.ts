import type { ImportedEvent } from '@/domain/integrations/ics';
export const canReadDeviceCalendar = false;
export async function readDeviceCalendar(): Promise<ImportedEvent[]> { throw new Error('Usa la importación ICS en este dispositivo.'); }
