import { z } from 'zod';
import { TIME_RE } from '@/lib/time';

export const profileSchema = z.object({
  display_name: z.string().trim().min(1, 'Escribe tu nombre.').max(60),
  handle: z.string().regex(/^[a-z0-9_]{3,24}$/, 'Usa entre 3 y 24 letras minúsculas, números o _.') ,
  timezone: z.string().refine((tz) => { try { new Intl.DateTimeFormat('es', { timeZone: tz }); return true; } catch { return false; } }, 'Zona horaria no válida.'),
  week_starts_on: z.union([z.literal(0), z.literal(1)]),
  visibility: z.enum(['private', 'friends', 'public']),
});
export function validateQuietHours(start: string, end: string) {
  if (!start && !end) return true;
  return TIME_RE.test(start) && TIME_RE.test(end) && start !== end;
}
