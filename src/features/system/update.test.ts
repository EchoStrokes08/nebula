import { Platform } from 'react-native';

import { checkForUpdate, isNewer } from './update';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.2.0' } } }));

const reply = (body: unknown, ok = true) => jest.fn().mockResolvedValue({ ok, json: async () => body }) as unknown as typeof fetch;

describe('aviso de versión nueva', () => {
  const os = Platform.OS;
  afterEach(() => { Platform.OS = os; });

  it('compara versiones numéricamente', () => {
    expect(isNewer('1.10.0', '1.9.0')).toBe(true);
    expect(isNewer('1.2.0', '1.2.0')).toBe(false);
    expect(isNewer('1.1.9', '1.2.0')).toBe(false);
  });

  it('en Android avisa solo si la publicada es más nueva y tolera fallos', async () => {
    Platform.OS = 'android';
    await expect(checkForUpdate(reply({ version: '1.3.0', notes: 'Mejoras' }))).resolves.toEqual({ current: '1.2.0', latest: '1.3.0', notes: 'Mejoras' });
    await expect(checkForUpdate(reply({ version: '1.2.0' }))).resolves.toBeNull();
    await expect(checkForUpdate(reply({ version: 'roto' }))).resolves.toBeNull();
    await expect(checkForUpdate(reply({}, false))).resolves.toBeNull();
    await expect(checkForUpdate(jest.fn().mockRejectedValue(new Error('sin red')) as unknown as typeof fetch)).resolves.toBeNull();
  });

  it('en la web del navegador no avisa: ya es siempre la última', async () => {
    Platform.OS = 'web';
    const send = reply({ version: '9.0.0' });
    await expect(checkForUpdate(send)).resolves.toBeNull();
    expect(send).not.toHaveBeenCalled();
  });
});
