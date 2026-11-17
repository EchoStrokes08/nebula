/** Coloca bloques solapados en columnas (como Google Calendar): cada bloque recibe columna y total. */
export interface Block {
  id: string;
  start: number; // minutos
  end: number;
}

export function layoutColumns<T extends Block>(blocks: T[]): (T & { column: number; columns: number })[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: (T & { column: number; columns: number })[] = [];
  let cluster: (T & { column: number; columns: number })[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const n = Math.max(1, ...cluster.map((c) => c.column + 1));
    for (const c of cluster) c.columns = n;
    out.push(...cluster);
    cluster = [];
  };
  for (const b of sorted) {
    if (b.start >= clusterEnd && cluster.length) flush();
    const used = new Set(cluster.filter((c) => c.end > b.start).map((c) => c.column));
    let col = 0;
    while (used.has(col)) col++;
    cluster.push({ ...b, column: col, columns: 1 });
    clusterEnd = Math.max(clusterEnd === -Infinity ? b.end : clusterEnd, b.end);
  }
  if (cluster.length) flush();
  return out;
}
