import { router } from 'expo-router';
import { useShareIntent } from 'expo-share-intent';
import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * «Compartir → Nebula» desde cualquier app: el texto o enlace abre la captura rápida ya rellena.
 * Se monta con la sesión iniciada; lo compartido antes de entrar se procesa al llegar aquí.
 */
export function ShareIntentHandler() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({ resetOnBackground: true, disabled: Platform.OS !== 'android' });
  useEffect(() => {
    if (!hasShareIntent) return;
    const text = [shareIntent.text, shareIntent.webUrl].filter((x, i, all): x is string => !!x && all.indexOf(x) === i).join(' ').trim();
    if (text) router.push({ pathname: '/captura', params: { texto: text.slice(0, 1000) } });
    resetShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent]);
  return null;
}
