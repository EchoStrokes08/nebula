import { applyErrorText, emptyPlanState, isTransient, planSteps, pickAll, runStep, studyNotes } from './plan';
import { createGoal, addMilestone, fetchGoals, linkHabitToGoal, updateGoal } from '@/features/goals/api';
import { createHabit } from '@/features/habits/api';
import { createTask } from '@/features/tasks/api';
import { samplePlan } from '@/domain/capture/plan.fixture';
import type { PlanAction } from '@/domain/capture/actions';

jest.mock('@/data/queryClient', () => ({ queryClient: { invalidateQueries: jest.fn() } }));
jest.mock('@/features/goals/api', () => ({ createGoal: jest.fn(), addMilestone: jest.fn(), fetchGoals: jest.fn(), linkHabitToGoal: jest.fn(), updateGoal: jest.fn() }));
jest.mock('@/features/habits/api', () => ({ createHabit: jest.fn() }));
jest.mock('@/features/tasks/api', () => ({ createTask: jest.fn() }));

const plan = samplePlan as unknown as PlanAction;
const run = async (p: PlanAction, pick = pickAll(p)) => { const s = emptyPlanState(); for (const step of planSteps(p, pick, 'Europe/Madrid')) await step.run(s); return s; };
beforeEach(() => jest.resetAllMocks());

