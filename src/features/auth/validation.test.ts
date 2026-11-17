import { authErrorMessage } from './errors';
import { newPasswordSchema, signUpSchema, validate } from './validation';

describe('validación de cuentas', () => {
  it('normaliza y acepta un registro válido', () => {
    const r = validate(signUpSchema, {
      displayName: ' Camila ',
      handle: 'Camila_R',
      email: ' Camila@Example.com ',
      password: 'estrella2026',
    });
    expect(r).toEqual({
      ok: true,
      data: { displayName: 'Camila', handle: 'camila_r', email: 'camila@example.com', password: 'estrella2026' },
    });
  });

  it('devuelve un mensaje por campo', () => {
    const r = validate(signUpSchema, { displayName: '', handle: 'a!', email: 'no', password: 'corta' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(['displayName', 'email', 'handle', 'password']);
      expect(r.errors.password).toBe('Usa al menos 10 caracteres.');
    }
  });

  it('exige letras y números y que las contraseñas coincidan', () => {
    expect(validate(signUpSchema, { displayName: 'A', handle: 'abc', email: 'a@b.co', password: 'soloLetrasAqui' }).ok).toBe(false);
    const r = validate(newPasswordSchema, { password: 'nebula12345', confirm: 'nebula12346' });
    expect(!r.ok && r.errors.confirm).toBe('Las contraseñas no coinciden.');
  });

  it('traduce errores de Auth sin revelar si el correo existe', () => {
    expect(authErrorMessage({ code: 'invalid_credentials' })).toMatch(/no son correctos/);
    expect(authErrorMessage({ status: 429 })).toMatch(/Demasiados intentos/);
    expect(authErrorMessage({ code: 'user_already_exists' })).not.toMatch(/existe/);
  });
});
