import { addDays, dayKeyOf, isDayKey, weekdayOf, type DayKey } from '@/lib/dates';
import { actionSchema, type ProposedAction } from './actions';

const DAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
/** Patrón de un día de la semana con o sin tilde (el texto original conserva las tildes). */
const DAY_RX = '(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)';
const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const dayIndex = (word: string) => DAYS.indexOf(normalize(word));
/** Próxima fecha con ese día de la semana; `includeToday` para recurrencias que empiezan hoy. */
const nextWeekday = (today: DayKey, wd: number, includeToday = false) => addDays(today, ((wd - weekdayOf(today) + 7) % 7) || (includeToday ? 0 : 7));
function endOfMonth(day: DayKey): DayKey {
  const [y, m] = day.split('-').map(Number) as [number, number];
  return addDays((m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`) as DayKey, -1);
}

export interface CaptureResult { action: ProposedAction | null; warnings: string[] }

/** Parser conservador: la fecha base siempre es el día civil de la zona del perfil. */
export function parseCapture(text: string, now: Date, tz: string): CaptureResult {
  let clean = text.trim();
  if (!clean || clean.length > 1000) return { action: null, warnings: ['Escribe una idea de hasta 1000 caracteres.'] };
  const today = dayKeyOf(now, tz);
  const warnings: string[] = [];
  let day: DayKey | null = null;
  let time: string | null = null;
  let minutes: number | null = null;
  let recurrence: 'daily' | 'weekly' | 'monthly' | null = null;
  let weekdays: number[] = [];
  const remove = (pattern: RegExp) => { clean = clean.replace(pattern, ' '); };
  const take = (pattern: RegExp) => { const m = pattern.exec(clean); if (m) remove(pattern); return m; };

  // 1) Horas habladas. Antes que las fechas: «de la mañana» no es «mañana».
  let partOfDay: 'manana' | 'tarde' | 'noche' | null = null;
  const part = take(/\b(?:de|por)\s+la\s+(ma[nñ]ana|tarde|noche)\b/i);
  if (part) partOfDay = normalize(part[1]!).startsWith('man') ? 'manana' : (normalize(part[1]!) as 'tarde' | 'noche');
  if (take(/\b(?:a|al)\s+(?:el\s+)?mediod[ií]a\b/i)) time = '12:00';
  else if (take(/\ba\s+(?:la\s+)?medianoche\b/i)) time = '00:00';

  const clock = /\ba\s+las?\s+(\d{1,2})(?::(\d{2}))?(?:\s+y\s+(media|cuarto)|\s+menos\s+cuarto)?\s*(am|pm)?\b/i.exec(clean);
  if (clock && !time) {
    let h = Number(clock[1]);
    let m = Number(clock[2] ?? 0);
    const meridiem = clock[4]?.toLowerCase();
    if (clock[3]) m = normalize(clock[3]) === 'media' ? 30 : 15;
    else if (/menos\s+cuarto/i.test(clock[0])) { h -= 1; m = 45; }
    if (m > 59 || h > 23 || h < 0 || (meridiem && (h < 1 || h > 12))) return { action: null, warnings: ['La hora no es válida. Usa, por ejemplo, a las 18:30.'] };
    if (meridiem) h = h % 12 + (meridiem === 'pm' ? 12 : 0);
    else if ((partOfDay === 'tarde' || partOfDay === 'noche') && h < 12) h += 12;
    else if (partOfDay === 'manana' && h === 12) h = 0;
    time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    remove(/\ba\s+las?\s+\d{1,2}(?::\d{2})?(?:\s+y\s+(?:media|cuarto)|\s+menos\s+cuarto)?\s*(am|pm)?\b/i);
  }

  // 2) Recurrencias con días de la semana: «cada lunes y jueves», «los martes», «de lunes a viernes».
  const range = take(new RegExp(`\\bde\\s+${DAY_RX}\\s+a\\s+${DAY_RX}\\b`, 'i'));
  if (range) {
    const a = dayIndex(range[1]!), b = dayIndex(range[2]!);
    for (let i = a; ; i = (i + 1) % 7) { weekdays.push(i); if (i === b || weekdays.length > 7) break; }
  } else if (take(/\b(?:los|cada|todos\s+los)\s+fines?\s+de\s+semana\b/i)) {
    weekdays = [6, 0];
  } else {
    const list = new RegExp(`\\b(?:cada|todos\\s+los|los)\\s+${DAY_RX}(?:\\s*(?:,|y)\\s*${DAY_RX})*(?:\\s*(?:,|y)\\s*${DAY_RX})?\\b`, 'i').exec(clean);
    // «los lunes» solo cuenta en plural (los martes/jueves/viernes ya lo son); evita «el lunes».
    if (list) {
      weekdays = [...list[0].matchAll(new RegExp(DAY_RX, 'gi'))].map((x) => dayIndex(x[1]!));
      remove(new RegExp(list[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    }
  }
  weekdays = [...new Set(weekdays)].sort((x, y) => x - y);
  if (weekdays.length) {
    recurrence = 'weekly';
    // La primera vez: el día de la lista más cercano, hoy incluido.
    day = weekdays.map((wd) => nextWeekday(today, wd, true)).sort()[0]!;
  }

  // 3) Plazos con día de la semana: «antes del viernes» (el día anterior), «para / hasta el viernes».
  const deadline = !day && take(new RegExp(`\\b(antes\\s+del|para\\s+el|hasta\\s+el)\\s+(?:pr[oó]ximo\\s+)?${DAY_RX}\\b`, 'i'));
  if (deadline) {
    const target = nextWeekday(today, dayIndex(deadline[2]!));
    day = /^antes/i.test(deadline[1]!) ? addDays(target, -1) : target;
  }

  // 4) Fechas.
  const explicit = /\b(\d{4}-\d{2}-\d{2})\b/.exec(clean);
  if (day) { /* ya fijada por la recurrencia o el plazo */ }
  else if (explicit) {
    if (!isDayKey(explicit[1]!)) return { action: null, warnings: ['La fecha no existe. Corrígela antes de guardar.'] };
    day = explicit[1] as DayKey; remove(/\b\d{4}-\d{2}-\d{2}\b/);
  } else if (take(/\bpasado ma[nñ]ana\b/i)) day = addDays(today, 2);
  else if (take(/\bma[nñ]ana\b/i)) day = addDays(today, 1);
  else if (take(/\bhoy\b/i)) day = today;
  else if (take(/\b(?:este|el)\s+fin\s+de\s+semana\b/i)) day = nextWeekday(today, 6, true);
  else if (take(/\b(?:la\s+)?(?:pr[oó]xima\s+semana|semana\s+que\s+viene)\b/i)) day = nextWeekday(today, 1);
  else if (take(/\b(?:a\s+)?(?:fin|finales|final)\s+de(?:l)?\s+mes\b/i)) day = endOfMonth(today);
  else {
    const weeks = /\ben\s+(\d+)\s+semanas?\b/i.exec(clean);
    const relative = /\ben\s+(\d+)\s+d[ií]as?\b/i.exec(clean);
    if (weeks) { const n = Number(weeks[1]); if (n > 520) return { action: null, warnings: ['La fecha queda demasiado lejos.'] }; day = addDays(today, n * 7); remove(/\ben\s+\d+\s+semanas?\b/i); }
    else if (relative) { const n = Number(relative[1]); if (n > 3650) return { action: null, warnings: ['La fecha queda demasiado lejos.'] }; day = addDays(today, n); remove(/\ben\s+\d+\s+d[ií]as?\b/i); }
    else {
      const named = new RegExp(`\\b(?:el\\s+)?(?:pr[oó]ximo\\s+)?${DAY_RX}(?:\\s+que\\s+viene)?\\b`, 'i').exec(clean);
      if (named) { day = nextWeekday(today, dayIndex(named[1]!)); remove(new RegExp(named[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')); }
    }
  }

  // 5) Duración: «45 min», «1,5 horas», «media hora», «hora y media», «un cuarto de hora».
  if (take(/\b(?:una\s+)?hora\s+y\s+media\b/i)) minutes = 90;
  else if (take(/\b(?:durante\s+|por\s+)?media\s+hora\b/i)) minutes = 30;
  else if (take(/\b(?:durante\s+|por\s+)?un\s+cuarto\s+de\s+hora\b/i)) minutes = 15;
  else if (take(/\b(?:durante\s+|por\s+)?una\s+hora\b/i)) minutes = 60;
  else {
    const duration = /\b(?:durante\s+|por\s+)?(\d+(?:[.,]\d+)?)\s*(minutos?|min|horas?|h)\b/i.exec(clean);
    if (duration) {
      minutes = Number(duration[1]!.replace(',', '.')) * (/^h/i.test(duration[2]!) ? 60 : 1);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 480) return { action: null, warnings: ['La duración debe estar entre 1 y 480 minutos.'] };
      remove(/\b(?:durante\s+|por\s+)?\d+(?:[.,]\d+)?\s*(minutos?|min|horas?|h)\b/i);
    }
  }

  if (!recurrence) {
    if (take(/\b(cada d[ií]a|todos los d[ií]as|diariamente)\b/i)) recurrence = 'daily';
    else if (take(/\bcada semana\b/i)) recurrence = 'weekly';
    else if (take(/\bcada mes\b/i)) recurrence = 'monthly';
  }

  let type: 'task' | 'habit' | 'goal' | 'event' = 'task';
  if (/^\s*(h[aá]bito|habito):?\s/i.test(clean)) { type = 'habit'; remove(/^\s*h[aá]bito:?\s/i); }
  else if (/^\s*meta:?\s/i.test(clean)) { type = 'goal'; remove(/^\s*meta:?\s/i); }
  else if (/^\s*evento:?\s/i.test(clean)) { type = 'event'; remove(/^\s*evento:?\s/i); }
  else remove(/^\s*tarea:?\s/i);
  const priority = /\b(urgente|prioridad alta)\b/i.test(clean) ? 3 : 1;
  remove(/\b(urgente|prioridad alta)\b/i);
  const title = clean.replace(/\s+/g, ' ').replace(/^[\s,:;-]+|[\s,:;-]+$/g, '').trim();
  if (!title) return { action: null, warnings: ['Falta el nombre de la actividad.'] };
  if (day && day < today) warnings.push('La fecha está en el pasado.');
  if (time && !day && type !== 'habit') { day = today; warnings.push('Se ha usado hoy para la hora indicada.'); }
  if (type === 'task' && weekdays.length > 1) warnings.push('Una tarea se repite un día por semana. Para varios días, créala como hábito.');

  let action: unknown;
  if (type === 'habit') action = { type: 'create_habit', title, minutes, days: weekdays, time };
  else if (type === 'goal') action = { type: 'create_goal', title, day, milestones: [] };
  else if (type === 'event') {
    if (!day || !time || !minutes) return { action: null, warnings: ['Un evento necesita fecha, hora y duración. Ejemplo: evento Reunión mañana a las 10:00 durante 30 min.'] };
    action = { type: 'create_event', title, day, time, minutes };
  } else action = { type: 'create_task', title, day: day ?? (recurrence ? today : null), time, minutes, priority, recurrence };
  const result = actionSchema.safeParse(action);
  return result.success ? { action: result.data, warnings } : { action: null, warnings: ['Revisa el nombre y los datos de la actividad.'] };
}
