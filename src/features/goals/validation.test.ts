import { validate } from '@/features/auth/validation';

import { goalFormSchema } from './validation';

const base = { kind: 'goal', title: 'Leer más', targetDate: null, metric: 'milestones', metricTarget: null, metricUnit: null, visibility: 'private', color: 'violet', milestones: [] };

describe('formulario de meta', () => {
  it('acepta una meta por hitos', () => expect(validate(goalFormSchema, base).ok).toBe(true));
  it('una meta medible exige cantidad y unidad', () => {
    const r = validate(goalFormSchema, { ...base, metric: 'quantity' });
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['metricTarget', 'metricUnit']);
  });
});
