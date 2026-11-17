import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { spacing } from '@/design/tokens';

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
      {icon}
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
  root: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[10], paddingHorizontal: spacing[6] },
  center: { textAlign: 'center' },
  description: { maxWidth: 360 },
});
