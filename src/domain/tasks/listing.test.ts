import { toDayKey as d } from '@/lib/dates';

import { filterTasks, groupTasks, matchesSearch, moveOrder, sortOrderBetween, tasksForToday, type ListTask } from './listing';

const T = (p: Partial<ListTask> & { id: string }): ListTask => ({
  title: p.id,
  status: 'todo',
  priority: 2,
  dueDate: null,
  goalId: null,
  tags: [],
  sortOrder: 0,
  ...p,
});
const today = d('2026-11-18');
const tasks = [
  T({ id: 'a', dueDate: d('2026-11-15'), priority: 1 }),
  T({ id: 'b', dueDate: d('2026-11-18'), priority: 3, tags: [{ name: 'trabajo' }] }),
  T({ id: 'c', dueDate: d('2026-11-19') }),
  T({ id: 'd', dueDate: d('2026-12-30') }),
  T({ id: 'e' }),
  T({ id: 'f', status: 'done', dueDate: d('2026-11-10') }),
];

describe('listas de tareas', () => {
  it('agrupa por fecha con vencidas primero', () => {
    const g = groupTasks(filterTasks(tasks, { view: 'pendientes', search: '', tag: null }), 'fecha', today);
    expect(g.map((s) => [s.key, s.items.map((t) => t.id)])).toEqual([
      ['vencidas', ['a']],
      ['hoy', ['b']],
      ['manana', ['c']],
      ['despues', ['d']],
      ['sinFecha', ['e']],
    ]);
    expect(g[0]!.tone).toBe('danger');
  });

  it('agrupa por prioridad y por etiqueta', () => {
    expect(groupTasks(tasks, 'prioridad', today).map((s) => s.key)).toEqual(['3', '2', '1']);
    expect(groupTasks(tasks, 'etiqueta', today).map((s) => s.title)).toEqual(['#trabajo', 'Sin etiqueta']);
  });

  it('busca sin distinguir tildes y filtra por etiqueta y estado', () => {
    expect(matchesSearch(T({ id: 'x', title: 'Preparar exámenes' }), 'EXAMENES')).toBe(true);
    expect(filterTasks(tasks, { view: 'completadas', search: '', tag: null }).map((t) => t.id)).toEqual(['f']);
    expect(filterTasks(tasks, { view: 'pendientes', search: '', tag: 'trabajo' }).map((t) => t.id)).toEqual(['b']);
  });

  it('tareas de hoy incluye vencidas abiertas', () => {
    expect(tasksForToday(tasks, today).map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('orden fraccional', () => {
    expect(sortOrderBetween(1, 2)).toBe(1.5);
    expect(sortOrderBetween(null, 5)).toBe(4);
    expect(sortOrderBetween(5, null)).toBe(6);
  });

  it('mueve una tarea arriba o abajo en el orden manual', () => {
    const list = [{ id: 'x', sortOrder: 1 }, { id: 'y', sortOrder: 2 }, { id: 'z', sortOrder: 3 }];
    expect(moveOrder(list, 'z', -1)).toBe(1.5); // entre x e y
    expect(moveOrder(list, 'x', 1)).toBe(2.5); // entre y y z
    expect(moveOrder(list, 'x', -1)).toBeNull();
    expect(moveOrder(list, 'y', 1)).toBe(4); // tras la última
  });
});
