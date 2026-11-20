import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useToast } from '@/components/overlays/UndoToast';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, spacing } from '@/design/tokens';
import { completeGoogleRedirect } from '@/features/agenda/google';

type Params = { access_token?: string; expires_in?: string; scope?: string; state?: string; error?: string };

/**
 * Vuelta del permiso de Google Calendar: la página puente (oauth-google.html) trae aquí el token
 * en la web (/google-calendar?…) y en Android (nebula://google-calendar?…). Sincroniza y abre la Agenda.
 */
export default function GoogleCalendarReturn() {
  const params = useLocalSearchParams<Params>();
  const qc = useQueryClient();
  const toast = useToast((t) => t.show);
  const key = params.state ?? '';
  const [failure, setError] = useState<string | null>(null);
  const error = key ? failure : 'El enlace no es válido.';

  useEffect(() => {
    if (!key) return;
    const q = new URLSearchParams();
    for (const k of ['access_token', 'expires_in', 'scope', 'state', 'error'] as const) {
      const v = params[k];
      if (typeof v === 'string' && v) q.set(k, v);
    }
    let alive = true;
    completeGoogleRedirect(`nebula://google-calendar?${q}`)
      .then(async (r) => {
        if (r.kind === 'synced') { await qc.invalidateQueries(); toast(`Google Calendar conectado: ${r.count} eventos.`); }
        if (alive) router.replace('/agenda');
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'No se pudo conectar Google Calendar.'); });
    return () => { alive = false; };
    // Los parámetros llegan una vez con la URL; `key` identifica la respuesta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <View style={styles.root}>
      {error ? (
        <>
          <Text variant="title3">No se pudo conectar Google Calendar</Text>
          <Text tone="secondary" style={styles.center}>{error}</Text>
          <Button label="Ir a la Agenda" variant="secondary" onPress={() => router.replace('/agenda')} />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.accentBright} />
          <Text tone="secondary">Importando tu Google Calendar…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4], padding: spacing[6], backgroundColor: colors.bg },
  center: { textAlign: 'center', maxWidth: 360 },
});
