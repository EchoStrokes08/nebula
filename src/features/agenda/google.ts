import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { db, unwrap } from '@/data/db';
import { supabase } from '@/data/supabase';
import { chunks, mapGoogleEvents, type GoogleEvent } from '@/domain/integrations/google';
import type { ImportedEvent } from '@/domain/integrations/ics';
import { exchangeCode } from '@/features/auth/api';
import { parseCallbackUrl } from '@/features/auth/oauth';
import { useAuth } from '@/features/auth/session';
import { oauth } from '@/platform/oauth';

/**
 * Google Calendar → Nebula (solo lectura). Se pide el permiso `calendar.readonly` con el mismo
 * inicio de sesión de Google de la cuenta; el token de Google dura ~1 h, así que cada
 * sincronización usa el token vigente o vuelve a pedirlo. Los eventos se importan como copia
 * (no editables) y los borrados en Google desaparecen en la siguiente sincronización.
 */
export const GOOGLE_CALENDAR_NAME = 'Google Calendar';
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const API = 'https://www.googleapis.com/calendar/v3';
const PENDING = 'nebula-google-calendar-pending';
const LAST = 'nebula-google-calendar-last';
const PAST_DAYS = 30;
const FUTURE_DAYS = 365;

export class GoogleTokenError extends Error {}

/** Conexión en curso en este proceso: la autosincronización no debe duplicarla. */
let connecting = false;

async function google<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new GoogleTokenError('El permiso de Google caducó.');
  if (res.status === 403) {
    const body = await res.text();
    throw new Error(body.includes('insufficient') || body.includes('PERMISSION') ? 'Google no dio permiso para leer tu calendario. Vuelve a conectar y marca la casilla del calendario.' : 'Google rechazó la petición. Puede que la API de Calendar no esté activada en el proyecto.');
  }
  if (!res.ok) throw new Error(`Google respondió ${res.status}.`);
  return (await res.json()) as T;
}

/** Lee todos los calendarios visibles del usuario y los importa en Nebula. Devuelve cuántos eventos hay. */
export async function syncGoogleCalendar(token: string): Promise<number> {
  const now = Date.now();
  const from = new Date(now - PAST_DAYS * 86_400_000);
  const to = new Date(now + FUTURE_DAYS * 86_400_000);
  const calendars = await google<{ items?: { id: string; selected?: boolean; hidden?: boolean; timeZone?: string; primary?: boolean }[] }>(token, '/users/me/calendarList?minAccessRole=reader&maxResults=250');
  const visible = (calendars.items ?? []).filter((c) => c.primary || (c.selected !== false && !c.hidden));
  const events: ImportedEvent[] = [];
  for (const cal of visible) {
    let page: string | undefined;
    do {
      const q = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', timeMin: from.toISOString(), timeMax: to.toISOString(), maxResults: '2500', showDeleted: 'false' });
      if (page) q.set('pageToken', page);
      const res = await google<{ items?: GoogleEvent[]; nextPageToken?: string }>(token, `/calendars/${encodeURIComponent(cal.id)}/events?${q}`);
      events.push(...mapGoogleEvents(cal.id, res.items ?? [], cal.timeZone));
      page = res.nextPageToken;
    } while (page && events.length < 20_000);
  }
  for (const batch of chunks(events)) unwrap(await db().rpc('import_calendar', { p_name: GOOGLE_CALENDAR_NAME, p_provider: 'google', p_events: batch }));
  // Crea la integración aunque no haya eventos, para poder podar los que ya no existen.
  if (!events.length) unwrap(await db().rpc('import_calendar', { p_name: GOOGLE_CALENDAR_NAME, p_provider: 'google', p_events: [] }));
  const integration = unwrap(await db().from('integrations').select('id').eq('provider', 'google').eq('name', GOOGLE_CALENDAR_NAME).single()) as { id: string };
  unwrap(await db().rpc('prune_calendar', { p_integration: integration.id, p_from: from.toISOString(), p_to: to.toISOString(), p_keep: events.map((e) => e.external_id) }));
  await AsyncStorage.setItem(LAST, String(Date.now())).catch(() => {});
  return events.length;
}

export type ConnectOutcome = { kind: 'synced'; count: number } | { kind: 'redirecting' } | { kind: 'cancelled' };

/**
 * Pide a Google el permiso de lectura del calendario (mismo flujo OAuth que el inicio de sesión)
 * y sincroniza. Si se elige una cuenta de Google distinta de la de Nebula, se restaura la sesión.
 */
export async function connectGoogleCalendar(): Promise<ConnectOutcome> {
  connecting = true;
  try { return await connectInner(); } finally { connecting = false; }
}

