import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import type { OAuthAdapter } from './oauth.types';

/** Android: pestaña segura del navegador (Custom Tabs) y vuelta por deep link `nebula://`. */
export const oauth: OAuthAdapter = {
  async prepareRedirect() {
    return Linking.createURL('auth/callback');
  },
  async open(authUrl, redirectUrl) {
    const r = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    return r.type === 'success' ? { type: 'success', url: r.url } : { type: 'cancel' };
  },
};
