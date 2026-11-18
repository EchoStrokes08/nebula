import Constants from 'expo-constants';

/** Subdirectorio donde se sirve la versión web ('' en la raíz, '/nebula' en GitHub Pages). */
export const webBaseUrl = (((Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)?.baseUrl) ?? '').replace(/\/$/, '');

/** APK publicado junto a la versión web. */
export const apkUrl = `${webBaseUrl}/nebula.apk`;

/** Repositorio público donde cada versión publica el AppImage (Pages no admite archivos > 100 MB). */
export const githubRepo = 'EchoStrokes08/nebula';

/** AppImage de Linux de la última release: GitHub redirige `latest` a la versión más reciente. */
export const linuxAppImageUrl = `https://github.com/${githubRepo}/releases/latest/download/Nebula-linux-x86_64.AppImage`;
