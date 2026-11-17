import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { chartColors, colors } from '@/design/tokens';

/** Color estable por usuario a partir de su @usuario. */
export function colorFor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return chartColors[h % chartColors.length]!;
}

export function Avatar({ name, seed, size = 32 }: { name: string; seed: string; size?: number }) {
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  const c = colorFor(seed);
  return (
    <View style={[styles.root, { width: size, height: size, borderRadius: size / 2, backgroundColor: `${c}33`, borderColor: c }]} accessibilityElementsHidden importantForAccessibility="no">
      <Text variant={size >= 40 ? 'title3' : 'caption'} style={{ color: c }}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ root: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, backgroundColor: colors.surfaceRaised } });
