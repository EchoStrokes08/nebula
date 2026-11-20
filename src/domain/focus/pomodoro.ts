import { PRESETS, type FocusConfig } from './timer';

/** Ajustes personalizables del Pomodoro (minutos y bloques antes del descanso largo). */
export interface PomodoroSettings { focus: number; short: number; long: number; cycles: number }

export const DEFAULT_POMODORO: PomodoroSettings = { focus: 25, short: 5, long: 15, cycles: 4 };

/** [mínimo, máximo, paso] de cada ajuste. */
export const POMODORO_LIMITS: Record<keyof PomodoroSettings, [number, number, number]> = {
  focus: [5, 180, 5],
  short: [1, 30, 1],
  long: [5, 60, 5],
  cycles: [1, 8, 1],
};

/** Combinaciones habituales para elegir de un toque. */
export const POMODORO_PRESETS: { label: string; value: PomodoroSettings }[] = [
  { label: 'Clásico 25/5', value: DEFAULT_POMODORO },
  { label: 'Corto 15/3', value: { focus: 15, short: 3, long: 10, cycles: 4 } },
  { label: '50/10', value: { focus: 50, short: 10, long: 20, cycles: 3 } },
  { label: '52/17', value: { focus: 52, short: 17, long: 17, cycles: 1 } },
  { label: 'Profundo 90/20', value: { focus: 90, short: 20, long: 30, cycles: 2 } },
];

/** Recorta cada valor a sus límites (datos guardados de versiones anteriores o corruptos). */
export function clampPomodoro(s: Partial<PomodoroSettings> | null | undefined): PomodoroSettings {
  const out = { ...DEFAULT_POMODORO };
  for (const k of Object.keys(POMODORO_LIMITS) as (keyof PomodoroSettings)[]) {
    const [min, max] = POMODORO_LIMITS[k];
    const v = Number(s?.[k]);
    if (Number.isFinite(v)) out[k] = Math.min(max, Math.max(min, Math.round(v)));
  }
  return out;
}

export function pomodoroConfig(s: PomodoroSettings): FocusConfig {
  const c = clampPomodoro(s);
  return { ...PRESETS.pomodoro, focusMinutes: c.focus, breakMinutes: c.short, longBreakMinutes: c.long, cyclesBeforeLong: c.cycles };
}

export function describePomodoro(s: PomodoroSettings): string {
  const c = clampPomodoro(s);
  const long = c.cycles > 1 ? `; descanso largo de ${c.long} min cada ${c.cycles} bloques` : '';
  return `${c.focus} min de enfoque y ${c.short} de descanso${long}.`;
}

export const samePomodoro = (a: PomodoroSettings, b: PomodoroSettings) => a.focus === b.focus && a.short === b.short && a.long === b.long && a.cycles === b.cycles;
