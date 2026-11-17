import { toDayKey as d } from '@/lib/dates';

import { consistency, evaluatePeriod, recentPeriods, streaks, targetAt } from './evaluate';
import { recoveryProposal } from './recovery';
import type { HabitDef, HabitKind, HabitLog, HabitTarget } from './types';

const habit = (kind: HabitKind, target: Partial<HabitTarget> = {}, extra: Partial<HabitDef> = {}): HabitDef => ({
  id: 'h',
  name: 'Inglés',
  kind,
  unit: kind === 'duration' ? 'min' : null,
  scheduleDays: [],
  startDay: d('2026-11-01'),
  targets: [{ validFrom: d('2026-11-01'), period: 'day', target: 1, ...target }],
  pauses: [],
  ...extra,
});
const log = (day: string, value = 1): HabitLog => ({ dayKey: d(day), value });
const TODAY = d('2026-11-18'); // miércoles

describe('evaluatePeriod por tipo', () => {
  it('binario: hecho / pendiente / no hecho', () => {
    const h = habit('binary');
    expect(evaluatePeriod(h, [log('2026-11-18')], TODAY, TODAY).status).toBe('met');
    expect(evaluatePeriod(h, [], TODAY, TODAY).status).toBe('pending');
    expect(evaluatePeriod(h, [], d('2026-11-17'), TODAY).status).toBe('missed');
  });

  it('duración: suma registros parciales del día', () => {
    const h = habit('duration', { target: 30 });
    const r = evaluatePeriod(h, [log('2026-11-17', 10), log('2026-11-17', 15)], d('2026-11-17'), TODAY);
    expect(r).toMatchObject({ status: 'partial', value: 25, target: 30 });
    expect(r.progress).toBeCloseTo(25 / 30);
    expect(evaluatePeriod(h, [log('2026-11-17', 30)], d('2026-11-17'), TODAY).status).toBe('met');
  });

  it('cantidad: 8 vasos de agua', () => {
    const h = habit('quantity', { target: 8 });
    expect(evaluatePeriod(h, [log('2026-11-18', 5)], TODAY, TODAY)).toMatchObject({ status: 'pending', value: 5 });
  });

  it('frecuencia: 3 veces por semana (lunes a domingo)', () => {
    const h = habit('frequency', { period: 'week', target: 3 });
    const logs = [log('2026-11-16'), log('2026-11-16'), log('2026-11-18')];
    expect(evaluatePeriod(h, logs, TODAY, TODAY)).toMatchObject({ status: 'met', value: 3 });
    // la semana anterior (9–15) sin registros: missed
    expect(evaluatePeriod(h, logs, d('2026-11-12'), TODAY)).toMatchObject({ status: 'missed', start: '2026-11-09', end: '2026-11-15' });
  });

  it('acumulativo mensual: 100 km en noviembre', () => {
    const h = habit('cumulative', { period: 'month', target: 100 });
    const r = evaluatePeriod(h, [log('2026-11-02', 40), log('2026-11-10', 35)], TODAY, TODAY);
    expect(r).toMatchObject({ status: 'pending', value: 75, start: '2026-11-01', end: '2026-11-30' });
  });

  it('reducción: sin registro es desconocido, no cumplido', () => {
    const h = habit('reduction', { target: 2 });
    expect(evaluatePeriod(h, [], d('2026-11-17'), TODAY).status).toBe('unknown');
    expect(evaluatePeriod(h, [log('2026-11-17', 0)], d('2026-11-17'), TODAY).status).toBe('met');
    expect(evaluatePeriod(h, [log('2026-11-17', 3)], d('2026-11-17'), TODAY).status).toBe('missed');
    expect(evaluatePeriod(h, [log('2026-11-18', 1)], TODAY, TODAY).status).toBe('pending');
  });

  it('flexible: 3 sesiones semanales de al menos 20 minutos', () => {
    const h = habit('flexible', { period: 'week', target: 3, sessionMin: 20 });
    const logs = [log('2026-11-16', 25), log('2026-11-17', 10), log('2026-11-17', 15), log('2026-11-18', 5)];
    // lunes (25) y martes (10+15=25) cuentan; miércoles (5) no
    expect(evaluatePeriod(h, logs, TODAY, TODAY)).toMatchObject({ status: 'pending', value: 2 });
  });
});

