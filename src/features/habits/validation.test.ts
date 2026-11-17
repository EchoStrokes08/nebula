import { validate } from '@/features/auth/validation';

import { habitFormSchema, periodOptionsFor } from './validation';

const base = {
  name: 'Inglés',
  kind: 'duration' as const,
  period: 'day' as const,
  target: 30,
  scheduleDays: [1, 2, 3, 4, 5],
  icon: 'languages',
  color: 'violet' as const,
  priority: 2,
};

describe('formulario de hábito', () => {
  it('acepta un hábito de duración diario', () => {
    expect(validate(habitFormSchema, base).ok).toBe(true);
  });

  it('exige unidad en cantidad/acumulativo/reducción', () => {
    const r = validate(habitFormSchema, { ...base, kind: 'quantity', unit: '' });
    expect(!r.ok && r.errors.unit).toMatch(/unidad/);
  });

  it('flexible exige mínimo por sesión y periodo semanal', () => {
    const r = validate(habitFormSchema, { ...base, kind: 'flexible', target: 3 });
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['period', 'sessionMin']);
  });

  it('un diario necesita al menos un día y el mínimo no supera el objetivo', () => {
    const r = validate(habitFormSchema, { ...base, scheduleDays: [], minTarget: 60 });
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['minTarget', 'scheduleDays']);
  });

  it('periodos permitidos por tipo', () => {
    expect(periodOptionsFor('binary')).toEqual(['day']);
    expect(periodOptionsFor('cumulative')).toEqual(['week', 'month']);
  });
});
