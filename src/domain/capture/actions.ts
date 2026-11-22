import { z } from 'zod';

const title = z.string().trim().min(1).max(160);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
});
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const minutes = z.number().int().min(1).max(480);
const weekdays = z.array(z.number().int().min(0).max(6)).max(7);
/** Solo enlaces web públicos por HTTPS; el servidor descarta además los que no responden. */
export const resourceUrl = z.string().trim().max(500).regex(/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:\d+)?([/?#][^\s]*)?$/i, 'Solo enlaces https');
export const resourceSchema = z.object({ title: z.string().trim().min(1).max(120), url: resourceUrl, note: z.string().trim().max(200).nullable() }).strict();
export type PlanResource = z.infer<typeof resourceSchema>;
const study = z.string().trim().max(1000).nullable();
const resources = z.array(resourceSchema).max(6);
/** Las referencias propuestas por el modelo se contrastan con la meta y se completan en el servidor. */
const replacement = {
  replaceId: z.uuid().optional(),
  originalTitle: z.string().max(200).optional(),
  originalVersion: z.string().max(48).optional(),
};
/** Hito con fecha orientativa; se aceptan también textos sueltos (formato anterior). */
export const milestoneSchema = z.union([title.max(120), z.object({ title: title.max(120), day: day.nullable(), ...replacement }).strict()]);
export type PlanMilestone = Exclude<z.infer<typeof milestoneSchema>, string>;
export const milestoneOf = (m: z.infer<typeof milestoneSchema>): PlanMilestone => (typeof m === 'string' ? { title: m, day: null } : m);
export const PLAN_LIMITS = { milestones: 12, tasks: 24, habits: 6, resources: 15, steps: 8 } as const;
export const planTaskSchema = z.object({
  ...replacement,
  title,
  day: day.nullable(),
  minutes: minutes.nullable(),
  priority: z.number().int().min(0).max(3).describe('1 baja, 2 media, 3 alta'),
  study,
  resources,
  /** Pasos concretos (se guardan como subtareas). */
  steps: z.array(z.string().trim().min(1).max(200)).max(PLAN_LIMITS.steps).default([]),
  /** Criterio para dar la tarea por terminada. */
  done: z.string().trim().max(300).nullable().default(null),
  /** Índices de tareas ANTERIORES de este plan que deben terminarse antes (dependencias). */
  after: z.array(z.number().int().min(0).max(PLAN_LIMITS.tasks - 1)).max(4).default([]),
  /** Índice del hito al que pertenece (0 = primero) o null. */
  milestone: z.number().int().min(0).max(PLAN_LIMITS.milestones - 1).nullable().default(null),
}).strict();
export type PlanTask = z.infer<typeof planTaskSchema>;
export const planSchema = z.object({
  type: z.literal('create_plan'),
  /** Meta existente (id de context.goals) o null para crear una nueva con `goal`. */
  goalId: z.uuid().nullable(),
  revisionId: z.uuid().optional(),
  revisionVersion: z.string().max(48).optional(),
  goal: title.max(120),
  why: z.string().trim().max(1000).nullable(),
  day: day.nullable(),
  milestones: z.array(milestoneSchema).max(PLAN_LIMITS.milestones),
  tasks: z.array(planTaskSchema).max(PLAN_LIMITS.tasks),
  habits: z.array(z.object({ ...replacement, title: title.max(80), minutes: minutes.nullable(), days: weekdays, time: time.nullable(), study, resources }).strict()).max(PLAN_LIMITS.habits),
  resources: z.array(resourceSchema).max(PLAN_LIMITS.resources),
  /** Ajustes que hizo la app al calendario (los rellena el servidor, no el modelo). */
  adjustments: z.array(z.string().max(300)).max(10).default([]),
}).strict();
export type PlanAction = z.infer<typeof planSchema>;
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('create_task'), title, day: day.nullable(), time: time.nullable(), minutes: minutes.nullable(), priority: z.number().int().min(0).max(3).describe('1 baja, 2 media, 3 alta'), recurrence: z.enum(['daily', 'weekly', 'monthly']).nullable() }).strict(),
  z.object({ type: z.literal('create_habit'), title: title.max(80), minutes: minutes.nullable(), days: weekdays, time: time.nullable() }).strict(),
  z.object({ type: z.literal('create_goal'), title, day: day.nullable(), milestones: z.array(title).max(12) }).strict(),
  z.object({ type: z.literal('create_event'), title, day, time, minutes }).strict(),
  z.object({ type: z.literal('move_task'), id: z.uuid(), day, time, minutes }).strict(),
  z.object({ type: z.literal('estimate_task'), id: z.uuid(), minutes }).strict(),
  z.object({ type: z.literal('prioritize_task'), id: z.uuid(), priority: z.number().int().min(0).max(3).describe('1 baja, 2 media, 3 alta') }).strict(),
  planSchema,
]);
export type ProposedAction = z.infer<typeof actionSchema>;
export const assistanceSchema = z.object({ message: z.string().max(4000), actions: z.array(actionSchema).max(12) }).strict();

/** Prioridad de la base de datos: 1 baja, 2 media, 3 alta. Los modelos a veces usan 0. */
export const dbPriority = (p: number) => Math.min(3, Math.max(1, Math.round(p)));

/**
 * Ajusta en sitio lo que el modelo propone a los límites de la base de datos (antes, una tarea
 * con prioridad 0 hacía fallar «Confirmar y aplicar»). Lo usan el servidor y la app.
 */
export function normalizeActions(actions: { type: string }[]): void {
  for (const a of actions as Record<string, unknown>[]) {
    if ((a.type === 'create_task' || a.type === 'prioritize_task') && typeof a.priority === 'number') a.priority = dbPriority(a.priority);
    if (a.type === 'create_plan' && Array.isArray(a.tasks)) for (const t of a.tasks as { priority?: number }[]) if (typeof t.priority === 'number') t.priority = dbPriority(t.priority);
    if (a.type === 'create_goal') {
      if (typeof a.title === 'string') a.title = a.title.slice(0, 120).trim();
      if (Array.isArray(a.milestones)) a.milestones = (a.milestones as string[]).map((m) => m.slice(0, 120).trim());
    }
  }
}

