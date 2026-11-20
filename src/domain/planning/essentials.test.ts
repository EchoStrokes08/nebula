import { essentials, type EssentialHabit } from './essentials';
import type { PlanTask } from './scheduler';

const task = (id: string, extra: Partial<PlanTask> = {}): PlanTask => ({ id, title: id, minutes: 30, priority: 1, daysToDue: null, unlocks: 0, pendingPrereqs: [], ...extra });
const habit = (id: string, extra: Partial<EssentialHabit> = {}): EssentialHabit => ({ id, name: id, priority: 1, streak: 0, minimum: null, ...extra });

describe('essentials', () => {
  it('nunca muestra más de tres cosas', () => {
    const r = essentials(
      [task('a', { daysToDue: 0 }), task('b', { daysToDue: -1 }), task('c', { priority: 3 })],
      [habit('h1'), habit('h2')],
    );
    expect(r).toHaveLength(3);
  });

  it('mezcla: hasta dos tareas urgentes y al menos un hábito si lo hay', () => {
    const r = essentials([task('a', { daysToDue: 0 }), task('b', { daysToDue: -2 }), task('c', { daysToDue: 0 })], [habit('h')]);
    expect(r.map((x) => x.kind)).toEqual(['task', 'task', 'habit']);
    expect(r[0]).toMatchObject({ id: 'b', reason: 'Está vencida' });
  });

  it('ignora tareas que no son urgentes ni importantes, y las bloqueadas', () => {
    const r = essentials([task('normal', { daysToDue: 5 }), task('bloq', { daysToDue: 0, pendingPrereqs: ['x'] })], [habit('h')]);
    expect(r.map((x) => x.id)).toEqual(['h']);
  });

  it('sin hábitos, hasta tres tareas', () => {
    const r = essentials([task('a', { daysToDue: 0 }), task('b', { daysToDue: 0 }), task('c', { daysToDue: 0 }), task('d', { daysToDue: 0 })], []);
    expect(r).toHaveLength(3);
  });

  it('protege primero las rachas y ofrece el mínimo', () => {
    const r = essentials([], [habit('nuevo', { priority: 3 }), habit('racha', { streak: 6, minimum: '10 min' }), habit('otro')]);
    expect(r[0]).toMatchObject({ id: 'racha', reason: 'Protege tu racha de 6 · basta con 10 min' });
    expect(r[1]).toMatchObject({ id: 'nuevo', reason: 'Es de tus prioridades' });
  });

  it('un día sin nada urgente queda vacío', () => {
    expect(essentials([task('a', { daysToDue: 3 })], [])).toEqual([]);
  });
});
