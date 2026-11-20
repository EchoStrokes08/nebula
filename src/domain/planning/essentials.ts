import { score, type PlanTask } from './scheduler';

/**
 * «Solo lo esencial» para los días malos: como mucho tres cosas, nada más.
 * Prioriza lo que no admite espera (tareas vencidas o de hoy, prioridad alta) y los hábitos con
 * una racha que merece protegerse. Nunca borra ni aplaza nada: solo elige qué mostrar.
 */
export const ESSENTIAL_MAX = 3;

export interface EssentialHabit {
  id: string;
  name: string;
  /** Prioridad del hábito (1..3). */
  priority: number;
  /** Racha actual en periodos. */
  streak: number;
  /** Mínimo propuesto por el modo recuperación (p. ej. «10 min»), si lo hay. */
  minimum: string | null;
}

export interface EssentialItem {
  kind: 'task' | 'habit';
  id: string;
  title: string;
  reason: string;
}

const taskReason = (t: PlanTask) =>
  t.daysToDue !== null && t.daysToDue < 0 ? 'Está vencida' : t.daysToDue === 0 ? 'Vence hoy' : 'Prioridad alta';

function habitReason(h: EssentialHabit): string {
  const base = h.streak >= 3 ? `Protege tu racha de ${h.streak}` : h.priority >= 3 ? 'Es de tus prioridades' : 'Un paso pequeño cuenta';
  return h.minimum ? `${base} · basta con ${h.minimum}` : base;
}

export function essentials(tasks: PlanTask[], habits: EssentialHabit[], max = ESSENTIAL_MAX): EssentialItem[] {
  const urgent = tasks
    .filter((t) => t.pendingPrereqs.length === 0 && ((t.daysToDue !== null && t.daysToDue <= 0) || t.priority >= 3))
    .sort((a, b) => score(b) - score(a) || a.minutes - b.minutes);
  const rankedHabits = [...habits].sort((a, b) => Number(b.streak >= 3) - Number(a.streak >= 3) || b.priority - a.priority || b.streak - a.streak);

  // Hasta dos tareas urgentes; el resto, hábitos. Si faltan de un tipo, se completa con el otro.
  const taskSlots = rankedHabits.length > 0 ? Math.min(2, max - 1) : max;
  const pickedTasks = urgent.slice(0, taskSlots);
  const pickedHabits = rankedHabits.slice(0, max - pickedTasks.length);
  return [
    ...pickedTasks.map((t): EssentialItem => ({ kind: 'task', id: t.id, title: t.title, reason: taskReason(t) })),
    ...pickedHabits.map((h): EssentialItem => ({ kind: 'habit', id: h.id, title: h.name, reason: habitReason(h) })),
  ];
}
