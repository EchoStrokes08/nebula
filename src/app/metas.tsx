import { router } from 'expo-router';
import { Flag, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Chip } from '@/components/forms/Chip';
import { formatDay } from '@/components/forms/DateField';
import { Screen } from '@/components/layout/Screen';
import { ProgressBar } from '@/components/progress/ProgressBar';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing, userColors } from '@/design/tokens';
import { useGoalSummaries } from '@/features/goals/hooks';
import { useToday } from '@/features/habits/useToday';
import { SkeletonList } from '@/components/feedback/Skeleton';

type Filter = 'activas' | 'completadas' | 'todas';

export default function MetasScreen() {
  const { summaries, isLoading, error, refetch } = useGoalSummaries();
  const today = useToday();
  const [filter, setFilter] = useState<Filter>('activas');
  const items = (summaries ?? []).filter((s) =>
    filter === 'activas' ? s.goal.status === 'active' || s.goal.status === 'paused' : filter === 'completadas' ? s.goal.status === 'completed' : true,
  );

  return (
    <Screen
      back={{ fallback: '/hoy' }}
      title="Metas y proyectos"
      trailing={
        <View style={styles.row}>
          <Button label="Proyecto" variant="secondary" onPress={() => router.push({ pathname: '/meta/nueva', params: { tipo: 'proyecto' } })} />
          <Button label="Meta" icon={<Plus size={18} color={colors.textOnAccent} />} onPress={() => router.push('/meta/nueva')} />
        </View>
      }
    >
      <View style={styles.wrap}>
        {(['activas', 'completadas', 'todas'] as Filter[]).map((f) => (
          <Chip key={f} role="radio" label={f[0]!.toUpperCase() + f.slice(1)} selected={filter === f} onToggle={() => setFilter(f)} />
        ))}
      </View>
      {isLoading ? (
        <SkeletonList rows={3} />
      ) : error ? (
        <EmptyState title="No se pudieron cargar tus metas" action={<Button label="Reintentar" variant="secondary" onPress={() => refetch()} />} />
      ) : (summaries?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Flag size={28} color={colors.accentSoft} strokeWidth={1.6} />}
          title="Define hacia dónde vas"
          description="Una meta convierte tus hábitos y tareas en un resultado concreto. Un proyecto la divide en etapas con dependencias."
          action={<Button label="Crear mi primera meta" onPress={() => router.push('/meta/nueva')} />}
        />
      ) : items.length === 0 ? (
        <Text tone="secondary">Nada en este filtro.</Text>
      ) : (
        <View style={styles.list}>
          {items.map(({ goal, progress }) => (
            <Pressable
              key={goal.id}
              onPress={() => router.push({ pathname: '/meta/[id]', params: { id: goal.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${goal.title}. ${progress.ratio === null ? 'Sin progreso medible' : `${Math.round(progress.ratio * 100)} por ciento`}`}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View style={styles.cardHead}>
                <Text variant="overline" style={{ color: userColors[goal.color] }}>
                  {goal.kind === 'project' ? 'PROYECTO' : 'META'}
                  {goal.status === 'paused' ? ' · EN PAUSA' : goal.status === 'completed' ? ' · COMPLETADA' : goal.status === 'abandoned' ? ' · ABANDONADA' : ''}
                </Text>
                {goal.targetDate ? <Text variant="caption" tone={goal.targetDate < today && goal.status === 'active' ? 'danger' : 'tertiary'}>{formatDay(goal.targetDate, today)}</Text> : null}
              </View>
              <Text variant="title3">{goal.title}</Text>
              <ProgressBar progress={progress.ratio ?? 0} color={userColors[goal.color]} />
              <Text variant="caption" tone="secondary" tabular>
                {progress.ratio === null ? 'Sin progreso medible todavía' : `${Math.round(progress.ratio * 100)} % · ${progress.value} de ${progress.target}`}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[2] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  list: { gap: spacing[3] },
  card: { gap: spacing[2], padding: spacing[5], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pressed: { backgroundColor: colors.surfacePressed },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between' },
});
