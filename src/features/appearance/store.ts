import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { SkyChoice } from '@/design/sky';

interface AppearanceStore {
  sky: SkyChoice;
  /** Animación del fondo (rotación de la galaxia, estrellas fugaces). */
  livelyBackground: boolean;
  setSky(sky: SkyChoice): void;
  setLively(v: boolean): void;
}

/** Preferencias visuales del dispositivo (no se sincronizan: cada pantalla puede tener su cielo). */
export const useAppearance = create<AppearanceStore>()(
  persist(
    (set) => ({
      sky: 'auto',
      livelyBackground: true,
      setSky: (sky) => set({ sky }),
      setLively: (livelyBackground) => set({ livelyBackground }),
    }),
    { name: 'nebula-appearance', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
