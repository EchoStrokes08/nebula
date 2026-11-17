/**
 * Simulador de metas (PDF §2.04, prompt §7.4).
 * - **Cálculo**: aritmética exacta con los datos que da el usuario (trabajo pendiente y ritmo).
 * - **Estimación**: solo si hay historial suficiente; usa el ritmo real observado y su variación.
 *   Nunca se presenta como garantía.
 */
export interface SimulationInput {
  remaining: number; // trabajo pendiente (horas, páginas, sesiones…)
  plannedPerWeek: number; // ritmo planificado
  weeksUntilDeadline?: number | null;
  /** Avance semanal real de las últimas semanas (más reciente al final), si existe. */
  history?: number[];
}

export interface Scenario {
  name: 'conservador' | 'medio' | 'exigente';
  perWeek: number;
  weeks: number | null; // null si el ritmo es 0
  meetsDeadline: boolean | null;
}

export interface SimulationResult {
  calculation: Scenario[];
  /** Estimación con historial (null si no hay al menos `MIN_HISTORY` semanas). */
  estimate: null | {
    observedPerWeek: number;
    weeksLikely: number | null;
    weeksRange: [number | null, number | null];
    basedOnWeeks: number;
  };
  /** Ritmo necesario para cumplir el plazo. */
  requiredPerWeek: number | null;
}

export const MIN_HISTORY = 4;
const FACTORS = { conservador: 0.75, medio: 1, exigente: 1.25 } as const;

const weeksFor = (remaining: number, perWeek: number) => (perWeek > 0 ? Math.ceil((remaining / perWeek) * 10) / 10 : null);

export function simulate(input: SimulationInput): SimulationResult {
  const remaining = Math.max(0, input.remaining);
  const deadline = input.weeksUntilDeadline ?? null;
  const calculation = (Object.keys(FACTORS) as Scenario['name'][]).map((name) => {
    const perWeek = input.plannedPerWeek * FACTORS[name];
    const weeks = weeksFor(remaining, perWeek);
    return { name, perWeek, weeks, meetsDeadline: deadline === null || weeks === null ? null : weeks <= deadline };
  });

  let estimate: SimulationResult['estimate'] = null;
  const h = (input.history ?? []).filter((x) => Number.isFinite(x) && x >= 0);
  if (h.length >= MIN_HISTORY) {
    const mean = h.reduce((a, b) => a + b, 0) / h.length;
    const sd = Math.sqrt(h.reduce((a, b) => a + (b - mean) ** 2, 0) / (h.length - 1));
    const high = mean + sd;
    const low = Math.max(0, mean - sd);
    estimate = {
      observedPerWeek: mean,
      weeksLikely: weeksFor(remaining, mean),
      weeksRange: [weeksFor(remaining, high), weeksFor(remaining, low)],
      basedOnWeeks: h.length,
    };
  }

  return { calculation, estimate, requiredPerWeek: deadline && deadline > 0 ? remaining / deadline : null };
}
