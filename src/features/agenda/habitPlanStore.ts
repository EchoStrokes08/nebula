import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { addDays, type DayKey } from '@/lib/dates';

/** Hora planificada de un hábito en un día concreto (minutos locales). */
export interface HabitBlock {
  start: number;
  end: number;
}

interface HabitPlanStore {
  /** `día → hábito → bloque`. Solo se guardan días recientes y futuros. */
  plans: Record<string, Record<string, HabitBlock>>;
  setDay(day: DayKey, blocks: Record<string, HabitBlock>, today: DayKey): void;
}

/**
 * Bloques de hábitos aceptados en Planificar. No cambian la hora de recordatorio del hábito (que
 * vale para todos los días): solo colocan el hábito ese día en la agenda. Se guardan en el
 * dispositivo; los días pasados se descartan solos.
 */
export const useHabitPlans = create<HabitPlanStore>()(
  persist(
    (set, get) => ({
      plans: {},
      setDay(day, blocks, today) {
        const keepFrom = addDays(today, -1);
        const plans = Object.fromEntries(Object.entries(get().plans).filter(([d]) => d >= keepFrom && d !== day));
        set({ plans: { ...plans, ...(Object.keys(blocks).length ? { [day]: { ...get().plans[day], ...blocks } } : {}) } });
      },
    }),
    { name: 'nebula-habit-plans', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
