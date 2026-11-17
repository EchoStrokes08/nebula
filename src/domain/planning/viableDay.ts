import { score, type PlanTask } from './scheduler';

export type ViableMode = 'completo' | 'esencial' | 'recuperacion';

export interface ViableResult {
  keep: string[];
  /** Propuestas de aplazamiento (nunca se eliminan: el usuario decide). */
  defer: string[];
  capacityMinutes: number;
  plannedMinutes: number;
}

/**
 * Día viable (prompt §8.4):
 * - Completo: todo lo que cabe por orden de puntuación.
 * - Esencial: lo más importante que cabe en el tiempo disponible (vencidas/hoy y prioridad alta primero).
 * - Recuperación: la mitad de la capacidad, solo lo imprescindible (vence hoy o vencida, o prioridad alta),
 *   como mucho 3 tareas.
 */
export function viableDay(tasks: PlanTask[], capacityMinutes: number, mode: ViableMode): ViableResult {
  const ordered = [...tasks].sort((a, b) => score(b) - score(a) || a.minutes - b.minutes);
  const capacity = mode === 'recuperacion' ? Math.floor(capacityMinutes / 2) : capacityMinutes;
  const essential = (t: PlanTask) => (t.daysToDue !== null && t.daysToDue <= 0) || t.priority === 3;
  const pool = mode === 'completo' ? ordered : ordered.filter(essential);
  const keep: string[] = [];
  let used = 0;
  for (const t of pool) {
    if (mode === 'recuperacion' && keep.length >= 3) break;
    if (used + t.minutes <= capacity) {
      keep.push(t.id);
      used += t.minutes;
    }
  }
  return { keep, defer: ordered.filter((t) => !keep.includes(t.id)).map((t) => t.id), capacityMinutes: capacity, plannedMinutes: used };
}

/** Sobrecarga: estimado vs. disponible (prompt §12.4). */
export function overload(estimatedMinutes: number, availableMinutes: number): { over: boolean; excessMinutes: number; ratio: number | null } {
  return {
    over: estimatedMinutes > availableMinutes,
    excessMinutes: Math.max(0, estimatedMinutes - availableMinutes),
    ratio: availableMinutes > 0 ? estimatedMinutes / availableMinutes : null,
  };
}
