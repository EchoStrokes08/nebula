import { router, type Href } from 'expo-router';
import { CalendarClock, Sparkles, StickyNote, Timer, type LucideIcon } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { platformHaptics } from '@/platform/haptics';

const ACTIONS: { label: string; hint: string; icon: LucideIcon; color: string; href: Href }[] = [
  { label: 'Pregunta a Nebula', hint: 'Tu asistente IA', icon: Sparkles, color: '#E58FD0', href: '/asistente' },
  { label: 'Enfoque', hint: 'Bloque sin distracciones', icon: Timer, color: colors.warning, href: '/enfoque' },
  { label: 'Planificar', hint: 'Ordena tu día', icon: CalendarClock, color: colors.info, href: '/planificar' },
  { label: 'Nota rápida', hint: 'Un pósit con hora', icon: StickyNote, color: colors.success, href: '/captura' },
];

/** Accesos directos con icono y color: lo que más se usa, a un toque desde Hoy. */
export function QuickActionsRow() {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroll}>
      {ACTIONS.map((a) => (
        <Pressable
          key={a.label}
          accessibilityRole="button"
          accessibilityLabel={`${a.label}: ${a.hint}`}
          onPress={() => { platformHaptics.tap(); router.push(a.href); }}
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [styles.card, (pressed || hovered) && { borderColor: a.color, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
        >
          <View style={[styles.icon, { backgroundColor: `${a.color}22`, borderColor: `${a.color}55` }]}>
            <a.icon size={20} color={a.color} strokeWidth={2} />
          </View>
          <Text variant="bodyStrong" numberOfLines={1}>{a.label}</Text>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>{a.hint}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -spacing[5], flexGrow: 0 },
  row: { gap: spacing[3], paddingHorizontal: spacing[5] },
  card: { width: 148, gap: spacing[1], padding: spacing[4], borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: spacing[2] },
});
