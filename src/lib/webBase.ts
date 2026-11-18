import Constants from 'expo-constants';

/** Subdirectorio donde se sirve la versión web ('' en la raíz, '/nebula' en GitHub Pages). */
export const webBaseUrl = (((Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)?.baseUrl) ?? '').replace(/\/$/, '');

/** APK publicado junto a la versión web. */
export const apkUrl = `${webBaseUrl}/nebula.apk`;
