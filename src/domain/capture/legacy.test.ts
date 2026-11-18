import { toLegacyResponse, UPDATE_NOTICE } from './legacy';
import { assistanceSchema as legacySchema } from './legacy-actions.fixture';

const resource = (i: number) => ({ title: `R${i}`, url: `https://r${i}.example.com/`, note: '[Curso] algo' });

it('una app 1.1.x acepta el plan nuevo convertido y recibe el aviso de actualización', () => {
  const plan = {
    type: 'create_plan', goalId: null, goal: 'Aprobar el B2', why: 'x'.repeat(900), day: '2027-02-12',
    milestones: [{ title: 'Diagnóstico', day: '2026-11-23' }, 'Gramática'],
    tasks: Array.from({ length: 18 }, (_, i) => ({ title: `Tarea ${i}`, day: '2026-11-20', minutes: 45, priority: 2, study: 'Estudiar', resources: [1, 2, 3, 4, 5, 6].map(resource), steps: ['Leer', 'Practicar'], done: 'Hecho', after: i ? [i - 1] : [], milestone: 0 })),
    habits: Array.from({ length: 6 }, (_, i) => ({ title: `Hábito ${i}`, minutes: 20, days: [1, 2], time: null, study: 'Rutina', resources: [1, 2, 3, 4, 5].map(resource) })),
    resources: Array.from({ length: 15 }, (_, i) => resource(i)),
    adjustments: ['Moví 3 tareas'],
  };
  const out = toLegacyResponse({ message: 'Aquí tienes tu plan.', actions: [plan, { type: 'create_task', title: 'x', day: null, time: null, minutes: null, priority: 1, recurrence: null } as { type: string }] });
  const parsed = legacySchema.parse(out);
  expect(parsed.message.endsWith(UPDATE_NOTICE)).toBe(true);
  const legacy = parsed.actions[0] as { tasks: { study: string }[]; milestones: string[] };
  expect(legacy.milestones).toEqual(['Diagnóstico', 'Gramática']);
  expect(legacy.tasks).toHaveLength(12);
  expect(legacy.tasks[0]!.study).toContain('1. Leer');
  expect(legacy.tasks[0]!.study).toContain('Terminado cuando: Hecho');
});
