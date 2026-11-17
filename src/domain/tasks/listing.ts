import { addDays, diffDays, type DayKey } from '@/lib/dates';

export interface ListTask {
  id: string;
  title: string;
  notes?: string | null;
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  priority: number;
  dueDate: DayKey | null;
  goalId: string | null;
  tags: { name: string }[];
  sortOrder: number;
  completedAt?: string | null;
}

export type GroupBy = 'fecha' | 'prioridad' | 'meta' | 'etiqueta' | 'manual';
export interface Section<T> {
  key: string;
  title: string;
  tone?: 'danger' | 'warning' | 'default';
  items: T[];
}

const isOpen = (t: ListTask) => t.status === 'todo' || t.status === 'in_progress';

/** Búsqueda insensible a mayúsculas y tildes en título, notas y etiquetas. */
export function matchesSearch(t: ListTask, q: string): boolean {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const needle = norm(q.trim());
  if (!needle) return true;
  return [t.title, t.notes ?? '', ...t.tags.map((x) => x.name)].some((s) => norm(s).includes(needle));
}

export function dueBucket(due: DayKey | null, today: DayKey): 'vencidas' | 'hoy' | 'manana' | 'semana' | 'despues' | 'sinFecha' {
  if (!due) return 'sinFecha';
  const d = diffDays(today, due);
  if (d < 0) return 'vencidas';
  if (d === 0) return 'hoy';
  if (d === 1) return 'manana';
  if (d <= 7) return 'semana';
  return 'despues';
}

const DUE_TITLES = { vencidas: 'Vencidas', hoy: 'Hoy', manana: 'Mañana', semana: 'Próximos 7 días', despues: 'Más adelante', sinFecha: 'Sin fecha' } as const;
const PRIORITY_TITLES: Record<number, string> = { 3: 'Prioridad alta', 2: 'Prioridad media', 1: 'Prioridad baja' };

/** Orden dentro de un grupo: prioridad, fecha, orden manual. */
export function compareTasks(a: ListTask, b: ListTask): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  if (a.dueDate !== b.dueDate) return (a.dueDate ?? '9999') < (b.dueDate ?? '9999') ? -1 : 1;
  return a.sortOrder - b.sortOrder;
}

export function groupTasks<T extends ListTask>(tasks: T[], by: GroupBy, today: DayKey, goalTitles: Record<string, string> = {}): Section<T>[] {
  const map = new Map<string, Section<T>>();
  const push = (key: string, title: string, t: T, tone: Section<T>['tone'] = 'default') => {
    if (!map.has(key)) map.set(key, { key, title, tone, items: [] });
    map.get(key)!.items.push(t);
  };
  if (by === 'manual') {
    return tasks.length ? [{ key: 'manual', title: 'Mi orden', items: [...tasks].sort((a, b) => a.sortOrder - b.sortOrder) }] : [];
  }
  for (const t of tasks) {
    if (by === 'fecha') {
      const b = dueBucket(t.dueDate, today);
      push(b, DUE_TITLES[b], t, b === 'vencidas' ? 'danger' : b === 'hoy' ? 'warning' : 'default');
    } else if (by === 'prioridad') push(String(t.priority), PRIORITY_TITLES[t.priority] ?? 'Prioridad', t);
    else if (by === 'meta') push(t.goalId ?? '_', t.goalId ? (goalTitles[t.goalId] ?? 'Meta') : 'Sin meta', t);
    else if (t.tags.length === 0) push('_', 'Sin etiqueta', t);
    else for (const tag of t.tags) push(tag.name, `#${tag.name}`, t);
  }
  const order: string[] =
    by === 'fecha' ? Object.keys(DUE_TITLES) : by === 'prioridad' ? ['3', '2', '1'] : [...map.keys()].sort((a, b) => (a === '_' ? 1 : b === '_' ? -1 : a.localeCompare(b)));
  return order.filter((k) => map.has(k)).map((k) => ({ ...map.get(k)!, items: map.get(k)!.items.sort(compareTasks) }));
}

export interface TaskFilter {
  view: 'pendientes' | 'completadas';
  search: string;
  tag: string | null;
}

export function filterTasks<T extends ListTask>(tasks: T[], f: TaskFilter): T[] {
  return tasks.filter(
    (t) =>
      (f.view === 'pendientes' ? isOpen(t) : t.status === 'done') &&
      matchesSearch(t, f.search) &&
      (!f.tag || t.tags.some((x) => x.name === f.tag)),
  );
}

/** Tareas para «Hoy»: vencidas y de hoy, abiertas. */
export function tasksForToday<T extends ListTask>(tasks: T[], today: DayKey): T[] {
  return tasks.filter((t) => isOpen(t) && t.dueDate !== null && t.dueDate <= today).sort(compareTasks);
}

/** Orden fraccional para reordenar sin renumerar toda la lista. */
export function sortOrderBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 0;
  if (before === null) return after! - 1;
  if (after === null) return before + 1;
  return (before + after) / 2;
}

/** Nuevo `sortOrder` para mover `id` una posición arriba (-1) o abajo (+1) en `ordered`. */
export function moveOrder(ordered: { id: string; sortOrder: number }[], id: string, direction: -1 | 1): number | null {
  const i = ordered.findIndex((t) => t.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= ordered.length) return null;
  // Se coloca entre el vecino destino y el siguiente en esa dirección.
  const neighbor = ordered[j]!.sortOrder;
  const beyond = ordered[j + direction]?.sortOrder ?? null;
  return direction === -1 ? sortOrderBetween(beyond, neighbor) : sortOrderBetween(neighbor, beyond);
}

export const tomorrow = (today: DayKey) => addDays(today, 1);
