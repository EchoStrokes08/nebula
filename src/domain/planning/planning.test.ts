import { findConflicts, merge, subtract, total } from './intervals';
import { negotiate } from './negotiate';
import { planDay, type PlanTask } from './scheduler';
import { overload, viableDay } from './viableDay';

const h = (x: number) => x * 60;
const T = (p: Partial<PlanTask> & { id: string; minutes: number }): PlanTask => ({ title: p.id, priority: 2, daysToDue: null, unlocks: 0, pendingPrereqs: [], ...p });

describe('intervalos', () => {
  it('une, resta y detecta conflictos', () => {
    expect(merge([{ start: 0, end: 10 }, { start: 5, end: 20 }, { start: 30, end: 40 }])).toEqual([{ start: 0, end: 20 }, { start: 30, end: 40 }]);
    expect(subtract([{ start: h(9), end: h(13) }], [{ start: h(10), end: h(11) }])).toEqual([{ start: h(9), end: h(10) }, { start: h(11), end: h(13) }]);
    expect(total(subtract([{ start: h(9), end: h(13) }], [{ start: h(10), end: h(11) }], 10))).toBe(h(3) - 20);
    const c = findConflicts([{ id: 'a', start: h(9), end: h(10) }, { id: 'b', start: h(9.5), end: h(11) }, { id: 'c', start: h(11), end: h(12) }]);
    expect(c.map(([x, y]) => x.id + y.id)).toEqual(['ab']);
  });
});

describe('planificador', () => {
  const available = [{ start: h(9), end: h(13) }, { start: h(15), end: h(19) }];
  const busy = [{ start: h(10), end: h(11) }]; // clase

  it('no solapa con compromisos y ordena por urgencia', () => {
    const r = planDay([T({ id: 'leer', minutes: 30 }), T({ id: 'informe', minutes: 60, daysToDue: 0 }), T({ id: 'repaso', minutes: 45, priority: 3 })], available, busy);
    for (const p of r.placed) expect(p.end <= h(10) - 10 || p.start >= h(11) + 10).toBe(true);
    expect(r.placed.map((p) => p.taskId).sort()).toEqual(['informe', 'leer', 'repaso']);
    const all = [...r.placed, { taskId: 'clase', start: h(10), end: h(11) }];
    expect(findConflicts(all.map((p) => ({ id: p.taskId, start: p.start, end: p.end })))).toHaveLength(0);
    expect(r.reasons.informe).toMatch(/vence hoy/);
  });

  it('si solo cabe una, gana la más urgente', () => {
    const r = planDay([T({ id: 'normal', minutes: 60 }), T({ id: 'vencida', minutes: 60, daysToDue: -2 })], [{ start: h(9), end: h(10) }], []);
    expect(r.placed.map((p) => p.taskId)).toEqual(['vencida']);
    expect(r.unplaced).toEqual([{ taskId: 'normal', reason: 'sin_hueco' }]);
  });

  it('respeta dependencias dentro del día y marca las bloqueadas', () => {
    const r = planDay(
      [T({ id: 'css', minutes: 60 }), T({ id: 'js', minutes: 60, priority: 3, pendingPrereqs: ['css'] }), T({ id: 'deploy', minutes: 30, pendingPrereqs: ['externa'] })],
      available,
      busy,
    );
    const css = r.placed.find((p) => p.taskId === 'css')!;
    const js = r.placed.find((p) => p.taskId === 'js')!;
    expect(js.start).toBeGreaterThanOrEqual(css.end + 10);
    expect(r.unplaced).toEqual([{ taskId: 'deploy', reason: 'bloqueada' }]);
  });

  it('divide tareas largas y detecta sobrecarga', () => {
    const r = planDay([T({ id: 'proyecto', minutes: h(5) }), T({ id: 'extra', minutes: h(5) })], available, busy);
    expect(r.placed.filter((p) => p.taskId === 'proyecto').length).toBeGreaterThan(1);
    expect(r.overloadMinutes).toBeGreaterThan(0);
    expect(r.unplaced.map((u) => u.taskId)).toContain('extra');
  });

  it('no planifica en el pasado', () => {
    const r = planDay([T({ id: 'x', minutes: 30 })], available, [], { notBefore: h(16) });
    expect(r.placed[0]!.start).toBeGreaterThanOrEqual(h(16));
  });
});

describe('día viable y sobrecarga', () => {
  const tasks = [
    T({ id: 'vencida', minutes: 60, daysToDue: -1 }),
    T({ id: 'alta', minutes: 90, priority: 3 }),
    T({ id: 'normal', minutes: 60 }),
    T({ id: 'baja', minutes: 30, priority: 1 }),
  ];
  it('esencial conserva lo importante y propone aplazar el resto (sin eliminar)', () => {
    const r = viableDay(tasks, 180, 'esencial');
    expect(r.keep).toEqual(['vencida', 'alta']);
    expect(r.defer.sort()).toEqual(['baja', 'normal']);
    expect(r.keep.length + r.defer.length).toBe(tasks.length);
  });
  it('recuperación usa la mitad del tiempo', () => {
    expect(viableDay(tasks, 180, 'recuperacion')).toMatchObject({ capacityMinutes: 90, keep: ['vencida'] });
  });
  it('completo llena por puntuación', () => {
    expect(viableDay(tasks, 240, 'completo').plannedMinutes).toBe(240);
  });
  it('ejemplo del prompt: 18 h planificadas con 11 disponibles', () => {
    expect(overload(h(18), h(11))).toMatchObject({ over: true, excessMinutes: h(7) });
  });
});

describe('negociación de conflictos', () => {
  it('propone mover o dividir el bloque que choca (ejemplo 16:00)', () => {
    const study = { id: 'estudio', start: h(15), end: h(17) };
    const r = negotiate({ start: h(16), end: h(17) }, [study], [], [{ start: h(9), end: h(21) }]);
    const kinds = r[0]!.options.map((o) => o.kind);
    expect(kinds).toEqual(['mover', 'dividir', 'mantener']);
    const move = r[0]!.options[0] as { kind: 'mover'; to: { start: number } };
    expect(move.to.start).toBeGreaterThanOrEqual(h(17));
  });
});
