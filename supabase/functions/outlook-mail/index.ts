import { createClient } from '@supabase/supabase-js';
import { authenticate, body, headers, json } from '../_shared/http.ts';
import { triageAndSave, unseen } from '../_shared/mail.ts';
import {
  MAX_MAIL_PER_RUN, OUTLOOK_DAYS, OUTLOOK_SCOPES, parseGraphMessage, triageRequestSchema, type GraphMessage, type MailItem,
} from '../../../src/domain/mail/triage.ts';

/**
 * Correo de Outlook (Microsoft Graph) → sugerencias de Nebula (solo lectura).
 *  POST (con la sesión de Nebula):
 *  - start  { target }  → crea un estado de un solo uso y devuelve la URL de Microsoft.
 *  - status             → { connected }.
 *  - triage { today }   → lee el correo reciente de la bandeja (bandeja Prioritarios si está activa),
 *                         lo clasifica con la IA y lo guarda en mail_triage. Cuenta como una consulta.
 *  - forget             → borra el permiso y las clasificaciones de Outlook.
 *  GET (vuelta de Microsoft): canjea el código, guarda el permiso renovable de la persona que
 *  empezó la conexión y devuelve el control a la app (destinos fijos, no se puede redirigir a otro sitio).
 * Necesita MS_CLIENT_ID y MS_CLIENT_SECRET (registro de app en Microsoft Entra, cuentas personales
 * y de organización) con esta función como URI de redirección.
 */
const CLIENT_ID = Deno.env.get('MS_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('MS_CLIENT_SECRET') ?? '';
const REDIRECT_URI = Deno.env.get('OUTLOOK_REDIRECT_URI') ?? `${Deno.env.get('SUPABASE_URL')}/functions/v1/outlook-mail`;
// «common» admite cuentas personales y de cualquier organización; con una app de un solo
// directorio se pone su id de inquilino en MS_TENANT_ID.
const TENANT = /^[0-9a-f-]{36}$|^(common|organizations|consumers)$/.test(Deno.env.get('MS_TENANT_ID') ?? '') ? Deno.env.get('MS_TENANT_ID')! : 'common';
const AUTHORITY = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0`;
const GRAPH = 'https://graph.microsoft.com/v1.0/me';
const SCOPE = OUTLOOK_SCOPES.join(' ');
const STATE_TTL_MS = 15 * 60_000;

/** A dónde vuelve la app según dónde empezó la conexión (como la página puente de Google). */
const TARGETS: Record<string, string> = {
  w: 'https://echostrokes08.github.io/nebula/correo',
  a: 'nebula://correo',
  d: 'http://127.0.0.1:47913/auth/callback',
};

const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

type Tokens = { ok: true; access_token: string; refresh_token?: string } | { ok: false; revoked: boolean };

async function token(params: Record<string, string>): Promise<Tokens> {
  const res = await fetch(`${AUTHORITY}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, scope: SCOPE, ...params }),
  });
  const data = await res.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; scope?: string; error?: string };
  if (!res.ok || !data.access_token) {
    console.log(JSON.stringify({ outlook: 'token', status: res.status, error: data.error }));
    return { ok: false, revoked: data.error === 'invalid_grant' || data.error === 'unauthorized_client' || data.error === 'interaction_required' };
  }
  // Sin el permiso de leer el correo el token no sirve.
  if (data.scope && !/(^|\s|\/)Mail\.Read(\s|$)/i.test(data.scope)) return { ok: false, revoked: true };
  return { ok: true, access_token: data.access_token, refresh_token: data.refresh_token };
}

function back(target: string, result: string): Response {
  return new Response(null, { status: 302, headers: { Location: `${TARGETS[target]}?outlook=${encodeURIComponent(result)}`, 'Cache-Control': 'no-store' } });
}

const page = (title: string, text: string, status = 400) => new Response(
  `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
  `<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0B0815;color:#EDE8F7;font:16px/1.5 system-ui,sans-serif"><main style="text-align:center;padding:24px;max-width:420px"><h1 style="font-size:1.4rem">${title}</h1><p style="color:#B4AACB">${text}</p></main></body></html>`,
  { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
);

/** Vuelta de Microsoft tras aceptar (o rechazar) el permiso. */
async function callback(url: URL): Promise<Response> {
  const state = url.searchParams.get('state') ?? '';
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(state)) return page('Enlace no válido', 'Vuelve a Nebula y conecta Outlook desde la pantalla Correo.');
  const db = admin();
  const { data: row } = await db.from('mail_oauth_states').delete().eq('state', state).select('user_id, target, created_at').maybeSingle();
  if (!row || Date.now() - Date.parse(row.created_at) > STATE_TTL_MS || !TARGETS[row.target]) {
    return page('El enlace caducó', 'Vuelve a Nebula y conecta Outlook otra vez desde la pantalla Correo.');
  }
  const error = url.searchParams.get('error');
  if (error) return back(row.target, error === 'access_denied' ? 'cancelled' : 'error');
  const code = url.searchParams.get('code');
  if (!code || code.length > 4096) return back(row.target, 'error');
  const t = await token({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI });
  if (!t.ok || !t.refresh_token) return back(row.target, 'rejected');
  const { error: saveError } = await db.from('outlook_tokens').upsert({ user_id: row.user_id, refresh_token: t.refresh_token, updated_at: new Date().toISOString() });
  if (saveError) { console.log(JSON.stringify({ outlook: 'save', reason: saveError.message })); return back(row.target, 'error'); }
  return back(row.target, 'ok');
}

