import { useLocalSearchParams } from 'expo-router';

import { TaskEditor } from '@/features/tasks/TaskEditor';

export default function NuevaTarea() {
  const { meta } = useLocalSearchParams<{ meta?: string }>();
  return <TaskEditor presetGoalId={meta} />;
}
