import type { HabitKind, HabitTarget } from '@/domain/habits/types';
import { toDayKey as d } from '@/lib/dates';

import { applyToggle, focusSuggestion, perfectDays, toggleFor, trimLogs, widgetHeatmap, widgetItems, widgetOrbits, type WidgetHabit, type WidgetLog, type WidgetSnapshot } from './today';

const habit = (id: string, kind: HabitKind, target: Partial<HabitTarget> = {}, extra: Partial<WidgetHabit> = {}): WidgetHabit => ({
  id,
  name: id,
  color: 'violet',
  kind,
  unit: kind === 'duration' ? 'min' : null,
  scheduleDays: [],
  startDay: d('2026-11-01'),
  targets: [{ validFrom: d('2026-11-01'), period: 'day', target: 1, ...target }],
  pauses: [],
  ...extra,
});
const log = (habitId: string, day: string, value = 1, id = `${habitId}-${day}`): WidgetLog => ({ id, habitId, dayKey: d(day), value });
const snap = (habits: WidgetHabit[], logs: WidgetLog[] = [], tz = 'Europe/Madrid'): WidgetSnapshot => ({ v: 1, uid: 'u', tz, weekStartsOn: 1, habits, logs, savedAt: 0 });
// Miércoles 18 a las 12:00 en Madrid.
const NOW = new Date('2026-11-18T11:00:00Z');

