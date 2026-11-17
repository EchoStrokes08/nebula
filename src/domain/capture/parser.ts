import { addDays, dayKeyOf, isDayKey, weekdayOf, type DayKey } from '@/lib/dates';
import { actionSchema, type ProposedAction } from './actions';

const DAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export interface CaptureResult { action: ProposedAction | null; warnings: string[] }
/** Parser conservador: la fecha base siempre es el día civil de la zona del perfil. */
export function parseCapture(text: string, now: Date, tz: string): CaptureResult {
  let clean = text.trim();
  if (!clean || clean.length > 1000) return { action: null, warnings: ['Escribe una idea de hasta 1000 caracteres.'] };
  const normalized = normalize(clean);
  const today = dayKeyOf(now, tz);
  const warnings: string[] = [];
  let day: DayKey | null = null;
  let time: string | null = null;
  let minutes: number | null = null;
  let recurrence: 'daily' | 'weekly' | 'monthly' | null = null;
  const remove = (pattern: RegExp) => { clean = clean.replace(pattern, ' '); };
  const explicit = /\b(\d{4}-\d{2}-\d{2})\b/.exec(clean);
  if (explicit) {
    if (!isDayKey(explicit[1]!)) return { action: null, warnings: ['La fecha no existe. Corrígela antes de guardar.'] };
    day = explicit[1] as DayKey; remove(/\b\d{4}-\d{2}-\d{2}\b/);
  } else if (/\bpasado ma[nñ]ana\b/i.test(clean)) { day = addDays(today, 2); remove(/\bpasado ma[nñ]ana\b/i); }
  else if (/\bma[nñ]ana\b/i.test(clean)) { day = addDays(today, 1); remove(/\bma[nñ]ana\b/i); }
  else if (/\bhoy\b/i.test(clean)) { day = today; remove(/\bhoy\b/i); }
  else {
    const relative = /\ben\s+(\d+)\s+d[ií]as?\b/i.exec(clean);
    if (relative) { const n = Number(relative[1]); if (n > 3650) return { action: null, warnings: ['La fecha queda demasiado lejos.'] }; day = addDays(today, n); remove(/\ben\s+\d+\s+d[ií]as?\b/i); }
    else for (let i = 0; i < DAYS.length; i++) if (new RegExp(`\\b${DAYS[i]}\\b`).test(normalized)) {
      day = addDays(today, ((i - weekdayOf(today) + 7) % 7) || 7);
      remove(new RegExp(`(?:el\\s+)?${DAYS[i]!.replace('miercoles', 'mi[eé]rcoles').replace('sabado', 's[aá]bado')}`, 'i')); break;
    }
  }
  const clock = /\ba\s+las?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i.exec(clean);
  if (clock) {
    let h = Number(clock[1]); const m = Number(clock[2] ?? 0); const meridiem = clock[3]?.toLowerCase();
    if (m > 59 || h > 23 || (meridiem && (h < 1 || h > 12))) return { action: null, warnings: ['La hora no es válida. Usa, por ejemplo, a las 18:30.'] };
    if (meridiem) h = h % 12 + (meridiem === 'pm' ? 12 : 0);
    time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    remove(/\ba\s+las?\s+\d{1,2}(?::\d{2})?\s*(am|pm)?\b/i);
  }
  const duration = /\b(?:durante\s+|por\s+)?(\d+(?:[.,]\d+)?)\s*(minutos?|min|horas?|h)\b/i.exec(clean);
  if (duration) {
    minutes = Number(duration[1]!.replace(',', '.')) * (/^h/i.test(duration[2]!) ? 60 : 1);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 480) return { action: null, warnings: ['La duración debe estar entre 1 y 480 minutos.'] };
    remove(/\b(?:durante\s+|por\s+)?\d+(?:[.,]\d+)?\s*(minutos?|min|horas?|h)\b/i);
  }
  if (/\b(cada d[ií]a|todos los d[ií]as|diariamente)\b/i.test(clean)) { recurrence = 'daily'; remove(/\b(cada d[ií]a|todos los d[ií]as|diariamente)\b/i); }
  else if (/\bcada semana\b/i.test(clean)) { recurrence = 'weekly'; remove(/\bcada semana\b/i); }
  else if (/\bcada mes\b/i.test(clean)) { recurrence = 'monthly'; remove(/\bcada mes\b/i); }
  let type: 'task' | 'habit' | 'goal' | 'event' = 'task';
  if (/^(h[aá]bito|habito):?\s/i.test(clean)) { type = 'habit'; remove(/^h[aá]bito:?\s/i); }
  else if (/^meta:?\s/i.test(clean)) { type = 'goal'; remove(/^meta:?\s/i); }
  else if (/^evento:?\s/i.test(clean)) { type = 'event'; remove(/^evento:?\s/i); }
  else remove(/^tarea:?\s/i);
  const priority = /\b(urgente|prioridad alta)\b/i.test(clean) ? 3 : 1;
  remove(/\b(urgente|prioridad alta)\b/i);
  const title = clean.replace(/\s+/g, ' ').replace(/^[\s,:;-]+|[\s,:;-]+$/g, '').trim();
  if (!title) return { action: null, warnings: ['Falta el nombre de la actividad.'] };
  if (day && day < today) warnings.push('La fecha está en el pasado.');
  if (time && !day && type !== 'habit') { day = today; warnings.push('Se ha usado hoy para la hora indicada.'); }
  let action: unknown;
  if (type === 'habit') action = { type: 'create_habit', title, minutes, days: [], time };
  else if (type === 'goal') action = { type: 'create_goal', title, day, milestones: [] };
  else if (type === 'event') {
    if (!day || !time || !minutes) return { action: null, warnings: ['Un evento necesita fecha, hora y duración. Ejemplo: evento Reunión mañana a las 10:00 durante 30 min.'] };
    action = { type: 'create_event', title, day, time, minutes };
  } else action = { type: 'create_task', title, day: day ?? (recurrence ? today : null), time, minutes, priority, recurrence };
  const result = actionSchema.safeParse(action);
  return result.success ? { action: result.data, warnings } : { action: null, warnings: ['Revisa el nombre y los datos de la actividad.'] };
}
