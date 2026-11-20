import * as Linking from 'expo-linking';

import { supabase } from '@/data/supabase';
import { markIntentionalSignOut } from '@/features/auth/session';
import { unregisterPush } from '@/platform/push';

function client() {
  if (!supabase) throw new Error('Supabase no está configurado');
  return supabase;
}

/** URL a la que vuelven los enlaces de correo (deep link `nebula://auth/callback` en Android). */
export const authRedirectUrl = (next?: 'recovery') =>
  Linking.createURL('auth/callback', next ? { queryParams: { next } } : undefined);

export async function signIn(email: string, password: string) {
  const { error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(input: { email: string; password: string; displayName: string; handle: string; timezone: string }) {
  const { data, error } = await client().auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: authRedirectUrl(),
      data: { display_name: input.displayName, handle: input.handle, timezone: input.timezone },
    },
  });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

export async function resendConfirmation(email: string) {
  const { error } = await client().auth.resend({ type: 'signup', email, options: { emailRedirectTo: authRedirectUrl() } });
  if (error) throw error;
}

export async function requestPasswordReset(email: string) {
  const { error } = await client().auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl('recovery') });
  if (error) throw error;
}

/** Códigos ya canjeados (o en curso) en este proceso: cada código OAuth solo vale una vez. */
const exchanges = new Map<string, Promise<void>>();

/** ¿Este código ya se canjeó o se está canjeando? (Android puede entregar la vuelta dos veces). */
export const wasExchanged = (code: string) => exchanges.has(code);

export function exchangeCode(code: string): Promise<void> {
  let p = exchanges.get(code);
  if (!p) {
    p = (async () => {
      const { error } = await client().auth.exchangeCodeForSession(code);
      if (error) throw error;
    })();
    exchanges.set(code, p);
    // Si falla, se permite reintentar con el mismo código.
    p.catch(() => exchanges.delete(code));
  }
  return p;
}

export async function updatePassword(password: string) {
  const { error } = await client().auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  await unregisterPush();
  markIntentionalSignOut();
  const { error } = await client().auth.signOut();
  if (error) throw error;
}

export async function isHandleAvailable(handle: string): Promise<boolean> {
  const { data, error } = await client().rpc('is_handle_available', { candidate: handle });
  if (error) throw error;
  return data === true;
}

export { deviceTimeZone } from '@/features/profile/useTimezoneSync';
