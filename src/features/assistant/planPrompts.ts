/** Plantilla para pedir un plan: queda en el cuadro con el cursor al final para escribir la meta. */
export const PLAN_TEMPLATE = 'No sé bien cómo lograr una meta. Créame un plan con hitos, tareas, hábitos, qué estudiar y sitios web donde hacerlo. Mi meta es: ';

/** Petición lista para enviar cuando se abre el asistente desde una meta existente. */
export const planPromptFor = (goal: string) => `Tengo la meta «${goal.trim().slice(0, 120)}» y no sé bien cómo conseguirla. Créame un plan con hitos, tareas, hábitos, qué estudiar y sitios web donde hacerlo, a mi ritmo.`;

/** Heurística solo para el texto de espera mientras responde el modelo. */
export const looksLikePlanRequest = (text: string) => /\b(plan|meta|conseguir|lograr|aprender|estudiar|prepar)/i.test(text);
