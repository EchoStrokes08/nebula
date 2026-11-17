import { router } from 'expo-router';
import { View } from 'react-native';
import { Text } from '@/components/primitives/Text';
import { Button } from '@/components/primitives/Button';
import { syncPendingLogs, useConnection } from '@/data/offline/runtime';
import { colors, spacing } from '@/design/tokens';

export function OfflineBanner() {
  const { online, pending, error } = useConnection();
  if (online && !pending && !error) return null;
  return <View style={{ padding: spacing[3], backgroundColor: colors.surfaceRaised }} accessibilityLiveRegion="polite">
    <Text variant="caption">{!online ? 'Sin conexión. Puedes consultar los datos guardados y registrar hábitos.' : 'Sincronizando registros…'}{pending ? ` ${pending} pendientes.` : ''}</Text>
    {pending ? <Button label="Ver registros pendientes" variant="ghost" onPress={() => router.push('/sincronizacion')} /> : null}
    {error ? <><Text variant="caption" tone="danger">{error}</Text><Button label="Reintentar sincronización" variant="ghost" onPress={() => void syncPendingLogs()} /></> : null}
  </View>;
}
