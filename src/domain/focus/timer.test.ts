import { advance, finish, focusedSoFar, formatClock, pause, phaseEndsAt, PRESETS, remainingMs, resume, startTimer } from './timer';

const MIN = 60_000;
const t0 = Date.UTC(2026, 10, 18, 9, 0);

describe('temporizador de enfoque', () => {
  it('cuenta por marcas de tiempo: sigue correcto tras «segundo plano»', () => {
    const s = startTimer(PRESETS.pomodoro, t0, 'c1');
    // La app estuvo 10 minutos en segundo plano sin ejecutar nada: el cálculo no depende de ticks.
    expect(remainingMs(s, t0 + 10 * MIN)).toBe(15 * MIN);
    expect(phaseEndsAt(s)).toBe(t0 + 25 * MIN);
  });

  it('las pausas no cuentan como enfoque y desplazan el final', () => {
    let s = startTimer(PRESETS.pomodoro, t0, 'c1');
    s = pause(s, t0 + 5 * MIN);
    expect(remainingMs(s, t0 + 30 * MIN)).toBe(20 * MIN); // en pausa no avanza
    expect(phaseEndsAt(s)).toBeNull();
    s = resume(s, t0 + 8 * MIN);
    expect(phaseEndsAt(s)).toBe(t0 + 28 * MIN);
    expect(focusedSoFar(s, t0 + 10 * MIN)).toBe(7 * MIN);
  });

  it('pomodoro: 4 bloques y descanso largo', () => {
    let s = startTimer(PRESETS.pomodoro, t0, 'c1');
    let now = t0;
    const phases: string[] = [];
    for (let i = 0; i < 8; i++) {
      now += (s.phase === 'focus' ? 25 : s.phase === 'break' ? 5 : 15) * MIN;
      s = advance(s, now)!;
      phases.push(s.phase);
    }
    expect(phases).toEqual(['break', 'focus', 'break', 'focus', 'break', 'focus', 'longBreak', 'focus']);
    expect(s.focusedMs).toBe(4 * 25 * MIN);
  });

  it('modo libre termina tras el enfoque', () => {
    const s = startTimer({ ...PRESETS.custom, focusMinutes: 40 }, t0, 'c1');
    expect(advance(s, t0 + 40 * MIN)).toBeNull();
  });

  it('finalizar antes de tiempo registra solo el tiempo real', () => {
    let s = startTimer(PRESETS.pomodoro, t0, 'c1', { habitId: 'h1' });
    s = pause(s, t0 + 10 * MIN);
    const sum = finish(s, t0 + 12 * MIN);
    expect(sum).toMatchObject({ focusedSeconds: 600, pausedSeconds: 120, endedEarly: true, completedBlocks: 0, habitId: 'h1' });
  });

  it('un bloque abandonado más allá de su duración no infla el enfoque', () => {
    const s = startTimer(PRESETS.pomodoro, t0, 'c1');
    expect(focusedSoFar(s, t0 + 3 * 60 * MIN)).toBe(25 * MIN);
    expect(finish(s, t0 + 3 * 60 * MIN)).toMatchObject({ focusedSeconds: 1500, endedEarly: false, completedBlocks: 1 });
  });

  it('formato del reloj', () => {
    expect(formatClock(25 * MIN)).toBe('25:00');
    expect(formatClock(61_500)).toBe('01:02');
  });
});
