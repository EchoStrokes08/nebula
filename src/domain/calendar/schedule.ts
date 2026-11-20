import { hhmm, minutesOf } from '@/lib/time';

/** Horas del día de un día de la semana (0 = domingo). */
export interface DayHours { weekday: number; start: string; end: string }
/** Bloque ocupado que se repite en varios días. */
export interface BusyBlock { label: string; weekdays: number[]; start: string; end: string }
/** Franja libre resultante, la que usa el planificador. */
export interface FreeWindow { weekday: number; start: string; end: string }

/** Huecos más cortos que esto no sirven para planificar y se descartan. */
export const MIN_FREE_MINUTES = 15;

/** Fin del día en minutos: «24:00» o «23:59» cuentan como medianoche. */
const endMinutes = (t: string) => (t === '24:00' || t === '23:59' ? 1440 : minutesOf(t));
const toTime = (m: number) => (m >= 1440 ? '23:59' : hhmm(m));

/** Tiempo libre de cada día: su horario menos los bloques ocupados que caen ese día. */
export function freeWindows(days: DayHours[], busy: BusyBlock[]): FreeWindow[] {
  const out: FreeWindow[] = [];
  for (const day of [...days].sort((a, b) => a.weekday - b.weekday)) {
    let free: [number, number][] = [[minutesOf(day.start), endMinutes(day.end)]];
    for (const b of busy) {
      if (!b.weekdays.includes(day.weekday)) continue;
      const [bs, be] = [minutesOf(b.start), endMinutes(b.end)];
      free = free.flatMap(([s, e]): [number, number][] => {
        if (be <= s || bs >= e) return [[s, e]];
        return ([[s, bs], [be, e]] as [number, number][]).filter(([a, z]) => z > a);
      });
    }
    for (const [s, e] of free) if (e - s >= MIN_FREE_MINUTES) out.push({ weekday: day.weekday, start: hhmm(s), end: toTime(e) });
  }
  return out;
}

/** Minutos libres de un día de la semana. */
export function freeMinutes(windows: FreeWindow[], weekday: number): number {
  return windows.filter((w) => w.weekday === weekday).reduce((n, w) => n + endMinutes(w.end) - minutesOf(w.start), 0);
}

/**
 * Convierte las franjas libres antiguas al modelo nuevo: el día va de la primera a la última
 * franja y los huecos entre medias pasan a ser bloques «Ocupado».
 */
export function fromLegacyWindows(windows: FreeWindow[]): { days: DayHours[]; busy: BusyBlock[] } {
  const days: DayHours[] = [];
  const gaps = new Map<string, number[]>();
  for (let weekday = 0; weekday < 7; weekday++) {
    const ws = windows.filter((w) => w.weekday === weekday).sort((a, b) => minutesOf(a.start) - minutesOf(b.start));
    if (!ws.length) continue;
    days.push({ weekday, start: ws[0]!.start, end: ws.reduce((m, w) => (endMinutes(w.end) > endMinutes(m) ? w.end : m), ws[0]!.end) });
    let cursor = endMinutes(ws[0]!.end);
    for (const w of ws.slice(1)) {
      if (minutesOf(w.start) > cursor) {
        const key = `${hhmm(cursor)}-${w.start}`;
        gaps.set(key, [...(gaps.get(key) ?? []), weekday]);
      }
      cursor = Math.max(cursor, endMinutes(w.end));
    }
  }
  const busy = [...gaps].map(([key, weekdays]) => {
    const [start, end] = key.split('-') as [string, string];
    return { label: 'Ocupado', weekdays, start, end };
  });
  return { days, busy };
}
