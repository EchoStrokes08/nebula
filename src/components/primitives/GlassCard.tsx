import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type AccessibilityRole, type StyleProp, type ViewStyle } from 'react-native';

import { glassBlur } from '@/components/primitives/Card';
import { radius as radii } from '@/design/tokens';
import { platformHaptics } from '@/platform/haptics';

/** Borde de 1 px: morado arriba a la izquierda, casi invisible al centro, cian abajo a la derecha. */
const EDGE = ['rgba(169, 135, 255, 0.6)', 'rgba(255, 255, 255, 0.07)', 'rgba(95, 214, 230, 0.45)'] as const;
export const GLASS_FILL = 'rgba(18, 16, 30, 0.8)';

export interface GlassCardProps {
  children?: ReactNode;
  /** Estilo del contenido (relleno, gap, dirección…). */
  style?: StyleProp<ViewStyle>;
  /** Estilo del contenedor exterior (márgenes, ancho, flex). */
  outerStyle?: StyleProp<ViewStyle>;
  radius?: number;
  /** Color de un halo suave alrededor (p. ej. un hábito cumplido). */
  glow?: string;
  /** Sustituye el borde degradado por uno de este color. */
  edge?: string;
  /** Ocupa todo el alto del contenedor (tarjetas de igual altura en una fila). */
  fill?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
}

/**
 * Tarjeta de vidrio: fondo oscuro translúcido, borde degradado ultrafino y sombra profunda.
 * Con `onPress` se hunde un poco al tocarla.
 */
export function GlassCard({ children, style, outerStyle, radius = radii.xl, glow, edge, fill, onPress, accessibilityLabel, accessibilityHint, accessibilityRole }: GlassCardProps) {
  const shadow = { boxShadow: glow ? `0 0 22px ${glow}55, 0 10px 28px rgba(0, 0, 0, 0.45)` : '0 10px 28px rgba(0, 0, 0, 0.45)' } as ViewStyle;
  const body = (
    <LinearGradient colors={edge ? [edge, edge] : EDGE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.edge, fill && styles.grow, { borderRadius: radius }, shadow]}>
      <View style={[styles.fill, fill && styles.grow, glassBlur, { borderRadius: radius - 1 }, style]}>{children}</View>
    </LinearGradient>
  );
  if (!onPress) {
    return (
      <View style={outerStyle} accessibilityRole={accessibilityRole} accessibilityLabel={accessibilityLabel}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => { platformHaptics.tap(); onPress(); }}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [outerStyle, hovered && styles.hover, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  edge: { padding: 1 },
  grow: { flexGrow: 1 },
  fill: { backgroundColor: GLASS_FILL, overflow: 'hidden' },
  hover: { transform: [{ translateY: -2 }] },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.92 },
});
