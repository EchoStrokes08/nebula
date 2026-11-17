import { router } from 'expo-router';
import { Plus, Repeat } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { GoalsShortcut } from '@/features/goals/GoalsShortcut';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Chip } from '@/components/forms/Chip';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, spacing } from '@/design/tokens';
import { HabitList, isForToday } from '@/features/habits/HabitList';
import { HabitDetail } from '@/features/habits/HabitDetail';
import { useHabitSummaries } from '@/features/habits/hooks';
import { setSplitActive, SPLIT_MIN_WIDTH, useSplit } from '@/features/system/split';
import { SkeletonList } from '@/components/feedback/Skeleton';
import { ErrorState } from '@/components/feedback/ErrorState';

type Segment = 'hoy' | 'todos' | 'pausados' | 'archivados';
const SEGMENTS: { value: Segment; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'todos', label: 'Todos' },
  { value: 'pausados', label: 'Pausados' },
  { value: 'archivados', label: 'Archivados' },
];

export default function HabitosScreen() {
  const { summaries, today, isLoading, error, refetch } = useHabitSummaries();
  const [segment, setSegment] = useState<Segment>('hoy');
  const split = useWindowDimensions().width >= SPLIT_MIN_WIDTH;
  const selected = useSplit((st) => st.selected.habit);
  useEffect(() => { setSplitActive('habit', split); return () => setSplitActive('habit', false); }, [split]);
  const create = <Button label="Nuevo" icon={<Plus size={18} color={colors.textOnAccent} />} onPress={() => router.push('/habito/nuevo')} />;

  const items = (summaries ?? []).filter((s) => {
    if (segment === 'archivados') return s.habit.archived;
    if (s.habit.archived) return false;
    if (segment === 'pausados') return s.current.status === 'paused';
    if (segment === 'hoy') return isForToday(s);
    return true;
  });

  const list = (
    <Screen title="Hábitos" trailing={create} wide={split}>
      <GoalsShortcut />
      <View style={styles.segments} accessibilityRole="radiogroup">
        {SEGMENTS.map((s) => (
          <Chip key={s.value} role="radio" label={s.label} selected={segment === s.value} onToggle={() => setSegment(s.value)} />
        ))}
      </View>
      {isLoading ? (
        <SkeletonList rows={4} />
      ) : error ? (
        <ErrorState title="No se pudieron cargar tus hábitos" onRetry={() => refetch()} />
      ) : (summaries?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Repeat size={28} color={colors.accentSoft} strokeWidth={1.6} />}
          title="Todavía no hay hábitos"
          description="Empieza por uno pequeño que puedas cumplir incluso en un mal día."
          action={<Button label="Crear mi primer hábito" onPress={() => router.push('/habito/nuevo')} />}
        />
      ) : items.length === 0 ? (
        <Text tone="secondary">
          {segment === 'hoy' ? 'Hoy no tienes hábitos programados.' : segment === 'pausados' ? 'No hay hábitos en pausa.' : 'No hay hábitos archivados.'}
        </Text>
      ) : (
        <HabitList items={items} today={today} />
      )}
    </Screen>
  );
  if (!split) return list;
  return (
    <View style={styles.columns}>
      <View style={styles.listCol}>{list}</View>
      <View style={styles.detailCol}>
        {selected ? <HabitDetail key={selected} id={selected} embedded /> : (
          <View style={styles.placeholder}><EmptyState title="Elige un hábito" description="Su progreso, historial y estadísticas aparecerán aquí." /></View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  columns: { flex: 1, flexDirection: 'row' },
  listCol: { flex: 5, minWidth: 380 },
  detailCol: { flex: 6, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border },
  placeholder: { flex: 1, justifyContent: 'center' },
});
