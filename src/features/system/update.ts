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

/**
 * Android: descarga el APK y abre el instalador del sistema (la persona confirma «Actualizar»;
 * la primera vez Android pide permitir instalar apps desde Nebula). Si algo falla, abre la
 * descarga en el navegador. Escritorio: el proceso principal sustituye el AppImage y reinicia.
 */
export async function installUpdate(onProgress?: (ratio: number) => void): Promise<InstallResult> {
  const desktop = getDesktopBridge();
  if (desktop?.update) {
    const r = await desktop.update.install().catch(() => ({ status: 'error' as const }));
    return r.status === 'restarting' ? 'installing' : r.status === 'opened' ? 'opened' : 'error';
  }
  if (Platform.OS !== 'android') return 'error';
  try {
    const { File, Paths } = await import('expo-file-system');
    const IntentLauncher = await import('expo-intent-launcher');
    const target = new File(Paths.cache, 'nebula-update.apk');
    if (target.exists) target.delete();
    onProgress?.(0);
    const apk = await File.downloadFileAsync(`${publishedApkUrl}?t=${Date.now()}`, target, { idempotent: true });
    onProgress?.(1);
    // FLAG_GRANT_READ_URI_PERMISSION (1): el instalador necesita leer el archivo de la app.
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: apk.contentUri, type: 'application/vnd.android.package-archive', flags: 1 });
    return 'installing';
  } catch {
    await Linking.openURL(publishedApkUrl).catch(() => undefined);
    return 'opened';
  }
}
