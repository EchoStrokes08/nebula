import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { db, unwrap } from '@/data/db';
import { supabase } from '@/data/supabase';
import { GMAIL_SCOPE, mailErrorMessage, type MailKind, type MailProvider } from '@/domain/mail/triage';
import { exchangeCode } from '@/features/auth/api';
import { parseCallbackUrl } from '@/features/auth/oauth';
import { createTask } from '@/features/tasks/api';
import type { DayKey } from '@/lib/dates';
import { getDesktopBridge } from '@/platform/desktopBridge';
import { oauth } from '@/platform/oauth';

/**
 * Gmail y Outlook → Nebula (solo lectura).
 *
 * Gmail: El permiso se pide con el inicio de sesión de Google de Supabase
 * (como el flujo de Google Calendar sin cliente propio) y el permiso renovable queda en el servidor:
 * la función gmail-triage lee el correo, lo clasifica con la IA y guarda las sugerencias en
 * mail_triage. La app solo lee esas sugerencias y decide qué hacer con cada una.
 */
const PENDING = 'nebula-gmail-pending';

export class MailError extends Error {
  constructor(readonly code: string | undefined) { super(mailErrorMessage(code)); }
}

const FUNCTION: Record<MailProvider, string> = { gmail: 'gmail-triage', outlook: 'outlook-mail' };

/** Llama a la función del proveedor y convierte sus errores en mensajes comprensibles. */
async function callProvider<T>(provider: MailProvider, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().functions.invoke<T>(FUNCTION[provider], { body: payload });
  if (error) {
    const response = (error as { context?: { json?: () => Promise<unknown> } }).context;
    const body = typeof response?.json === 'function' ? await response.json().catch(() => null) as { error?: unknown } | null : null;
    throw new MailError(typeof body?.error === 'string' ? body.error : undefined);
  }
  return data as T;
}

const call = <T>(payload: Record<string, unknown>) => callProvider<T>('gmail', payload);

export async function mailConnected(provider: MailProvider): Promise<boolean> {
  return (await callProvider<{ connected: boolean }>(provider, { action: 'status' })).connected;
}

export type GmailConnectOutcome = 'connected' | 'redirecting' | 'cancelled';

/** Pide a Google el permiso de lectura del correo y lo guarda en el servidor. */
export async function connectGmail(): Promise<GmailConnectOutcome> {
  if (!supabase) throw new Error('Supabase no está configurado');
  const before = (await supabase.auth.getSession()).data.session;
  if (!before) throw new Error('Inicia sesión primero.');
  await AsyncStorage.setItem(PENDING, before.user.id).catch(() => {});
  const redirectTo = await oauth.prepareRedirect();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, scopes: GMAIL_SCOPE, queryParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' } },
  });
  if (error) throw error;
  const result = await oauth.open(data.url, redirectTo);
  if (result.type === 'redirect') return 'redirecting';
  if (result.type === 'cancel') { await AsyncStorage.removeItem(PENDING).catch(() => {}); return 'cancelled'; }
  const { code, error: cbError } = parseCallbackUrl(result.url);
  if (cbError) { await AsyncStorage.removeItem(PENDING).catch(() => {}); throw new Error(cbError); }
  if (!code) throw new Error('Google no devolvió un código de acceso.');
  await exchangeCode(code);
  await finishConnect(before);
  return 'connected';
}

/**
 * Navegador web: la conexión vuelve por redirección de página completa. Al abrir la pantalla del
 * correo se termina si quedó pendiente. Devuelve true si guardó el permiso.
 */
export async function completePendingGmail(): Promise<boolean> {
  if (!supabase) return false;
  const pending = await AsyncStorage.getItem(PENDING).catch(() => null);
  if (!pending) return false;
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.provider_refresh_token) return false;
  if (session.user.id !== pending) {
    await AsyncStorage.removeItem(PENDING).catch(() => {});
    throw new Error('Esa cuenta de Google no es la de tu perfil de Nebula. Vuelve a iniciar sesión con tu cuenta y conecta Gmail con ella.');
  }
  await finishConnect(null);
  return true;
}

