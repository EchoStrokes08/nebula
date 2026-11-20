import type { DayKey } from '@/lib/dates';

/**
 * Órdenes que el asistente resuelve en el dispositivo, al momento y sin IA: «pasa lo que no hice
 * hoy a mañana», «reorganiza mi tarde». Proponen la acción; aplicarla siempre requiere un toque.
 */
export type AssistantCommand =
  | { kind: 'carry_over' }
  | { kind: 'reorganize'; from: 'tarde' | 'ahora' };

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function matchCommand(text: string): AssistantCommand | null {
  const t = norm(text);
  if (t.length > 160) return null; // Una petición larga va al asistente completo.
  const move = /\b(pasa|pasame|mueve|muevelo|lleva|aplaza|pospon|posponer|deja|traslada)\w*\b/;
  const leftovers = /\b(no (hice|termine|acabe|complete|alcance)|pendientes?|me quedo|quedo|lo de hoy|sin hacer)\b/;
  if (move.test(t) && leftovers.test(t) && /\bmanana\b/.test(t)) return { kind: 'carry_over' };
  if (/\b(reorganiza|reordena|replanifica|reprograma|organiza|planifica|ordena)\w*\b/.test(t)) {
    if (/\btarde\b/.test(t)) return { kind: 'reorganize', from: 'tarde' };
    if (/\b(resto del dia|lo que queda|mi dia|el dia|de hoy|hoy)\b/.test(t)) return { kind: 'reorganize', from: 'ahora' };
  }
  return null;
}

export interface CarryTask {
  id: string;
  title: string;
  status: string;
  dueDate: DayKey | null;
  /** Día local del bloque programado, si lo tiene. */
  scheduledDay: DayKey | null;
}

/** Tareas abiertas que tocaban hoy (o antes) y no se hicieron: candidatas a pasar a mañana. */
export function carryOverTasks<T extends CarryTask>(tasks: T[], today: DayKey): T[] {
  return tasks.filter((t) =>
    (t.status === 'todo' || t.status === 'in_progress')
    && ((t.dueDate !== null && t.dueDate <= today) || (t.scheduledDay !== null && t.scheduledDay <= today)));
}

/** Inicio de la reorganización en minutos locales: la tarde empieza a las 13:00 o ahora si es más tarde. */
export const reorganizeFrom = (cmd: Extract<AssistantCommand, { kind: 'reorganize' }>, nowMinutes: number) =>
  Math.ceil(Math.max(nowMinutes, cmd.from === 'tarde' ? 13 * 60 : 0) / 5) * 5;
