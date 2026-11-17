import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';

/** Indicador con variación respecto al periodo anterior (la flecha no es el único portador: hay texto). */
export function StatTile({ label, value, delta, deltaLabel }: { label: string; value: string; delta?: number | null; deltaLabel?: string }) {
  const tone = delta === null || delta === undefined ? 'tertiary' : delta >= 0 ? 'success' : 'warning';
  const deltaText =
    delta === null || delta === undefined ? 'sin periodo anterior' : `${delta >= 0 ? '▲' : '▼'} ${deltaLabel ?? `${Math.abs(Math.round(delta * 100))} %`} vs. anterior`;
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}. ${deltaText.replace('▲', 'sube').replace('▼', 'baja')}`}>
      <Text variant="caption" tone="secondary">{label}</Text>
      <Text variant="metric" tabular>{value}</Text>
      <Text variant="caption" tone={tone}>{deltaText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flexGrow: 1, flexBasis: 150, gap: 2, padding: spacing[4], borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderTopColor: colors.cardHighlight, borderLeftWidth: 3, borderLeftColor: colors.accentBright },
});
