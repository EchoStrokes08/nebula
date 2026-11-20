import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, fontFamily, radius, spacing } from '@/design/tokens';

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
      {icon ? (
        <View style={styles.system} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.ringOuter} />
          <View style={styles.ringInner} />
          <View style={styles.planet} />
          <View style={styles.moon} />
          <View style={styles.orb}>{icon}</View>
        </View>
      ) : null}
      <Text style={[styles.title, styles.center]}>
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
  root: { alignItems: 'center', gap: spacing[3], paddingTop: spacing[8], paddingBottom: spacing[10], paddingHorizontal: spacing[6], borderRadius: radius.xl, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  center: { textAlign: 'center' },
  system: { width: 148, height: 112, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[1] },
  ringOuter: { position: 'absolute', width: 148, height: 64, borderRadius: 74, borderWidth: 1, borderColor: colors.hairline, transform: [{ rotate: '-14deg' }] },
  ringInner: { position: 'absolute', width: 108, height: 108, borderRadius: 54, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(199, 169, 255, 0.22)' },
  planet: { position: 'absolute', right: 6, top: 30, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.star, shadowColor: colors.star, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  moon: { position: 'absolute', left: 30, bottom: 4, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.info, opacity: 0.8 },
  orb: { width: 64, height: 64, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(37, 27, 57, 0.95)', borderWidth: 1, borderColor: 'rgba(169, 135, 255, 0.45)', shadowColor: colors.accentBright, shadowOpacity: 0.6, shadowRadius: 22, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  title: { fontFamily: fontFamily.serif, fontSize: 28, lineHeight: 32, color: colors.text },
  description: { maxWidth: 360 },
});
