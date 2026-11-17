import { StyleSheet, View } from 'react-native';

import { StatTile } from '@/components/charts/StatTile';
import { Card } from '@/components/primitives/Card';
import { Text } from '@/components/primitives/Text';
import { spacing } from '@/design/tokens';
import { compare, dailyCompletion, periodStats } from '@/domain/stats/stats';
import { useFocusSessions } from '@/features/agenda/hooks';
import { percent } from '@/features/habits/format';
import { useHabitsData } from '@/features/habits/hooks';
import { useTimeZone } from '@/features/habits/useToday';
import { useTasks } from '@/features/tasks/hooks';
import { addDays, dayKeyOf, type DayKey } from '@/lib/dates';
import { formatDuration } from '@/lib/time';

/** Resumen semanal sin IA (F09-010): solo datos registrados, comparados con la semana anterior. */
export function WeeklySummary({ from, to, today }: { from: DayKey; to: DayKey; today: DayKey }) {
  const tz = useTimeZone();
  const { habits, logs } = useHabitsData();
  const tasks = useTasks();
  const focus = useFocusSessions();
  if (!habits.data || !logs.data || !tasks.data || !focus.data) return null;
  const end = to > today ? today : to;
  const withLogs = habits.data.map((h) => ({ ...h, logs: logs.data!.filter((l) => l.habitId === h.id) }));
  const input = {
    completion: dailyCompletion(withLogs, addDays(from, -7), end, today),
    focus: focus.data.filter((f) => f.endedAt).map((f) => ({ day: dayKeyOf(new Date(f.startedAt), tz), minutes: Math.round(f.focusedSeconds / 60) })),
    tasksDone: tasks.data.filter((t) => t.completedAt).map((t) => ({ day: dayKeyOf(new Date(t.completedAt!), tz) })),
  };
  const current = periodStats(input, from, end);
  const previous = periodStats(input, addDays(from, -7), addDays(end, -7));
  const delta = compare(current, previous);
  const empty = current.completionRate === null && current.focusMinutes === 0 && current.tasksCompleted === 0;
  return (
    <Card>
      <Text variant="title3">Resumen de la semana</Text>
      {empty ? (
        <Text tone="secondary">Esta semana todavía no hay registros. El resumen se construye solo con lo que registras.</Text>
      ) : (
        <>
          <View style={styles.tiles}>
            <StatTile label="Hábitos cumplidos" value={percent(current.completionRate)} delta={delta.completion} deltaLabel={delta.completion !== null ? `${Math.abs(Math.round(delta.completion * 100))} pts` : undefined} />
            <StatTile label="Enfoque" value={formatDuration(current.focusMinutes)} delta={delta.focus} />
            <StatTile label="Tareas completadas" value={String(current.tasksCompleted)} delta={delta.tasks} />
          </View>
          <Text variant="caption" tone="tertiary">{current.activeDays} {current.activeDays === 1 ? 'día' : 'días'} con actividad. Comparado con los mismos días de la semana anterior.</Text>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({ tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] } });
