import type { EnvResult } from '@/lib/env';

export type Gate = 'config' | 'preview' | 'loading' | 'auth' | 'recovery' | 'onboarding' | 'app';

export interface AuthSnapshot {
  status: 'loading' | 'signedOut' | 'signedIn';
  onboarded: boolean | null;
  recovery: boolean;
}

/**
 * Decide qué grupo de rutas está disponible.
 * `preview` (sin servidor) solo existe si el build se generó con EXPO_PUBLIC_DEV_PREVIEW_UI=1
 * y no hay servidor configurado; la UI muestra siempre una etiqueta visible.
 */
export function resolveGate(env: EnvResult, auth?: AuthSnapshot): Gate {
  if (!env.ok) return env.devPreview ? 'preview' : 'config';
  if (!auth || auth.status === 'loading') return 'loading';
  if (auth.status === 'signedOut') return 'auth';
  if (auth.recovery) return 'recovery';
  if (auth.onboarded === null) return 'loading';
  return auth.onboarded ? 'app' : 'onboarding';
}
