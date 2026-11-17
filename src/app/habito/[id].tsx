import { useLocalSearchParams } from 'expo-router';

import { HabitDetail } from '@/features/habits/HabitDetail';

export default function HabitoDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HabitDetail id={id} />;
}
