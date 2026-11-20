import { clampPomodoro, DEFAULT_POMODORO, describePomodoro, pomodoroConfig } from './pomodoro';

describe('Pomodoro configurable', () => {
  it('por defecto es el clásico 25/5 con descanso largo cada 4', () => {
    expect(pomodoroConfig(DEFAULT_POMODORO)).toMatchObject({ mode: 'pomodoro', focusMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, cyclesBeforeLong: 4 });
  });
  it('usa los minutos personalizados', () => {
    expect(pomodoroConfig({ focus: 50, short: 10, long: 20, cycles: 3 })).toMatchObject({ focusMinutes: 50, breakMinutes: 10, longBreakMinutes: 20, cyclesBeforeLong: 3 });
    expect(describePomodoro({ focus: 50, short: 10, long: 20, cycles: 3 })).toBe('50 min de enfoque y 10 de descanso; descanso largo de 20 min cada 3 bloques.');
  });
  it('recorta valores fuera de rango o corruptos', () => {
    expect(clampPomodoro({ focus: 999, short: 0, long: Number.NaN, cycles: 2.6 })).toEqual({ focus: 180, short: 1, long: 15, cycles: 3 });
    expect(clampPomodoro(null)).toEqual(DEFAULT_POMODORO);
  });
});
