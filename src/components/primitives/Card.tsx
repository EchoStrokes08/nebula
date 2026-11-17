import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { colors, elevation, gradients, radius, spacing } from '@/design/tokens';

type Tone = 'default' | 'raised' | 'accent' | 'warning' | 'danger';

const toneStyle: Record<Tone, ViewStyle> = {
  default: { borderColor: colors.border, borderTopColor: colors.cardHighlight },
  raised: { borderColor: colors.borderStrong, borderTopColor: 'rgba(199, 169, 255, 0.4)', ...elevation.low },
  accent: { backgroundColor: 'rgba(128, 85, 232, 0.22)', borderColor: colors.accentBright },
  warning: { backgroundColor: colors.warningMuted, borderColor: 'rgba(242, 184, 102, 0.3)' },
  danger: { backgroundColor: colors.dangerMuted, borderColor: 'rgba(240, 122, 138, 0.3)' },
};

/** En web, el desenfoque del fondo refuerza la sensación de cristal sobre la galaxia. */
export const glassBlur = Platform.OS === 'web' ? ({ backdropFilter: 'blur(14px)' } as unknown as ViewStyle) : null;

export interface CardProps extends ViewProps {
  tone?: Tone;
  /** `compact` reduce el relleno para filas y listas densas de escritorio. */
  compact?: boolean;
  children?: ReactNode;
}

/** Superficie base de contenido: cristal oscuro con brillo superior sobre el fondo espacial. */
export function Card({ tone = 'default', compact, style, ...rest }: CardProps) {
  const base = [styles.base, compact && styles.compact, glassBlur, toneStyle[tone], style];
  if (tone === 'default' || tone === 'raised') {
    return <LinearGradient {...rest} colors={tone === 'raised' ? gradients.cardRaised : gradients.card} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={base} />;
  }
  return <View {...rest} style={base} />;
}
/** Alias semántico para superficies sin significado de tarjeta. */
export const Surface = Card;

const styles = StyleSheet.create({
  base: { gap: spacing[3], padding: spacing[5], borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  compact: { gap: spacing[2], padding: spacing[3], borderRadius: radius.lg },
});
