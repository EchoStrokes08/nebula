import type { DayKey } from '@/lib/dates';

/** Los 7 tipos de hábito (REGLAS_NEGOCIO §2). */
export type HabitKind =
  | 'binary' // hecho / no hecho
  | 'duration' // minutos por periodo
  | 'quantity' // unidades por periodo (páginas, vasos…)
  | 'frequency' // N veces por periodo (cada registro cuenta como una vez)
  | 'cumulative' // total acumulado en semana/mes
  | 'reduction' // no superar un límite
  | 'flexible'; // N sesiones por semana, cada una de al menos `sessionMin`, sin días fijos

export type HabitPeriod = 'day' | 'week' | 'month';

export interface HabitTarget {
  validFrom: DayKey;
  period: HabitPeriod;
  /** Objetivo principal: cantidad (o límite máximo en `reduction`, o nº de veces/sesiones). */
  target: number;
  /** Mínimo por sesión (solo `flexible`). */
  sessionMin?: number | null;
  /** Versión mínima propuesta para días difíciles / recuperación. */
  minTarget?: number | null;
}

export interface HabitDef {
  id: string;
  name: string;
  kind: HabitKind;
  unit?: string | null;
  /** Días programados (0 = domingo) para hábitos diarios; vacío = todos los días. */
  scheduleDays: number[];
  startDay: DayKey;
  /** Versiones del objetivo, cualquier orden. */
  targets: HabitTarget[];
  /** Pausas como rangos inclusivos. */
  pauses: { from: DayKey; to: DayKey | null }[];
  archived?: boolean;
}

export interface HabitLog {
  dayKey: DayKey;
  value: number;
}

export type PeriodStatus =
  | 'met' // cumplido
  | 'partial' // con avance pero sin cumplir (periodo cerrado)
  | 'missed' // sin avance (periodo cerrado)
  | 'pending' // periodo en curso todavía sin cumplir
  | 'paused'
  | 'notScheduled'
  | 'unknown' // reducción sin ningún registro: no se sabe si se cumplió
  | 'beforeStart';

export interface PeriodResult {
  start: DayKey;
  end: DayKey;
  status: PeriodStatus;
  /** Valor medido (suma, veces o sesiones según el tipo). */
  value: number;
  target: number;
  /** 0..1 (en reducción: 1 si no se superó el límite). */
  progress: number;
}
