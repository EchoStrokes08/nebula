import * as SecureStore from 'expo-secure-store';

import type { KeyValueStorage } from './secureStorage.types';

/** Android: Keystore mediante expo-secure-store. Las claves solo admiten [A-Za-z0-9._-]. */
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export const secureStorage: KeyValueStorage = {
  getItem: (key) => SecureStore.getItemAsync(safeKey(key)),
  setItem: (key, value) => SecureStore.setItemAsync(safeKey(key), value),
  removeItem: (key) => SecureStore.deleteItemAsync(safeKey(key)),
};
