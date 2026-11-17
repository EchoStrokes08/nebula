import * as ExpoCrypto from 'expo-crypto';

/**
 * Hermes no trae WebCrypto. Sin él, supabase-js generaría el verificador PKCE con Math.random
 * y usaría el método `plain`. Aquí se expone el subconjunto necesario respaldado por el
 * generador aleatorio seguro y el SHA-256 nativos del sistema.
 */
export function installWebCrypto(): void {
  const g = globalThis as { crypto?: Partial<Crypto> };
  const current = g.crypto ?? {};
  const getRandomValues = current.getRandomValues ?? (<T extends ArrayBufferView | null>(a: T): T => ExpoCrypto.getRandomValues(a as never) as T);
  const subtle =
    current.subtle ??
    ({
      digest: async (algorithm: AlgorithmIdentifier, data: BufferSource) => {
        const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
        if (name.toUpperCase() !== 'SHA-256') throw new Error(`Algoritmo no soportado: ${name}`);
        return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data);
      },
    } as unknown as SubtleCrypto);
  g.crypto = { ...current, getRandomValues, subtle } as Crypto;
}
