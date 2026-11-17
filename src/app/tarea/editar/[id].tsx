import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/primitives/Button';
import { spacing } from '@/design/tokens';
import { useTasks } from '@/features/tasks/hooks';
import { TaskEditor } from '@/features/tasks/TaskEditor';
import { SkeletonList } from '@/components/feedback/Skeleton';

export default function EditarTarea() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tasks = useTasks();
  const task = tasks.data?.find((t) => t.id === id);
  if (tasks.isLoading) return <View style={styles.center}><SkeletonList rows={3} /></View>;
  if (!task) {
    return (
      <View style={styles.center}>
        <EmptyState title="Esta tarea ya no existe" />
        <Button label="Volver" variant="secondary" onPress={() => router.replace('/agenda')} />
      </View>
    );
  }
  return <TaskEditor key={task.id} task={task} />;
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4], padding: spacing[6] } });
