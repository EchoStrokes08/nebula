/**
 * Permiso de Google Calendar con un cliente OAuth propio (no el de Supabase), para que Google
 * pueda verificar la app: la única dirección de retorno es una página de Nebula en GitHub Pages
 * (`oauth-google.html`), que reenvía el token a la app según el destino codificado en `state`:
 *   w → la versión web, a → la app de Android (nebula://), d → el escritorio (loopback 127.0.0.1).
 * Flujo implícito (sin secreto de cliente): el token dura ~1 h y solo permite leer el calendario.
 */
export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
export const GOOGLE_RELAY_URL = 'https://echostrokes08.github.io/nebula/oauth-google.html';

export type GoogleTarget = 'w' | 'a' | 'd';

const STATE_RE = /^([wad])\.([A-Za-z0-9_-]{16,64})$/;

export function makeState(target: GoogleTarget, nonce: string): string {
  const state = `${target}.${nonce}`;
  if (!STATE_RE.test(state)) throw new Error('Estado OAuth no válido');
  return state;
}

export function parseState(state: string | null | undefined): { target: GoogleTarget; nonce: string } | null {
  const m = STATE_RE.exec(state ?? '');
  return m ? { target: m[1] as GoogleTarget, nonce: m[2]! } : null;
}

export function buildGoogleAuthUrl(opts: { clientId: string; state: string; prompt?: 'consent' | 'select_account' }): string {
  const q = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: GOOGLE_RELAY_URL,
    response_type: 'token',
    scope: GOOGLE_CALENDAR_SCOPE,
    include_granted_scopes: 'true',
    state: opts.state,
  });
  if (opts.prompt) q.set('prompt', opts.prompt);
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export type GoogleRedirect =
  | { ok: true; accessToken: string; expiresAt: number; state: string; scopes: string[] }
  | { ok: false; error: string; state?: string };

/** Lee el token (o el error) de la URL a la que la página puente devolvió el control. */
export function parseGoogleRedirect(url: string, now = Date.now()): GoogleRedirect {
  const q = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0]! : '';
  const h = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const p = new URLSearchParams([q, h].filter(Boolean).join('&'));
  const state = p.get('state') ?? undefined;
  const error = p.get('error');
  if (error) return { ok: false, error: error === 'access_denied' ? 'cancelled' : error, state };
  const token = p.get('access_token');
  if (!token || !state) return { ok: false, error: 'Google no devolvió un permiso de acceso.', state };
  const scopes = (p.get('scope') ?? '').split(' ').filter(Boolean);
  const seconds = Number(p.get('expires_in')) || 3600;
  // Margen de un minuto para no usar un token a punto de caducar.
  return { ok: true, accessToken: token, expiresAt: now + Math.max(0, seconds - 60) * 1000, state, scopes };
}

/** ¿Concedió el permiso del calendario? (Google deja desmarcar la casilla en la pantalla de permisos). */
export function grantedCalendar(scopes: string[]): boolean {
  return scopes.length === 0 || scopes.includes(GOOGLE_CALENDAR_SCOPE);
}
