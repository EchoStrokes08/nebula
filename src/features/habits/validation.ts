import { z } from 'zod';

import type { HabitKind } from '@/domain/habits/types';

const positive = (msg: string) => z.number({ error: msg }).positive(msg).max(100000, 'Demasiado grande.');

export const habitFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Ponle un nombre.').max(80, 'Máximo 80 caracteres.'),
    description: z.string().trim().max(500).optional(),
    kind: z.enum(['binary', 'duration', 'quantity', 'frequency', 'cumulative', 'reduction', 'flexible']),
    period: z.enum(['day', 'week', 'month']),
    target: z.number({ error: 'Introduce un número.' }).min(0, 'No puede ser negativo.').max(100000),
    unit: z.string().trim().max(20).optional(),
    sessionMin: positive('Introduce los minutos mínimos por sesión.').optional(),
    minTarget: positive('Debe ser mayor que 0.').optional(),
    scheduleDays: z.array(z.number().int().min(0).max(6)),
    icon: z.string(),
    color: z.enum(['violet', 'lavender', 'cyan', 'green', 'amber', 'rose', 'coral', 'sky']),
    priority: z.number().int().min(1).max(3),
  })
  .superRefine((v, ctx) => {
    const needsUnit: HabitKind[] = ['quantity', 'cumulative', 'reduction'];
    if (needsUnit.includes(v.kind) && !v.unit) ctx.addIssue({ code: 'custom', path: ['unit'], message: 'Indica la unidad (p. ej. páginas, km, cafés).' });
    if (v.kind !== 'binary' && v.kind !== 'reduction' && v.target <= 0) ctx.addIssue({ code: 'custom', path: ['target'], message: 'El objetivo debe ser mayor que 0.' });
    if (v.kind === 'flexible' && !v.sessionMin) ctx.addIssue({ code: 'custom', path: ['sessionMin'], message: 'Indica los minutos mínimos por sesión.' });
    if (v.kind === 'cumulative' && v.period === 'day') ctx.addIssue({ code: 'custom', path: ['period'], message: 'Un acumulativo es semanal o mensual.' });
    if (v.kind === 'flexible' && v.period !== 'week') ctx.addIssue({ code: 'custom', path: ['period'], message: 'Los hábitos flexibles son semanales.' });
    if (v.minTarget && v.minTarget > v.target && v.kind !== 'reduction') ctx.addIssue({ code: 'custom', path: ['minTarget'], message: 'El mínimo no puede superar el objetivo.' });
    if (v.period === 'day' && v.scheduleDays.length === 0) ctx.addIssue({ code: 'custom', path: ['scheduleDays'], message: 'Elige al menos un día.' });
  });

export type HabitForm = z.infer<typeof habitFormSchema>;

/** Periodo por defecto y si se puede elegir, según el tipo. */
export function periodOptionsFor(kind: HabitKind): ('day' | 'week' | 'month')[] {
  switch (kind) {
    case 'binary':
      return ['day'];
    case 'cumulative':
      return ['week', 'month'];
    case 'flexible':
      return ['week'];
    case 'frequency':
      return ['day', 'week', 'month'];
    default:
      return ['day', 'week'];
  }
}
