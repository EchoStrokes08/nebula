import { addDays, type DayKey } from '@/lib/dates';

export type NoteColor = 'amarillo' | 'rosa' | 'verde' | 'azul' | 'violeta' | 'naranja';
export const NOTE_COLORS: NoteColor[] = ['amarillo', 'rosa', 'verde', 'azul', 'violeta', 'naranja'];

export interface Note {
  id: string;
  text: string;
  color: NoteColor;
  day: DayKey | null;
  /** «HH:MM» o null. */
  atTime: string | null;
  remind: boolean;
  done: boolean;
  createdAt: string;
}

/**
 * Pósits que se ven en Hoy: los pendientes sin fecha, los de hoy, los vencidos y los de los
 * próximos `ahead` días. Orden: vencidos y de hoy por hora, luego sin fecha (recientes primero)
 * y por último los próximos.
 */
export function boardNotes(notes: Note[], today: DayKey, ahead = 7): Note[] {
  const limit = addDays(today, ahead);
  const pending = notes.filter((n) => !n.done && (n.day === null || n.day <= limit));
  const rank = (n: Note) => (n.day !== null && n.day <= today ? 0 : n.day === null ? 1 : 2);
  return [...pending].sort((a, b) =>
    rank(a) - rank(b)
    || (a.day ?? '').localeCompare(b.day ?? '')
    || (a.atTime ?? '99:99').localeCompare(b.atTime ?? '99:99')
    || b.createdAt.localeCompare(a.createdAt));
}

/** Etiqueta de cuándo: «Hoy · 10:30», «Mañana», «Vencida · ayer»… (null si no tiene fecha). */
export function whenLabel(n: Pick<Note, 'day' | 'atTime'>, today: DayKey, formatDay: (d: DayKey, today: DayKey) => string): string | null {
  if (!n.day) return null;
  const base = formatDay(n.day, today);
  const time = n.atTime ? ` · ${n.atTime}` : '';
  return n.day < today ? `Vencida · ${base.toLowerCase()}${time}` : `${base}${time}`;
}
