import { isDayKey } from '@/lib/dates';
export interface ImportedEvent { external_id: string; title: string; starts_at: string; ends_at: string; all_day: boolean; tz: string }
const unescape = (text: string) => text.replace(/\\[nN]/g, '\n').replace(/\\([,;\\])/g, '$1');
function dateValue(value: string): { iso: string; allDay: boolean } | null {
  if (/^\d{8}$/.test(value)) {
    const day = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    return isDayKey(day) ? { iso: `${day}T00:00:00.000Z`, allDay: true } : null;
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.000Z`;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) && d.toISOString() === iso ? { iso, allDay: false } : null;
}
/** Importación explícita de eventos UTC o de día completo. Se informa cada omisión. */
export function parseIcs(raw: string): { events: ImportedEvent[]; warnings: string[] } {
  const warnings: string[] = []; const events: ImportedEvent[] = [];
  if (raw.length > 2_000_000) return { events, warnings: ['El archivo supera 2 MB.'] };
  const unfolded = raw.replace(/\r?\n[ \t]/g, '');
  if (!/BEGIN:VCALENDAR/.test(unfolded)) return { events, warnings: ['No es un calendario ICS.'] };
  const blocks = unfolded.match(/BEGIN:VEVENT\r?\n[\s\S]*?END:VEVENT/g) ?? [];
  for (const [index, block] of blocks.entries()) {
    if (index >= 500) { warnings.push('Solo se pueden importar 500 eventos por operación.'); break; }
    const fields = new Map<string, { params: string; value: string }>();
    for (const line of block.split(/\r?\n/)) {
      const colon = line.indexOf(':'); if (colon < 0) continue;
      const [name, ...params] = line.slice(0, colon).split(';');
      fields.set(name!.toUpperCase(), { params: params.join(';'), value: line.slice(colon + 1) });
    }
    const title = unescape(fields.get('SUMMARY')?.value ?? '').trim();
    const uid = fields.get('UID')?.value;
    const start = dateValue(fields.get('DTSTART')?.value ?? ''); const end = dateValue(fields.get('DTEND')?.value ?? '');
    if (fields.has('RRULE') || fields.has('RECURRENCE-ID')) { warnings.push(`${title || index + 1}: evento recurrente omitido; exporta las ocurrencias por separado.`); continue; }
    if (!uid || !title || !start || !end || fields.get('DTSTART')?.params.includes('TZID=') || new Date(end.iso) <= new Date(start.iso)) { warnings.push(`${title || index + 1}: faltan datos, la zona no es UTC o la fecha no es válida.`); continue; }
    if (uid.length > 500 || title.length > 160) { warnings.push(`${index + 1}: nombre o identificador demasiado largo.`); continue; }
    if (fields.get('STATUS')?.value === 'CANCELLED') continue;
    events.push({ external_id: uid, title, starts_at: start.iso, ends_at: end.iso, all_day: start.allDay, tz: 'UTC' });
  }
  return { events, warnings };
}
