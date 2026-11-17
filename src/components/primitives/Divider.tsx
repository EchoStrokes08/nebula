import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/design/tokens';

export function Divider({ vertical, inset = 0 }: { vertical?: boolean; inset?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={vertical ? [styles.v, { marginVertical: inset }] : [styles.h, { marginHorizontal: inset }]}
    />
  );
}

const styles = StyleSheet.create({
  h: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.borderStrong, marginVertical: spacing[1] },
  v: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.borderStrong },
});
