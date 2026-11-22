import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';
import { z } from 'zod';

import { publishedApkUrl, updateInfoUrl } from '@/lib/webBase';
import { getDesktopBridge } from '@/platform/desktopBridge';

/** Versión de esta app (app.json, incrustada en el APK y en el build web). */
export const appVersion = (): string => Constants.expoConfig?.version ?? '0.0.0';

const parts = (v: string) => v.split('.').map((n) => Number.parseInt(n, 10) || 0);
export function isNewer(latest: string, current: string): boolean {
  const a = parts(latest); const b = parts(current);
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return false;
}

const infoSchema = z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/), notes: z.string().max(500).catch('') }).loose();

export interface UpdateOffer { current: string; latest: string; notes: string }

/**
 * ¿Hay una versión más nueva publicada? Solo en Android y en escritorio: la web del navegador
 * ya es siempre la última. Cualquier fallo (sin red, JSON raro) se trata como «no hay».
 */
export async function checkForUpdate(send: typeof fetch = fetch): Promise<UpdateOffer | null> {
  const desktop = getDesktopBridge();
  if (desktop) {
    if (!desktop.update) return null;
    const r = await desktop.update.check().catch(() => null);
    return r ? { current: r.current, latest: r.latest, notes: r.notes } : null;
  }
  if (Platform.OS !== 'android') return null;
  try {
    const r = await send(`${updateInfoUrl}?t=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
    if (!r.ok) return null;
    const info = infoSchema.safeParse(await r.json());
    if (!info.success || !isNewer(info.data.version, appVersion())) return null;
    return { current: appVersion(), latest: info.data.version, notes: info.data.notes };
  } catch { return null; }
}

export type InstallResult = 'installing' | 'opened' | 'error';

/** Instalador nativo de Nebula (Android 1.4.2+); null en APKs antiguos, la web y los tests. */
async function nativeInstaller() {
  if (Platform.OS !== 'android') return null;
  try { return (await import('../../../modules/nebula-installer')).NebulaInstaller; } catch { return null; }
}

/**
 * Android: ¿la actualización se puede instalar sin que la persona confirme nada? Requiere Android 12+
 * y que la versión instalada la haya instalado la propia Nebula (la primera vez siempre se confirma).
 */
export async function canInstallSilently(): Promise<boolean> {
  const native = await nativeInstaller();
  try { return native?.canInstallSilently() ?? false; } catch { return false; }
}

/** Android: con datos móviles (o una red marcada como de pago) no se descarga nada sin pedirlo. */
export async function isMeteredConnection(): Promise<boolean> {
  try {
    const NetInfo = (await import('@react-native-community/netinfo')).default;
    const state = await NetInfo.fetch();
    return state.type === 'cellular' || state.details?.isConnectionExpensive === true;
  } catch { return false; }
}

/** Android: descarga el APK de `version` a la caché (o reutiliza el ya descargado) y devuelve su URI. */
export async function downloadApk(version: string): Promise<string> {
  const { Directory, File, Paths } = await import('expo-file-system');
  const dir = new Directory(Paths.cache, 'actualizaciones');
  if (!dir.exists) dir.create({ intermediates: true });
  const target = new File(dir, `nebula-${version}.apk`);
  if (target.exists && (target.size ?? 0) > 5 * 1024 * 1024) return target.uri;
  // Borra descargas de otras versiones para no acumular APKs.
  for (const entry of dir.list()) entry.delete();
  try {
    const apk = await File.downloadFileAsync(`${publishedApkUrl}?v=${version}`, target, { idempotent: true });
    return apk.uri;
  } catch (e) {
    if (target.exists) target.delete();
    throw e;
  }
}

/** Android: abre el instalador del sistema con el APK (método de las versiones ≤1.4.1). */
async function openSystemInstaller(uri: string): Promise<void> {
  const { File } = await import('expo-file-system');
  const IntentLauncher = await import('expo-intent-launcher');
  // FLAG_GRANT_READ_URI_PERMISSION (1): el instalador necesita leer el archivo de la app.
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: new File(uri).contentUri, type: 'application/vnd.android.package-archive', flags: 1 });
}

/**
 * Android: instala el APK descargado. Con el instalador nativo la sesión deja a Nebula como su propia
 * instaladora, y desde Android 12 las siguientes actualizaciones ya no piden confirmación. El resultado
 * llega por `onInstallStatus`. Si el módulo no existe, abre el instalador del sistema.
 */
export async function installApk(uri: string, { fallback = false } = {}): Promise<void> {
  const native = fallback ? null : await nativeInstaller();
  if (native) await native.install(uri);
  else await openSystemInstaller(uri);
}

export type InstallStatus = 'success' | 'pendingUserAction' | 'aborted' | 'failure';
/** Android: estado de la instalación nativa en curso. Devuelve la función para dejar de escuchar. */
export async function onInstallStatus(listener: (status: InstallStatus, message: string | null) => void): Promise<() => void> {
  const native = await nativeInstaller();
  if (!native) return () => undefined;
  const sub = native.addListener('onStatus', (e) => listener(e.status, e.message));
  return () => sub.remove();
}

/**
 * Instalación manual con un toque. Android: descarga el APK e instala. Escritorio: el proceso
 * principal prepara la actualización y reinicia. Si algo falla, abre la descarga en el navegador.
 */
export async function installUpdate(version?: string): Promise<InstallResult> {
  const desktop = getDesktopBridge();
  if (desktop?.update) {
    const r = await desktop.update.install().catch(() => ({ status: 'error' as const }));
    return r.status === 'restarting' ? 'installing' : r.status === 'opened' ? 'opened' : 'error';
  }
  if (Platform.OS !== 'android') return 'error';
  try {
    await installApk(await downloadApk(version ?? 'ultima'));
    return 'installing';
  } catch {
    await Linking.openURL(publishedApkUrl).catch(() => undefined);
    return 'opened';
  }
}
