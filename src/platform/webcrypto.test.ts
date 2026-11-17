import * as ExpoCrypto from 'expo-crypto';

import { installWebCrypto } from './webcrypto.native';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  getRandomValues: jest.fn((a: Uint8Array) => a.fill(7)),
  digest: jest.fn(async () => new Uint8Array([1, 2, 3]).buffer),
}));

describe('installWebCrypto (Android)', () => {
  const original = globalThis.crypto;
  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true, writable: true });
  });

  it('instala getRandomValues y SHA-256 nativos cuando faltan', async () => {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
    installWebCrypto();
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(4));
    expect([...bytes]).toEqual([7, 7, 7, 7]);
    const hash = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode('verifier'));
    expect(new Uint8Array(hash)).toEqual(new Uint8Array([1, 2, 3]));
    expect(ExpoCrypto.digest).toHaveBeenCalledWith('SHA-256', expect.anything());
    await expect(globalThis.crypto.subtle.digest('SHA-1', new Uint8Array())).rejects.toThrow(/no soportado/);
  });

  it('no reemplaza un WebCrypto existente', () => {
    const existing = { getRandomValues: jest.fn(), subtle: { digest: jest.fn() } };
    Object.defineProperty(globalThis, 'crypto', { value: existing, configurable: true, writable: true });
    installWebCrypto();
    expect(globalThis.crypto.subtle).toBe(existing.subtle);
  });
});
