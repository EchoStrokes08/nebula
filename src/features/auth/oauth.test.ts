import { parseCallbackUrl } from './oauth';

describe('parseCallbackUrl', () => {
  it('lee el código PKCE de la query', () => {
    expect(parseCallbackUrl('nebula://auth/callback?code=abc123')).toEqual({ code: 'abc123', error: undefined });
    expect(parseCallbackUrl('http://127.0.0.1:47913/auth/callback?code=x&state=y')).toEqual({ code: 'x', error: undefined });
  });

  it('lee errores en query o fragmento', () => {
    expect(parseCallbackUrl('nebula://auth/callback?error=access_denied&error_description=Cancelado').error).toBe('Cancelado');
    expect(parseCallbackUrl('nebula://auth/callback#error=server_error').error).toBe('server_error');
  });
});
