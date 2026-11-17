import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/primitives/Button';
import { spacing } from '@/design/tokens';
import { EventEditor } from '@/features/agenda/EventEditor';
import { useEvents } from '@/features/agenda/hooks';
import { SkeletonList } from '@/components/feedback/Skeleton';

export default function EventoDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const events = useEvents();
  const event = events.data?.find((e) => e.id === id);
  if (events.isLoading) return <View style={styles.center}><SkeletonList rows={3} /></View>;
  if (!event) {
    return (
      <View style={styles.center}>
        <EmptyState title="Este evento ya no existe" />
        <Button label="Volver" variant="secondary" onPress={() => router.replace('/agenda')} />
      </View>
    );
  }
  return <EventEditor key={event.id} event={event} />;
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4], padding: spacing[6] } });
