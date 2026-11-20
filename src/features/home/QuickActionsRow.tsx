import { router, type Href } from 'expo-router';
import { CalendarClock, Sparkles, Timer, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { GlassCard } from '@/components/primitives/GlassCard';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';

const ACTIONS: { label: string; hint: string; icon: LucideIcon; color: string; href: Href }[] = [
  { label: 'Asistente IA', hint: 'Pregúntale a Nebula', icon: Sparkles, color: '#E58FD0', href: '/asistente' },
  { label: 'Enfoque', hint: 'Sin distracciones', icon: Timer, color: colors.warning, href: '/enfoque' },
  { label: 'Planificar', hint: 'Ordena tu día', icon: CalendarClock, color: colors.info, href: '/planificar' },
];

/**
 * Accesos directos de Hoy: tres tarjetas de vidrio del mismo ancho, con el icono iluminado.
 * Los textos son cortos y pueden ocupar dos líneas: nunca se cortan con puntos suspensivos.
 */
export function QuickActionsRow() {
  return (
    <View style={styles.row}>
      {ACTIONS.map((a) => (
        <GlassCard
          key={a.label}
          onPress={() => router.push(a.href)}
          accessibilityLabel={`${a.label}: ${a.hint}`}
          outerStyle={styles.cell}
          fill
          radius={radius.lg}
          style={styles.card}
        >
          <View style={[styles.icon, { backgroundColor: `${a.color}24`, borderColor: `${a.color}66`, boxShadow: `0 0 16px ${a.color}66` } as ViewStyle]}>
            <a.icon size={20} color={a.color} strokeWidth={2.2} />
          </View>
          <Text variant="bodyStrong" style={styles.label}>{a.label}</Text>
          <Text variant="caption" tone="tertiary">{a.hint}</Text>
        </GlassCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[3] },
  cell: { flex: 1, minWidth: 0 },
  card: { gap: 2, paddingHorizontal: spacing[3] - 2, paddingVertical: spacing[4] },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: spacing[2] },
  label: { fontSize: 14, lineHeight: 19 },
});
