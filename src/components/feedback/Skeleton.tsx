import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { colors, radius, spacing } from '@/design/tokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/** Bloque de carga. Pulsa suavemente salvo con movimiento reducido. */
export function Skeleton({ width = '100%', height = 16, round }: { width?: DimensionValue; height?: number; round?: boolean }) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0.55);
  useEffect(() => {
    if (reduced) { opacity.value = 0.55; return; }
    opacity.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [reduced, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.block, { width, height, borderRadius: round ? height / 2 : radius.sm }, style]} />;
}

/** Lista de filas de carga, anunciada una sola vez como «Cargando». */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Cargando" style={styles.list}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={36} height={36} round />
          <View style={styles.lines}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="35%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.surfaceRaised },
  list: { gap: spacing[4] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  lines: { flex: 1, gap: spacing[2] },
});
