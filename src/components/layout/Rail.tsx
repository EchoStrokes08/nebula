import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { colors, spacing } from '@/design/tokens';

/** A partir de este ancho (web/escritorio) la fila se reparte en varias líneas en vez de desplazarse. */
export const RAIL_WRAP_MIN_WIDTH = 600;

/** ¿Debe repartirse en líneas? En web el ratón no desplaza en horizontal, así que no se corta nada. */
export const railWraps = (width: number, os: string = Platform.OS) => os === 'web' && width >= RAIL_WRAP_MIN_WIDTH;

/**
 * Fila de elementos (chips, pósits…) que en móvil se desliza en horizontal con un degradado en el
 * borde que invita a seguir, y en escritorio se reparte en varias líneas para que nada quede oculto.
 * `bleed` es el margen lateral de la pantalla: en móvil la fila llega hasta el borde.
 */
export function Rail({ children, gap = spacing[2], bleed = spacing[5], style, accessibilityRole }: { children: ReactNode; gap?: number; bleed?: number; style?: ViewStyle; accessibilityRole?: 'tablist' | 'list' }) {
  const { width } = useWindowDimensions();
  if (railWraps(width)) {
    return <View accessibilityRole={accessibilityRole} style={[styles.wrap, { gap }, style]}>{children}</View>;
  }
  return (
    <View style={[{ marginHorizontal: -bleed }, style]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole={accessibilityRole} contentContainerStyle={[styles.row, { gap, paddingHorizontal: bleed }]}>
        {children}
      </ScrollView>
      <LinearGradient pointerEvents="none" colors={['rgba(11, 8, 21, 0)', colors.bg]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fade, { width: bleed + spacing[6] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  row: { alignItems: 'flex-start' },
  fade: { position: 'absolute', right: 0, top: 0, bottom: 0 },
});
