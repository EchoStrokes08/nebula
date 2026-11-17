import type { Challenge, ChallengeKind, ChallengeMetric } from './api';

export const KIND_LABEL: Record<ChallengeKind, string> = {
  duel: 'Duelo 1 vs. 1',
  group: 'Reto grupal',
  cooperative: 'Objetivo en equipo',
  team: 'Equipos enfrentados',
  pact: 'Pacto',
};

export const METRIC_LABEL: Record<ChallengeMetric, { title: string; help: string; scoreUnit: string }> = {
  percent: { title: '% de tu objetivo', help: 'Cada uno fija su objetivo; gana quien cumple más porcentaje del suyo (retos equilibrados).', scoreUnit: '%' },
  consistency: { title: 'Constancia', help: 'Gana quien cumple más días.', scoreUnit: 'días' },
  sessions: { title: 'Sesiones válidas', help: 'Cuenta las sesiones o registros válidos (enfoque ≥ 10 min).', scoreUnit: 'sesiones' },
  quantity: { title: 'Cantidad total', help: 'Suma total con la misma unidad para todos.', scoreUnit: '' },
  relative: { title: 'Progreso relativo', help: 'Mejora frente a tu propio periodo anterior de igual duración.', scoreUnit: '%' },
};

/** Explicación de cómo se clasifica (texto bajo la clasificación, como en la maqueta del PDF). */
export function rankingNote(c: Pick<Challenge, 'metric' | 'unit' | 'tieRule' | 'percentCap'>): string {
  const base =
    c.metric === 'percent'
      ? `La clasificación usa el porcentaje de cumplimiento de cada participante (máximo ${c.percentCap} %), no las cantidades acumuladas.`
      : c.metric === 'consistency'
        ? 'La clasificación usa los días cumplidos dentro del reto.'
        : c.metric === 'sessions'
          ? 'La clasificación usa el número de sesiones válidas.'
          : c.metric === 'relative'
            ? 'La clasificación compara tu avance con tu propio periodo anterior.'
            : `La clasificación usa el total acumulado en ${c.unit}.`;
  return `${base} ${c.tieRule === 'shared' ? 'Los empates se comparten.' : 'En caso de empate, gana quien tenga más días activos.'}`;
}

export function scoreText(metric: ChallengeMetric, score: number, unit: string): string {
  if (metric === 'percent' || metric === 'relative') return `${Math.round(score)} %`;
  if (metric === 'quantity') return `${Math.round(score * 10) / 10} ${unit}`;
  return `${score} ${METRIC_LABEL[metric].scoreUnit}`;
}
