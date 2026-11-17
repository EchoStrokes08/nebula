import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';

/** Marca permanente del modo de vista previa: deja claro que no hay datos reales ni servidor. */
export function PreviewBadge() {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="none" style={[styles.badge, { top: insets.top + spacing[2] }]} accessibilityRole="text">
      <Text variant="caption" tone="warning">
        Vista previa de desarrollo · sin servidor
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    backgroundColor: colors.warningMuted,
    borderWidth: 1,
    borderColor: 'rgba(242, 184, 102, 0.3)',
  },
});
