import { z } from 'zod';

/**
 * Variables públicas del cliente. Solo se aceptan valores que pueden vivir en el bundle:
 * la `service_role` y las claves de IA nunca deben llegar aquí.
 */
const schema = z.object({
  supabaseUrl: z.url(),
  supabaseAnonKey: z.string().min(20),
});

export type ClientEnv = z.infer<typeof schema>;

export type EnvResult =
  | { ok: true; env: ClientEnv; devPreview: boolean }
  | { ok: false; missing: string[]; devPreview: boolean };

export function readEnv(source: Record<string, string | undefined>): EnvResult {
  const devPreview = source.EXPO_PUBLIC_DEV_PREVIEW_UI === '1';
  const parsed = schema.safeParse({
    supabaseUrl: source.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: source.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (parsed.success) {
    if (looksLikeServiceRole(parsed.data.supabaseAnonKey)) {
      throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY contiene una clave secreta (service_role / sb_secret_): no debe usarse en el cliente.');
    }
    return { ok: true, env: parsed.data, devPreview };
  }
  const missing = parsed.error.issues.map((i) =>
    i.path[0] === 'supabaseUrl' ? 'EXPO_PUBLIC_SUPABASE_URL' : 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  );
  return { ok: false, missing: [...new Set(missing)], devPreview };
}

/** Claves con privilegios: `sb_secret_…` (formato nuevo) o JWT con rol `service_role` (formato antiguo). */
function looksLikeServiceRole(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  const payload = key.split('.')[1];
  if (!payload) return false;
  try {
    const json = JSON.parse(globalThis.atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return json?.role === 'service_role';
  } catch {
    return false;
  }
}

// Expo sustituye en compilación solo los accesos literales `process.env.EXPO_PUBLIC_*`.
export const clientEnv: EnvResult = readEnv({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_DEV_PREVIEW_UI: process.env.EXPO_PUBLIC_DEV_PREVIEW_UI,
});
