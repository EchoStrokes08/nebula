import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/useReducedMotion';

import { colors, motion } from '@/design/tokens';

export function ProgressBar({ progress, color = colors.accentBright, height = 6 }: { progress: number; color?: string; height?: number }) {
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const reduced = useReducedMotion();
  const shown = useSharedValue(p);
  useEffect(() => {
    shown.value = reduced ? p : withTiming(p, { duration: motion.slow });
  }, [p, reduced, shown]);
  const fill = useAnimatedStyle(() => ({ width: `${shown.value * 100}%` }));
  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]} accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: color }, fill]} />
    </View>
  );
}

/** Barra de contribuciones por persona (maqueta «En equipo» del PDF). */
export function ContributionBar({ parts, total, height = 8 }: { parts: { value: number; color: string; label: string }[]; total: number; height?: number }) {
  const sum = parts.reduce((a, p) => a + p.value, 0);
  return (
    <View
      style={[styles.track, styles.row, { height, borderRadius: height / 2 }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={parts.map((p) => `${p.label}: ${p.value}`).join(', ')}
      accessibilityValue={{ min: 0, max: Math.max(0, total), now: Math.min(sum, Math.max(0, total)) }}
    >
      {parts.map((p, i) => (
        <View key={i} style={{ width: `${(Math.min(p.value, Math.max(0, total - parts.slice(0, i).reduce((a, x) => a + x.value, 0))) / Math.max(1, total)) * 100}%`, height, backgroundColor: p.color }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', backgroundColor: colors.track, overflow: 'hidden' },
  row: { flexDirection: 'row' },
});
