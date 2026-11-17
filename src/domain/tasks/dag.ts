/** Grafo de dependencias: `deps[a]` = tareas de las que depende `a` (deben terminarse antes). */
export interface DagNode {
  id: string;
  done: boolean;
  estimateMinutes?: number | null;
}

export interface DagAnalysis {
  /** Orden topológico (prerrequisitos primero). */
  order: string[];
  /** Nivel de cada nodo (0 = sin prerrequisitos) para dibujar por columnas. */
  level: Map<string, number>;
  /** Pendientes con algún prerrequisito sin terminar. */
  blocked: Set<string>;
  /** Pendientes listas para empezar. */
  ready: Set<string>;
  /** Cuántas tareas pendientes dependen (directa o indirectamente) de cada una. */
  unlocks: Map<string, number>;
  /** Cadena de pendientes con más minutos estimados (ruta crítica). */
  criticalPath: string[];
}

export function analyzeDag(nodes: DagNode[], edges: { taskId: string; dependsOn: string }[]): DagAnalysis {
  const ids = new Set(nodes.map((n) => n.id));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const deps = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();
  for (const id of ids) {
    deps.set(id, []);
    dependents.set(id, []);
  }
  for (const e of edges) {
    if (!ids.has(e.taskId) || !ids.has(e.dependsOn)) continue;
    deps.get(e.taskId)!.push(e.dependsOn);
    dependents.get(e.dependsOn)!.push(e.taskId);
  }

  // Kahn
  const indeg = new Map([...ids].map((id) => [id, deps.get(id)!.length]));
  const queue = [...ids].filter((id) => indeg.get(id) === 0);
  const order: string[] = [];
  const level = new Map<string, number>();
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    const lv = Math.max(-1, ...deps.get(id)!.map((d) => level.get(d) ?? 0)) + 1;
    level.set(id, lv);
    for (const n of dependents.get(id)!) {
      indeg.set(n, indeg.get(n)! - 1);
      if (indeg.get(n) === 0) queue.push(n);
    }
  }
  if (order.length !== ids.size) throw new Error('El grafo de dependencias contiene un ciclo');

  const blocked = new Set<string>();
  const ready = new Set<string>();
  for (const id of order) {
    if (byId.get(id)!.done) continue;
    (deps.get(id)!.some((d) => !byId.get(d)!.done) ? blocked : ready).add(id);
  }

  const unlocks = new Map<string, number>();
  for (const id of ids) {
    const seen = new Set<string>();
    const stack = [...dependents.get(id)!];
    while (stack.length) {
      const n = stack.pop()!;
      if (seen.has(n)) continue;
      seen.add(n);
      stack.push(...dependents.get(n)!);
    }
    unlocks.set(id, [...seen].filter((n) => !byId.get(n)!.done).length);
  }

  // Ruta crítica: camino más largo (en minutos; 30 por defecto) entre pendientes.
  const weight = (id: string) => (byId.get(id)!.done ? 0 : (byId.get(id)!.estimateMinutes ?? 30));
  const best = new Map<string, { total: number; prev: string | null }>();
  for (const id of order) {
    const pending = deps.get(id)!.filter((d) => !byId.get(d)!.done);
    let prev: string | null = null;
    let base = 0;
    for (const d of pending) {
      const b = best.get(d)!;
      if (b.total > base) {
        base = b.total;
        prev = d;
      }
    }
    best.set(id, { total: base + weight(id), prev });
  }
  let end: string | null = null;
  let max = 0;
  for (const [id, b] of best) {
    if (!byId.get(id)!.done && b.total > max) {
      max = b.total;
      end = id;
    }
  }
  const criticalPath: string[] = [];
  while (end) {
    criticalPath.unshift(end);
    end = best.get(end)!.prev;
  }

  return { order, level, blocked, ready, unlocks, criticalPath };
}

/** ¿Añadir la arista `taskId → dependsOn` crearía un ciclo? (validación previa en la UI) */
export function wouldCreateCycle(edges: { taskId: string; dependsOn: string }[], taskId: string, dependsOn: string): boolean {
  if (taskId === dependsOn) return true;
  const adj = new Map<string, string[]>();
  for (const e of edges) adj.set(e.taskId, [...(adj.get(e.taskId) ?? []), e.dependsOn]);
  const stack = [dependsOn];
  const seen = new Set<string>();
  while (stack.length) {
    const n = stack.pop()!;
    if (n === taskId) return true;
    if (seen.has(n)) continue;
    seen.add(n);
    stack.push(...(adj.get(n) ?? []));
  }
  return false;
}
