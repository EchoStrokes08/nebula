import { Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { platformHaptics } from '@/platform/haptics';
import { colors, hitTarget, radius, spacing } from '@/design/tokens';

/** Ajuste numérico con − / +, límites y unidad. Se anuncia como control ajustable. */
export function Stepper({ label, value, onChange, min = 0, max = Number.MAX_SAFE_INTEGER, step = 1, unit }: {
  label: string; value: number; onChange(v: number): void; min?: number; max?: number; step?: number; unit?: string;
}) {
  const set = (v: number) => { const next = Math.min(max, Math.max(min, Math.round(v * 1000) / 1000)); if (next !== value) { platformHaptics.tap(); onChange(next); } };
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max: max === Number.MAX_SAFE_INTEGER ? undefined : max, now: value, text: `${value}${unit ? ` ${unit}` : ''}` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => set(e.nativeEvent.actionName === 'increment' ? value + step : value - step)}
    >
      <Text variant="bodyStrong" style={styles.flex}>{label}</Text>
      <Pressable onPress={() => set(value - step)} disabled={value <= min} accessibilityRole="button" accessibilityLabel={`Restar ${step}`} style={[styles.btn, value <= min && styles.off]}>
        <Minus size={18} color={colors.text} />
      </Pressable>
      <Text variant="title3" tabular style={styles.value}>{value}{unit ? <Text variant="caption" tone="secondary"> {unit}</Text> : null}</Text>
      <Pressable onPress={() => set(value + step)} disabled={value >= max} accessibilityRole="button" accessibilityLabel={`Sumar ${step}`} style={[styles.btn, value >= max && styles.off]}>
        <Plus size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1 },
  btn: { width: hitTarget, height: hitTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderStrong },
  off: { opacity: 0.4 },
  value: { minWidth: 56, textAlign: 'center' },
});
