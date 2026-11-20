import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, spacing } from '@/design/tokens';
import { exchangeCode, wasExchanged } from '@/features/auth/api';
import { authErrorMessage } from '@/features/auth/errors';
import { useAuth } from '@/features/auth/session';

/** Destino de los enlaces de confirmación y recuperación (`nebula://auth/callback?code=…`). */
export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string; next?: string; error_description?: string }>();
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const error =
    params.error_description ?? exchangeError ?? (params.code ? null : 'El enlace no es válido o ya se usó.');

  useEffect(() => {
    if (!params.code) return;
    // Vuelta duplicada de un inicio de sesión o una conexión (p. ej. Google Calendar) que ya se
    // completó en otra parte: no se vuelve a canjear el código, se regresa a donde estaba.
    if (wasExchanged(params.code)) {
      if (router.canGoBack()) router.back(); else router.replace('/');
      return;
    }
    if (params.next === 'recovery') useAuth.getState().setRecovery(true);
    exchangeCode(params.code)
      .then(() => router.replace('/'))
      .catch((e) => {
        useAuth.getState().setRecovery(false);
        // El código ya no vale pero la sesión sigue abierta: era una vuelta repetida, no un error.
        if (useAuth.getState().session && params.next !== 'recovery') { if (router.canGoBack()) router.back(); else router.replace('/'); return; }
        setExchangeError(`${authErrorMessage(e)} El enlace puede haber caducado.`);
      });
  }, [params.code, params.next]);

  return (
    <View style={styles.root}>
      {error ? (
        <>
          <Text variant="title3">No se pudo completar</Text>
          <Text tone="secondary" style={styles.center}>
            {error}
          </Text>
          <Button label="Ir a entrar" variant="secondary" onPress={() => router.replace('/entrar')} />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.accentBright} />
          <Text tone="secondary">Verificando enlace…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4], padding: spacing[6] },
  center: { textAlign: 'center', maxWidth: 360 },
});
