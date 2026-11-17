import type { LucideIcon } from 'lucide-react-native';

import { colors } from '@/design/tokens';

const tones = {
  primary: colors.text,
  secondary: colors.textSecondary,
  tertiary: colors.textTertiary,
  accent: colors.accentSoft,
  onAccent: colors.textOnAccent,
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  info: colors.info,
} as const;
export type IconTone = keyof typeof tones;

/**
 * Icono lineal con tamaño y color del sistema. Decorativo por defecto (oculto al lector de
 * pantalla); con `label` se anuncia como imagen.
 */
export function Icon({ as: Glyph, size = 20, tone = 'secondary', color, label }: { as: LucideIcon; size?: number; tone?: IconTone; color?: string; label?: string }) {
  return (
    <Glyph
      size={size}
      color={color ?? tones[tone]}
      strokeWidth={1.75}
      accessibilityLabel={label}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    />
  );
}
