import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/primitives/Button';
import { spacing } from '@/design/tokens';
import { HabitEditor } from '@/features/habits/HabitEditor';
import { useHabitsData } from '@/features/habits/hooks';
import { SkeletonList } from '@/components/feedback/Skeleton';

export default function EditarHabito() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { habits } = useHabitsData();
  const habit = habits.data?.find((h) => h.id === id);
  if (habits.isLoading) return <View style={styles.center}><SkeletonList rows={3} /></View>;
  if (!habit) {
    return (
      <View style={styles.center}>
        <EmptyState title="Este hábito ya no existe" />
        <Button label="Volver" variant="secondary" onPress={() => router.replace('/habitos')} />
      </View>
    );
  }
  return <HabitEditor key={habit.id} habit={habit} />;
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4], padding: spacing[6] } });
