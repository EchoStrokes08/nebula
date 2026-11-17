import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';

/** Cabecera de sección con icono en una órbita de color: da ritmo visual entre bloques de texto. */
export function SectionHeader({ icon: Icon, title, meta, color = colors.accentBright }: { icon: LucideIcon; title: string; meta?: string; color?: string }) {
  return (
    <View style={styles.row}>
      <View style={[styles.orb, { borderColor: color, shadowColor: color }]}>
        <Icon size={16} color={color} strokeWidth={2.2} />
      </View>
      <Text variant="title3" accessibilityRole="header" style={styles.title}>{title}</Text>
      {meta ? <Text variant="callout" tone="secondary" tabular>{meta}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  orb: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(24, 18, 42, 0.9)', borderWidth: 1, shadowOpacity: 0.7, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 4 },
  title: { flex: 1 },
});
