import { TZDate } from '@date-fns/tz';

/**
 * Fechas de Nebula (ARQUITECTURA §4).
 * - Un instante es un `Date` (UTC).
 * - Un `DayKey` es un día civil 'YYYY-MM-DD' en una zona concreta; las rachas, periodos y
 *   límites de retos se calculan sobre DayKeys para que viajar o cambiar de hora no
 *   reescriba el pasado.
 */
export type DayKey = string & { readonly __brand: 'DayKey' };

const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDayKey(value: string): value is DayKey {
  const m = DAY_KEY_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

export function toDayKey(value: string): DayKey {
  if (!isDayKey(value)) throw new Error(`Fecha no válida: ${value}`);
  return value;
}

/** Día civil de un instante en la zona indicada. */
export function dayKeyOf(instant: Date, timeZone: string): DayKey {
  const z = new TZDate(instant.getTime(), timeZone);
  const y = z.getFullYear();
  const m = String(z.getMonth() + 1).padStart(2, '0');
  const d = String(z.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}` as DayKey;
}

// Aritmética de días en UTC puro: un DayKey no tiene hora, así que no le afecta el DST.
function toUtc(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}
const fromUtc = (d: Date) => d.toISOString().slice(0, 10) as DayKey;

export function addDays(key: DayKey, days: number): DayKey {
  const d = toUtc(key);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** 0 = domingo … 6 = sábado. */
export function weekdayOf(key: DayKey): number {
  return toUtc(key).getUTCDay();
}

/** Días entre dos DayKeys (b − a). */
export function diffDays(a: DayKey, b: DayKey): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

/** Primer día de la semana que contiene `key`, según el día de inicio del usuario. */
export function startOfWeek(key: DayKey, weekStartsOn: number): DayKey {
  const offset = (weekdayOf(key) - weekStartsOn + 7) % 7;
  return addDays(key, -offset);
}

export function startOfMonth(key: DayKey): DayKey {
  return `${key.slice(0, 7)}-01` as DayKey;
}

/** Lista inclusiva de días entre `from` y `to`. */
export function dayRange(from: DayKey, to: DayKey): DayKey[] {
  const n = diffDays(from, to);
  return n < 0 ? [] : Array.from({ length: n + 1 }, (_, i) => addDays(from, i));
}

/** Instante en que empieza un día civil en una zona (00:00 local, o la primera hora válida). */
export function startOfDayInstant(key: DayKey, timeZone: string): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(new TZDate(y, m - 1, d, 0, 0, 0, timeZone).getTime());
}

/** Duración real en horas de un día civil (23, 24 o 25 en cambios de hora). */
export function hoursInDay(key: DayKey, timeZone: string): number {
  const start = startOfDayInstant(key, timeZone).getTime();
  const end = startOfDayInstant(addDays(key, 1), timeZone).getTime();
  return (end - start) / 3_600_000;
}
