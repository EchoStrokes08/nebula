/** Lógica pura de push-dispatch (sin APIs de Deno): se prueba con Jest desde src/. */

export interface PushPrefs {
  social: boolean;
  quietStart: string | null;
  quietEnd: string | null;
  tz: string;
}

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Minutos del día en la zona del usuario. */
export function localMinutes(now: Date, tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    return Number(parts.find((p) => p.type === 'hour')?.value ?? 0) * 60 + Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  } catch {
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }
}

/** Misma regla que la app: avisos sociales activados y fuera de las horas de silencio. */
export function shouldPush(p: PushPrefs, now: Date): boolean {
  if (!p.social) return false;
  if (!p.quietStart || !p.quietEnd) return true;
  const s = minutesOf(p.quietStart);
  const e = minutesOf(p.quietEnd);
  if (s === e) return true;
  const m = localMinutes(now, p.tz);
  const quiet = s < e ? m >= s && m < e : m >= s || m < e;
  return !quiet;
}

export interface NotificationRow {
  id: string;
  title: string;
  body: string;
}

/** Mensaje FCM v1. El `tag` evita duplicados si la misma notificación se envía dos veces. */
export function fcmMessage(token: string, n: NotificationRow) {
  return {
    message: {
      token,
      notification: { title: n.title.slice(0, 120), body: n.body.slice(0, 400) },
      data: { notificationId: n.id, route: '/notificaciones' },
      android: { priority: 'high', notification: { channel_id: 'social', tag: `social-${n.id}`, color: '#8055E8' } },
    },
  };
}

/** El token ya no sirve (app desinstalada o token rotado): se borra. */
export function isDeadToken(status: number, body: string): boolean {
  // Un error del propio mensaje (también INVALID_ARGUMENT) no debe borrar un token bueno.
  return status === 404 || /UNREGISTERED/.test(body) || (status === 400 && /registration token/i.test(body));
}

export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Partial<ServiceAccount>;
    return j.project_id && j.client_email && j.private_key?.includes('PRIVATE KEY') ? (j as ServiceAccount) : null;
  } catch {
    return null;
  }
}

/** Reclamaciones del JWT con el que la cuenta de servicio pide un token OAuth a Google. */
export function jwtClaims(sa: ServiceAccount, nowSec: number) {
  return {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: nowSec,
    exp: nowSec + 3600,
  };
}

export function base64url(bytes: Uint8Array | string): string {
  const b = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function pemToDer(pem: string): Uint8Array {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
