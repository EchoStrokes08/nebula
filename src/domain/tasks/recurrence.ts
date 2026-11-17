import { addDays, weekdayOf, type DayKey } from '@/lib/dates';

/** Subconjunto de RRULE admitido (coincide con la restricción SQL de `tasks.recurrence`). */
export interface Recurrence {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  interval: number;
  byDay: number[]; // 0 = domingo
}

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export function parseRecurrence(rule: string): Recurrence | null {
  const m = /^FREQ=(DAILY|WEEKLY|MONTHLY)(?:;INTERVAL=([1-9][0-9]?))?(?:;BYDAY=([A-Z,]+))?$/.exec(rule);
  if (!m) return null;
  const byDay = m[3] ? m[3].split(',').map((d) => DAYS.indexOf(d)) : [];
  if (byDay.some((d) => d < 0)) return null;
  return { freq: m[1] as Recurrence['freq'], interval: m[2] ? Number(m[2]) : 1, byDay: [...new Set(byDay)].sort() };
}

export function formatRecurrence(r: Recurrence): string {
  let s = `FREQ=${r.freq}`;
  if (r.interval > 1) s += `;INTERVAL=${r.interval}`;
  if (r.byDay.length && r.freq === 'WEEKLY') s += `;BYDAY=${r.byDay.map((d) => DAYS[d]).join(',')}`;
  return s;
}

function addMonths(day: DayKey, months: number): DayKey {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate(); // último día del mes destino
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}` as DayKey;
}

/**
 * Siguiente fecha estrictamente posterior a `from`. En semanal con BYDAY se busca el
 * siguiente día de la lista; al acabar la semana se salta `interval` semanas.
 */
export function nextOccurrence(rule: string, from: DayKey): DayKey | null {
  const r = parseRecurrence(rule);
  if (!r) return null;
  if (r.freq === 'DAILY') return addDays(from, r.interval);
  if (r.freq === 'MONTHLY') return addMonths(from, r.interval);
  if (r.byDay.length === 0) return addDays(from, 7 * r.interval);
  const wd = weekdayOf(from);
  const later = r.byDay.find((d) => d > wd);
  if (later !== undefined) return addDays(from, later - wd);
  // Primer día de la lista en la semana `interval` posterior.
  return addDays(from, 7 * r.interval - wd + r.byDay[0]!);
}

export function describeRecurrence(rule: string | null): string | null {
  if (!rule) return null;
  const r = parseRecurrence(rule);
  if (!r) return null;
  const names = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  if (r.freq === 'DAILY') return r.interval === 1 ? 'Cada día' : `Cada ${r.interval} días`;
  if (r.freq === 'MONTHLY') return r.interval === 1 ? 'Cada mes' : `Cada ${r.interval} meses`;
  const base = r.interval === 1 ? 'Cada semana' : `Cada ${r.interval} semanas`;
  return r.byDay.length ? `${base} (${r.byDay.map((d) => names[d]).join(', ')})` : base;
}
