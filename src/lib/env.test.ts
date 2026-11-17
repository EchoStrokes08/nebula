import { readEnv } from './env';

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
const jwt = (role: string) => `${b64({ alg: 'HS256' })}.${b64({ role })}.firma-de-prueba`;

describe('readEnv', () => {
  it('informa de las variables que faltan', () => {
    const r = readEnv({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing.sort()).toEqual(['EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_URL']);
  });

  it('acepta una configuración válida con clave anon', () => {
    const r = readEnv({ EXPO_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt('anon') });
    expect(r.ok).toBe(true);
  });

  it('rechaza una clave service_role en el cliente', () => {
    expect(() =>
      readEnv({ EXPO_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: jwt('service_role') }),
    ).toThrow(/service_role/);
  });

  it('acepta una clave publishable y rechaza una sb_secret_', () => {
    const url = 'https://abc.supabase.co';
    expect(readEnv({ EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_' + 'x'.repeat(30) }).ok).toBe(true);
    expect(() => readEnv({ EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_' + 'x'.repeat(30) })).toThrow(/service_role/);
  });

  it('detecta el modo de vista previa de desarrollo', () => {
    expect(readEnv({ EXPO_PUBLIC_DEV_PREVIEW_UI: '1' }).devPreview).toBe(true);
  });
});
