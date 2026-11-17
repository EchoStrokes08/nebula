import type { LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Sheet } from '@/components/overlays/Sheet';
import { Text } from '@/components/primitives/Text';
import { colors, hitTarget, radius, spacing } from '@/design/tokens';

export interface MenuAction { label: string; icon?: LucideIcon; destructive?: boolean; onSelect(): void }

/**
 * Menú contextual (F02-011/F02-019): pulsación larga en Android, clic derecho en escritorio y
 * acción de accesibilidad «Más acciones». Devuelve las props para el elemento que lo abre y el menú.
 */
export function useContextMenu(title: string, actions: MenuAction[]) {
  const [open, setOpen] = useState(false);
  const triggerProps = {
    onLongPress: () => setOpen(true),
    delayLongPress: 400,
    accessibilityActions: [{ name: 'longpress', label: 'Más acciones' }],
    onAccessibilityAction: (e: { nativeEvent: { actionName: string } }) => { if (e.nativeEvent.actionName === 'longpress') setOpen(true); },
    ...(Platform.OS === 'web' ? { onContextMenu: (e: { preventDefault(): void }) => { e.preventDefault(); setOpen(true); } } : {}),
  };
  const menu = (
    <Sheet visible={open} onClose={() => setOpen(false)} title={title}>
      <View style={styles.list}>
        {actions.map((a) => (
          <Pressable
            key={a.label}
            accessibilityRole="menuitem"
            accessibilityLabel={a.label}
            onPress={() => { setOpen(false); a.onSelect(); }}
            style={(s: { hovered?: boolean; pressed: boolean }) => [styles.item, (s.hovered || s.pressed) && styles.itemOn]}
          >
            {a.icon ? <a.icon size={18} color={a.destructive ? colors.danger : colors.textSecondary} /> : null}
            <Text tone={a.destructive ? 'danger' : 'primary'}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
  return { triggerProps, menu, open: () => setOpen(true) };
}

/** Envoltorio para elementos no pulsables (el contenido se vuelve el disparador). */
export function ContextMenu({ title, actions, children }: { title: string; actions: MenuAction[]; children: ReactNode }) {
  const { triggerProps, menu } = useContextMenu(title, actions);
  return (
    <>
      <Pressable {...triggerProps} accessibilityRole="button" accessibilityLabel={`${title}. Mantén pulsado para más acciones`}>{children}</Pressable>
      {menu}
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing[1] },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: hitTarget, paddingHorizontal: spacing[3], borderRadius: radius.md },
  itemOn: { backgroundColor: colors.surfacePressed },
});
