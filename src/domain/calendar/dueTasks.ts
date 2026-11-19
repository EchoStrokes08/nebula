import type { DayKey } from '@/lib/dates';

/** Duración con la que se dibuja una fecha límite con hora (es un aviso, no un bloque planificado). */
export const DUE_BLOCK_MINUTES = 30;

export interface DueTaskInput {
  id: string;
  title: string;
  status: string;
  dueDate: DayKey | null;
  dueTime: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}

export interface DueSlot {
  id: string;
  title: string;
  day: DayKey;
  start: number;
  end: number;
  allDay: boolean;
  /** Venció antes de hoy y sigue pendiente: se repite en el día de hoy. */
  overdue?: boolean;
}

/**
 * Tareas que deben salir en la agenda por su fecha límite: pendientes, con fecha dentro
 * del rango y sin bloque planificado (esas ya se muestran por su horario).
 * Con hora → bloque corto a esa hora; sin hora → fila de «todo el día».
 * Si se pasa `today`, las vencidas también aparecen ese día como «todo el día» para no perderlas.
 */
export function dueTaskSlots(tasks: DueTaskInput[], from: DayKey, to: DayKey, today?: DayKey): DueSlot[] {
  const out: DueSlot[] = [];
  const showOverdue = today !== undefined && today >= from && today <= to;
  for (const t of tasks) {
    if (!t.dueDate) continue;
    if (t.status === 'done' || t.status === 'cancelled') continue;
    if (t.scheduledStart && t.scheduledEnd) continue;
    if (showOverdue && t.dueDate < today) {
      out.push({ id: t.id, title: t.title, day: today, start: 0, end: 24 * 60, allDay: true, overdue: true });
    }
    if (t.dueDate < from || t.dueDate > to) continue;
    const m = t.dueTime ? /^(\d{1,2}):(\d{2})/.exec(t.dueTime) : null;
    if (m) {
      const start = Math.min(Number(m[1]) * 60 + Number(m[2]), 24 * 60 - DUE_BLOCK_MINUTES);
      out.push({ id: t.id, title: t.title, day: t.dueDate, start, end: start + DUE_BLOCK_MINUTES, allDay: false });
    } else {
      out.push({ id: t.id, title: t.title, day: t.dueDate, start: 0, end: 24 * 60, allDay: true });
    }
  }
  return out;
}