async function finishConnect(before: { user: { id: string }; access_token: string; refresh_token: string } | null) {
  await AsyncStorage.removeItem(PENDING).catch(() => {});
  const after = (await supabase!.auth.getSession()).data.session;
  if (before && after && after.user.id !== before.user.id) {
    await supabase!.auth.setSession({ access_token: before.access_token, refresh_token: before.refresh_token });
    throw new Error('Esa cuenta de Google no es la de tu perfil de Nebula. Elige la cuenta con la que entras en Nebula.');
  }
  const refreshToken = after?.provider_refresh_token;
  if (!refreshToken) throw new MailError('rejected');
  await call({ action: 'store', refresh_token: refreshToken });
}

export async function disconnectMail(provider: MailProvider) {
  await callProvider(provider, { action: 'forget' });
}

/**
 * Outlook: Microsoft vuelve a la función outlook-mail (no al inicio de sesión de Supabase), que
 * guarda el permiso para quien empezó la conexión y devuelve el control a la app con ?outlook=…
 * Así la cuenta de Outlook puede ser distinta de la de Nebula.
 */
export async function connectOutlook(): Promise<GmailConnectOutcome> {
  const target = Platform.OS !== 'web' ? 'a' : getDesktopBridge() ? 'd' : 'w';
  // Escritorio: prepareRedirect levanta el servidor de retorno en 127.0.0.1.
  const returnUrl = target === 'a' ? Linking.createURL('correo') : await oauth.prepareRedirect();
  const { url } = await callProvider<{ url: string }>('outlook', { action: 'start', target });
  if (!url.startsWith('https://login.microsoftonline.com/')) throw new MailError(undefined);
  const result = await oauth.open(url, returnUrl);
  if (result.type === 'redirect') return 'redirecting';
  if (result.type === 'cancel') return 'cancelled';
  return outlookReturn(result.url);
}

/** Resultado que trae la vuelta de Outlook (?outlook=ok|cancelled|rejected|error). */
export function outlookReturn(url: string): GmailConnectOutcome {
  const q = url.includes('?') ? new URLSearchParams(url.slice(url.indexOf('?') + 1).split('#')[0]) : new URLSearchParams();
  const r = q.get('outlook');
  if (r === 'ok') return 'connected';
  if (r === 'cancelled') return 'cancelled';
  throw new MailError(r === 'rejected' ? 'outlook_rejected' : undefined);
}

const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Revisa el correo nuevo. `pending`: correos que quedaron para la siguiente revisión. */
export async function triageMail(provider: MailProvider): Promise<{ added: number; pending: number }> {
  return callProvider(provider, { action: 'triage', today: localDay() });
}

export type MailStatus = 'new' | 'task' | 'done' | 'dismissed';

export interface MailSuggestion {
  provider: MailProvider;
  messageId: string;
  threadId: string;
  sender: string;
  subject: string;
  receivedAt: string;
  kind: MailKind;
  title: string | null;
  dueDate: DayKey | null;
  priority: number;
  reason: string | null;
  status: MailStatus;
  taskId: string | null;
  webLink: string | null;
}

export async function fetchMailSuggestions(): Promise<MailSuggestion[]> {
  const rows = unwrap(await db().from('mail_triage')
    .select('provider, message_id, thread_id, sender, subject, received_at, kind, title, due_date, priority, reason, status, task_id, web_link')
    .order('received_at', { ascending: false }).limit(200)) as Record<string, unknown>[];
  return rows.map((r) => ({
    provider: r.provider as MailProvider,
    messageId: r.message_id as string,
    threadId: r.thread_id as string,
    sender: r.sender as string,
    subject: r.subject as string,
    receivedAt: r.received_at as string,
    kind: r.kind as MailKind,
    title: (r.title as string) ?? null,
    dueDate: (r.due_date as DayKey) ?? null,
    priority: r.priority as number,
    reason: (r.reason as string) ?? null,
    status: r.status as MailStatus,
    taskId: (r.task_id as string) ?? null,
    webLink: (r.web_link as string) ?? null,
  }));
}

export async function setMailStatus(s: Pick<MailSuggestion, 'provider' | 'messageId'>, status: MailStatus, taskId: string | null = null) {
  unwrap(await db().from('mail_triage').update({ status, task_id: taskId }).eq('provider', s.provider).eq('message_id', s.messageId));
}

/** Convierte la sugerencia en una tarea de Nebula (con remitente y asunto en las notas). */
export async function suggestionToTask(s: MailSuggestion): Promise<string> {
  const id = await createTask({
    title: s.title ?? s.subject,
    notes: `Del correo de ${s.sender}: «${s.subject}»`,
    priority: s.priority,
    dueDate: s.dueDate,
  });
  await setMailStatus(s, 'task', id);
  return id;
}
