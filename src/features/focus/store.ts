import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { advance, finish, pause, phaseEndsAt, resume, startTimer, type FocusConfig, type SessionSummary, type TimerState } from '@/domain/focus/timer';
import { uuid } from '@/lib/ids';
import { useAuth } from '@/features/auth/session';
import { notifications } from '@/platform/notifications';

const NOTIF_ID = 'focus-end';

interface FocusStore {
  timer: TimerState | null;
  ownerId: string | null;
  start(config: FocusConfig, links: { habitId?: string | null; taskId?: string | null }): void;
  pause(): void;
  resume(): void;
  /** Pasa a la siguiente fase; devuelve el resumen si la sesión termina (modo libre). */
  next(): SessionSummary | null;
  stop(): SessionSummary | null;
}

/** Programa (o cancela) el aviso del final de la fase actual. */
function syncNotification(t: TimerState | null) {
  void notifications.cancel(NOTIF_ID);
  if (!t) return;
  const end = phaseEndsAt(t);
  if (end === null) return;
  const focus = t.phase === 'focus';
  void notifications.schedule({
    id: NOTIF_ID,
    channel: 'enfoque',
    at: new Date(end),
    title: focus ? 'Bloque de enfoque terminado' : 'Fin del descanso',
    body: focus ? 'Buen trabajo. Tómate el descanso o registra la sesión.' : 'Vuelve al trabajo. El siguiente bloque empieza cuando tú decidas.',
  });
}

/**
 * Sesión activa persistida (AsyncStorage): si la app se cierra, al volver se recupera la sesión
 * con el tiempo correcto porque todo se calcula con marcas de tiempo.
 */
export const useFocus = create<FocusStore>()(
  persist(
    (set, get) => ({
      timer: null,
      ownerId: null,
      start(config, links) {
        const t = startTimer(config, Date.now(), uuid(), links);
        set({ timer: t, ownerId: useAuth.getState().session?.user.id ?? null });
        syncNotification(t);
      },
      pause() {
        const t = get().timer;
        if (!t) return;
        const p = pause(t, Date.now());
        set({ timer: p });
        syncNotification(p);
      },
      resume() {
        const t = get().timer;
        if (!t) return;
        const r = resume(t, Date.now());
        set({ timer: r });
        syncNotification(r);
      },
      next() {
        const t = get().timer;
        if (!t) return null;
        const now = Date.now();
        const n = advance(t, now);
        if (n === null) {
          const summary = finish(t, now);
          set({ timer: null });
          syncNotification(null);
          return summary;
        }
        set({ timer: n });
        syncNotification(n);
        return null;
      },
      stop() {
        const t = get().timer;
        if (!t) return null;
        const summary = finish(t, Date.now());
        set({ timer: null });
        syncNotification(null);
        return summary;
      },
    }),
    { name: 'nebula-focus', storage: createJSONStorage(() => AsyncStorage), partialize: (s) => ({ timer: s.timer, ownerId: s.ownerId }) },
  ),
);

/** Un temporizador nunca se transfiere a otra cuenta al cambiar de sesión. */
export function isolateFocusForUser(uid: string | null) {
  const state = useFocus.getState();
  if (state.timer && state.ownerId !== uid) {
    useFocus.setState({ timer: null, ownerId: uid });
    syncNotification(null);
  }
}
useFocus.persist.onFinishHydration(() => {
  if (useAuth.getState().status !== 'loading') isolateFocusForUser(useAuth.getState().session?.user.id ?? null);
});

/**
 * Escritorio: la mini-ventana de enfoque y la principal comparten almacenamiento (mismo origen).
 * Cuando una cambia la sesión, la otra la vuelve a leer.
 */
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === 'nebula-focus') void useFocus.persist.rehydrate();
  });
}
