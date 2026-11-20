import { base64url, fcmMessage, isDeadToken, jwtClaims, parseServiceAccount, pemToDer, shouldPush } from '../../../supabase/functions/push-dispatch/logic';

const prefs = { social: true, quietStart: '22:00', quietEnd: '07:00', tz: 'Europe/Madrid' };

describe('shouldPush', () => {
  it('respeta el interruptor social', () => {
    expect(shouldPush({ ...prefs, social: false }, new Date('2026-11-20T11:00:00Z'))).toBe(false);
  });
  it('silencio que cruza medianoche, en la hora local', () => {
    expect(shouldPush(prefs, new Date('2026-11-20T11:00:00Z'))).toBe(true); // 12:00 Madrid
    expect(shouldPush(prefs, new Date('2026-11-20T22:30:00Z'))).toBe(false); // 23:30 Madrid
    expect(shouldPush(prefs, new Date('2026-11-20T05:30:00Z'))).toBe(false); // 06:30 Madrid
    expect(shouldPush(prefs, new Date('2026-11-20T06:30:00Z'))).toBe(true); // 07:30 Madrid
  });
  it('sin horas de silencio siempre avisa', () => {
    expect(shouldPush({ ...prefs, quietStart: null, quietEnd: null }, new Date('2026-11-20T22:30:00Z'))).toBe(true);
  });
});

it('fcmMessage abre Notificaciones, usa el canal social y recorta el texto', () => {
  const m = fcmMessage('tok', { id: 'n1', title: 'x'.repeat(200), body: 'hola' }).message;
  expect(m.token).toBe('tok');
  expect(m.notification.title).toHaveLength(120);
  expect(m.data).toEqual({ notificationId: 'n1', route: '/notificaciones' });
  expect(m.android.notification).toMatchObject({ channel_id: 'social', tag: 'social-n1' });
});

it('isDeadToken solo borra tokens realmente inválidos', () => {
  expect(isDeadToken(404, '{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}')).toBe(true);
  expect(isDeadToken(400, 'The registration token is not a valid FCM registration token')).toBe(true);
  expect(isDeadToken(400, 'Invalid value at message.android.priority')).toBe(false);
  expect(isDeadToken(500, 'internal')).toBe(false);
});

it('parseServiceAccount valida la forma del JSON', () => {
  expect(parseServiceAccount(undefined)).toBeNull();
  expect(parseServiceAccount('{"project_id":"p"}')).toBeNull();
  const sa = parseServiceAccount(JSON.stringify({ project_id: 'p', client_email: 'a@p.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nAAEC\n-----END PRIVATE KEY-----\n' }));
  expect(sa?.project_id).toBe('p');
  expect(jwtClaims(sa!, 1000)).toMatchObject({ iss: 'a@p.iam.gserviceaccount.com', iat: 1000, exp: 4600, scope: 'https://www.googleapis.com/auth/firebase.messaging' });
  expect([...pemToDer(sa!.private_key)]).toEqual([0, 1, 2]);
});

it('base64url sin relleno ni caracteres de URL', () => {
  expect(base64url(new Uint8Array([251, 255, 191]))).toBe('-_-_');
  expect(base64url('{"a":1}')).toBe('eyJhIjoxfQ');
});
