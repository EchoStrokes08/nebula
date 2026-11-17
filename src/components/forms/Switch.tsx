import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { platformHaptics } from '@/platform/haptics';
import { colors, hitTarget, radius, spacing } from '@/design/tokens';

/** Interruptor con etiqueta y descripción; toda la fila es pulsable. */
export function Switch({ label, description, value, onChange, disabled }: { label: string; description?: string; value: boolean; onChange(next: boolean): void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={() => { platformHaptics.tap(); onChange(!value); }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      aria-checked={value}
      style={(s: { pressed: boolean; focused?: boolean }) => [styles.row, disabled && styles.disabled, s.focused && Platform.OS === 'web' && styles.focus]}
    >
      <View style={styles.text}>
        <Text variant="bodyStrong">{label}</Text>
        {description ? <Text variant="caption" tone="secondary">{description}</Text> : null}
      </View>
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.thumb, value && styles.thumbOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: hitTarget, borderRadius: radius.md },
  text: { flex: 1, gap: 2 },
  track: { width: 46, height: 28, borderRadius: radius.pill, padding: 3, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderStrong },
  trackOn: { backgroundColor: colors.accent, borderColor: colors.accentBright },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.textSecondary },
  thumbOn: { backgroundColor: colors.textOnAccent, transform: [{ translateX: 18 }] },
  disabled: { opacity: 0.5 },
  focus: { outlineColor: colors.borderFocus, outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 2 } as object,
});
