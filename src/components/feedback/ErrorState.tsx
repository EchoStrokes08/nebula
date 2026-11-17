import { CloudOff, TriangleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, spacing } from '@/design/tokens';

/** Error recuperable: explica qué pasó en lenguaje claro y ofrece reintentar. */
export function ErrorState({ title = 'No se pudo cargar', message, onRetry, offline }: { title?: string; message?: string; onRetry?: () => void; offline?: boolean }) {
  const Glyph = offline ? CloudOff : TriangleAlert;
  return (
    <View style={styles.root}>
      <Glyph size={28} color={offline ? colors.textSecondary : colors.warning} accessibilityElementsHidden importantForAccessibility="no" />
      <View accessible accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.text}>
        <Text variant="title3" style={styles.center}>{offline ? 'Sin conexión' : title}</Text>
        <Text variant="callout" tone="secondary" style={styles.center}>
          {message ?? (offline ? 'Tus registros se guardan y se enviarán al volver la conexión.' : 'Comprueba la conexión e inténtalo de nuevo.')}
        </Text>
      </View>
      {onRetry ? <Button label="Reintentar" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[8], paddingHorizontal: spacing[6] },
  text: { alignItems: 'center', gap: spacing[2] },
  center: { textAlign: 'center', maxWidth: 360 },
});
