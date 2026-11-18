import { busyFromTasks, schedulePlan, type SchedulePlan } from './schedule';

const task = (day: string | null, minutes: number | null = 30, after: number[] = [], milestone: number | null = null) => ({ day, minutes, after, milestone });

// 2026-11-18 es miércoles.
const ctx = { today: '2026-11-18', activeDays: [1, 2, 3, 4, 5], busy: {} as Record<string, number> };

describe('planificación del plan', () => {
  it('no programa nada en el pasado ni en días inactivos', () => {
    const plan: SchedulePlan = { day: null, milestones: [], tasks: [task('2026-11-01'), task('2026-11-21')] }; // sábado
    schedulePlan(plan, ctx);
    expect(plan.tasks.map((t) => t.day)).toEqual(['2026-11-18', '2026-11-23']);
    expect(plan.adjustments!.join(' ')).toMatch(/Moví 2 tareas/);
  });

  it('respeta el tope diario contando lo que la persona ya tiene', () => {
    const plan: SchedulePlan = { day: null, milestones: [], tasks: [task('2026-11-18', 60), task('2026-11-18', 60), task('2026-11-18', 30)] };
    schedulePlan(plan, { ...ctx, busy: { '2026-11-18': 90 } });
    // 90 + 60 > 120 → pasa al jueves; la segunda cabe (120); la tercera ya no → viernes.
    expect(plan.tasks.map((t) => t.day)).toEqual(['2026-11-19', '2026-11-19', '2026-11-20']);
  });

  it('una tarea más larga que el tope va sola en un día libre en vez de no programarse', () => {
    const plan: SchedulePlan = { day: null, milestones: [], tasks: [task('2026-11-18', 180)] };
    schedulePlan(plan, ctx);
    expect(plan.tasks[0]!.day).toBe('2026-11-18');
  });

  it('una tarea nunca va antes de sus dependencias ni antes de la anterior; descarta dependencias hacia delante', () => {
    const plan: SchedulePlan = { day: null, milestones: [], tasks: [task('2026-11-25', 30, [1]), task('2026-11-19', 30, [0])] };
    schedulePlan(plan, ctx);
    expect(plan.tasks[0]!.after).toEqual([]);
    expect(plan.tasks[1]!.day! >= plan.tasks[0]!.day!).toBe(true);
  });

  it('pone fecha a las tareas sin fecha y fecha los hitos tras su última tarea, en orden', () => {
    const plan: SchedulePlan = {
      day: '2026-11-20',
      milestones: ['Fundamentos', { title: 'Proyecto', day: '2026-11-19' }],
      tasks: [task(null, 100, [], 0), task(null, 100, [0], 0), task(null, 100, [1], 1)],
    };
    schedulePlan(plan, ctx);
    expect(plan.tasks.map((t) => t.day)).toEqual(['2026-11-18', '2026-11-19', '2026-11-20']);
    expect(plan.milestones).toEqual([{ title: 'Fundamentos', day: '2026-11-19' }, { title: 'Proyecto', day: '2026-11-20' }]);
    expect(plan.adjustments!.join(' ')).toMatch(/Puse fecha a 3 tareas/);
  });

  it('si el trabajo no cabe antes de la fecha objetivo, la retrasa y lo explica', () => {
    const plan: SchedulePlan = { day: '2026-11-19', milestones: [], tasks: [task('2026-11-18', 120), task('2026-11-18', 120), task('2026-11-18', 120)] };
    schedulePlan(plan, ctx);
    expect(plan.day).toBe('2026-11-20');
    expect(plan.adjustments!.join(' ')).toMatch(/fecha objetivo/);
  });

  it('cuenta solo tareas abiertas con fecha para la carga existente', () => {
    expect(busyFromTasks([
      { status: 'todo', due: '2026-11-18', estimate: 45 },
      { status: 'todo', due: '2026-11-18', estimate: null },
      { status: 'done', due: '2026-11-18', estimate: 60 },
      { status: 'todo', due: null, estimate: 60 },
    ])).toEqual({ '2026-11-18': 75 });
  });
});
