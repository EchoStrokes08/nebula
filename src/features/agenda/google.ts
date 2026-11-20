import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { db, unwrap } from '@/data/db';
import { supabase } from '@/data/supabase';
import { DEFAULT_SYNC_MINUTES, parseSyncMinutes, syncDue } from '@/domain/integrations/autoSync';
import { chunks, mapGoogleEvents, type GoogleEvent } from '@/domain/integrations/google';
import { buildGoogleAuthUrl, grantedCalendar, makeState, parseGoogleRedirect, parseState, type GoogleTarget } from '@/domain/integrations/googleOAuth';
import type { ImportedEvent } from '@/domain/integrations/ics';
import { exchangeCode } from '@/features/auth/api';
import { parseCallbackUrl } from '@/features/auth/oauth';
import { useAuth } from '@/features/auth/session';
import { getDesktopBridge } from '@/platform/desktopBridge';
import { oauth } from '@/platform/oauth';

/**
 * Google Calendar → Nebula (solo lectura). El permiso `calendar.readonly` se pide con un cliente
 * OAuth propio (EXPO_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID) cuyo retorno es una página de Nebula en
 * GitHub Pages, no el dominio de Supabase: así Google puede verificar la app y no muestra el aviso
 * «Google no verificó esta app». Sin ese cliente se usa el flujo anterior (inicio de sesión de
 * Supabase con el permiso extra). El token dura ~1 h; con el flujo de Supabase, el permiso renovable
 * queda en el servidor (función google-calendar) y da tokens nuevos sin volver a abrir Google. La resincronización automática usa el intervalo de Ajustes. Los eventos se importan como copia y los borrados en Google desaparecen al resincronizar.
 */
export const GOOGLE_CALENDAR_NAME = 'Google Calendar';
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const API = 'https://www.googleapis.com/calendar/v3';
const PENDING = 'nebula-google-calendar-pending';
const LAST = 'nebula-google-calendar-last';
const TOKEN = 'nebula-google-calendar-token';
const NONCE = 'nebula-google-calendar-nonce';
const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CALENDAR_CLIENT_ID ?? '';
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
  try { return await (CLIENT_ID ? connectOwnClient() : connectViaSupabase()); } finally { connecting = false; }
}

// ---- Cliente OAuth propio ------------------------------------------------------------------

type StoredToken = { token: string; expiresAt: number };

async function storedToken(): Promise<string | null> {
  try {
    const t = JSON.parse((await AsyncStorage.getItem(TOKEN)) ?? 'null') as StoredToken | null;
    return t && t.expiresAt > Date.now() ? t.token : null;
  } catch { return null; }
}

async function forgetToken() { await AsyncStorage.removeItem(TOKEN).catch(() => {}); }

async function rememberToken(token: string, expiresIn: number) {
  // Margen de un minuto para no usar un token a punto de caducar.
  const t: StoredToken = { token, expiresAt: Date.now() + Math.max(0, expiresIn - 60) * 1000 };
  await AsyncStorage.setItem(TOKEN, JSON.stringify(t)).catch(() => {});
}

// ---- Permiso renovable en el servidor (función google-calendar) -----------------------------

type ServerToken = { access_token: string; expires_in: number };

/** Llama a la función del servidor; `null` si no está desplegada o configurada, o no hay permiso. */
async function callServer(action: 'store' | 'token' | 'forget', extra: Record<string, unknown> = {}): Promise<ServerToken | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.functions.invoke<ServerToken>('google-calendar', { body: { action, ...extra } });
    if (error || !data?.access_token) return null;
    return data;
  } catch { return null; }
}

/** Guarda en el servidor el permiso renovable que Google dio al conectar (si lo dio). */
async function storeRefreshToken(refreshToken: string | null | undefined) {
  if (!refreshToken) return;
  const r = await callServer('store', { refresh_token: refreshToken });
  if (r) { serverMissAt = 0; await rememberToken(r.access_token, r.expires_in); }
}

