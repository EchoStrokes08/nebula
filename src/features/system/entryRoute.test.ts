import { entryRoute } from './entryRoute';

describe('entryRoute', () => {
  it('lleva cada estado a una ruta existente', () => {
    expect(entryRoute('app')).toBe('/hoy');
    expect(entryRoute('auth')).toBe('/bienvenida');
    expect(entryRoute('onboarding')).toBe('/bienvenido');
    expect(entryRoute('recovery')).toBe('/nueva-contrasena');
    expect(entryRoute('loading')).toBeNull();
  });
});
