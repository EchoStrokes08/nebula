import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';

export function FormMessage({ tone, children }: { tone: 'danger' | 'success' | 'info'; children: string }) {
  const bg = tone === 'danger' ? colors.dangerMuted : tone === 'success' ? colors.successMuted : colors.infoMuted;
  return (
    <View style={[styles.box, { backgroundColor: bg }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text variant="callout" tone={tone}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: spacing[3], borderRadius: radius.md },
});
