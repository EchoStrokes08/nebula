import { getDesktopBridge } from './desktopBridge';
import type { KeyValueStorage } from './secureStorage.types';

/**
 * Escritorio (Electron): cifrado con `safeStorage` en el proceso principal.
 * Navegador de desarrollo: localStorage (no se distribuye como producto).
 */
export function createWebSecureStorage(): KeyValueStorage {
  const desktop = getDesktopBridge();
  if (desktop) {
    return {
      getItem: (key) => desktop.secureStore.get(key),
      setItem: async (key, value) => {
        await desktop.secureStore.set(key, value);
      },
      removeItem: (key) => desktop.secureStore.remove(key),
    };
  }
  return {
    getItem: async (key) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(key)),
    setItem: async (key, value) => {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    },
    removeItem: async (key) => {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    },
  };
}

export const secureStorage: KeyValueStorage = createWebSecureStorage();
