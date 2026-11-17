import { z } from 'zod';

import { TIME_RE } from '@/lib/time';

export const taskFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Escribe qué hay que hacer.').max(200, 'Máximo 200 caracteres.'),
    notes: z.string().max(5000, 'Máximo 5000 caracteres.').optional(),
    priority: z.number().int().min(1).max(3),
    dueDate: z.string().nullable(),
    dueTime: z.string().regex(TIME_RE, 'Usa el formato HH:MM.').nullable(),
    estimateMinutes: z.number().int('Minutos enteros.').min(1, 'Mínimo 1 minuto.').max(1440, 'Máximo 24 horas.').nullable(),
    recurrence: z.string().nullable(),
    reminderMinutesBefore: z.number().int().min(0).max(10080).nullable(),
    goalId: z.string().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.recurrence && !v.dueDate) ctx.addIssue({ code: 'custom', path: ['recurrence'], message: 'Una tarea recurrente necesita fecha.' });
    if (v.dueTime && !v.dueDate) ctx.addIssue({ code: 'custom', path: ['dueTime'], message: 'Indica también la fecha.' });
    if (v.reminderMinutesBefore !== null && !v.dueDate) ctx.addIssue({ code: 'custom', path: ['reminderMinutesBefore'], message: 'El recordatorio necesita fecha.' });
  });

export type TaskForm = z.infer<typeof taskFormSchema>;
