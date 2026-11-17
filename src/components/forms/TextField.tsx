import { Eye, EyeOff } from 'lucide-react-native';
import { useId, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, fontFamily, hitTarget, radius, spacing } from '@/design/tokens';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  hint?: string;
  secure?: boolean;
  /** Altura mínima del área de texto (multilínea). */
  minInputHeight?: number;
}

export function TextField({ label, error, hint, secure, minInputHeight, onFocus, onBlur, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const id = useId();
  return (
    <View style={styles.root}>
      <Text variant="caption" tone="secondary" nativeID={`${id}-label`}>
        {label}
      </Text>
      <View style={[styles.box, focused && styles.boxFocused, !!error && styles.boxError]}>
        <TextInput
          {...rest}
          accessibilityLabel={label}
          aria-labelledby={`${id}-label`}
          accessibilityHint={error ?? hint}
          secureTextEntry={secure && hidden}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accentBright}
          style={[styles.input, Platform.OS === 'web' && styles.webInput, minInputHeight ? { minHeight: minInputHeight } : null]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar contraseña' : 'Ocultar contraseña'}
            hitSlop={8}
            style={styles.eye}
          >
            {hidden ? <Eye size={18} color={colors.textTertiary} /> : <EyeOff size={18} color={colors.textTertiary} />}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="tertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[1] + 2 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: hitTarget + 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[4],
  },
  boxFocused: { borderColor: colors.borderFocus },
  boxError: { borderColor: colors.danger },
  input: { flex: 1, color: colors.text, fontFamily: fontFamily.regular, fontSize: 15, paddingVertical: spacing[3] },
  webInput: { outlineStyle: 'none' } as object,
  eye: { padding: spacing[1] },
});