async function connectInner(): Promise<ConnectOutcome> {
  if (!supabase) throw new Error('Supabase no está configurado');
  const before = (await supabase.auth.getSession()).data.session;
  if (!before) throw new Error('Inicia sesión primero.');
  await AsyncStorage.setItem(PENDING, before.user.id).catch(() => {});
  const redirectTo = await oauth.prepareRedirect();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, scopes: SCOPE, queryParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' } },
  });
  if (error) throw error;
  const result = await oauth.open(data.url, redirectTo);
  if (result.type === 'redirect') return { kind: 'redirecting' };
  if (result.type === 'cancel') { await AsyncStorage.removeItem(PENDING).catch(() => {}); return { kind: 'cancelled' }; }
  const { code, error: cbError } = parseCallbackUrl(result.url);
  if (cbError) throw new Error(cbError);
  if (!code) throw new Error('Google no devolvió un código de acceso.');
  await exchangeCode(code);
  return { kind: 'synced', count: await finishConnect(before) };
}

/** Comprueba que la cuenta es la misma y sincroniza con el token recién obtenido. */
async function finishConnect(before: { user: { id: string }; access_token: string; refresh_token: string } | null): Promise<number> {
  await AsyncStorage.removeItem(PENDING).catch(() => {});
  const after = (await supabase!.auth.getSession()).data.session;
  if (before && after && after.user.id !== before.user.id) {
    await supabase!.auth.setSession({ access_token: before.access_token, refresh_token: before.refresh_token });
    throw new Error('Esa cuenta de Google no es la de tu perfil de Nebula. Elige la cuenta con la que entras en Nebula.');
  }
  const token = after?.provider_token;
  if (!token) throw new Error('Google no concedió acceso al calendario.');
  return syncGoogleCalendar(token);
}

/** ¿Hay un calendario de Google conectado? (consulta la lista de integraciones). */
export async function hasGoogleCalendar(): Promise<boolean> {
  const rows = unwrap(await db().from('integrations').select('id').eq('provider', 'google').limit(1)) as unknown[];
  return rows.length > 0;
}

/**
 * Sincronización con el token vigente; si caducó o no hay, vuelve a pedir permiso a Google.
 */
export async function refreshGoogleCalendar(): Promise<ConnectOutcome> {
  const token = useAuth.getState().session?.provider_token;
  if (token) {
    try { return { kind: 'synced', count: await syncGoogleCalendar(token) }; }
    catch (e) { if (!(e instanceof GoogleTokenError)) throw e; }
  }
  return connectGoogleCalendar();
}

/**
 * Montado en las pestañas: completa una conexión que volvió por redirección (navegador web) y,
 * mientras el token de Google siga vigente tras un inicio de sesión, resincroniza cada 30 min.
 */
export function useGoogleCalendarAutoSync(onDone?: (message: string) => void) {
  const qc = useQueryClient();
  const session = useAuth((s) => s.session);
  const running = useRef(false);
  const notify = useRef(onDone);
  useEffect(() => { notify.current = onDone; }, [onDone]);
  const token = session?.provider_token ?? null;
  useEffect(() => {
    if (!token || running.current || connecting) return;
    let cancelled = false;
    (async () => {
      const pending = await AsyncStorage.getItem(PENDING).catch(() => null);
      const last = Number(await AsyncStorage.getItem(LAST).catch(() => null)) || 0;
      const connected = pending ? true : Date.now() - last > 30 * 60_000 && (await hasGoogleCalendar().catch(() => false));
      if (cancelled || !connected || (!pending && Date.now() - last < 30 * 60_000)) return;
      running.current = true;
      try {
        const count = pending ? await finishConnect(null) : await syncGoogleCalendar(token);
        await qc.invalidateQueries();
        if (pending) notify.current?.(`Google Calendar conectado: ${count} eventos.`);
      } catch (e) {
        if (pending) notify.current?.(e instanceof Error ? e.message : 'No se pudo sincronizar Google Calendar.');
      } finally { running.current = false; }
    })();
    return () => { cancelled = true; };
  }, [token, qc]);
}

/** Estado y acción para los botones «Conectar / Sincronizar Google Calendar». */
export function useGoogleCalendar() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const run = async () => {
    setBusy(true); setMessage('');
    try {
      const r = await refreshGoogleCalendar();
      if (r.kind === 'synced') { await qc.invalidateQueries(); setMessage(`Sincronizado: ${r.count} eventos de tu Google Calendar.`); }
      if (r.kind === 'cancelled') setMessage('Conexión cancelada.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No se pudo sincronizar Google Calendar.');
    } finally { setBusy(false); }
  };
  return { run, busy, message };
}
