import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { spacing } from '@/design/tokens';
import { requestPasswordReset } from '@/features/auth/api';
import { AuthShell } from '@/features/auth/AuthShell';
import { authErrorMessage } from '@/features/auth/errors';
import { FormMessage } from '@/features/auth/FormMessage';
import { resetRequestSchema, validate } from '@/features/auth/validation';

export default function Recuperar() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setMessage(null);
    const v = validate(resetRequestSchema, { email });
    if (!v.ok) return setError(v.errors.email ?? null);
    setError(null);
    setBusy(true);
    try {
      await requestPasswordReset(v.data.email);
      // Mensaje neutro: no revela si existe una cuenta con ese correo.
      setMessage({ tone: 'success', text: 'Si existe una cuenta con ese correo, recibirás un enlace para crear una contraseña nueva.' });
    } catch (e) {
      setMessage({ tone: 'danger', text: authErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Recuperar contraseña" subtitle="Te enviaremos un enlace para crear una nueva.">
      <View style={styles.form}>
        <TextField
          label="Correo"
          value={email}
          onChangeText={setEmail}
          error={error}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          inputMode="email"
          onSubmitEditing={submit}
        />
        {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
        <Button label="Enviar enlace" onPress={submit} loading={busy} fullWidth />
      </View>
      <Link href="/entrar" accessibilityRole="link">
        <Text variant="callout" tone="secondary">
          Volver a entrar
        </Text>
      </Link>
    </AuthShell>
  );
}

const styles = StyleSheet.create({ form: { gap: spacing[4] } });
