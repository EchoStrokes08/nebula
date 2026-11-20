import { habitFormSchema, periodOptionsFor } from '@/features/habits/validation';
import { HABIT_ICONS } from '@/features/habits/icons';

import { describeTemplate, groupTemplates, HABIT_TEMPLATES, searchTemplates, TEMPLATE_CATEGORIES, templateCount } from './templates';

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
  it('agrupa por categoría en orden y sin grupos vacíos', () => {
    const groups = groupTemplates(HABIT_TEMPLATES);
    expect(groups.map((g) => g.category.id)).toEqual(TEMPLATE_CATEGORIES.map((c) => c.id));
    expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(HABIT_TEMPLATES.length);
    expect(groupTemplates(searchTemplates('agua')).every((g) => g.items.length > 0)).toBe(true);
    expect(templateCount(null)).toBe(HABIT_TEMPLATES.length);
    expect(templateCount('cuidado')).toBe(HABIT_TEMPLATES.filter((x) => x.category === 'cuidado').length);
  });
  it('los nombres no se repiten', () => {
    const names = HABIT_TEMPLATES.map((x) => x.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });
  it('describe el objetivo en lenguaje natural', () => {
    expect(describeTemplate({ kind: 'quantity', period: 'day', target: 8, unit: 'vasos' })).toBe('8 vasos al día');
    expect(describeTemplate({ kind: 'frequency', period: 'week', target: 1 })).toBe('1 vez por semana');
    expect(describeTemplate({ kind: 'duration', period: 'day', target: 480 })).toBe('8 h al día');
    expect(describeTemplate({ kind: 'reduction', period: 'day', target: 2, unit: 'cafés' })).toBe('Máximo 2 cafés al día');
  });
});
