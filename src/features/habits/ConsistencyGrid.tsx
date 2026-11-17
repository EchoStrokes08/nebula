import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, spacing } from '@/design/tokens';
import { addDays, startOfWeek, type DayKey } from '@/lib/dates';

type Cell = 'met' | 'partial' | 'missed' | 'none' | 'future';

/**
 * Mapa de consistencia de 12 semanas (columnas = semanas, filas = días). El color no es el único
 * portador de información: el resumen textual va en la etiqueta accesible.
 */
export function ConsistencyGrid({
  today,
  weekStartsOn,
  cellFor,
  color,
  summary,
}: {
  today: DayKey;
  weekStartsOn: number;
  cellFor(day: DayKey): Cell;
  color: string;
  summary: string;
}) {
  const firstWeek = addDays(startOfWeek(today, weekStartsOn), -7 * 11);
  const weeks = Array.from({ length: 12 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(firstWeek, w * 7 + d)));
  const fill = (c: Cell) =>
    c === 'met' ? color : c === 'partial' ? `${color}66` : c === 'future' ? 'transparent' : colors.track;
  return (
    <View accessible accessibilityLabel={summary} accessibilityRole="image" style={styles.root}>
      <View style={styles.grid}>
        {weeks.map((days, i) => (
          <View key={i} style={styles.col}>
            {days.map((d) => (
              <View key={d} style={[styles.cell, { backgroundColor: fill(d > today ? 'future' : cellFor(d)) }]} />
            ))}
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <Text variant="caption" tone="tertiary">
          Hace 12 semanas
        </Text>
        <Text variant="caption" tone="tertiary">
          Hoy
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[2] },
  grid: { flexDirection: 'row', gap: 4 },
  col: { flex: 1, gap: 4 },
  cell: { aspectRatio: 1, borderRadius: 3 },
  legend: { flexDirection: 'row', justifyContent: 'space-between' },
});
