import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';

export interface Segment<T extends string> { value: T; label: string }

/** Selector exclusivo de 2–5 opciones (pestañas internas, vistas Día/Semana/Mes…). */
export function SegmentedControl<T extends string>({ segments, value, onChange, label }: { segments: Segment<NoInfer<T>>[]; value: T; onChange(v: NoInfer<T>): void; label: string }) {
  return (
    <View style={styles.root} accessibilityRole="tablist" accessibilityLabel={label}>
      {segments.map((s) => {
        const selected = s.value === value;
        return (
          <Pressable
            key={s.value}
            onPress={() => onChange(s.value)}
            accessibilityRole="tab"
            accessibilityLabel={s.label}
            accessibilityState={{ selected }}
            aria-selected={selected}
            style={(st: { hovered?: boolean; focused?: boolean }) => [styles.seg, selected && styles.selected, st.hovered && !selected && styles.hover, st.focused && Platform.OS === 'web' && styles.focus]}
          >
            <Text variant="callout" style={{ color: selected ? colors.text : colors.textSecondary }} numberOfLines={1}>{s.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', padding: 3, gap: 3, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  seg: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[2], borderRadius: radius.sm },
  selected: { backgroundColor: colors.accentMuted, borderWidth: 1, borderColor: colors.accentBright },
  hover: { backgroundColor: colors.surfaceRaised },
  focus: { outlineColor: colors.borderFocus, outlineWidth: 2, outlineStyle: 'solid' } as object,
});
