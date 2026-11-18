import { getDesktopBridge } from './desktopBridge';
import type { OAuthAdapter } from './oauth.types';
import { webBaseUrl } from '@/lib/webBase';

/**
 * Escritorio (Electron): navegador del sistema + servidor de retorno en 127.0.0.1 dentro del
 * proceso principal (RFC 8252). Navegador de desarrollo: redirección de página completa.
 */
export const oauth: OAuthAdapter = {
  async prepareRedirect() {
    const desktop = getDesktopBridge();
    if (desktop) return desktop.oauth.listen();
    return `${window.location.origin}${webBaseUrl}/auth/callback`;
  },
  async open(authUrl) {
    const desktop = getDesktopBridge();
    if (desktop) {
      const url = await desktop.oauth.open(authUrl);
      return url ? { type: 'success', url } : { type: 'cancel' };
    }
    window.location.assign(authUrl);
    return { type: 'redirect' };
  },
};
