import Constants from 'expo-constants';

/** Subdirectorio donde se sirve la versión web ('' en la raíz, '/nebula' en GitHub Pages). */
export const webBaseUrl = (((Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)?.baseUrl) ?? '').replace(/\/$/, '');

/** APK publicado junto a la versión web. */
export const apkUrl = `${webBaseUrl}/nebula.apk`;

/** Repositorio público donde cada versión publica el AppImage (Pages no admite archivos > 100 MB). */
export const githubRepo = 'EchoStrokes08/nebula';

/** AppImage de Linux de la última release: GitHub redirige `latest` a la versión más reciente. */
export const linuxAppImageUrl = `https://github.com/${githubRepo}/releases/latest/download/Nebula-linux-x86_64.AppImage`;

/**
 * Instalador web de Windows, publicado junto a la versión web: pesa <1 MB y descarga el paquete de
 * la app (~110 MB, no cabe en Pages) desde la release de su versión.
 */
export const windowsInstallerUrl = `${webBaseUrl}/Nebula-Setup.exe`;

/** Web publicada (GitHub Pages): allí viven `version.json` y el APK de la última versión. */
export const pagesUrl = 'https://echostrokes08.github.io/nebula';
export const updateInfoUrl = `${pagesUrl}/version.json`;
export const publishedApkUrl = `${pagesUrl}/nebula.apk`;