describe('calendario, pausas y versiones', () => {
  it('días no programados y anteriores al inicio', () => {
    const h = habit('binary', {}, { scheduleDays: [1, 3, 5] }); // L, X, V
    expect(evaluatePeriod(h, [], d('2026-11-17'), TODAY).status).toBe('notScheduled'); // martes
    expect(evaluatePeriod(h, [], d('2026-10-30'), TODAY).status).toBe('beforeStart');
  });

  it('las pausas no cuentan como fallos', () => {
    const h = habit('binary', {}, { pauses: [{ from: d('2026-11-10'), to: d('2026-11-12') }] });
    expect(evaluatePeriod(h, [], d('2026-11-11'), TODAY).status).toBe('paused');
  });

  it('cambiar el objetivo no reescribe periodos pasados (D-08)', () => {
    const h = habit('duration', { target: 30 }, {});
    h.targets.push({ validFrom: d('2026-11-15'), period: 'day', target: 60 });
    expect(targetAt(h, d('2026-11-14'))?.target).toBe(30);
    expect(evaluatePeriod(h, [log('2026-11-14', 30)], d('2026-11-14'), TODAY).status).toBe('met');
    expect(evaluatePeriod(h, [log('2026-11-16', 30)], d('2026-11-16'), TODAY).status).toBe('partial');
  });
});

describe('constancia y rachas', () => {
  const h = habit('binary', {}, { startDay: d('2026-11-10') });
  // 10..17 cerrados: cumplidos 10, 11, 13, 14, 15, 16, 17 (falla el 12); hoy 18 pendiente
  const logs = ['10', '11', '13', '14', '15', '16', '17'].map((x) => log(`2026-11-${x}`));
  const periods = recentPeriods(h, logs, TODAY, 30);

  it('recorre hasta el día de inicio', () => {
    expect(periods).toHaveLength(9);
    expect(periods[0]!.start).toBe('2026-11-18');
  });

  it('constancia excluye el día en curso', () => {
    expect(consistency(periods)).toEqual({ met: 7, evaluated: 8, ratio: 7 / 8 });
  });

  it('racha actual no se rompe por el día pendiente', () => {
    expect(streaks(periods)).toEqual({ current: 5, best: 5 });
  });

  it('una pausa no rompe la racha', () => {
    const paused = habit('binary', {}, { startDay: d('2026-11-14'), pauses: [{ from: d('2026-11-16'), to: d('2026-11-16') }] });
    const p = recentPeriods(paused, [log('2026-11-14'), log('2026-11-15'), log('2026-11-17')], TODAY, 10);
    expect(streaks(p).current).toBe(3);
  });
});

describe('modo recuperación', () => {
  it('propone retomar con un mínimo tras varios días sin cumplir', () => {
    const h = habit('duration', { target: 40 });
    const p = recoveryProposal(h, [log('2026-11-13', 40)], TODAY);
    expect(p).toEqual({ missedInARow: 4, suggestedTarget: 10, unit: 'min' });
  });

  it('respeta el mínimo definido por el usuario y no salta si hoy ya se cumplió', () => {
    const h = habit('duration', { target: 40, minTarget: 5 });
    expect(recoveryProposal(h, [log('2026-11-13', 40)], TODAY)?.suggestedTarget).toBe(5);
    expect(recoveryProposal(h, [log('2026-11-13', 40), log('2026-11-18', 40)], TODAY)).toBeNull();
  });

  it('no aplica a hábitos de reducción ni con un solo fallo', () => {
    expect(recoveryProposal(habit('reduction', { target: 2 }), [], TODAY)).toBeNull();
    expect(recoveryProposal(habit('binary'), [log('2026-11-16')], TODAY)).toBeNull();
  });
});
