import { planSteps, pickAll, studyNotes } from './plan';
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
const run = async (p: PlanAction, pick = pickAll(p)) => { const s = { goalId: null as string | null }; for (const step of planSteps(p, pick, 'Europe/Madrid')) await step.run(s); return s; };
beforeEach(() => jest.resetAllMocks());

it('crea la meta, vincula tareas y hábitos y guarda qué estudiar con sus enlaces', async () => {
  jest.mocked(createGoal).mockResolvedValue('g1');
  jest.mocked(createHabit).mockResolvedValue('h1');
  await run(plan);
  expect(createGoal).toHaveBeenCalledWith(expect.objectContaining({ title: 'Aprender Python básico', metric: 'milestones', milestones: samplePlan.milestones, targetDate: '2027-02-01' }));
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
  jest.mocked(fetchGoals).mockResolvedValue([{ id: '7d1f6c1e-3d2a-4e5b-9f00-0123456789ab', description: 'Mía', milestones: [{ sortOrder: 0 }, { sortOrder: 4 }] }] as never);
  await run({ ...plan, goalId: '7d1f6c1e-3d2a-4e5b-9f00-0123456789ab' });
  expect(createGoal).not.toHaveBeenCalled();
  expect(addMilestone).toHaveBeenNthCalledWith(1, '7d1f6c1e-3d2a-4e5b-9f00-0123456789ab', 'Sintaxis y tipos', 5);
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
