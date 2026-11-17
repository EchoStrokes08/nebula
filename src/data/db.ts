import { supabase } from './supabase';

/** Cliente de Supabase garantizado (la UI solo llega aquí si la app está configurada). */
export function db() {
  if (!supabase) throw new Error('Supabase no está configurado');
  return supabase;
}

/** Lanza el error de Supabase si lo hay y devuelve los datos. */
export function unwrap<T>(r: { data: T; error: unknown }): T {
  if (r.error) throw r.error;
  return r.data;
}

/** Como `unwrap`, pero exige que haya datos (p. ej. `insert(...).select().single()`). */
export function unwrapOne<T>(r: { data: T; error: unknown }): NonNullable<T> {
  if (r.error) throw r.error;
  if (r.data === null || r.data === undefined) throw new Error('Respuesta vacía del servidor');
  return r.data as NonNullable<T>;
}