describe('widgetItems', () => {
  it('pone los pendientes antes que los cumplidos y cuenta los hechos', () => {
    const s = snap([habit('leer', 'binary'), habit('agua', 'quantity', { target: 8 })], [log('leer', '2026-11-18')]);
    const r = widgetItems(s, NOW);
    expect(r.today).toBe('2026-11-18');
    expect(r.items.map((i) => [i.id, i.done])).toEqual([['agua', false], ['leer', true]]);
    expect(r.done).toBe(1);
  });

  it('oculta archivados, pausados y días no programados', () => {
    const s = snap([
      habit('a', 'binary', {}, { archived: true }),
      habit('p', 'binary', {}, { pauses: [{ from: d('2026-11-10'), to: null }] }),
      habit('lun', 'binary', {}, { scheduleDays: [1] }), // solo lunes
      habit('ok', 'binary'),
    ]);
    expect(widgetItems(s, NOW).items.map((i) => i.id)).toEqual(['ok']);
  });

  it('calcula el día en la zona del usuario, no en UTC', () => {
    // 23:30 UTC del 18 = 00:30 del 19 en Madrid.
    const s = snap([habit('leer', 'binary')], [log('leer', '2026-11-18')]);
    const r = widgetItems(s, new Date('2026-11-18T23:30:00Z'));
    expect(r.today).toBe('2026-11-19');
    expect(r.items[0]!.done).toBe(false);
    expect(r.items[0]!.streak).toBe(1); // el pendiente de hoy no rompe la racha
  });

  it('describe el avance y solo deja marcar binarios y de frecuencia', () => {
    const s = snap(
      [habit('gym', 'frequency', { period: 'week', target: 3 }), habit('medita', 'duration', { target: 15 }), habit('leer', 'binary')],
      [log('gym', '2026-11-16'), log('medita', '2026-11-18', 5)],
    );
    const byId = Object.fromEntries(widgetItems(s, NOW).items.map((i) => [i.id, i]));
    expect(byId.gym).toMatchObject({ detail: '1/3 esta semana', toggleable: true });
    expect(byId.medita).toMatchObject({ detail: '5/15 min', toggleable: false });
    expect(byId.leer).toMatchObject({ detail: null, toggleable: true });
  });

  it('racha con los días anteriores cumplidos', () => {
    const s = snap([habit('leer', 'binary')], ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18'].map((x) => log('leer', x)));
    expect(widgetItems(s, NOW).items[0]!.streak).toBe(4);
  });
});

describe('toggleFor / applyToggle', () => {
  it('registra 1 si hoy no hay registro y lo deshace si ya lo hay', () => {
    const s = snap([habit('leer', 'binary')]);
    const op = toggleFor(s, 'leer', NOW);
    expect(op).toEqual({ op: 'insert', habitId: 'leer', dayKey: '2026-11-18', value: 1 });
    const after = applyToggle(s, op!, 'c1');
    expect(widgetItems(after, NOW).items[0]!.done).toBe(true);

    const undo = toggleFor(after, 'leer', NOW);
    expect(undo).toEqual({ op: 'delete', ids: ['c1'] });
    expect(widgetItems(applyToggle(after, undo!, 'x'), NOW).items[0]!.done).toBe(false);
  });

  it('borra por clientId cuando el registro lo tiene (también los del servidor)', () => {
    const s = snap([habit('leer', 'binary')], [{ ...log('leer', '2026-11-18', 1, 'srv-1'), clientId: 'cli-1' }, log('leer', '2026-11-17')]);
    expect(toggleFor(s, 'leer', NOW)).toEqual({ op: 'delete', ids: ['cli-1'] });
    expect(applyToggle(s, { op: 'delete', ids: ['cli-1'] }, 'x').logs.map((l) => l.id)).toEqual(['leer-2026-11-17']);
  });

  it('no marca hábitos de cantidad, archivados ni desconocidos', () => {
    const s = snap([habit('agua', 'quantity', { target: 8 }), habit('old', 'binary', {}, { archived: true })]);
    expect(toggleFor(s, 'agua', NOW)).toBeNull();
    expect(toggleFor(s, 'old', NOW)).toBeNull();
    expect(toggleFor(s, 'nada', NOW)).toBeNull();
  });
});

it('trimLogs conserva solo la ventana necesaria', () => {
  const logs = [log('a', '2026-01-01'), log('a', '2026-11-01')];
  expect(trimLogs(logs, d('2026-11-18')).map((l) => l.dayKey)).toEqual(['2026-11-01']);
});

describe('widgets complementarios', () => {
  it('widgetOrbits: día, semana y mes con tareas de la instantánea', () => {
    const s = { ...snap([habit('leer', 'binary')], [log('leer', '2026-11-16'), log('leer', '2026-11-18')]), tasks: [{ status: 'done' as const, dueDate: d('2026-11-17') }] };
    const r = widgetOrbits(s, NOW);
    expect(r.day).toEqual({ done: 1, total: 1, progress: 1 });
    expect(r.week).toMatchObject({ total: 8, done: 3 });
    expect(r.month.total).toBe(31); // 30 días de noviembre + la tarea
  });

  it('widgetOrbits: el anillo del día avanza con los hábitos a medias', () => {
    const s = snap([habit('leer', 'duration', { target: 30 }), habit('agua', 'binary')], [log('leer', '2026-11-18', 15)]);
    const r = widgetOrbits(s, NOW);
    expect(r.day).toMatchObject({ done: 0, total: 2 });
    expect(r.day.progress).toBeCloseTo(0.25);
    expect(r.week.done).toBeCloseTo(0.5);
  });

  it('widgetHeatmap: semanas completas, futuro sin pintar y sin hábitos = null', () => {
    const s = snap([habit('leer', 'binary'), habit('agua', 'binary')], [log('leer', '2026-11-16'), log('agua', '2026-11-16'), log('leer', '2026-11-17')]);
    const { days } = widgetHeatmap(s, NOW, 3);
    expect(days).toHaveLength(21);
    expect(days[0]!.day).toBe('2026-11-02');
    const at = (k: string) => days.find((x) => x.day === k)!;
    expect(at('2026-11-16').ratio).toBe(1);
    expect(at('2026-11-17').ratio).toBe(0.5);
    expect(at('2026-11-19')).toMatchObject({ future: true, ratio: null });
    expect(perfectDays(days, d('2026-11-18'))).toBe(0); // el 17 no fue completo
    expect(widgetHeatmap(snap([habit('n', 'binary', {}, { startDay: d('2026-11-18') })]), NOW, 1).days[0]!.ratio).toBeNull();
  });

  it('perfectDays: hoy incompleto no corta la cuenta', () => {
    const s = snap([habit('leer', 'binary')], [log('leer', '2026-11-16'), log('leer', '2026-11-17')]);
    expect(perfectDays(widgetHeatmap(s, NOW, 1).days, d('2026-11-18'))).toBe(2);
  });

  it('focusSuggestion: el hábito de minutos al que más le falta hoy', () => {
    const s = snap([habit('leer', 'duration', { target: 15 }), habit('piano', 'duration', { target: 30 }), habit('cama', 'binary')], [log('piano', '2026-11-18', 20)]);
    expect(focusSuggestion(s, NOW)).toEqual({ habitId: 'leer', name: 'leer', leftMinutes: 15 });
    expect(focusSuggestion(snap([habit('cama', 'binary')]), NOW)).toBeNull();
  });
});
