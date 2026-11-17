import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    // Sin acción, el lector de pantalla lo anuncia como una sola unidad; con acción, el botón
    // debe seguir siendo enfocable por separado.
    <View style={styles.root} accessibilityRole="summary" accessible={!action}>
      {icon ? <View style={styles.orb}>{icon}</View> : null}
      <Text variant="title3" style={styles.center}>
        {title}
      </Text>
      {description ? (
        <Text variant="callout" tone="secondary" style={[styles.center, styles.description]}>
          {description}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[10], paddingHorizontal: spacing[6], borderRadius: radius.xl, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  center: { textAlign: 'center' },
  orb: { width: 72, height: 72, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(128, 85, 232, 0.22)', borderWidth: 1, borderColor: 'rgba(169, 135, 255, 0.45)', shadowColor: colors.accentBright, shadowOpacity: 0.8, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  description: { maxWidth: 360 },
});