class GraphError extends Error {
  constructor(readonly code: 'reconnect' | 'no_mailbox' | 'microsoft_unavailable') { super(code); }
}

async function graph<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${GRAPH}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 401 || res.status === 403) throw new GraphError('reconnect');
  if (res.status === 404) {
    const text = await res.text();
    throw new GraphError(/MailboxNotEnabled|ResourceNotFound/i.test(text) ? 'no_mailbox' : 'microsoft_unavailable');
  }
  if (!res.ok) throw new GraphError('microsoft_unavailable');
  return await res.json() as T;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method === 'GET') {
    if (!CLIENT_ID || !CLIENT_SECRET) return page('Outlook no está disponible', 'La conexión con Outlook aún no está activada en Nebula.', 503);
    try { return await callback(new URL(req.url)); }
    catch (e) {
      console.log(JSON.stringify({ outlook: 'callback', reason: e instanceof Error ? e.message : String(e) }));
      return page('No se pudo conectar Outlook', 'Vuelve a Nebula e inténtalo otra vez.', 500);
    }
  }
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  try {
    const { client, user } = await authenticate(req);
    const input = await body(req) as { action?: string; target?: unknown };
    const db = admin();
    const tokens = db.from('outlook_tokens');

    if (input.action === 'status') {
      const { data, error } = await tokens.select('user_id').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      return json({ connected: !!data });
    }

    if (input.action === 'forget') {
      // Microsoft no permite revocar un refresh token concreto: se borra y deja de usarse.
      const del = await tokens.delete().eq('user_id', user.id);
      if (del.error) throw del.error;
      const rows = await db.from('mail_triage').delete().eq('user_id', user.id).eq('provider', 'outlook');
      if (rows.error) throw rows.error;
      return json({ forgotten: true });
    }

    if (!CLIENT_ID || !CLIENT_SECRET) return json({ error: 'not_configured' }, 503);

    if (input.action === 'start') {
      const target = typeof input.target === 'string' ? input.target : '';
      if (!TARGETS[target]) return json({ error: 'invalid_target' }, 400);
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const state = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      // Un solo intento abierto por persona.
      await db.from('mail_oauth_states').delete().eq('user_id', user.id);
      const { error } = await db.from('mail_oauth_states').insert({ state, user_id: user.id, target });
      if (error) throw error;
      const q = new URLSearchParams({ client_id: CLIENT_ID, response_type: 'code', redirect_uri: REDIRECT_URI, response_mode: 'query', scope: SCOPE, state, prompt: 'select_account' });
      return json({ url: `${AUTHORITY}/authorize?${q}` });
    }

    const parsed = triageRequestSchema.safeParse(input);
    if (!parsed.success) return json({ error: 'unknown action' }, 400);
    const today = parsed.data.today;

    const { data: stored, error: readError } = await tokens.select('refresh_token').eq('user_id', user.id).maybeSingle();
    if (readError) throw readError;
    if (!stored) return json({ error: 'not_connected' }, 404);
    const t = await token({ grant_type: 'refresh_token', refresh_token: stored.refresh_token });
    if (!t.ok) {
      if (t.revoked) { await tokens.delete().eq('user_id', user.id); return json({ error: 'reconnect' }, 409); }
      return json({ error: 'microsoft_unavailable' }, 502);
    }
    // Microsoft renueva el refresh token en cada uso: se guarda el nuevo.
    if (t.refresh_token && t.refresh_token !== stored.refresh_token) {
      await tokens.update({ refresh_token: t.refresh_token, updated_at: new Date().toISOString() }).eq('user_id', user.id);
    }

    const since = new Date(Date.now() - OUTLOOK_DAYS * 86_400_000).toISOString();
    const q = new URLSearchParams({
      $filter: `receivedDateTime ge ${since}`,
      $orderby: 'receivedDateTime desc',
      $top: '60',
      $select: 'id,conversationId,subject,from,receivedDateTime,bodyPreview,webLink,inferenceClassification',
    });
    const list = await graph<{ value?: GraphMessage[] }>(t.access_token, `/mailFolders/inbox/messages?${q}`);
    // «Otros» de la bandeja Prioritarios es lo equivalente a promociones y notificaciones en Gmail.
    const mail = (list.value ?? []).filter((m) => m.inferenceClassification !== 'other').map(parseGraphMessage).filter((m): m is MailItem => !!m);
    const fresh = new Set(await unseen(db, user.id, 'outlook', mail.map((m) => m.id)));
    const pending = mail.filter((m) => fresh.has(m.id));
    const batch = pending.slice(0, MAX_MAIL_PER_RUN);
    return await triageAndSave({ admin: db, client, userId: user.id, provider: 'outlook', mail: batch, today, pending: pending.length - batch.length });
  } catch (e) {
    if (e instanceof Error && e.message === 'unauthorized') return json({ error: 'unauthorized' }, 401);
    if (e instanceof GraphError) return json({ error: e.code }, e.code === 'reconnect' ? 409 : e.code === 'no_mailbox' ? 404 : 502);
    console.log(JSON.stringify({ outlook: 'internal', reason: e instanceof Error ? e.message : String(e) }));
    return json({ error: 'outlook mail failed' }, 500);
  }
});
