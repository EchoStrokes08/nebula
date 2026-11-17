import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, radius, spacing } from '@/design/tokens';

/**
 * Panel translúcido. **Uso restringido** (DISENO_UI_UX §2): solo para elementos flotantes sobre el
 * fondo espacial (barra de navegación, temporizador, cabeceras). Nunca para listas ni texto largo.
 */
export function GlassPanel({ style, ...rest }: ViewProps & { children?: ReactNode }) {
  return <View {...rest} style={[styles.glass, style]} />;
}

const styles = StyleSheet.create({
  glass: {
    padding: spacing[4],
    borderRadius: radius.xl,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
});
