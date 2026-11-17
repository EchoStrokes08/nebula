import { resolveGate, type AuthSnapshot } from './gate';

const env = { ok: true as const, env: { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'x'.repeat(30) }, devPreview: false };
const auth = (p: Partial<AuthSnapshot>): AuthSnapshot => ({ status: 'signedIn', onboarded: true, recovery: false, ...p });

describe('resolveGate', () => {
  it('sin servidor: configuración o vista previa explícita', () => {
    expect(resolveGate({ ok: false, missing: ['X'], devPreview: false })).toBe('config');
    expect(resolveGate({ ok: false, missing: ['X'], devPreview: true })).toBe('preview');
  });

  it('sigue el estado de la sesión', () => {
    expect(resolveGate(env, auth({ status: 'loading' }))).toBe('loading');
    expect(resolveGate(env, auth({ status: 'signedOut' }))).toBe('auth');
    expect(resolveGate(env, auth({ onboarded: null }))).toBe('loading');
    expect(resolveGate(env, auth({ onboarded: false }))).toBe('onboarding');
    expect(resolveGate(env, auth({}))).toBe('app');
  });

  it('un enlace de recuperación obliga a fijar contraseña antes de entrar', () => {
    expect(resolveGate(env, auth({ recovery: true }))).toBe('recovery');
  });

  it('la vista previa nunca se activa si hay servidor configurado', () => {
    expect(resolveGate({ ...env, devPreview: true }, auth({ status: 'signedOut' }))).toBe('auth');
  });
});
