import { z } from 'zod';

const title = z.string().trim().min(1).max(160);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
});
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const minutes = z.number().int().min(1).max(480);
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('create_task'), title, day: day.nullable(), time: time.nullable(), minutes: minutes.nullable(), priority: z.number().int().min(0).max(3), recurrence: z.enum(['daily', 'weekly', 'monthly']).nullable() }).strict(),
  z.object({ type: z.literal('create_habit'), title: title.max(80), minutes: minutes.nullable(), days: z.array(z.number().int().min(0).max(6)).max(7), time: time.nullable() }).strict(),
  z.object({ type: z.literal('create_goal'), title, day: day.nullable(), milestones: z.array(title).max(12) }).strict(),
  z.object({ type: z.literal('create_event'), title, day, time, minutes }).strict(),
  z.object({ type: z.literal('move_task'), id: z.uuid(), day, time, minutes }).strict(),
  z.object({ type: z.literal('estimate_task'), id: z.uuid(), minutes }).strict(),
  z.object({ type: z.literal('prioritize_task'), id: z.uuid(), priority: z.number().int().min(0).max(3) }).strict(),
]);
export type ProposedAction = z.infer<typeof actionSchema>;
export const assistanceSchema = z.object({ message: z.string().max(3000), actions: z.array(actionSchema).max(12) }).strict();
