import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/data/supabase';
import { clientEnv } from '@/lib/env';
import { oauth } from '@/platform/oauth';

import { exchangeCode } from './api';

export type OAuthOutcome = 'signedIn' | 'cancelled' | 'redirecting';

/** Extrae `code` o el error de la URL de retorno (query o fragmento). */
export function parseCallbackUrl(url: string): { code?: string; error?: string } {
  const q = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0]! : '';
  const h = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const params = new URLSearchParams([q, h].filter(Boolean).join('&'));
  const code = params.get('code') ?? undefined;
  const error = params.get('error_description') ?? params.get('error') ?? undefined;
  return { code, error };
}

/** Inicio de sesión o registro con Google (el mismo flujo sirve para ambos). */
export async function signInWithGoogle(): Promise<OAuthOutcome> {
  if (!supabase) throw new Error('Supabase no está configurado');
  const redirectTo = await oauth.prepareRedirect();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;
  const result = await oauth.open(data.url, redirectTo);
  if (result.type === 'redirect') return 'redirecting';
  if (result.type === 'cancel') return 'cancelled';
  const { code, error: cbError } = parseCallbackUrl(result.url);
  if (cbError) throw new Error(cbError);
  if (!code) throw new Error('El proveedor no devolvió un código de acceso.');
  await exchangeCode(code);
  return 'signedIn';
}

/**
 * Proveedores activos en el proyecto (endpoint público `/auth/v1/settings`).
 * El botón de Google solo se muestra si el proveedor está configurado: no hay botones muertos.
 */
export function useAuthProviders() {
  return useQuery({
    queryKey: ['auth-providers'],
    enabled: clientEnv.ok,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      if (!clientEnv.ok) return { google: false };
      const res = await fetch(`${clientEnv.env.supabaseUrl}/auth/v1/settings`, {
        headers: { apikey: clientEnv.env.supabaseAnonKey },
      });
      if (!res.ok) throw new Error(`settings ${res.status}`);
      const json = (await res.json()) as { external?: Record<string, boolean> };
      return { google: json.external?.google === true };
    },
  });
}
