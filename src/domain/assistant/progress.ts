/**
 * Etapas que se muestran mientras el asistente trabaja. El servidor no informa del avance (la
 * respuesta llega entera), así que se estiman por el tiempo transcurrido según cómo trabaja
 * `ai-assist` en un plan: lee el contexto, busca fuentes (hasta ~24 s), redacta con el modelo de
 * razonamiento y lo valida; si el plan sale incompleto, prueba con otro modelo.
 */
export interface ProgressStep {
  label: string;
  /** Segundo a partir del cual esta etapa pasa a ser la actual. */
  from: number;
}

export const PLAN_STEPS: ProgressStep[] = [
  { label: 'Leyendo tu meta y tu avance', from: 0 },
  { label: 'Buscando fuentes fiables', from: 3 },
  { label: 'Redactando tu plan paso a paso', from: 25 },
  { label: 'Revisando que esté completo', from: 70 },
];

export const CHAT_STEPS: ProgressStep[] = [
  { label: 'Leyendo tus datos', from: 0 },
  { label: 'Pensando la respuesta', from: 4 },
];

/** A partir de aquí se avisa de que tarda más de lo normal (sin cortar: el servidor sigue). */
export const SLOW_AFTER_S = { plan: 110, chat: 40 } as const;

export function progressAt(kind: 'plan' | 'chat', elapsedS: number): { steps: ProgressStep[]; current: number; slow: boolean } {
  const steps = kind === 'plan' ? PLAN_STEPS : CHAT_STEPS;
  let current = 0;
  steps.forEach((s, i) => { if (elapsedS >= s.from) current = i; });
  return { steps, current, slow: elapsedS >= SLOW_AFTER_S[kind] };
}

/** «0:07», «1:32». */
export const formatElapsed = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
