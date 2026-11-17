import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';

/** Marco de las pantallas de acceso: una columna en Android, dos en escritorio. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 900;
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  aside: { flex: 1, maxWidth: 440, gap: spacing[4] },
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
