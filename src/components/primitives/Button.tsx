import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { platformHaptics } from '@/platform/haptics';
import { Text } from '@/components/primitives/Text';
import { colors, gradients, hitTarget, radius, spacing } from '@/design/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: Variant;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const bg: Record<Variant, string> = {
  primary: colors.accent,
  secondary: colors.surfaceRaised,
  ghost: 'transparent',
  danger: colors.dangerMuted,
};
const bgPressed: Record<Variant, string> = {
  primary: colors.accentPressed,
  secondary: colors.surfacePressed,
  ghost: 'rgba(199, 169, 255, 0.08)',
  danger: 'rgba(240, 122, 138, 0.24)',
};
const fg: Record<Variant, string> = {
  primary: colors.textOnAccent,
  secondary: colors.text,
  ghost: colors.accentSoft,
  danger: colors.danger,
};

export function Button({ label, variant = 'primary', loading, icon, fullWidth, disabled, onPress, ...rest }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      {...rest}
      onPress={(event) => { platformHaptics.tap(); onPress?.(event); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      aria-busy={!!loading}
      aria-disabled={!!inactive}
      disabled={inactive}
      style={(state: { pressed: boolean; hovered?: boolean; focused?: boolean }) => [
        styles.base,
        fullWidth && styles.full,
        variant === 'secondary' && styles.bordered,
        { backgroundColor: state.pressed || state.hovered ? bgPressed[variant] : bg[variant] },
        inactive && styles.disabled,
        variant === 'primary' && styles.glow,
        variant === 'primary' && { backgroundColor: 'transparent' },
        state.focused && Platform.OS === 'web' && styles.focus,
      ]}
    >
      {(state: { pressed: boolean; hovered?: boolean }) => (<>
      {variant === 'primary' ? (
        <LinearGradient colors={state.pressed ? [colors.accentPressed, colors.accent] : gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.fill, state.hovered && styles.hovered]} />
      ) : null}
      <View style={styles.content}>
        {loading ? <ActivityIndicator size="small" color={fg[variant]} /> : icon}
        <Text variant="bodyStrong" style={{ color: fg[variant] }}>
          {label}
        </Text>
      </View>
      </>)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: hitTarget + 4,
    paddingHorizontal: spacing[5],
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: { alignSelf: 'stretch' },
  bordered: { borderWidth: 1, borderColor: colors.borderStrong },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  disabled: { opacity: 0.5 },
  fill: { borderRadius: radius.md },
  hovered: { opacity: 0.88 },
  glow: { shadowColor: colors.accent, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  focus: { outlineColor: colors.borderFocus, outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 2 } as object,
});
