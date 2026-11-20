import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react-native';
import { CalendarDays, Repeat, Sparkles, Timer, Trophy } from 'lucide-react-native';
import { KeyboardAvoidingView, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { KeyboardScroll } from '@/components/layout/KeyboardScroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { DownloadApps } from '@/features/system/DownloadApps';

/** Marco de las pantallas de acceso: una columna en Android, dos en escritorio. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 900;
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <KeyboardScroll
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing[8], paddingBottom: insets.bottom + spacing[8] },
          wide && styles.scrollWide,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {wide ? (
          <View style={styles.aside}>
            <Brand />
            <Text variant="display">Convierte intenciones en resultados.</Text>
            <Text tone="secondary">Hábitos, agenda, enfoque y retos con amigos, en un solo lugar.</Text>
            <View style={styles.features}>
              {FEATURES.map((f) => <Feature key={f.label} {...f} />)}
            </View>
            <View style={styles.asideDownloads}><DownloadApps /></View>
          </View>
        ) : null}
        <View style={[styles.card, wide && styles.cardWide]}>
          {!wide ? <Brand /> : null}
          <View style={styles.heading}>
            <Text variant="title1" accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text tone="secondary">{subtitle}</Text> : null}
          </View>
          {children}
          {!wide ? <DownloadApps /> : null}
        </View>
      </KeyboardScroll>
    </KeyboardAvoidingView>
  );
}

const FEATURES: { icon: LucideIcon; label: string }[] = [
  { icon: Repeat, label: 'Hábitos con rachas' },
  { icon: CalendarDays, label: 'Agenda y tareas' },
  { icon: Timer, label: 'Modo enfoque' },
  { icon: Trophy, label: 'Retos con amigos' },
  { icon: Sparkles, label: 'Asistente con IA' },
];

function Feature({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <View style={styles.feature}>
      <Icon size={15} color={colors.accentSoft} />
      <Text variant="callout">{label}</Text>
    </View>
  );
}

function Brand() {
  return (
    <View style={styles.brand}>
      <View style={styles.mark} />
      <Text variant="title3">Nebula</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: spacing[5], justifyContent: 'center' },
  scrollWide: { flexDirection: 'row', alignItems: 'center', gap: spacing[16], paddingHorizontal: spacing[16] },
  aside: { flex: 1, maxWidth: 480, gap: spacing[4] },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  feature: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2], paddingHorizontal: spacing[3],
    borderRadius: radius.pill, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border,
  },
  asideDownloads: { marginTop: spacing[4], maxWidth: 420 },
  card: { gap: spacing[6], width: '100%', maxWidth: 440, alignSelf: 'center' },
  cardWide: {
    padding: spacing[8],
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heading: { gap: spacing[2] },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  mark: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
});
