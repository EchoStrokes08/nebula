import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { formatDuration } from '@/lib/time';
import { isPhaseOver, remainingMs } from '@/domain/focus/timer';
import { notifications } from '@/platform/notifications';

import { useFocusSound } from './settings';
import { pauseFocusSound, playFocusSound, stopFocusSound } from './sounds';
import { useFocus } from './store';

const BLUR_GRACE_MS = 20_000;
const REMIND_EVERY_MS = 5 * 60_000;

/**
 * Acompaña a la sesión de enfoque esté donde esté el usuario dentro de la app:
 * - sonido de fondo solo durante los bloques de enfoque (se calla en pausas y descansos);
 * - en escritorio, un recordatorio amable si cambias de ventana en pleno bloque.
 * No pinta nada.
 */
export function FocusAmbience() {
  const timer = useFocus((s) => s.timer);
  const sound = useFocusSound((s) => s.sound);

  // Sonido: se reevalúa cada 5 s para callarse al acabar el bloque aunque nadie toque nada.
  useEffect(() => {
    if (!timer) { stopFocusSound(); return; }
    const sync = () => {
      const focusing = timer.phase === 'focus' && timer.pausedAt === null && !isPhaseOver(timer, Date.now());
      if (focusing && sound !== 'none') void playFocusSound(sound);
      else if (sound === 'none') stopFocusSound();
      else pauseFocusSound();
    };
    sync();
    const id = setInterval(sync, 5000);
    return () => clearInterval(id);
  }, [timer, sound]);
  useEffect(() => () => stopFocusSound(), []);

  // Bloqueo suave en escritorio: no cierra nada, solo recuerda que el bloque sigue en marcha.
  const lastReminder = useRef(0);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !timer) return;
    let pending: ReturnType<typeof setTimeout> | undefined;
    const onBlur = () => {
      clearTimeout(pending);
      pending = setTimeout(() => {
        const t = useFocus.getState().timer;
        if (!t || t.phase !== 'focus' || t.pausedAt !== null || isPhaseOver(t, Date.now())) return;
        if (Date.now() - lastReminder.current < REMIND_EVERY_MS) return;
        lastReminder.current = Date.now();
        const left = Math.max(1, Math.round(remainingMs(t, Date.now()) / 60_000));
        void notifications.show('Sigues en tu bloque de enfoque', `Quedan ${formatDuration(left)}. Vuelve cuando puedas: lo demás puede esperar.`);
      }, BLUR_GRACE_MS);
    };
    const onFocus = () => clearTimeout(pending);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => { clearTimeout(pending); window.removeEventListener('blur', onBlur); window.removeEventListener('focus', onFocus); };
  }, [timer]);

  return null;
}
