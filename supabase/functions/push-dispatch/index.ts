import { createClient } from '@supabase/supabase-js';

import { json } from '../_shared/http.ts';
import { base64url, fcmMessage, isDeadToken, jwtClaims, parseServiceAccount, pemToDer, shouldPush, type ServiceAccount } from './logic.ts';

/**
 * Envía por Firebase Cloud Messaging cada notificación social nueva. Solo la llama el trigger
 * `notifications_push` (pg_net), con la cabecera `x-push-secret`.
 * Secretos: PUSH_DISPATCH_SECRET y FIREBASE_SERVICE_ACCOUNT (JSON de la cuenta de servicio).
 */
let cached: { token: string; exp: number } | null = null;

async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 60 > now) return cached.token;
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify(jwtClaims(sa, now)))}`;
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${base64url(sig)}` }),
  });
  if (!res.ok) throw new Error(`oauth ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, exp: now + data.expires_in };
  return data.access_token;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('PUSH_DISPATCH_SECRET');
  if (req.method !== 'POST' || !secret || req.headers.get('x-push-secret') !== secret) return json({ error: 'unauthorized' }, 401);
  const sa = parseServiceAccount(Deno.env.get('FIREBASE_SERVICE_ACCOUNT'));
  if (!sa) return json({ error: 'push not configured' }, 503);

  let id: unknown;
  try { id = (await req.json())?.notification_id; } catch { /* cuerpo inválido */ }
  if (typeof id !== 'string') return json({ error: 'bad request' }, 400);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: n } = await db.from('notifications').select('id, user_id, title, body, read_at').eq('id', id).maybeSingle();
  if (!n || n.read_at) return json({ sent: 0, reason: 'gone' });

  const [{ data: prefs }, { data: profile }, { data: tokens }] = await Promise.all([
    db.from('user_preferences').select('notifications, quiet_hours_start, quiet_hours_end').eq('user_id', n.user_id).maybeSingle(),
    db.from('profiles').select('timezone').eq('id', n.user_id).maybeSingle(),
    db.from('push_tokens').select('token').eq('user_id', n.user_id),
  ]);
  if (!tokens?.length) return json({ sent: 0, reason: 'no tokens' });
  const allowed = shouldPush({
    social: (prefs?.notifications as { social?: boolean } | null)?.social ?? true,
    quietStart: (prefs?.quiet_hours_start as string | null)?.slice(0, 5) ?? null,
    quietEnd: (prefs?.quiet_hours_end as string | null)?.slice(0, 5) ?? null,
    tz: (profile?.timezone as string | undefined) ?? 'UTC',
  }, new Date());
  if (!allowed) return json({ sent: 0, reason: 'muted' });

  const bearer = await accessToken(sa);
  let sent = 0;
  for (const { token } of tokens) {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(fcmMessage(token, { id: n.id, title: n.title, body: n.body ?? '' })),
    });
    if (res.ok) { sent++; continue; }
    const text = await res.text();
    if (isDeadToken(res.status, text)) await db.from('push_tokens').delete().eq('token', token);
    else console.error('fcm', res.status, text.slice(0, 300));
  }
  return json({ sent });
});
