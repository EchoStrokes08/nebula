import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, spacing } from '@/design/tokens';
import { addDays, startOfWeek, type DayKey } from '@/lib/dates';

/** Mapa de consistencia de 53 semanas: intensidad = proporción cumplida del día (null = sin datos). */
export function YearHeatmap({ today, weekStartsOn, rateFor, summary }: { today: DayKey; weekStartsOn: number; rateFor(day: DayKey): number | null; summary: string }) {
  const first = addDays(startOfWeek(today, weekStartsOn), -7 * 52);
  const fill = (r: number | null) => (r === null ? colors.track : r === 0 ? 'rgba(169, 135, 255, 0.12)' : `rgba(169, 135, 255, ${0.3 + r * 0.7})`);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} style={styles.root}>
      {/* En web se ve la barra: el ratón no desplaza en horizontal y así no queda nada oculto. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS === 'web'} contentContainerStyle={styles.grid}>
        {Array.from({ length: 53 }, (_, w) => (
          <View key={w} style={styles.col}>
            {Array.from({ length: 7 }, (_, d) => {
              const day = addDays(first, w * 7 + d);
              return <View key={d} style={[styles.cell, { backgroundColor: day > today ? 'transparent' : fill(rateFor(day)) }]} />;
            })}
          </View>
        ))}
      </ScrollView>
      <View style={styles.legend}>
        <Text variant="caption" tone="tertiary">Menos</Text>
        {[null, 0.25, 0.6, 1].map((r, i) => <View key={i} style={[styles.cell, { backgroundColor: fill(r) }]} />)}
        <Text variant="caption" tone="tertiary">Más</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[2] },
  grid: { flexDirection: 'row', gap: 3 },
  col: { gap: 3 },
  cell: { width: 11, height: 11, borderRadius: 2 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
});
