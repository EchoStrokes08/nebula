import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
