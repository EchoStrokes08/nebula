import { Platform, Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';

export interface ChipProps {
  label: string;
  selected: boolean;
  onToggle(): void;
  /** `radio` para selección única; `checkbox` para múltiple. */
  role?: 'checkbox' | 'radio';
}

export function Chip({ label, selected, onToggle, role = 'checkbox' }: ChipProps) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole={role}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityLabel={label}
      style={(s: { pressed: boolean; hovered?: boolean; focused?: boolean }) => [
        styles.chip,
        selected && styles.selected,
        (s.pressed || s.hovered) && !selected && styles.hover,
        s.focused && Platform.OS === 'web' && styles.focus,
      ]}
    >
      <Text variant="callout" style={{ color: selected ? colors.text : colors.textSecondary }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.accentMuted, borderColor: colors.accentBright },
  hover: { backgroundColor: colors.surfaceRaised },
  focus: { outlineColor: colors.borderFocus, outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 2 } as object,
});
