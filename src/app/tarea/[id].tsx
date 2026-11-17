import { useLocalSearchParams } from 'expo-router';

import { TaskDetail } from '@/features/tasks/TaskDetail';

export default function TareaDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TaskDetail id={id} />;
}
