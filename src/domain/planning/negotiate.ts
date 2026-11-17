import { length, overlaps, subtract, type Interval } from './intervals';

export type NegotiationOption =
  | { kind: 'mover'; blockId: string; to: Interval }
  | { kind: 'dividir'; blockId: string; parts: Interval[] }
  | { kind: 'mantener' };

/**
 * Calendario que negocia (PDF §5, prompt §8.3): cuando un evento nuevo choca con bloques
 * flexibles (tareas o sesiones planificadas), propone moverlos al siguiente hueco del día o
 * dividirlos alrededor del evento. Nunca aplica nada: devuelve opciones para que decida el usuario.
 */
export function negotiate(newEvent: Interval, flexible: (Interval & { id: string })[], fixed: Interval[], available: Interval[], breakMin = 10): { blockId: string; options: NegotiationOption[] }[] {
  const clashes = flexible.filter((b) => overlaps(b, newEvent));
  return clashes.map((b) => {
    const others = flexible.filter((x) => x.id !== b.id);
    const free = subtract(available, [...fixed, ...others, newEvent], breakMin);
    const need = length(b);
    const options: NegotiationOption[] = [];
    const later = free.find((f) => f.start >= newEvent.end && length(f) >= need) ?? free.find((f) => length(f) >= need);
    if (later) options.push({ kind: 'mover', blockId: b.id, to: { start: later.start, end: later.start + need } });
    // Dividir: la parte antes del evento y el resto en el siguiente hueco.
    const before = Math.max(0, newEvent.start - breakMin - b.start);
    if (before >= 15 && before < need) {
      const rest = need - before;
      const slot = free.find((f) => f.start >= newEvent.end && length(f) >= rest);
      if (slot) options.push({ kind: 'dividir', blockId: b.id, parts: [{ start: b.start, end: b.start + before }, { start: slot.start, end: slot.start + rest }] });
    }
    options.push({ kind: 'mantener' });
    return { blockId: b.id, options };
  });
}
