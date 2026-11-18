import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface RecentStore {
  /** Mensajes mostrados recientemente (para no repetir). Se guardan los 30 últimos. */
  recent: string[];
  /** Mensaje fijado para cada «día:momento», así no cambia al volver a la pantalla. */
  picks: Record<string, string>;
  remember(id: string): void;
  pin(key: string, id: string): void;
}

export const useRecentMessages = create<RecentStore>()(
  persist(
    (set, get) => ({
      recent: [],
      picks: {},
      remember(id) {
        if (get().recent[0] === id) return;
        set({ recent: [id, ...get().recent.filter((x) => x !== id)].slice(0, 30) });
      },
      pin(key, id) {
        if (get().picks[key] === id) return;
        // Solo se conservan las fijaciones del mismo día.
        const day = key.split(':')[0]!;
        const picks = Object.fromEntries(Object.entries(get().picks).filter(([k]) => k.startsWith(`${day}:`)));
        set({ picks: { ...picks, [key]: id } });
      },
    }),
    { name: 'nebula-motivation-recent', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
