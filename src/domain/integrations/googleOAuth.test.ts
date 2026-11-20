import { buildGoogleAuthUrl, GOOGLE_CALENDAR_SCOPE, GOOGLE_RELAY_URL, grantedCalendar, makeState, parseGoogleRedirect, parseState } from './googleOAuth';

const NONCE = 'abcdefghijklmnop1234';

describe('estado OAuth', () => {
  it('codifica destino y nonce', () => {
    expect(parseState(makeState('a', NONCE))).toEqual({ target: 'a', nonce: NONCE });
  });
  it('rechaza destinos o nonces raros', () => {
    expect(parseState('x.' + NONCE)).toBeNull();
    expect(parseState('w.corto')).toBeNull();
    expect(parseState('w.' + NONCE + '/../')).toBeNull();
    expect(parseState(null)).toBeNull();
    expect(() => makeState('w', 'corto')).toThrow();
  });
});

describe('buildGoogleAuthUrl', () => {
  it('pide solo lectura del calendario con retorno a la página puente', () => {
    const u = new URL(buildGoogleAuthUrl({ clientId: 'id.apps.googleusercontent.com', state: makeState('w', NONCE) }));
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(u.searchParams.get('redirect_uri')).toBe(GOOGLE_RELAY_URL);
    expect(u.searchParams.get('response_type')).toBe('token');
    expect(u.searchParams.get('scope')).toBe(GOOGLE_CALENDAR_SCOPE);
    expect(u.searchParams.get('prompt')).toBeNull();
  });
});

describe('parseGoogleRedirect', () => {
  const now = 1_000_000;
  it('lee el token de la query o del fragmento', () => {
    const r = parseGoogleRedirect(`nebula://google-calendar?access_token=tok&expires_in=3599&state=a.${NONCE}&scope=${encodeURIComponent(GOOGLE_CALENDAR_SCOPE)}`, now);
    expect(r).toEqual({ ok: true, accessToken: 'tok', expiresAt: now + 3539_000, state: `a.${NONCE}`, scopes: [GOOGLE_CALENDAR_SCOPE] });
    const h = parseGoogleRedirect(`https://x/oauth#access_token=t2&state=w.${NONCE}`, now);
    expect(h.ok && h.accessToken).toBe('t2');
  });
  it('traduce la cancelación y los errores', () => {
    expect(parseGoogleRedirect(`x?error=access_denied&state=w.${NONCE}`)).toEqual({ ok: false, error: 'cancelled', state: `w.${NONCE}` });
    expect(parseGoogleRedirect('x?state=w.' + NONCE).ok).toBe(false);
  });
  it('detecta si se desmarcó el permiso del calendario', () => {
    expect(grantedCalendar([GOOGLE_CALENDAR_SCOPE, 'email'])).toBe(true);
    expect(grantedCalendar(['email'])).toBe(false);
  });
});
