import { createClient } from '@supabase/supabase-js';
import { authenticate, body, headers, json } from '../_shared/http.ts';
import { triageAndSave, unseen } from '../_shared/mail.ts';
import {
  GMAIL_QUERY, GMAIL_SCOPE, MAX_MAIL_PER_RUN, parseGmailMessage, triageRequestSchema, type GmailMessage, type MailItem,
} from '../../../src/domain/mail/triage.ts';

/**
 * Correo de Gmail → sugerencias de Nebula (solo lectura).
 *  - store  { refresh_token } → valida el permiso de Gmail y lo guarda para el usuario.
 *  - status                    → { connected } sin tocar Google.
 *  - triage { today }          → lee los correos recientes aún no revisados, los clasifica con la IA
 *                                y guarda el resultado en mail_triage. Cuenta como una consulta de IA.
 *  - forget                    → revoca el permiso en Google, lo borra y borra las clasificaciones.
 * El refresh token nunca vuelve al cliente. Al modelo solo llegan remitente, asunto, fecha y el
 * fragmento de Gmail (no el cuerpo del correo).
 */
const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';

type Refreshed = { ok: true; access_token: string } | { ok: false; revoked: boolean };

async function refresh(refreshToken: string): Promise<Refreshed> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  const data = await res.json().catch(() => ({})) as { access_token?: string; scope?: string; error?: string };
  if (!res.ok || !data.access_token) return { ok: false, revoked: data.error === 'invalid_grant' || data.error === 'unauthorized_client' };
  // Sin la casilla de Gmail marcada el token no sirve para leer el correo.
  if (data.scope && !data.scope.split(' ').includes(GMAIL_SCOPE)) return { ok: false, revoked: true };
  return { ok: true, access_token: data.access_token };
}

class GmailError extends Error {
  constructor(readonly code: 'gmail_api_disabled' | 'reconnect' | 'google_unavailable') { super(code); }
}

async function gmail<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${GMAIL}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new GmailError('reconnect');
  if (res.status === 403) {
    const text = await res.text();
    throw new GmailError(/accessNotConfigured|SERVICE_DISABLED|has not been used/.test(text) ? 'gmail_api_disabled' : 'reconnect');
  }
  if (!res.ok) throw new GmailError('google_unavailable');
  return await res.json() as T;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  try {
    const { client, user } = await authenticate(req);
    const input = await body(req) as { action?: string; refresh_token?: unknown };
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const tokens = admin.from('gmail_tokens');

    if (input.action === 'status') {
      const { data, error } = await tokens.select('user_id').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      return json({ connected: !!data });
    }

    if (input.action === 'forget') {
      const { data } = await tokens.select('refresh_token').eq('user_id', user.id).maybeSingle();
      if (data) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(data.refresh_token)}`, { method: 'POST' }).catch(() => {});
      const del = await tokens.delete().eq('user_id', user.id);
      if (del.error) throw del.error;
      const rows = await admin.from('mail_triage').delete().eq('user_id', user.id).eq('provider', 'gmail');
      if (rows.error) throw rows.error;
      return json({ forgotten: true });
    }

    if (!CLIENT_ID || !CLIENT_SECRET) return json({ error: 'not_configured' }, 503);

    if (input.action === 'store') {
      const token = typeof input.refresh_token === 'string' ? input.refresh_token.trim() : '';
      if (token.length < 10 || token.length > 2048) return json({ error: 'invalid_token' }, 400);
      const r = await refresh(token);
      if (!r.ok) return json({ error: 'rejected' }, 400);
      const { error } = await tokens.upsert({ user_id: user.id, refresh_token: token, updated_at: new Date().toISOString() });
      if (error) throw error;
      return json({ connected: true });
    }

    const parsed = triageRequestSchema.safeParse(input);
    if (!parsed.success) return json({ error: 'unknown action' }, 400);
    const today = parsed.data.today;

    const { data: stored, error: readError } = await tokens.select('refresh_token').eq('user_id', user.id).maybeSingle();
    if (readError) throw readError;
    if (!stored) return json({ error: 'not_connected' }, 404);
    const r = await refresh(stored.refresh_token);
    if (!r.ok) {
      if (r.revoked) { await tokens.delete().eq('user_id', user.id); return json({ error: 'reconnect' }, 409); }
      return json({ error: 'google_unavailable' }, 502);
    }

    // Correos recientes que aún no se han revisado (los ya clasificados no se vuelven a enviar).
    const list = await gmail<{ messages?: { id: string }[] }>(r.access_token, `/messages?${new URLSearchParams({ q: GMAIL_QUERY, maxResults: '60' })}`);
    const ids = (list.messages ?? []).map((m) => m.id).filter((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id));
    const fresh = await unseen(admin, user.id, 'gmail', ids);
    const batch = fresh.slice(0, MAX_MAIL_PER_RUN);
    const meta = new URLSearchParams([['format', 'metadata'], ['metadataHeaders', 'From'], ['metadataHeaders', 'Subject']]);
    const mail = (await Promise.all(batch.map((id) => gmail<GmailMessage>(r.access_token, `/messages/${id}?${meta}`))))
      .map(parseGmailMessage).filter((m): m is MailItem => !!m);
    return await triageAndSave({ admin, client, userId: user.id, provider: 'gmail', mail, today, pending: fresh.length - batch.length });
  } catch (e) {
    if (e instanceof Error && e.message === 'unauthorized') return json({ error: 'unauthorized' }, 401);
    if (e instanceof GmailError) return json({ error: e.code }, e.code === 'reconnect' ? 409 : e.code === 'gmail_api_disabled' ? 503 : 502);
    console.log(JSON.stringify({ mail: 'internal', reason: e instanceof Error ? e.message : String(e) }));
    return json({ error: 'gmail triage failed' }, 500);
  }
});
