import { useEffect } from 'react';
import { router } from 'expo-router';
import * as Actions from 'expo-quick-actions';
import { useQuickActionCallback } from 'expo-quick-actions/hooks';
export function QuickActions() {
  useQuickActionCallback((action) => {
    if (action.id === 'capture') router.push('/captura');
    if (action.id === 'focus') router.push('/enfoque');
    if (action.id === 'today') router.navigate('/hoy');
  });
  useEffect(() => {
    void Actions.isSupported().then((supported) => supported ? Actions.setItems([
      { id: 'capture', title: 'Captura rápida', params: { href: '/captura' } },
      { id: 'focus', title: 'Iniciar enfoque', params: { href: '/enfoque' } },
      { id: 'today', title: 'Ver mi día', params: { href: '/hoy' } },
    ]) : undefined).catch(() => {});
  }, []);
  return null;
}
