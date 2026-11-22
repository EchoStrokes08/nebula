import { cleanOutput, qualityShortfall, repairPlan } from '../../../supabase/functions/ai-assist/provider';
import { planSchema } from './actions';
import { samplePlan } from './plan.fixture';

const task = (i: number, extra: Record<string, unknown> = {}) => ({
  ...samplePlan.tasks[0], title: `Practica la lección ${i + 1}`, minutes: 30,
  study: 'Ejercicios de la lección.', milestone: i % 3, after: i ? [i - 1] : [],
  steps: ['Lee la lección', 'Haz los ejercicios'], done: 'Ejercicios corregidos.', ...extra,
});
const planWith = (tasks: Record<string, unknown>[]) => planSchema.parse({ ...samplePlan, tasks });

describe('repairPlan: completa huecos menores en vez de descartar el plan', () => {
  it('un plan con una tarea sin duración ni criterio ya no se rechaza', () => {
    const plan = planWith(Array.from({ length: 8 }, (_, i) => (i === 3 ? task(i, { minutes: null, done: null, steps: ['Solo un paso'] }) : task(i))));
    expect(qualityShortfall(structuredClone(plan), false, false)).toBe('tarea sin duración, práctica, pasos distintos o criterio de terminado');
    expect(repairPlan(plan).touched).toBe(1);
    expect(plan.tasks[3]).toMatchObject({ minutes: 30, done: 'Has completado «Practica la lección 4» y puedes explicar lo que hiciste.' });
    expect(plan.tasks[3]!.steps).toHaveLength(2);
    expect(qualityShortfall(plan, false, false)).toBeNull();
  });

  it('limita la duración y corrige hitos y dependencias imposibles', () => {
    const plan = planWith([task(0, { minutes: 300, milestone: 11, after: [] }), task(1, { after: [0, 1, 5] })]);
    repairPlan(plan);
    expect(plan.tasks[0]).toMatchObject({ minutes: 120, milestone: 2 });
    expect(plan.tasks[1]!.after).toEqual([0]);
  });

  it('no toca un plan que ya cumple', () => {
    const plan = planWith(Array.from({ length: 8 }, (_, i) => task(i)));
    expect(repairPlan(plan).touched).toBe(0);
  });

  it('completa el criterio de terminado aunque falte en todas (si hay pasos)', () => {
    const plan = planWith(Array.from({ length: 8 }, (_, i) => task(i, { done: null })));
    expect(repairPlan(plan).fields).toEqual(['criterio']);
    expect(qualityShortfall(plan, false, false)).toBeNull();
  });

  it('no inventa el detalle de un plan sin pasos en casi todas las tareas', () => {
    const plan = planWith(Array.from({ length: 8 }, (_, i) => task(i, { steps: [], done: null })));
    repairPlan(plan);
    expect(plan.tasks.every((t) => t.steps.length === 0 && t.done === null)).toBe(true);
    expect(qualityShortfall(plan, false, false)).toBe('tarea sin duración, práctica, pasos distintos o criterio de terminado');
  });

  it('acepta una respuesta que es solo la lista de acciones', () => {
    const out = cleanOutput(JSON.stringify([{ type: 'create_task', title: 'Hola', day: null, time: null, minutes: null, priority: 2, recurrence: null }])) as { actions: unknown[]; message: string };
    expect(out.actions).toHaveLength(1);
    expect(out.message).toBeTruthy();
  });

  it('un plan sin tareas sigue siendo insuficiente', () => {
    const plan = planWith([]);
    repairPlan(plan);
    expect(qualityShortfall(plan, false, false)).toBe('falta estrategia, hitos o tareas');
  });
});
