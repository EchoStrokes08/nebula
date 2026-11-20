import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { FocusSound } from './sounds';
import { clampPomodoro, DEFAULT_POMODORO, type PomodoroSettings } from '@/domain/focus/pomodoro';

interface PomodoroStore {
  settings: PomodoroSettings;
  set(patch: Partial<PomodoroSettings>): void;
  reset(): void;
}

/** Duraciones del Pomodoro elegidas por el usuario (en este dispositivo). */
export const usePomodoroSettings = create<PomodoroStore>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_POMODORO,
      set: (patch) => set({ settings: clampPomodoro({ ...get().settings, ...patch }) }),
      reset: () => set({ settings: DEFAULT_POMODORO }),
    }),
    {
      name: 'nebula-pomodoro',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => ({ ...current, settings: clampPomodoro((persisted as Partial<PomodoroStore> | undefined)?.settings) }),
    },
  ),
);

interface SoundStore {
  sound: FocusSound;
  setSound(sound: FocusSound): void;
}

/** Sonido de fondo elegido para las sesiones de enfoque (en este dispositivo). */
export const useFocusSound = create<SoundStore>()(
  persist(
    (set) => ({ sound: 'none', setSound: (sound) => set({ sound }) }),
    { name: 'nebula-focus-sound', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