it('crea la meta, vincula tareas y hábitos y guarda qué estudiar con sus enlaces', async () => {
  jest.mocked(createGoal).mockResolvedValue('g1');
  jest.mocked(createHabit).mockResolvedValue('h1');
  await run(plan);
  expect(createGoal).toHaveBeenCalledWith(expect.objectContaining({ title: 'Aprender Python básico', metric: 'milestones', milestones: samplePlan.milestones.map((title) => ({ title, dueDate: null })), targetDate: '2027-02-01' }));
  expect(jest.mocked(createGoal).mock.calls[0]![0].description).toContain('https://docs.python.org/es/3/tutorial/');
  const task = jest.mocked(createTask).mock.calls[0]![0];
  expect(task).toMatchObject({ title: 'Instalar Python y VS Code', goalId: 'g1', estimateMinutes: 30, dueDate: '2026-11-18' });
  expect(task.notes).toBe('Instalar y ejecutar hola mundo.\n\nRecursos:\n• Python.org: https://www.python.org/downloads/');
  expect(createHabit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Practicar Python', kind: 'duration', target: 25, scheduleDays: [1, 3, 5], reminderTime: '19:00' }));
  expect(linkHabitToGoal).toHaveBeenCalledWith('h1', 'g1');
});

it('respeta lo que la persona desmarca', async () => {
  jest.mocked(createGoal).mockResolvedValue('g1');
  await run(plan, { milestones: false, tasks: [], habits: [] });
  expect(createGoal).toHaveBeenCalledWith(expect.objectContaining({ milestones: [], metric: 'tasks' }));
  expect(createTask).not.toHaveBeenCalled();
  expect(createHabit).not.toHaveBeenCalled();
});

it('con una meta existente añade hitos detrás de los suyos sin crear otra meta', async () => {
  jest.mocked(fetchGoals).mockResolvedValue([{ id: '7d1f6c1e-3d2a-4e5b-9f00-0123456789ab', description: 'Mía', milestones: [{ title: 'Otro', sortOrder: 0 }, { title: 'Más', sortOrder: 4 }] }] as never);
  await run({ ...plan, goalId: '7d1f6c1e-3d2a-4e5b-9f00-0123456789ab' });
  expect(createGoal).not.toHaveBeenCalled();
  expect(addMilestone).toHaveBeenNthCalledWith(1, '7d1f6c1e-3d2a-4e5b-9f00-0123456789ab', 'Sintaxis y tipos', 5, null);
  expect(jest.mocked(updateGoal).mock.calls[0]![1].description).toMatch(/^Mía\n\nRecursos de estudio:/);
  expect(createTask).toHaveBeenCalledWith(expect.objectContaining({ goalId: '7d1f6c1e-3d2a-4e5b-9f00-0123456789ab' }));
});

it('recorta las notas largas sin partir los enlaces', () => {
  const links = [{ title: 'A', url: 'https://a.example.com/x', note: null }, { title: 'B', url: 'https://b.example.com/y', note: null }];
  const text = studyNotes('x'.repeat(600), links, 120)!;
  expect(text.length).toBeLessThanOrEqual(120);
  expect(text).toContain('https://a.example.com/x');
  expect(text).toContain('https://b.example.com/y');
  expect(studyNotes(null, [], 500)).toBeNull();
});

it('guarda los pasos como subtareas, el criterio de terminado y las dependencias entre tareas', async () => {
  jest.mocked(createGoal).mockResolvedValue('g1');
  jest.mocked(createTask).mockResolvedValueOnce('t0').mockResolvedValueOnce('t1').mockResolvedValueOnce('t2');
  const detailed = {
    ...plan,
    milestones: [{ title: 'Fundamentos', day: '2026-12-01' }, 'Proyecto'],
    tasks: [
      { ...samplePlan.tasks[0], steps: ['Descargar Python', 'Ejecutar hola mundo'], done: 'print funciona en la terminal', after: [], milestone: 0 },
      { title: 'Variables', day: '2026-11-19', minutes: 40, priority: 2, study: null, resources: [], steps: [], done: null, after: [0], milestone: 0 },
      { title: 'Bucles', day: '2026-11-20', minutes: 40, priority: 2, study: null, resources: [], steps: [], done: null, after: [0, 1], milestone: 1 },
    ],
  } as unknown as PlanAction;
  // La persona no quiere la tarea 1: la 2 depende solo de la 0.
  await run(detailed, { milestones: true, tasks: [0, 2], habits: [] });
  expect(jest.mocked(createGoal).mock.calls[0]![0].milestones).toEqual([{ title: 'Fundamentos', dueDate: '2026-12-01' }, { title: 'Proyecto', dueDate: null }]);
  const [first, second] = jest.mocked(createTask).mock.calls.map((c) => c[0]);
  expect(first).toMatchObject({ subtasks: ['Descargar Python', 'Ejecutar hola mundo'], dependsOn: [] });
  expect(first!.notes).toContain('Terminado cuando: print funciona en la terminal');
  expect(second).toMatchObject({ title: 'Bucles', dependsOn: ['t0'] });
});

it('no repite dependencias ni hitos ya añadidos al reintentar', async () => {
  jest.mocked(createGoal).mockResolvedValue('g1');
  jest.mocked(createTask).mockResolvedValueOnce('t0').mockResolvedValueOnce('t1');
  const p = { ...plan, tasks: [{ ...samplePlan.tasks[0], after: [] }, { ...samplePlan.tasks[0], title: 'B', after: [0, 0] }], habits: [] } as unknown as PlanAction;
  await run(p);
  expect(jest.mocked(createTask).mock.calls[1]![0].dependsOn).toEqual(['t0']);
  jest.mocked(fetchGoals).mockResolvedValue([{ id: '7d1f6c1e-3d2a-4e5b-9f00-0123456789ab', description: '', milestones: [{ title: 'Sintaxis y tipos', sortOrder: 0 }] }] as never);
  await run({ ...plan, goalId: '7d1f6c1e-3d2a-4e5b-9f00-0123456789ab', tasks: [], habits: [] });
  expect(addMilestone).not.toHaveBeenCalledWith(expect.anything(), 'Sintaxis y tipos', expect.anything(), expect.anything());
  expect(addMilestone).toHaveBeenCalledTimes(samplePlan.milestones.length - 1);
});

it('reintenta solo los fallos pasajeros', async () => {
  const wait = jest.fn().mockResolvedValue(undefined);
  const flaky = jest.fn().mockRejectedValueOnce({ code: '', message: 'TypeError: Network request failed' }).mockResolvedValueOnce(undefined);
  await runStep({ key: 'k', label: 'x', run: flaky }, emptyPlanState(), wait);
  expect(flaky).toHaveBeenCalledTimes(2);
  const bad = jest.fn().mockRejectedValue({ code: '23514', message: 'tasks_priority_check' });
  await expect(runStep({ key: 'k', label: 'x', run: bad }, emptyPlanState(), wait)).rejects.toMatchObject({ code: '23514' });
  expect(bad).toHaveBeenCalledTimes(1);
  expect(isTransient({ code: 'PGRST301', message: 'JWT expired' })).toBe(true);
  expect(applyErrorText({ message: 'TypeError: Network request failed' })).toBe('no hay conexión con el servidor');
});
