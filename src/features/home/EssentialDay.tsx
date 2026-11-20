import AsyncStorage from '@react-native-async-storage/async-storage';
import { Leaf } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlassCard } from '@/components/primitives/GlassCard';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, spacing } from '@/design/tokens';
import { essentials } from '@/domain/planning/essentials';
import { formatNumber, unitLabel } from '@/features/habits/format';
import { HabitList } from '@/features/habits/HabitList';
import type { HabitSummary } from '@/features/habits/hooks';
import type { Task } from '@/features/tasks/api';
import { toPlanTasks } from '@/features/tasks/planTasks';
import { TaskRow } from '@/features/tasks/TaskRow';
import type { DayKey } from '@/lib/dates';

const KEY = 'nebula.essential.v1';

/** Modo «solo lo esencial»: vale para el día en que se activa y se apaga solo al día siguiente. */
export function useEssentialMode(today: DayKey): [boolean, (on: boolean) => void] {
  const [day, setDay] = useState<string | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(KEY).then(setDay).catch(() => undefined);
  }, []);
  const set = (on: boolean) => {
    setDay(on ? today : null);
    void (on ? AsyncStorage.setItem(KEY, today) : AsyncStorage.removeItem(KEY)).catch(() => undefined);
  };
  return [day === today, set];
}

/** Como mucho tres cosas, con el motivo de cada una. Nada se borra ni se aplaza. */
export function EssentialDay({ habits, tasks, today, onExit }: { habits: HabitSummary[]; tasks: Task[]; today: DayKey; onExit: () => void }) {
  const picked = useMemo(() => {
    const pendingHabits = habits.filter((s) => s.current.status !== 'met');
    return essentials(
      toPlanTasks(tasks, today),
      pendingHabits.map((s) => ({
        id: s.habit.id,
        name: s.habit.name,
        priority: s.habit.priority,
        streak: s.streak.current,
        minimum: s.recovery ? (s.habit.kind === 'binary' ? 'una vez' : `${formatNumber(s.recovery.suggestedTarget)} ${unitLabel(s.habit.kind, s.habit.unit)}`) : null,
      })),
    );
  }, [habits, tasks, today]);
  const doneToday = habits.filter((s) => s.current.status === 'met').length;

  return (
    <View style={styles.root}>
      <GlassCard edge="rgba(111, 214, 160, 0.45)" style={styles.head} accessibilityRole="summary">
        <View style={styles.row}>
          <Leaf size={16} color={colors.success} />
          <Text variant="overline" tone="success">SOLO LO ESENCIAL</Text>
        </View>
        <Text variant="title3">
          {picked.length === 0 ? 'Hoy no hay nada urgente. Descansa sin culpa.' : picked.length === 1 ? 'Solo una cosa importa hoy.' : `Solo ${picked.length} cosas importan hoy.`}
        </Text>
        <Text variant="callout" tone="secondary">Lo demás puede esperar a mañana. Un paso pequeño también cuenta{doneToday ? ` · ya llevas ${doneToday} hecho${doneToday === 1 ? '' : 's'}` : ''}.</Text>
      </GlassCard>

      {picked.map((item) => (
        <View key={`${item.kind}-${item.id}`} style={styles.item}>
          <Text variant="caption" tone="tertiary">{item.reason}</Text>
          {item.kind === 'task' ? (
            (() => { const t = tasks.find((x) => x.id === item.id); return t ? <TaskRow task={t} today={today} /> : null; })()
          ) : (
            <HabitList items={habits.filter((s) => s.habit.id === item.id)} today={today} />
          )}
        </View>
      ))}

      <Button label="Ver todo mi día" variant="ghost" onPress={onExit} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[4] },
  head: { padding: spacing[5], gap: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  item: { gap: spacing[1] },
});
