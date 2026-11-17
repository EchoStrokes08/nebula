import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/useReducedMotion';

import { motion, spacing } from '@/design/tokens';
import type { DayKey } from '@/lib/dates';

import { HabitRow } from './HabitRow';
import type { HabitSummary } from './hooks';

export function HabitList({ items, today }: { items: HabitSummary[]; today: DayKey }) {
  const reduced = useReducedMotion();
  return (
    <View style={styles.list}>
      {items.map((s, i) => (
        // Entrada escalonada breve (≤ 350 ms en total por fila); sin animación con movimiento reducido.
        <Animated.View
          key={s.habit.id}
          entering={reduced ? undefined : FadeInDown.duration(motion.base).delay(Math.min(i, 6) * 30)}
          layout={reduced ? undefined : LinearTransition.duration(motion.base)}
        >
          <HabitRow s={s} today={today} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ list: { gap: spacing[2] } });

/** Hábitos que tocan hoy: activos, no pausados y programados (o de periodo semanal/mensual). */
export const isForToday = (s: HabitSummary) =>
  !s.habit.archived && s.current.status !== 'paused' && s.current.status !== 'notScheduled' && s.current.status !== 'beforeStart';
