import { toDayKey } from '@/lib/dates';

import { boardNotes, whenLabel, type Note } from './board';

const today = toDayKey('2026-11-20');
const n = (id: string, patch: Partial<Note> = {}): Note => ({ id, text: id, color: 'amarillo', day: null, atTime: null, remind: false, done: false, createdAt: '2026-11-19T10:00:00Z', ...patch });
const fmt = (d: string, t: string) => (d === t ? 'Hoy' : d);

describe('tablero de notas rápidas', () => {
  it('ordena vencidas y de hoy por hora, luego sin fecha y luego las próximas; oculta hechas y lejanas', () => {
    const list = boardNotes([
      n('lejana', { day: toDayKey('2026-12-30') }),
      n('hecha', { done: true }),
      n('sin-fecha-vieja', { createdAt: '2026-11-01T00:00:00Z' }),
      n('sin-fecha-nueva', { createdAt: '2026-11-19T12:00:00Z' }),
      n('manana', { day: toDayKey('2026-11-21') }),
      n('hoy-tarde', { day: today, atTime: '18:00' }),
      n('hoy-pronto', { day: today, atTime: '09:00' }),
      n('ayer', { day: toDayKey('2026-11-19') }),
    ], today);
    expect(list.map((x) => x.id)).toEqual(['ayer', 'hoy-pronto', 'hoy-tarde', 'sin-fecha-nueva', 'sin-fecha-vieja', 'manana']);
  });
  it('etiqueta cuándo toca', () => {
    expect(whenLabel({ day: today, atTime: '10:30' }, today, fmt)).toBe('Hoy · 10:30');
    expect(whenLabel({ day: toDayKey('2026-11-18'), atTime: null }, today, fmt)).toBe('Vencida · 2026-11-18');
    expect(whenLabel({ day: null, atTime: null }, today, fmt)).toBeNull();
  });
});
