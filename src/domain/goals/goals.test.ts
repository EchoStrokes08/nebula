import { goalProgress } from './progress';
import { simulate } from './simulator';

describe('progreso de metas', () => {
  it('cantidad con correcciones y contribución de hábitos', () => {
    const p = goalProgress({ metric: 'quantity', metricTarget: 12, progressEvents: [{ delta: 3 }, { delta: -1 }], milestones: [], tasks: [], habitContribution: 1 });
    expect(p).toEqual({ value: 3, target: 12, ratio: 0.25 });
  });

  it('hitos y tareas (las canceladas no cuentan); sin datos no es 0 %', () => {
    expect(goalProgress({ metric: 'milestones', metricTarget: null, progressEvents: [], milestones: [{ done: true }, { done: false }], tasks: [] }).ratio).toBe(0.5);
    expect(goalProgress({ metric: 'tasks', metricTarget: null, progressEvents: [], milestones: [], tasks: [{ status: 'done' }, { status: 'cancelled' }, { status: 'todo' }] }).ratio).toBe(0.5);
    expect(goalProgress({ metric: 'milestones', metricTarget: null, progressEvents: [], milestones: [], tasks: [] }).ratio).toBeNull();
  });
});

describe('simulador', () => {
  it('ejemplo del PDF: 6 h/semana → 72 h en 12 semanas', () => {
    const r = simulate({ remaining: 72, plannedPerWeek: 6, weeksUntilDeadline: 12 });
    expect(r.calculation.find((s) => s.name === 'medio')).toMatchObject({ weeks: 12, meetsDeadline: true });
    expect(r.calculation.find((s) => s.name === 'conservador')).toMatchObject({ perWeek: 4.5, weeks: 16, meetsDeadline: false });
    expect(r.calculation.find((s) => s.name === 'exigente')!.weeks).toBeCloseTo(9.6);
    expect(r.requiredPerWeek).toBe(6);
    expect(r.estimate).toBeNull(); // sin historial no se inventa estimación
  });

  it('con historial añade una estimación con rango', () => {
    const r = simulate({ remaining: 40, plannedPerWeek: 6, history: [4, 5, 3, 4] });
    expect(r.estimate!.observedPerWeek).toBe(4);
    expect(r.estimate!.weeksLikely).toBe(10);
    const [fast, slow] = r.estimate!.weeksRange;
    expect(fast!).toBeLessThan(10);
    expect(slow!).toBeGreaterThan(10);
  });

  it('ritmo cero no produce semanas', () => {
    expect(simulate({ remaining: 10, plannedPerWeek: 0 }).calculation[1]!.weeks).toBeNull();
  });
});
