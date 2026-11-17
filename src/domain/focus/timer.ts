/**
 * Temporizador de enfoque (F06-017). Todo se calcula a partir de marcas de tiempo, así que el
 * estado es correcto aunque la app pase a segundo plano, se cierre o el equipo se suspenda.
 */
export type FocusMode = 'pomodoro' | 'custom' | 'long';
export type Phase = 'focus' | 'break' | 'longBreak';

export interface FocusConfig {
  mode: FocusMode;
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLong: number;
}

export const PRESETS: Record<FocusMode, FocusConfig> = {
  pomodoro: { mode: 'pomodoro', focusMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, cyclesBeforeLong: 4 },
  custom: { mode: 'custom', focusMinutes: 45, breakMinutes: 0, longBreakMinutes: 0, cyclesBeforeLong: 0 },
  long: { mode: 'long', focusMinutes: 90, breakMinutes: 15, longBreakMinutes: 15, cyclesBeforeLong: 1 },
};

export interface TimerState {
  clientId: string;
  config: FocusConfig;
  sessionStartedAt: number;
  phase: Phase;
  cycle: number; // nº de bloque de enfoque (1..)
  phaseStartedAt: number;
  pausedAt: number | null;
  /** Pausa acumulada en la fase actual. */
  phasePausedMs: number;
  /** Totales de fases ya cerradas. */
  focusedMs: number;
  pausedMs: number;
  habitId: string | null;
  taskId: string | null;
}

const phaseMinutes = (s: Pick<TimerState, 'config' | 'phase'>) =>
  s.phase === 'focus' ? s.config.focusMinutes : s.phase === 'break' ? s.config.breakMinutes : s.config.longBreakMinutes;

export function startTimer(config: FocusConfig, now: number, clientId: string, links: { habitId?: string | null; taskId?: string | null } = {}): TimerState {
  return {
    clientId,
    config,
    sessionStartedAt: now,
    phase: 'focus',
    cycle: 1,
    phaseStartedAt: now,
    pausedAt: null,
    phasePausedMs: 0,
    focusedMs: 0,
    pausedMs: 0,
    habitId: links.habitId ?? null,
    taskId: links.taskId ?? null,
  };
}

/** Milisegundos transcurridos en la fase actual, sin contar pausas. */
export function phaseElapsed(s: TimerState, now: number): number {
  const until = s.pausedAt ?? now;
  return Math.max(0, until - s.phaseStartedAt - s.phasePausedMs);
}

export function remainingMs(s: TimerState, now: number): number {
  return Math.max(0, phaseMinutes(s) * 60_000 - phaseElapsed(s, now));
}

export const isPhaseOver = (s: TimerState, now: number) => remainingMs(s, now) === 0;

export function pause(s: TimerState, now: number): TimerState {
  return s.pausedAt !== null ? s : { ...s, pausedAt: now };
}

export function resume(s: TimerState, now: number): TimerState {
  if (s.pausedAt === null) return s;
  return { ...s, phasePausedMs: s.phasePausedMs + (now - s.pausedAt), pausedAt: null };
}

/** Enfoque real acumulado (fases cerradas + la actual si es de enfoque). */
export function focusedSoFar(s: TimerState, now: number): number {
  const current = s.phase === 'focus' ? Math.min(phaseElapsed(s, now), s.config.focusMinutes * 60_000) : 0;
  return s.focusedMs + current;
}

/** Instante en que acabará la fase actual (para programar la notificación). null si está en pausa. */
export function phaseEndsAt(s: TimerState): number | null {
  return s.pausedAt !== null ? null : s.phaseStartedAt + s.phasePausedMs + phaseMinutes(s) * 60_000;
}

/**
 * Pasa a la siguiente fase. En modo libre no hay descansos: la sesión termina tras el enfoque
 * (devuelve null). El tiempo de fases que se quedaron sin atender no cuenta como enfoque.
 */
export function advance(s: TimerState, now: number): TimerState | null {
  const closedFocus = s.phase === 'focus' ? Math.min(phaseElapsed(s, now), s.config.focusMinutes * 60_000) : 0;
  const pausedNow = s.pausedAt !== null ? now - s.pausedAt : 0;
  const base = { ...s, focusedMs: s.focusedMs + closedFocus, pausedMs: s.pausedMs + s.phasePausedMs + pausedNow, phasePausedMs: 0, pausedAt: null, phaseStartedAt: now };
  if (s.phase === 'focus') {
    if (s.config.breakMinutes === 0) return null;
    const long = s.config.cyclesBeforeLong > 0 && s.cycle % s.config.cyclesBeforeLong === 0;
    return { ...base, phase: long ? 'longBreak' : 'break' };
  }
  return { ...base, phase: 'focus', cycle: s.cycle + 1 };
}

export interface SessionSummary {
  clientId: string;
  mode: FocusMode;
  plannedMinutes: number;
  startedAt: number;
  endedAt: number;
  focusedSeconds: number;
  pausedSeconds: number;
  completedBlocks: number;
  endedEarly: boolean;
  habitId: string | null;
  taskId: string | null;
}

/** Cierra la sesión. `endedEarly` si se terminó con un bloque de enfoque a medias. */
export function finish(s: TimerState, now: number): SessionSummary {
  const focused = focusedSoFar(s, now);
  const inFocus = s.phase === 'focus';
  const currentDone = inFocus && isPhaseOver(s, now);
  const pausedNow = s.pausedAt !== null ? now - s.pausedAt : 0;
  return {
    clientId: s.clientId,
    mode: s.config.mode,
    plannedMinutes: s.config.focusMinutes * Math.max(1, s.cycle),
    startedAt: s.sessionStartedAt,
    endedAt: now,
    focusedSeconds: Math.round(focused / 1000),
    pausedSeconds: Math.round((s.pausedMs + s.phasePausedMs + pausedNow) / 1000),
    completedBlocks: s.cycle - (inFocus && !currentDone ? 1 : 0),
    endedEarly: inFocus && !currentDone,
    habitId: s.habitId,
    taskId: s.taskId,
  };
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
