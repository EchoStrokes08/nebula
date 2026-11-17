import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/primitives/Button';
import { spacing } from '@/design/tokens';
import { GoalEditor } from '@/features/goals/GoalEditor';
import { useGoals } from '@/features/goals/hooks';
import { SkeletonList } from '@/components/feedback/Skeleton';

export default function EditarMeta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const goals = useGoals();
  const goal = goals.data?.find((g) => g.id === id);
  if (goals.isLoading) return <View style={styles.center}><SkeletonList rows={3} /></View>;
  if (!goal) {
    return (
      <View style={styles.center}>
        <EmptyState title="Esta meta ya no existe" />
        <Button label="Volver" variant="secondary" onPress={() => router.replace('/metas')} />
      </View>
    );
  }
  return <GoalEditor key={goal.id} goal={goal} />;
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4], padding: spacing[6] } });
