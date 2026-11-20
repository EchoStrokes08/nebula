import { toDayKey as d } from '@/lib/dates';

import { carryOverTasks, matchCommand, reorganizeFrom } from './commands';

describe('matchCommand', () => {
  it.each([
    'Pasa lo que no hice hoy a mañana',
    'pásame lo pendiente para mañana',
    'mueve lo que me quedó a mañana',
    'Aplaza lo de hoy a mañana porfa',
  ])('«%s» pasa lo pendiente a mañana', (t) => {
    expect(matchCommand(t)).toEqual({ kind: 'carry_over' });
  });

  it('reorganizar la tarde o el resto del día', () => {
    expect(matchCommand('Reorganiza mi tarde')).toEqual({ kind: 'reorganize', from: 'tarde' });
    expect(matchCommand('organiza el resto del día')).toEqual({ kind: 'reorganize', from: 'ahora' });
    expect(matchCommand('replanifica mi día')).toEqual({ kind: 'reorganize', from: 'ahora' });
  });

  it('lo demás va al asistente completo', () => {
    expect(matchCommand('¿Qué hábito me cuesta más?')).toBeNull();
    expect(matchCommand('Organiza un plan para aprender inglés')).toBeNull();
    expect(matchCommand('Mañana tengo examen, ¿qué estudio?')).toBeNull();
  });
});

it('carryOverTasks: abiertas que vencían o estaban programadas hoy o antes', () => {
  const today = d('2026-11-20');
  const t = (id: string, extra: object) => ({ id, title: id, status: 'todo', dueDate: null, scheduledDay: null, ...extra });
  const r = carryOverTasks([
    t('hoy', { dueDate: today }),
    t('vencida', { dueDate: d('2026-11-18') }),
    t('bloque', { scheduledDay: today }),
    t('futura', { dueDate: d('2026-11-22') }),
    t('hecha', { dueDate: today, status: 'done' }),
    t('sinFecha', {}),
  ], today);
  expect(r.map((x) => x.id)).toEqual(['hoy', 'vencida', 'bloque']);
});

it('reorganizeFrom: la tarde empieza a las 13:00 salvo que ya sea más tarde', () => {
  expect(reorganizeFrom({ kind: 'reorganize', from: 'tarde' }, 9 * 60)).toBe(13 * 60);
  expect(reorganizeFrom({ kind: 'reorganize', from: 'tarde' }, 15 * 60 + 2)).toBe(15 * 60 + 5);
  expect(reorganizeFrom({ kind: 'reorganize', from: 'ahora' }, 9 * 60 + 1)).toBe(9 * 60 + 5);
});
