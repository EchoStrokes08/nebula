import { formatElapsed, PLAN_STEPS, progressAt } from './progress';

describe('progreso del asistente', () => {
  it('avanza de etapa con el tiempo y nunca pasa de la última', () => {
    expect(progressAt('plan', 0).current).toBe(0);
    expect(progressAt('plan', 5).current).toBe(1);
    expect(progressAt('plan', 30).current).toBe(2);
    expect(progressAt('plan', 500).current).toBe(PLAN_STEPS.length - 1);
    expect(progressAt('chat', 6).current).toBe(1);
  });

  it('avisa de que tarda más de lo normal según el tipo de consulta', () => {
    expect(progressAt('plan', 100).slow).toBe(false);
    expect(progressAt('plan', 115).slow).toBe(true);
    expect(progressAt('chat', 45).slow).toBe(true);
  });

  it('formatea el tiempo transcurrido', () => {
    expect(formatElapsed(7)).toBe('0:07');
    expect(formatElapsed(92)).toBe('1:32');
  });
});
