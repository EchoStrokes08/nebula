import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, elevation, radius, spacing } from '@/design/tokens';

type Tone = 'default' | 'raised' | 'accent' | 'warning' | 'danger';

const toneStyle: Record<Tone, object> = {
  default: { backgroundColor: colors.surface, borderColor: colors.border },
  raised: { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong, ...elevation.low },
  accent: { backgroundColor: colors.accentMuted, borderColor: colors.accentBright },
  warning: { backgroundColor: colors.warningMuted, borderColor: 'rgba(242, 184, 102, 0.3)' },
  danger: { backgroundColor: colors.dangerMuted, borderColor: 'rgba(240, 122, 138, 0.3)' },
};

export interface CardProps extends ViewProps {
  tone?: Tone;
  /** `compact` reduce el relleno para filas y listas densas de escritorio. */
  compact?: boolean;
  children?: ReactNode;
}

/** Superficie base de contenido: fondo sólido legible sobre el fondo espacial. */
export function Card({ tone = 'default', compact, style, ...rest }: CardProps) {
  return <View {...rest} style={[styles.base, compact && styles.compact, toneStyle[tone], style]} />;
}
/** Alias semántico para superficies sin significado de tarjeta. */
export const Surface = Card;

const styles = StyleSheet.create({
  base: { gap: spacing[3], padding: spacing[5], borderRadius: radius.lg, borderWidth: 1 },
  compact: { gap: spacing[2], padding: spacing[3], borderRadius: radius.md },
});
