import { z } from 'zod';

/**
 * Contexto que el asistente recibe junto a cada petición. Lo comparten cliente y servidor
 * (la Edge Function lo importa por ruta relativa), así que este archivo solo depende de Zod.
 * Todo está acotado: el contexto es información, nunca instrucciones para el modelo.
 */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const text = (max: number) => z.string().max(max);
const count = z.number().int().min(0).max(100000);
const ratio = z.number().min(0).max(1);

export const assistantTones = ['cercano', 'directo', 'motivador', 'tranquilo'] as const;
export type AssistantTone = (typeof assistantTones)[number];

export const assistantContextSchema = z.object({
  now: z.object({ day, time, weekday: text(12), timezone: text(64), partOfDay: z.enum(['madrugada', 'mañana', 'tarde', 'noche']) }).strict(),
  person: z.object({
    name: text(60).nullable(),
    about: text(1500),
    tone: z.enum(assistantTones),
    interests: z.array(text(40)).max(20),
    goals: z.array(text(60)).max(12),
    activeDays: z.array(z.number().int().min(0).max(6)).max(7),
    focusWindows: z.array(z.object({ start: time, end: time }).strict()).max(8),
    motivation: text(20),
  }).strict(),
  week: z.object({
    from: day,
    to: day,
    tasksCompleted: count,
    habitRecords: count,
    activeDays: z.number().int().min(0).max(7),
    focusMinutes: count,
    perDay: z.array(z.object({ day, habitsMet: count, habitsDue: count, tasksDone: count, focusMinutes: count }).strict()).max(7),
  }).strict(),
  habits: z.array(z.object({
    id: z.uuid(),
    name: text(80),
    kind: text(16),
    period: text(8),
    target: z.number().min(0).max(100000),
    unit: text(24).nullable(),
    today: text(16),
    todayValue: z.number().min(0).max(100000),
    streak: count,
    bestStreak: count,
    consistency30: ratio.nullable(),
    days: z.array(z.number().int().min(0).max(6)).max(7),
    reminder: time.nullable(),
    struggling: z.boolean(),
  }).strict()).max(25),
  tasks: z.array(z.object({
    id: z.uuid(),
    title: text(120),
    status: text(16),
    priority: z.number().int().min(0).max(3),
    due: day.nullable(),
    dueTime: time.nullable(),
    estimate: z.number().int().min(0).max(10000).nullable(),
    scheduled: text(40).nullable(),
    postponed: count,
    blocked: z.boolean(),
    goal: text(120).nullable(),
    subtasks: text(12).nullable(),
  }).strict()).max(30),
  recentlyDone: z.array(text(120)).max(12),
  goals: z.array(z.object({
    id: z.uuid(),
    title: text(120),
    kind: text(10),
    progress: ratio,
    targetDate: day.nullable(),
    milestones: text(12),
    nextMilestone: text(120).nullable(),
    openTasks: count,
  }).strict()).max(12),
  agenda: z.array(z.object({ title: text(120), day, start: time.nullable(), end: time.nullable(), category: text(30) }).strict()).max(30),
  challenges: z.array(z.object({ title: text(120), kind: text(16), metric: text(16), status: text(16), endsOn: day, unit: text(24) }).strict()).max(8),
  journal: z.array(z.object({ day, achievements: text(300), difficulties: text(300), learnings: text(300), nextStep: text(300) }).strict()).max(4),
  insights: z.array(text(300)).max(8),
}).strict();
export type AssistantContext = z.infer<typeof assistantContextSchema>;

/** Turnos previos de la conversación (solo texto) para que el asistente mantenga el hilo. */
export const historySchema = z.array(z.object({ role: z.enum(['user', 'assistant']), text: text(2000) }).strict()).max(8);
export type AssistantHistory = z.infer<typeof historySchema>;
