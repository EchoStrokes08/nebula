import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { Text } from '@/components/primitives/Text';
import { colors, spacing } from '@/design/tokens';

export interface Bar {
  label: string;
  /** null = sin datos (se dibuja una marca mínima atenuada, distinta de 0). */
  value: number | null;
  highlight?: boolean;
}

/**
 * Barras verticales accesibles: el resumen textual (`summary`) es lo que lee el lector de
 * pantalla; las etiquetas del eje se muestran debajo.
 */
export function BarChart({ bars, max, color = colors.accentBright, height = 120, summary }: { bars: Bar[]; max?: number; color?: string; height?: number; summary: string }) {
  const [width, setWidth] = useState(0);
  const top = max ?? Math.max(1, ...bars.map((b) => b.value ?? 0));
  const gap = 6;
  const barW = bars.length ? Math.max(4, (width - gap * (bars.length - 1)) / bars.length) : 0;
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} style={styles.root}>
      <View onLayout={onLayout} style={{ height }}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {bars.map((b, i) => {
              const h = b.value === null ? 2 : Math.max(2, (b.value / top) * (height - 4));
              return (
                <Rect
                  key={i}
                  x={i * (barW + gap)}
                  y={height - h}
                  width={barW}
                  height={h}
                  rx={Math.min(4, barW / 2)}
                  fill={b.value === null ? colors.track : color}
                  opacity={b.value === null ? 1 : b.highlight ? 1 : 0.55}
                />
              );
            })}
          </Svg>
        ) : null}
      </View>
      <View style={styles.axis}>
        {bars.map((b, i) => (
          <Text key={i} variant="caption" tone={b.highlight ? 'primary' : 'tertiary'} style={styles.axisLabel} numberOfLines={1}>
            {b.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[2] },
  axis: { flexDirection: 'row', gap: 6 },
  axisLabel: { flex: 1, textAlign: 'center' },
});
