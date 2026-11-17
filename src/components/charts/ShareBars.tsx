import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { chartColors, colors, spacing } from '@/design/tokens';

/** Distribución horizontal (barras con etiqueta y porcentaje en texto). */
export function ShareBars({ items, format }: { items: { label: string; value: number; share: number }[]; format(v: number): string }) {
  return (
    <View style={styles.root}>
      {items.map((it, i) => (
        <View key={it.label} style={styles.row} accessible accessibilityLabel={`${it.label}: ${format(it.value)}, ${Math.round(it.share * 100)} por ciento`}>
          <View style={styles.head}>
            <Text variant="callout" numberOfLines={1} style={styles.flex}>{it.label}</Text>
            <Text variant="caption" tone="secondary" tabular>{format(it.value)} · {Math.round(it.share * 100)} %</Text>
          </View>
          <View style={styles.track}>
            <View style={{ width: `${it.share * 100}%`, height: 6, borderRadius: 3, backgroundColor: chartColors[i % chartColors.length] }} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[3] },
  row: { gap: spacing[1] },
  head: { flexDirection: 'row', gap: spacing[2] },
  flex: { flex: 1 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.track },
});
