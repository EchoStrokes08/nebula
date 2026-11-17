import { router } from 'expo-router';
import { Check, ExternalLink, Pencil, Plus } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { useContextMenu } from '@/components/overlays/ContextMenu';
import { useToast } from '@/components/overlays/UndoToast';
import { ProgressRing } from '@/components/progress/ProgressRing';
import { Text } from '@/components/primitives/Text';
import { colors, hitTarget, motion, radius, spacing, userColors } from '@/design/tokens';
import { targetAt } from '@/domain/habits/evaluate';
import { platformHaptics } from '@/platform/haptics';
import { openInSplit, useSplit } from '@/features/system/split';

import { percent, progressText } from './format';
import type { HabitSummary } from './hooks';
import { newClientId, useLogHabit, useUndoLog } from './hooks';
import { HabitIcon } from './icons';
import { LogSheet } from './LogSheet';

/** Fila de hábito con registro rápido según su tipo (DISENO_UI_UX §5.9). */
export function HabitRow({ s, today }: { s: HabitSummary; today: import('@/lib/dates').DayKey }) {
  const { habit, current } = s;
  const color = userColors[habit.color] ?? colors.accentBright;
  const period = targetAt(habit, today)?.period ?? 'day';
  const [sheet, setSheet] = useState(false);
  const log = useLogHabit();
  const undo = useUndoLog();
  const toast = useToast((t) => t.show);
  const done = current.status === 'met';
  const paused = current.status === 'paused';
  const notToday = current.status === 'notScheduled';
  // Animación de completado: pulso breve del botón al pasar a «cumplido».
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const wasDone = useRef(done);
  useEffect(() => {
    if (done && !wasDone.current && !reduced) scale.value = withSequence(withTiming(1.18, { duration: motion.fast }), withTiming(1, { duration: motion.base }));
    wasDone.current = done;
  }, [done, reduced, scale]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const record = (value: number, note: string | null = null) => {
    const clientId = newClientId();
    log.mutate(
      { clientId, habitId: habit.id, dayKey: today, value, note },
      { onError: () => toast('No se pudo guardar el registro. Revisa la conexión.') },
    );
    platformHaptics.success();
    toast(`${habit.name}: registrado`, () => undo.mutate(clientId));
  };

  const quick = () => {
    if (habit.kind === 'binary') {
      if (done) {
        // Desmarcar: elimina los registros de hoy (con deshacer implícito: se puede volver a marcar).
        s.todayLogs.forEach((l) => undo.mutate(l.id));
        return;
      }
      record(1);
    } else if (habit.kind === 'frequency') record(1);
    else setSheet(true);
  };

  const selected = useSplit((st) => st.active.habit && st.selected.habit === habit.id);
  const open = () => { if (!openInSplit('habit', habit.id)) router.push({ pathname: '/habito/[id]', params: { id: habit.id } }); };
  const ctx = useContextMenu(habit.name, [
    { label: 'Abrir', icon: ExternalLink, onSelect: open },
    ...(!paused ? [{ label: 'Registrar…', icon: Plus, onSelect: () => setSheet(true) }] : []),
    { label: 'Editar', icon: Pencil, onSelect: () => router.push({ pathname: '/habito/editar/[id]', params: { id: habit.id } }) },
  ]);

  const quickLabel =
    habit.kind === 'binary' ? (done ? `Desmarcar ${habit.name}` : `Marcar ${habit.name} como hecho`) : `Registrar ${habit.name}`;

  return (
    <View style={[styles.row, selected && styles.rowSelected]}>
      <Pressable
        style={(st: { pressed: boolean; hovered?: boolean }) => [styles.main, (st.pressed || st.hovered) && styles.mainHover]}
        onPress={open}
        accessibilityState={{ selected }}
        {...ctx.triggerProps}
        accessibilityRole="button"
        accessibilityLabel={`${habit.name}. ${progressText(habit.kind, habit.unit, current, period)}`}
      >
        <ProgressRing progress={habit.kind === 'reduction' ? 0 : current.progress} color={color} size={42} label={`Progreso de ${habit.name}`}>
          <HabitIcon name={habit.icon} size={18} color={color} strokeWidth={1.8} />
        </ProgressRing>
        <View style={styles.text}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {habit.name}
          </Text>
          <Text variant="caption" tone={paused || notToday ? 'tertiary' : 'secondary'} numberOfLines={1}>
            {paused
              ? 'En pausa'
              : notToday
                ? 'Hoy no toca'
                : progressText(habit.kind, habit.unit, current, period)}
            {s.consistency30.ratio !== null ? `  ·  ${percent(s.consistency30.ratio)} constancia` : ''}
          </Text>
        </View>
      </Pressable>
      {!paused ? (
        <Animated.View style={pop}>
        <Pressable
          onPress={quick}
          accessibilityRole={habit.kind === 'binary' ? 'checkbox' : 'button'}
          accessibilityState={habit.kind === 'binary' ? { checked: done } : undefined}
          aria-checked={habit.kind === 'binary' ? done : undefined}
          accessibilityLabel={quickLabel}
          style={(st: { pressed: boolean; hovered?: boolean; focused?: boolean }) => [
            styles.action,
            done && { backgroundColor: color, borderColor: color },
            (st.pressed || st.hovered) && !done && styles.actionHover,
            st.focused && Platform.OS === 'web' && styles.focus,
          ]}
        >
          {habit.kind === 'binary' ? (
            <Check size={20} color={done ? colors.bg : colors.textTertiary} strokeWidth={2.4} />
          ) : (
            <Plus size={20} color={done ? colors.bg : colors.textSecondary} strokeWidth={2} />
          )}
        </Pressable>
        </Animated.View>
      ) : null}
      <LogSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        habitName={habit.name}
        kind={habit.kind}
        unit={habit.unit ?? null}
        onSubmit={(v, note) => record(v, note)}
      />
      {ctx.menu}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingRight: spacing[3],
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowSelected: { borderColor: colors.accentBright, backgroundColor: colors.accentMuted },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radius.lg },
  mainHover: { backgroundColor: 'rgba(199, 169, 255, 0.04)' },
  text: { flex: 1, gap: 2 },
  action: {
    width: hitTarget,
    height: hitTarget,
    borderRadius: hitTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  actionHover: { backgroundColor: colors.surfaceRaised },
  focus: { outlineColor: colors.borderFocus, outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 2 } as object,
});
