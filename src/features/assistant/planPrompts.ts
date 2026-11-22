/** Plantilla para pedir un plan: queda en el cuadro con el cursor al final para escribir la meta. */
export const PLAN_TEMPLATE = 'Quiero un plan detallado con hitos medibles, tareas paso a paso y fuentes fiables. Mi meta es: ';

/** Petición lista para enviar cuando se abre el asistente desde una meta existente. */
export const planPromptFor = (goal: string) => `Tengo la meta «${goal.trim().slice(0, 120)}» y quiero un plan detallado a mi ritmo. Usa mi avance y el plan actual si los hay. Propón hitos medibles, tareas paso a paso y fuentes fiables.`;

/** Heurística solo para el texto de espera mientras responde el modelo. */
export const looksLikePlanRequest = (text: string) => /\b(plan|meta|conseguir|lograr|aprender|estudiar|prepar)/i.test(text);
