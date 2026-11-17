import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, elevation, hitTarget, radius, spacing } from '@/design/tokens';
import { platformHaptics } from '@/platform/haptics';

/** Botón de creación rápida (abre la captura universal). Fila en la barra lateral; botón flotante en Android. */
export function QuickCreate({ layout }: { layout: 'sidebar' | 'floating' }) {
  const open = () => { platformHaptics.tap(); router.push('/captura'); };
  if (layout === 'sidebar') {
    return (
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityHint="Captura rápida: crea una tarea, hábito o evento escribiéndolo"
        style={(s: { hovered?: boolean; focused?: boolean; pressed: boolean }) => [styles.side, (s.hovered || s.pressed) && styles.sideHover, s.focused && Platform.OS === 'web' && styles.focus]}
      >
        <View style={styles.sideIcon}><Plus size={16} color={colors.textOnAccent} strokeWidth={2.4} /></View>
        <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>Capturar</Text>
        <Text variant="caption" tone="tertiary">Ctrl K</Text>
      </Pressable>
    );
  }
  return (
    <Pressable onPress={open} accessibilityRole="button" accessibilityLabel="Captura rápida" style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}>
      <Plus size={24} color={colors.textOnAccent} strokeWidth={2.2} />
    </Pressable>
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
});
