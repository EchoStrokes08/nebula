import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Mensajes mostrados recientemente (para no repetir). Se guardan los 30 últimos. */
export const useRecentMessages = create<{ recent: string[]; remember(id: string): void }>()(
  persist(
    (set, get) => ({
      recent: [],
      remember(id) {
        if (get().recent[0] === id) return;
        set({ recent: [id, ...get().recent.filter((x) => x !== id)].slice(0, 30) });
      },
    }),
    { name: 'nebula-motivation-recent', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
