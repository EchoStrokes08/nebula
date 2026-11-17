import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Text } from '@/components/primitives/Text';
import { colors, spacing } from '@/design/tokens';

/** Serie temporal simple con puntos; `null` deja un hueco (sin datos ≠ 0). */
export function LineChart({ values, labels, color = colors.accentBright, height = 120, summary, max }: { values: (number | null)[]; labels: string[]; color?: string; height?: number; summary: string; max?: number }) {
  const [width, setWidth] = useState(0);
  const top = max ?? Math.max(1, ...values.map((v) => v ?? 0));
  const PAD = 5; // margen para que los puntos de los extremos no se corten
  const step = values.length > 1 ? (width - 2 * PAD) / (values.length - 1) : 0;
  const x = (i: number) => PAD + i * step;
  const y = (v: number) => height - 6 - (v / top) * (height - 12);
  let d = '';
  values.forEach((v, i) => {
    if (v === null) return;
    const prev = values[i - 1];
    d += `${i === 0 || prev === null || prev === undefined ? 'M' : 'L'}${x(i)},${y(v)} `;
  });
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary} style={styles.root}>
      <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {[0.25, 0.5, 0.75].map((f) => <Line key={f} x1={0} x2={width} y1={height * f} y2={height * f} stroke={colors.border} strokeWidth={1} />)}
            <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
            {values.map((v, i) => (v === null ? null : <Circle key={i} cx={x(i)} cy={y(v)} r={3} fill={color} />))}
          </Svg>
        ) : null}
      </View>
      <View style={styles.axis}>
        {labels.map((l, i) => (
          <Text key={i} variant="caption" tone="tertiary" style={[styles.label, i === 0 && styles.left, i === labels.length - 1 && styles.right]}>{l}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[2] },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { flex: 1, textAlign: 'center' },
  left: { textAlign: 'left' },
  right: { textAlign: 'right' },
});
