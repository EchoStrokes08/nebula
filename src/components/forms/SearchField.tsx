import { Search } from 'lucide-react-native';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fontFamily, radius, spacing } from '@/design/tokens';

/** Buscador en forma de píldora con la lupa dentro, el mismo en toda la app. */
export function SearchField({ label, ...rest }: Omit<TextInputProps, 'style' | 'accessibilityLabel'> & { label: string }) {
  return (
    <View style={styles.box}>
      <Search size={18} color={colors.textTertiary} />
      <TextInput
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel={label}
        returnKeyType="search"
        style={styles.input}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[4], minHeight: 48, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  input: { flex: 1, color: colors.text, fontFamily: fontFamily.regular, fontSize: 16, paddingVertical: spacing[3], outlineStyle: 'none' } as object,
});
