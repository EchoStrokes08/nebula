import { useLocalSearchParams } from 'expo-router';

import { EventEditor } from '@/features/agenda/EventEditor';
import { isDayKey } from '@/lib/dates';

export default function NuevoEvento() {
  const { dia } = useLocalSearchParams<{ dia?: string }>();
  return <EventEditor presetDay={dia && isDayKey(dia) ? dia : undefined} />;
}
