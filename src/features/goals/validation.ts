import { z } from 'zod';

export const goalFormSchema = z
  .object({
    kind: z.enum(['goal', 'project']),
    title: z.string().trim().min(1, 'Ponle un nombre.').max(120, 'Máximo 120 caracteres.'),
    description: z.string().max(2000).optional(),
    expectedOutcome: z.string().max(500).optional(),
    targetDate: z.string().nullable(),
    metric: z.enum(['quantity', 'milestones', 'tasks']),
    metricTarget: z.number().positive('Debe ser mayor que 0.').max(1_000_000).nullable(),
    metricUnit: z.string().trim().max(20).nullable(),
    visibility: z.enum(['private', 'friends', 'public']),
    color: z.enum(['violet', 'lavender', 'cyan', 'green', 'amber', 'rose', 'coral', 'sky']),
    milestones: z.array(z.string().trim().min(1).max(120)).max(30),
  })
  .superRefine((v, ctx) => {
    if (v.metric === 'quantity') {
      if (v.metricTarget === null) ctx.addIssue({ code: 'custom', path: ['metricTarget'], message: 'Indica la cantidad objetivo.' });
      if (!v.metricUnit) ctx.addIssue({ code: 'custom', path: ['metricUnit'], message: 'Indica la unidad (horas, libros, km…).' });
    }
  });

export type GoalForm = z.infer<typeof goalFormSchema>;