/** Última vez que el servidor no tenía permiso: evita preguntarle cada minuto en vano. */
let serverMissAt = 0;
const SERVER_RETRY_MS = 10 * 60_000;

/** Token nuevo a partir del permiso renovable guardado en el servidor, sin abrir el navegador. */
async function serverToken(): Promise<string | null> {
  if (Date.now() - serverMissAt < SERVER_RETRY_MS) return null;
  const r = await callServer('token');
  if (!r) { serverMissAt = Date.now(); return null; }
  await rememberToken(r.access_token, r.expires_in);
  return r.access_token;
}

/** Olvida el permiso renovable (al quitar Google Calendar de las integraciones). */
export async function forgetGoogleCalendar() {
  await forgetToken();
  await callServer('forget');
}

/**
 * Token vigente: el guardado en el dispositivo, uno renovado por el servidor o, con el flujo
 * anterior, el que dejó el inicio de sesión.
 */
async function currentToken(): Promise<string | null> {
  return (await storedToken()) ?? (await serverToken()) ?? (CLIENT_ID ? null : useAuth.getState().session?.provider_token ?? null);
}

function target(): GoogleTarget {
  if (Platform.OS !== 'web') return 'a';
  return getDesktopBridge() ? 'd' : 'w';
}

async function connectOwnClient(): Promise<ConnectOutcome> {
  if (!useAuth.getState().session) throw new Error('Inicia sesión primero.');
  const nonce = Crypto.randomUUID().replace(/-/g, '');
  await AsyncStorage.setItem(NONCE, nonce);
  const t = target();
  const authUrl = buildGoogleAuthUrl({ clientId: CLIENT_ID, state: makeState(t, nonce) });
  // Escritorio: prepareRedirect levanta el servidor de retorno en 127.0.0.1, adonde reenvía la página puente.
  const redirect = t === 'a' ? Linking.createURL('google-calendar') : await oauth.prepareRedirect();
  const result = await oauth.open(authUrl, redirect);
  if (result.type === 'redirect') return { kind: 'redirecting' };
  if (result.type === 'cancel') return { kind: 'cancelled' };
  return completeGoogleRedirect(result.url);
}

const completions = new Map<string, Promise<ConnectOutcome>>();

/**
 * Termina la conexión con la URL a la que volvió Google (vía la página puente). En Android puede
 * llegar dos veces (la sesión del navegador y el enlace nebula://): ambas comparten el resultado.
 */
export function completeGoogleRedirect(url: string): Promise<ConnectOutcome> {
  const r = parseGoogleRedirect(url);
  const key = r.state ?? url;
  let p = completions.get(key);
  if (!p) {
    p = (async (): Promise<ConnectOutcome> => {
      const st = parseState(r.state);
      const expected = await AsyncStorage.getItem(NONCE).catch(() => null);
      if (!st || !expected || st.nonce !== expected) throw new Error('La respuesta de Google no corresponde a esta conexión. Vuelve a intentarlo.');
      await AsyncStorage.removeItem(NONCE).catch(() => {});
      if (!r.ok) {
        if (r.error === 'cancelled') return { kind: 'cancelled' };
        throw new Error(r.error);
      }
      if (!grantedCalendar(r.scopes)) throw new Error('Google no dio permiso para leer tu calendario. Vuelve a conectar y marca la casilla del calendario.');
      await AsyncStorage.setItem(TOKEN, JSON.stringify({ token: r.accessToken, expiresAt: r.expiresAt } satisfies StoredToken));
      return { kind: 'synced', count: await syncGoogleCalendar(r.accessToken) };
    })();
    completions.set(key, p);
  }
  return p;
}

// ---- Flujo anterior: inicio de sesión de Supabase con el permiso del calendario ------------------

