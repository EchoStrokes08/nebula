import { length, subtract, total, type Interval } from './intervals';

export interface PlanTask {
  id: string;
  title: string;
  minutes: number;
  priority: number; // 1..3
  /** Días hasta la fecha límite (negativo = vencida; null = sin fecha). */
  daysToDue: number | null;
  /** Pendientes que dependen de esta tarea (desbloquea). */
  unlocks: number;
  /** Prerrequisitos sin terminar. */
  pendingPrereqs: string[];
}

export interface Placement {
  taskId: string;
  start: number;
  end: number;
  /** Parte n de m si se dividió. */
  part?: [number, number];
}

export interface PlanResult {
  placed: Placement[];
  unplaced: { taskId: string; reason: 'bloqueada' | 'sin_hueco' }[];
  availableMinutes: number;
  requestedMinutes: number;
  /** Minutos que no caben (sobrecarga). */
  overloadMinutes: number;
  /** Razón legible de por qué se eligió cada tarea en ese orden. */
  reasons: Record<string, string>;
}

export interface PlanOptions {
  /** Margen entre bloques (descanso). */
  breakMinutes?: number;
  /** Bloque mínimo al dividir una tarea larga. */
  minChunk?: number;
  /** No planificar antes de este minuto (p. ej. «ahora»). */
  notBefore?: number;
  /** Franjas preferidas de concentración: se usan primero para las tareas más exigentes. */
  preferred?: Interval[];
}

/** Puntuación de urgencia/importancia (mayor = antes). Documentada en REGLAS_NEGOCIO §8. */
export function score(t: PlanTask): number {
  const due = t.daysToDue === null ? 0 : t.daysToDue < 0 ? 60 : t.daysToDue === 0 ? 50 : t.daysToDue <= 2 ? 30 : t.daysToDue <= 7 ? 15 : 5;
  return due + t.priority * 12 + Math.min(t.unlocks, 5) * 4;
}

export function reasonFor(t: PlanTask): string {
  const parts: string[] = [];
  if (t.daysToDue !== null && t.daysToDue < 0) parts.push('está vencida');
  else if (t.daysToDue === 0) parts.push('vence hoy');
  else if (t.daysToDue !== null && t.daysToDue <= 2) parts.push(`vence en ${t.daysToDue} días`);
  if (t.priority === 3) parts.push('prioridad alta');
  if (t.unlocks > 0) parts.push(`desbloquea ${t.unlocks}`);
  return parts.length ? parts.join(', ') : 'tiempo disponible';
}

/**
 * Planificador determinista (F06-011): coloca tareas en los huecos libres sin solapes,
 * por orden de puntuación, respetando dependencias (un prerrequisito colocado antes en el
 * mismo plan desbloquea a sus dependientes a partir de su fin) y dejando descansos.
 * Las tareas que no caben en ningún hueco se dividen en bloques ≥ `minChunk`.
 */
export function planDay(tasks: PlanTask[], available: Interval[], busy: Interval[], opts: PlanOptions = {}): PlanResult {
  const breakMin = opts.breakMinutes ?? 10;
  const minChunk = opts.minChunk ?? 25;
  let free = subtract(available, busy, breakMin).map((i) => ({ start: Math.max(i.start, opts.notBefore ?? -Infinity), end: i.end })).filter((i) => length(i) > 0);
  const availableMinutes = total(free);
  const placed: Placement[] = [];
  const unplaced: PlanResult['unplaced'] = [];
  const doneAt = new Map<string, number>();
  const reasons: Record<string, string> = {};

  const queue = [...tasks].sort((a, b) => score(b) - score(a) || a.minutes - b.minutes);
  const prefer = (slots: Interval[], t: PlanTask) => {
    if (!opts.preferred?.length || t.priority < 3) return slots;
    const inPref = (s: Interval) => opts.preferred!.some((p) => s.start < p.end && p.start < s.end);
    return [...slots.filter(inPref), ...slots.filter((s) => !inPref(s))];
  };

  let progressed = true;
  const pending = new Set(queue.map((t) => t.id));
  while (progressed) {
    progressed = false;
    for (const t of queue) {
      if (!pending.has(t.id)) continue;
      // Prerrequisitos: todos deben estar colocados antes en este plan.
      if (t.pendingPrereqs.some((p) => !doneAt.has(p))) continue;
      const earliest = Math.max(-Infinity, ...t.pendingPrereqs.map((p) => doneAt.get(p)! + breakMin));
      const slots = prefer(
        free.map((s) => ({ start: Math.max(s.start, earliest), end: s.end })).filter((s) => length(s) > 0),
        t,
      );
      const whole = slots.find((s) => length(s) >= t.minutes);
      let segments: Interval[] = [];
      if (whole) segments = [{ start: whole.start, end: whole.start + t.minutes }];
      else {
        let left = t.minutes;
        for (const s of [...slots].sort((a, b) => a.start - b.start)) {
          if (left <= 0) break;
          const take = Math.min(length(s), left);
          if (take < Math.min(minChunk, left)) continue;
          segments.push({ start: s.start, end: s.start + take });
          left -= take;
        }
        if (left > 0) segments = [];
      }
      pending.delete(t.id);
      progressed = true;
      if (!segments.length) {
        unplaced.push({ taskId: t.id, reason: 'sin_hueco' });
        continue;
      }
      segments.forEach((seg, i) => placed.push({ taskId: t.id, start: seg.start, end: seg.end, ...(segments.length > 1 && { part: [i + 1, segments.length] as [number, number] }) }));
      reasons[t.id] = reasonFor(t);
      doneAt.set(t.id, Math.max(...segments.map((s) => s.end)));
      free = subtract(free, segments, breakMin);
    }
  }
  for (const id of pending) unplaced.push({ taskId: id, reason: 'bloqueada' });

  const requestedMinutes = tasks.reduce((a, t) => a + t.minutes, 0);
  return {
    placed: placed.sort((a, b) => a.start - b.start),
    unplaced,
    availableMinutes,
    requestedMinutes,
    overloadMinutes: Math.max(0, requestedMinutes - availableMinutes),
    reasons,
  };
}
