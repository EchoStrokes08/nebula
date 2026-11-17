import { addDays, type DayKey } from '@/lib/dates';

import { journalPatterns, terms } from './patterns';

const today = '2026-11-17' as DayKey;
const entry = (i: number, difficulties: string, next = 'Empezar a las 9') => ({ day_key: addDays(today, -i * 2), achievements: '', difficulties, learnings: '', next_step: next });

it('extrae términos sin palabras vacías', () => {
  expect(terms('Mucho cansancio y el móvil, cansancio')).toEqual(['cansancio', 'móvil']);
});
it('exige un mínimo de reflexiones', () => {
  expect(journalPatterns([entry(1, 'cansancio')], new Set(), [])).toEqual({ status: 'insufficient', needed: 6, have: 1 });
});
it('detecta temas recurrentes y asociaciones con lenguaje prudente', () => {
  const entries = [0, 1, 2, 3, 4, 5, 6].map((i) => entry(i, i < 4 ? 'Mucho cansancio por la tarde' : 'Reuniones largas'));
  const range = Array.from({ length: 28 }, (_, i) => addDays(today, -i));
  const active = new Set(entries.map((e) => e.day_key));
  const r = journalPatterns(entries, active, range);
  if (r.status !== 'ok') throw new Error('esperaba ok');
  expect(r.patterns.map((p) => p.text)).toEqual(expect.arrayContaining([expect.stringMatching(/«cansancio» aparece en 4 de tus 7/), expect.stringMatching(/no necesariamente la causa/)]));
});
it('sugiere cerrar con un próximo paso si casi nunca se hace', () => {
  const entries = [0, 1, 2, 3, 4, 5].map((i) => entry(i, 'x', ''));
  const r = journalPatterns(entries, new Set(), []);
  if (r.status !== 'ok') throw new Error('esperaba ok');
  expect(r.patterns.some((p) => p.id === 'next-steps')).toBe(true);
});
