/** Intervalo en minutos desde la medianoche local [start, end). */
export interface Interval {
  start: number;
  end: number;
}

export const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;
export const length = (i: Interval) => Math.max(0, i.end - i.start);

/** Une intervalos solapados o contiguos. */
export function merge(list: Interval[]): Interval[] {
  const sorted = [...list].filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

/** `base` menos `busy` (con un margen opcional alrededor de cada ocupado). */
export function subtract(base: Interval[], busy: Interval[], buffer = 0): Interval[] {
  const blocks = merge(busy.map((b) => ({ start: b.start - buffer, end: b.end + buffer })));
  const out: Interval[] = [];
  for (const w of merge(base)) {
    let cursor = w.start;
    for (const b of blocks) {
      if (b.end <= cursor || b.start >= w.end) continue;
      if (b.start > cursor) out.push({ start: cursor, end: Math.min(b.start, w.end) });
      cursor = Math.max(cursor, b.end);
    }
    if (cursor < w.end) out.push({ start: cursor, end: w.end });
  }
  return out.filter((i) => length(i) > 0);
}

export const total = (list: Interval[]) => merge(list).reduce((a, i) => a + length(i), 0);

/** Pares de elementos que se solapan (detección de conflictos). */
export function findConflicts<T extends Interval & { id: string }>(items: T[]): [T, T][] {
  const sorted = [...items].sort((a, b) => a.start - b.start);
  const out: [T, T][] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length && sorted[j]!.start < sorted[i]!.end; j++) {
      if (overlaps(sorted[i]!, sorted[j]!)) out.push([sorted[i]!, sorted[j]!]);
    }
  }
  return out;
}
