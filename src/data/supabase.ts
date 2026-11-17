import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { clientEnv } from '@/lib/env';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { secureStorage } from '@/platform/secureStorage';
import { installWebCrypto } from '@/platform/webcrypto';

// PKCE necesita aleatoriedad segura y SHA-256 (supabase-js los consulta al iniciar sesión).
installWebCrypto();

/**
 * Cliente único de Supabase. Es `null` si la app no está configurada: la UI muestra
 * entonces la pantalla de configuración en lugar de fallar en silencio.
 */
export const supabase: SupabaseClient | null = clientEnv.ok
  ? createClient(clientEnv.env.supabaseUrl, clientEnv.env.supabaseAnonKey, {
      auth: {
        storage: secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        // PKCE: los enlaces de correo traen un código de un solo uso que se canjea en la app.
        flowType: 'pkce',
        detectSessionInUrl: false,
      },
      // 15 s: una red que no responde nunca debe bloquear el arranque ni la interfaz.
      global: { fetch: fetchWithTimeout(15_000) },
    })
  : null;
