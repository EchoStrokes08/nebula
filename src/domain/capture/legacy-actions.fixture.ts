// Copia del esquema de la versión 1.1.x (apps ya instaladas). Solo para tests de compatibilidad.
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
const study = z.string().trim().max(600).nullable();
const resources = z.array(resourceSchema).max(4);
export const planSchema = z.object({
  type: z.literal('create_plan'),
  /** Meta existente (id de context.goals) o null para crear una nueva con `goal`. */
  goalId: z.uuid().nullable(),
  goal: title.max(120),
  why: z.string().trim().max(600).nullable(),
  day: day.nullable(),
  milestones: z.array(title.max(120)).max(12),
  tasks: z.array(z.object({ title, day: day.nullable(), minutes: minutes.nullable(), priority: z.number().int().min(0).max(3), study, resources }).strict()).max(12),
  habits: z.array(z.object({ title: title.max(80), minutes: minutes.nullable(), days: weekdays, time: time.nullable(), study, resources }).strict()).max(5),
  resources: z.array(resourceSchema).max(8),
}).strict();
export type PlanAction = z.infer<typeof planSchema>;
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('create_task'), title, day: day.nullable(), time: time.nullable(), minutes: minutes.nullable(), priority: z.number().int().min(0).max(3), recurrence: z.enum(['daily', 'weekly', 'monthly']).nullable() }).strict(),
  z.object({ type: z.literal('create_habit'), title: title.max(80), minutes: minutes.nullable(), days: weekdays, time: time.nullable() }).strict(),
  z.object({ type: z.literal('create_goal'), title, day: day.nullable(), milestones: z.array(title).max(12) }).strict(),
  z.object({ type: z.literal('create_event'), title, day, time, minutes }).strict(),
  z.object({ type: z.literal('move_task'), id: z.uuid(), day, time, minutes }).strict(),
  z.object({ type: z.literal('estimate_task'), id: z.uuid(), minutes }).strict(),
  z.object({ type: z.literal('prioritize_task'), id: z.uuid(), priority: z.number().int().min(0).max(3) }).strict(),
  planSchema,
]);
export type ProposedAction = z.infer<typeof actionSchema>;
export const assistanceSchema = z.object({ message: z.string().max(3000), actions: z.array(actionSchema).max(12) }).strict();
