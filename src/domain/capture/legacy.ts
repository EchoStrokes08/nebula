/**
 * Compatibilidad con apps ya instaladas (1.1.x y anteriores): validan las respuestas con un
 * esquema estricto antiguo, así que rechazarían los campos nuevos del plan. El servidor las
 * reconoce porque no envían `client` y les devuelve el plan en el formato antiguo (los pasos y
 * el criterio de terminado van dentro de «study») junto con un aviso para actualizar.
 * Sin imports: lo usa la Edge Function (Deno).
 */
type Resource = { title: string; url: string; note: string | null };
type Milestone = string | { title: string; day: string | null };
interface Plan {
  type: 'create_plan'; goalId: string | null; goal: string; why: string | null; day: string | null;
  milestones: Milestone[]; resources: Resource[]; adjustments?: string[];
  tasks: { title: string; day: string | null; minutes: number | null; priority: number; study: string | null; resources: Resource[]; steps?: string[]; done?: string | null; after?: number[]; milestone?: number | null }[];
  habits: { title: string; minutes: number | null; days: number[]; time: string | null; study: string | null; resources: Resource[] }[];
}

const clip = (s: string | null, max: number) => (s && s.length > max ? `${s.slice(0, max - 1)}…` : s);

export const UPDATE_NOTICE = '\n\n**Hay una versión nueva de Nebula** con planes mucho más completos (pasos, fases y más recursos). Descárgala desde https://echostrokes08.github.io/nebula/';

export function toLegacyPlan(plan: Plan): Record<string, unknown> {
  return {
    type: plan.type, goalId: plan.goalId, goal: plan.goal, why: clip(plan.why, 600), day: plan.day,
    milestones: plan.milestones.slice(0, 12).map((m) => (typeof m === 'string' ? m : m.title)),
    tasks: plan.tasks.slice(0, 12).map((t) => {
      const extra = [t.steps?.length ? `Pasos:\n${t.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : '', t.done ? `Terminado cuando: ${t.done}` : ''].filter(Boolean);
      return { title: t.title, day: t.day, minutes: t.minutes, priority: t.priority, study: clip([t.study ?? '', ...extra].filter(Boolean).join('\n\n') || null, 600), resources: t.resources.slice(0, 4) };
    }),
    habits: plan.habits.slice(0, 5).map((h) => ({ ...h, study: clip(h.study, 600), resources: h.resources.slice(0, 4) })),
    resources: plan.resources.slice(0, 8),
  };
}

/** Respuesta completa para una app antigua: planes en formato antiguo y aviso de actualización. */
export function toLegacyResponse(result: { message: string; actions: { type: string }[] }): { message: string; actions: unknown[] } {
  return {
    message: `${result.message.slice(0, 3000 - UPDATE_NOTICE.length)}${UPDATE_NOTICE}`,
    actions: result.actions.map((a) => (a.type === 'create_plan' ? toLegacyPlan(a as unknown as Plan) : a)),
  };
}
