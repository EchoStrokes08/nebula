import { habitFormSchema, periodOptionsFor } from '@/features/habits/validation';
import { HABIT_ICONS } from '@/features/habits/icons';

import { describeTemplate, HABIT_TEMPLATES, searchTemplates, TEMPLATE_CATEGORIES } from './templates';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

describe('hábitos sugeridos', () => {
  it('cada categoría tiene sugerencias y los ids son únicos', () => {
    for (const c of TEMPLATE_CATEGORIES) expect(HABIT_TEMPLATES.filter((x) => x.category === c.id).length).toBeGreaterThanOrEqual(3);
    expect(new Set(HABIT_TEMPLATES.map((x) => x.id)).size).toBe(HABIT_TEMPLATES.length);
  });
  it.each(HABIT_TEMPLATES.map((x) => [x.name, x] as const))('«%s» pasa la validación del formulario', (_name, x) => {
    expect(periodOptionsFor(x.kind)).toContain(x.period);
    expect(HABIT_ICONS[x.icon]).toBeDefined();
    const r = habitFormSchema.safeParse({ name: x.name, kind: x.kind, period: x.period, target: x.target, unit: x.unit, sessionMin: x.sessionMin, minTarget: x.minTarget, scheduleDays: x.period === 'day' ? (x.days ?? [0, 1, 2, 3, 4, 5, 6]) : [], icon: x.icon, color: x.color, priority: 2 });
    expect(r.error?.issues ?? []).toEqual([]);
  });
  it('busca sin tildes y por categoría', () => {
    expect(searchTemplates('MEDITÁ').map((x) => x.name)).toContain('Meditar');
    expect(searchTemplates('agua').map((x) => x.name)).toContain('Beber agua');
    expect(searchTemplates('', 'ejercicio').every((x) => x.category === 'ejercicio')).toBe(true);
  });
  it('describe el objetivo en lenguaje natural', () => {
    expect(describeTemplate({ kind: 'quantity', period: 'day', target: 8, unit: 'vasos' })).toBe('8 vasos al día');
    expect(describeTemplate({ kind: 'frequency', period: 'week', target: 1 })).toBe('1 vez por semana');
    expect(describeTemplate({ kind: 'duration', period: 'day', target: 480 })).toBe('8 h al día');
    expect(describeTemplate({ kind: 'reduction', period: 'day', target: 2, unit: 'cafés' })).toBe('Máximo 2 cafés al día');
  });
});