async function connectViaSupabase(): Promise<ConnectOutcome> {
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
  await rememberToken(token, 3600);
  // Con el permiso renovable en el servidor, la sincronización automática no caduca a la hora.
  await storeRefreshToken(after?.provider_refresh_token);
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
  const token = await currentToken();
  if (token) {
    try { return { kind: 'synced', count: await syncGoogleCalendar(token) }; }
    catch (e) { if (!(e instanceof GoogleTokenError)) throw e; await forgetToken(); }
  }
  return connectGoogleCalendar();
}

const INTERVAL = 'nebula-google-calendar-interval';

/** Intervalo de sincronización automática elegido en este dispositivo (minutos; 0 = nunca). */
export async function getGoogleSyncMinutes(): Promise<number> {
  return parseSyncMinutes(await AsyncStorage.getItem(INTERVAL).catch(() => null));
}

/** Preferencia «Sincronizar cada…» de Ajustes. Al cambiarla, la app la aplica sin reiniciar. */
export function useGoogleSyncInterval() {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['google-sync-interval'], networkMode: 'always', staleTime: Infinity, queryFn: getGoogleSyncMinutes });
  const set = async (minutes: number) => {
    await AsyncStorage.setItem(INTERVAL, String(minutes));
    qc.setQueryData(['google-sync-interval'], minutes);
  };
  return { minutes: query.data ?? DEFAULT_SYNC_MINUTES, set };
}

/** ¿Hay un permiso de Google vigente para sincronizar sin abrir el navegador? */
export async function hasGoogleToken(): Promise<boolean> {
  return !!(await currentToken());
}

/** Comprobación periódica mientras la app está abierta (el intervalo real lo marca la preferencia). */
const TICK_MS = 60_000;

/**
 * Montado en las pestañas: completa una conexión que volvió por redirección (navegador web) y
 * resincroniza sola con el intervalo elegido en Ajustes: al abrir la app, al volver a primer plano
 * y mientras siga abierta. Solo usa el permiso vigente; si caducó, no abre el navegador por sorpresa
 * (la barra de Google Calendar avisa para renovarlo con un toque).
 */
export function useGoogleCalendarAutoSync(onDone?: (message: string) => void) {
  const qc = useQueryClient();
  const session = useAuth((s) => s.session);
  const running = useRef(false);
  const notify = useRef(onDone);
  useEffect(() => { notify.current = onDone; }, [onDone]);
  const userId = session?.user.id ?? null;
  const providerToken = session?.provider_token ?? null;
  const { minutes } = useGoogleSyncInterval();
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const tick = async () => {
      if (running.current || connecting || cancelled) return;
      // Solo el flujo anterior vuelve por redirección con PENDING (el propio vuelve por /google-calendar).
      const pending = !CLIENT_ID && providerToken ? await AsyncStorage.getItem(PENDING).catch(() => null) : null;
      const last = Number(await AsyncStorage.getItem(LAST).catch(() => null)) || 0;
      if (!pending && !syncDue(last, minutes)) return;
      const token = await currentToken();
      if (!token || cancelled) { if (!token) void qc.invalidateQueries({ queryKey: ['google-token'] }); return; }
      if (!pending && !(await hasGoogleCalendar().catch(() => false))) return;
      if (cancelled || running.current) return;
      running.current = true;
      try {
        const count = pending ? await finishConnect(null) : await syncGoogleCalendar(token);
        await qc.invalidateQueries();
        if (pending) notify.current?.(`Google Calendar conectado: ${count} eventos.`);
      } catch (e) {
        if (e instanceof GoogleTokenError) { await forgetToken(); void qc.invalidateQueries({ queryKey: ['google-token'] }); }
        if (pending) notify.current?.(e instanceof Error ? e.message : 'No se pudo sincronizar Google Calendar.');
      } finally { running.current = false; }
    };
    void tick();
    const timer = setInterval(() => void tick(), TICK_MS);
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') void tick(); });
    return () => { cancelled = true; clearInterval(timer); sub.remove(); };
  }, [userId, providerToken, qc, minutes]);
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
