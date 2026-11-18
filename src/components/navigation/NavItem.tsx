import { Platform, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { TabTriggerSlotProps } from 'expo-router/ui';

import { Text } from '@/components/primitives/Text';
import { colors, hitTarget, motion, radius, spacing } from '@/design/tokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';

import type { Section } from './sections';

type Props = TabTriggerSlotProps & { section: Section; layout: 'bottom' | 'sidebar'; shortcut?: string };

// React 19: `ref` llega como prop normal desde TabTrigger (asChild) y se reenvía con `...pressable`.
// Los tipos de expo-router declaran `RefAttributes<View>` y en RN 0.88 `View` es un componente
// función, por lo que el tipo no encaja aunque en ejecución la ref apunte al elemento nativo.
export function NavItem({ section, layout, isFocused, shortcut, ref, ...pressable }: Props) {
  const Icon = section.icon;
  const tint = isFocused ? colors.text : colors.textTertiary;
  const sidebar = layout === 'sidebar';
  const reduced = useReducedMotion();
  // Indicador activo con entrada suave (150–350 ms); estático con movimiento reducido.
  const enter = reduced ? undefined : FadeIn.duration(motion.base);
  return (
    <Pressable
      ref={ref as never}
      {...pressable}
      // Barra inferior: pestañas. Barra lateral: enlaces de navegación con la página actual marcada
      // (contiene también la marca y la captura, que no son pestañas).
      accessibilityRole={sidebar ? 'link' : 'tab'}
      accessibilityState={sidebar ? undefined : { selected: !!isFocused }}
      aria-selected={sidebar ? undefined : !!isFocused}
      aria-current={sidebar && isFocused ? 'page' : undefined}
      accessibilityLabel={sidebar ? undefined : section.label}
      style={({ pressed, hovered, focused }: { pressed: boolean; hovered?: boolean; focused?: boolean }) => [
        sidebar ? styles.side : styles.bottom,
        sidebar && isFocused && styles.sideActive,
        (hovered || pressed) && !isFocused && styles.hover,
        focused && Platform.OS === 'web' && styles.focusRing,
      ]}
    >
      {!sidebar && isFocused ? <Animated.View entering={enter} style={styles.bottomIndicator} /> : null}
      {sidebar && isFocused ? <Animated.View entering={enter} style={styles.sideIndicator} /> : null}
      <Icon size={sidebar ? 18 : 22} color={isFocused ? colors.accentBright : tint} strokeWidth={isFocused ? 2.2 : 1.8} />
      <Text variant={sidebar ? 'bodyStrong' : 'caption'} style={[{ color: tint }, sidebar && styles.sideLabel]}>
        {section.label}
      </Text>
      {sidebar && shortcut ? (
        <Text variant="caption" tone="tertiary">
          {shortcut}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bottom: {
    flex: 1,
    minHeight: hitTarget + 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
  },
  bottomIndicator: {
    position: 'absolute',
    top: 6,
    width: 54,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(169, 135, 255, 0.35)',
  },
  sideIndicator: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2, backgroundColor: colors.accentBright },
  side: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: 40,
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
  },
  sideActive: { backgroundColor: colors.accentMuted },
  sideLabel: { flex: 1 },
  hover: { backgroundColor: 'rgba(199, 169, 255, 0.06)' },
  focusRing: { outlineColor: colors.borderFocus, outlineWidth: 2, outlineStyle: 'solid' } as object,
});
