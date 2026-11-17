import { z } from 'zod';

export const HANDLE_RE = /^[a-z0-9_]{3,24}$/;

const email = z.string().trim().toLowerCase().pipe(z.email('Introduce un correo válido.'));
const password = z
  .string()
  .min(10, 'Usa al menos 10 caracteres.')
  .max(72, 'Máximo 72 caracteres.')
  .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), 'Combina letras y números.');

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Introduce tu contraseña.'),
});

export const signUpSchema = z.object({
  displayName: z.string().trim().min(1, 'Escribe cómo quieres que te vean.').max(60, 'Máximo 60 caracteres.'),
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(HANDLE_RE, 'Entre 3 y 24 caracteres: letras minúsculas, números o _.'),
  email,
  password,
});

export const resetRequestSchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Las contraseñas no coinciden.' });

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/** Valida y devuelve los datos limpios o un error por campo (el primero de cada uno). */
export function validate<S extends z.ZodType>(
  schema: S,
  input: unknown,
): { ok: true; data: z.infer<S> } | { ok: false; errors: FieldErrors<z.infer<S>> } {
  const r = schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  const errors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = String(issue.path[0] ?? '_');
    errors[key] ??= issue.message;
  }
  return { ok: false, errors: errors as FieldErrors<z.infer<S>> };
}
