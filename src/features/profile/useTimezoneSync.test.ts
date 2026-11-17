import { shouldAdoptDeviceZone } from './useTimezoneSync';

describe('sincronización de zona horaria', () => {
  it('solo adopta la del dispositivo si el perfil tiene el UTC por defecto', () => {
    expect(shouldAdoptDeviceZone('UTC', 'America/Bogota')).toBe(true);
    expect(shouldAdoptDeviceZone('Europe/Madrid', 'America/Bogota')).toBe(false);
    expect(shouldAdoptDeviceZone('UTC', 'America/Bogota', true)).toBe(false);
    expect(shouldAdoptDeviceZone('UTC', 'UTC')).toBe(false);
    expect(shouldAdoptDeviceZone(undefined, 'America/Bogota')).toBe(false);
  });
});
