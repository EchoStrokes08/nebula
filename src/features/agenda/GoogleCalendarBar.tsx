import { useQuery } from '@tanstack/react-query';
import { CalendarSync } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { db, unwrap } from '@/data/db';
import { useAuth } from '@/features/auth/session';

import { useGoogleCalendar } from './google';

/** Conectar o resincronizar Google Calendar desde la agenda o Integraciones. */
export function GoogleCalendarBar({ detailed = false }: { detailed?: boolean }) {
  const uid = useAuth((s) => s.session?.user.id);
  const google = useGoogleCalendar();
  const state = useQuery({
    queryKey: ['integrations', uid, 'google'],
    enabled: !!uid,
    queryFn: async () => (unwrap(await db().from('integrations').select('last_imported_at').eq('provider', 'google').limit(1)) as { last_imported_at: string | null }[])[0] ?? null,
  });
  const connected = !!state.data;
  const last = state.data?.last_imported_at ? new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(state.data.last_imported_at)) : null;
  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        <CalendarSync size={18} color={colors.info} />
        <View style={styles.flex}>
          <Text variant="bodyStrong">Google Calendar</Text>
          <Text variant="caption" tone="tertiary">
            {connected ? `Sincronizado${last ? ` el ${last}` : ''}. Tus eventos diarios, semanales y mensuales aparecen aquí.` : detailed ? 'Trae todos tus eventos (también los que se repiten) a la agenda. Solo lectura: Nebula no cambia nada en Google.' : 'Trae tus eventos de Google a la agenda.'}
          </Text>
        </View>
        <Button label={connected ? 'Sincronizar' : 'Conectar'} variant={connected ? 'ghost' : 'secondary'} loading={google.busy} onPress={() => void google.run()} />
      </View>
      {google.message ? <Text variant="caption" tone="secondary" accessibilityLiveRegion="polite">{google.message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { gap: spacing[2], padding: spacing[3], paddingLeft: spacing[4], borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1 },
});
