import { createClient } from '@supabase/supabase-js';
import { authenticate, body, headers, json } from '../_shared/http.ts';

/**
 * Permiso renovable de Google Calendar (solo lectura).
 *  - store  { refresh_token } → lo valida pidiendo un token de acceso y lo guarda para el usuario.
 *  - token                     → devuelve un token de acceso nuevo usando el guardado.
 *  - forget                    → lo revoca en Google y lo borra.
 * El refresh token nunca vuelve al cliente. Necesita GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET: los
 * del proveedor Google del inicio de sesión de Supabase, que es quien emitió el permiso.
 */
const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

type Refreshed = { ok: true; access_token: string; expires_in: number } | { ok: false; revoked: boolean };

async function refresh(refreshToken: string): Promise<Refreshed> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  const data = await res.json().catch(() => ({})) as { access_token?: string; expires_in?: number; scope?: string; error?: string };
  if (!res.ok || !data.access_token) return { ok: false, revoked: data.error === 'invalid_grant' || data.error === 'unauthorized_client' };
  // Sin el permiso del calendario el token no sirve para sincronizar.
  if (data.scope && !data.scope.split(' ').includes(CALENDAR_SCOPE)) return { ok: false, revoked: true };
  return { ok: true, access_token: data.access_token, expires_in: data.expires_in ?? 3600 };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  try {
    const { user } = await authenticate(req);
    if (!CLIENT_ID || !CLIENT_SECRET) return json({ error: 'not_configured' }, 503);
    const input = await body(req) as { action?: string; refresh_token?: unknown };
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const table = admin.from('google_calendar_tokens');

    if (input.action === 'store') {
      const token = typeof input.refresh_token === 'string' ? input.refresh_token.trim() : '';
      if (token.length < 10 || token.length > 2048) return json({ error: 'invalid_token' }, 400);
      const r = await refresh(token);
      if (!r.ok) return json({ error: 'rejected' }, 400);
      const { error } = await table.upsert({ user_id: user.id, refresh_token: token, updated_at: new Date().toISOString() });
      if (error) throw error;
      return json({ access_token: r.access_token, expires_in: r.expires_in });
    }

    if (input.action === 'token') {
      const { data, error } = await table.select('refresh_token').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'not_connected' }, 404);
      const r = await refresh(data.refresh_token);
      if (!r.ok) {
        if (r.revoked) { await table.delete().eq('user_id', user.id); return json({ error: 'reconnect' }, 409); }
        return json({ error: 'google_unavailable' }, 502);
      }
      return json({ access_token: r.access_token, expires_in: r.expires_in });
    }

    if (input.action === 'forget') {
      const { data } = await table.select('refresh_token').eq('user_id', user.id).maybeSingle();
      if (data) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(data.refresh_token)}`, { method: 'POST' }).catch(() => {});
      const { error } = await table.delete().eq('user_id', user.id);
      if (error) throw error;
      return json({ forgotten: true });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    const unauthorized = e instanceof Error && e.message === 'unauthorized';
    return json({ error: unauthorized ? 'unauthorized' : 'google calendar failed' }, unauthorized ? 401 : 500);
  }
});
