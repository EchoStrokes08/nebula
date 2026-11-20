import { router, type Href } from 'expo-router';
import { Flame, Plus, Quote, SquareCheck, Target, X, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/primitives/Text';
import { colors, elevation, hitTarget, radius, spacing } from '@/design/tokens';
import { platformHaptics } from '@/platform/haptics';

export const CREATE_OPTIONS: { label: string; hint: string; icon: LucideIcon; color: string; href: Href }[] = [
  { label: 'Hábito', hint: 'Algo que repetir', icon: Flame, color: colors.warning, href: '/habito/nuevo' },
  { label: 'Tarea', hint: 'Algo que terminar', icon: SquareCheck, color: colors.info, href: '/tarea/nueva' },
  { label: 'Meta', hint: 'Un objetivo grande', icon: Target, color: colors.success, href: '/meta/nueva' },
  { label: 'Motivación', hint: 'Tus frases y la de hoy', icon: Quote, color: '#E58FD0', href: '/motivacion' },
];

/**
 * Botón «+»: abre un menú con lo que se puede crear (hábito, tarea, meta, motivación).
 * La nota rápida tiene su propio acceso (Hoy y Ctrl K), así que aquí no se repite.
 */
export function QuickCreate({ layout }: { layout: 'sidebar' | 'floating' }) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  // Misma altura que la capa del botón flotante en las pestañas.
  const fabBottom = hitTarget + 8 + Math.max(insets.bottom, spacing[2]) + spacing[4];
  const toggle = () => { platformHaptics.tap(); setOpen((o) => !o); };
  const go = (href: Href) => { setOpen(false); platformHaptics.tap(); router.push(href); };

  const menu = (
    <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Cerrar menú" accessibilityRole="button" />
      <Animated.View
        entering={layout === 'floating' ? FadeInDown.duration(160) : FadeIn.duration(120)}
        style={[styles.menu, layout === 'floating' ? { right: spacing[5], bottom: fabBottom + hitTarget + 12 + spacing[3] } : styles.menuSide]}
        accessibilityRole="menu"
        aria-label="Crear"
      >
        <Text variant="overline" tone="tertiary" style={styles.menuTitle}>CREAR</Text>
        {CREATE_OPTIONS.map((o) => (
          <Pressable
            key={o.label}
            onPress={() => go(o.href)}
            accessibilityRole="menuitem"
            accessibilityLabel={`${o.label}: ${o.hint}`}
            style={(s: { pressed: boolean; hovered?: boolean; focused?: boolean }) => [styles.item, (s.pressed || s.hovered) && styles.itemHover, s.focused && Platform.OS === 'web' && styles.focus]}
          >
            <View style={[styles.itemIcon, { backgroundColor: `${o.color}22`, borderColor: `${o.color}55` }]}>
              <o.icon size={18} color={o.color} strokeWidth={2.2} />
            </View>
            <View style={styles.flex}>
              <Text variant="bodyStrong">{o.label}</Text>
              <Text variant="caption" tone="tertiary">{o.hint}</Text>
            </View>
          </Pressable>
        ))}
      </Animated.View>
      {layout === 'floating' ? (
        <View pointerEvents="box-none" style={[styles.fabLayerOpen, { bottom: fabBottom }]}>
          <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel="Cerrar menú de creación" style={[styles.fab, styles.fabOpen]}>
            <X size={24} color={colors.textOnAccent} strokeWidth={2.2} />
          </Pressable>
        </View>
      ) : null}
    </Modal>
  );

  if (layout === 'sidebar') {
    return (
      <>
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel="Crear"
          accessibilityHint="Abre un menú para crear un hábito, una tarea, una meta o ver tu motivación"
          accessibilityState={{ expanded: open }}
          style={(s: { hovered?: boolean; focused?: boolean; pressed: boolean }) => [styles.side, (s.hovered || s.pressed) && styles.sideHover, s.focused && Platform.OS === 'web' && styles.focus]}
        >
          <View style={styles.sideIcon}><Plus size={16} color={colors.textOnAccent} strokeWidth={2.4} /></View>
          <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>Crear</Text>
        </Pressable>
        {menu}
      </>
    );
  }
  return (
    <>
      <Pressable onPress={toggle} accessibilityRole="button" accessibilityLabel="Crear" accessibilityState={{ expanded: open }} style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}>
        <Plus size={24} color={colors.textOnAccent} strokeWidth={2.2} />
      </Pressable>
      {menu}
    </>
  );
}

const styles = StyleSheet.create({
  side: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 40, paddingHorizontal: spacing[3], marginBottom: spacing[3], borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong },
  sideHover: { backgroundColor: colors.surfaceRaised },
  sideIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  flex: { flex: 1 },
  focus: { outlineColor: colors.borderFocus, outlineWidth: 2, outlineStyle: 'solid' } as object,
  fab: { position: 'absolute', right: spacing[5], bottom: 0, width: hitTarget + 12, height: hitTarget + 12, borderRadius: (hitTarget + 12) / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, ...elevation.glow },
  fabPressed: { backgroundColor: colors.accentPressed },
  fabOpen: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderStrong },
  fabLayerOpen: { position: 'absolute', right: 0, left: 0, height: 0 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  menu: { position: 'absolute', width: 260, padding: spacing[2], gap: 2, borderRadius: radius.lg, backgroundColor: colors.cardRaised, borderWidth: 1, borderColor: colors.borderStrong, ...elevation.glow },
  menuSide: { left: spacing[3], top: 112 },
  menuTitle: { paddingHorizontal: spacing[3], paddingTop: spacing[2], paddingBottom: spacing[1] },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radius.md },
  itemHover: { backgroundColor: colors.surfacePressed },
  itemIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
