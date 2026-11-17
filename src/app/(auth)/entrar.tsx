import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { spacing } from '@/design/tokens';
import { resendConfirmation, signIn } from '@/features/auth/api';
import { AuthShell } from '@/features/auth/AuthShell';
import { useAuth } from '@/features/auth/session';
import { Card } from '@/components/primitives/Card';
import { authErrorMessage } from '@/features/auth/errors';
import { FormMessage } from '@/features/auth/FormMessage';
import { GoogleButton, OrDivider } from '@/features/auth/GoogleButton';
import { signInSchema, validate, type FieldErrors } from '@/features/auth/validation';

export default function Entrar() {
  const expired = useAuth((s) => s.expired);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<{ email: string; password: string }>>({});
  const [message, setMessage] = useState<{ tone: 'danger' | 'success'; text: string } | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setMessage(null);
    setUnconfirmed(false);
    const v = validate(signInSchema, { email, password });
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    setBusy(true);
    try {
      await signIn(v.data.email, v.data.password);
      // La guarda de navegación lleva a Hoy u onboarding cuando cambia la sesión.
    } catch (e) {
      const code = (e as { code?: string }).code;
      setUnconfirmed(code === 'email_not_confirmed');
      setMessage({ tone: 'danger', text: authErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await resendConfirmation(email.trim().toLowerCase());
      setMessage({ tone: 'success', text: 'Te hemos reenviado el correo de confirmación.' });
    } catch (e) {
      setMessage({ tone: 'danger', text: authErrorMessage(e) });
    }
  };

  return (
    <AuthShell title="Entrar" subtitle="Continúa donde lo dejaste.">
      {expired ? (
        <Card tone="warning" accessibilityRole="alert">
          <Text variant="bodyStrong">Tu sesión ha caducado</Text>
          <Text variant="callout" tone="secondary">Vuelve a entrar. Los registros que hiciste sin conexión siguen guardados en este dispositivo y se enviarán al entrar.</Text>
        </Card>
      ) : null}
      <GoogleButton />
      <OrDivider />
      <View style={styles.form}>
        <TextField
          label="Correo"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          inputMode="email"
        />
        <TextField
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          secure
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={submit}
        />
        {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
        {unconfirmed ? <Button label="Reenviar correo de confirmación" variant="ghost" onPress={resend} /> : null}
        <Button label="Entrar" onPress={submit} loading={busy} fullWidth />
      </View>
      <View style={styles.links}>
        <Link href="/recuperar" accessibilityRole="link">
          <Text variant="callout" tone="accent">
            ¿Olvidaste tu contraseña?
          </Text>
        </Link>
        <Link href="/registro" accessibilityRole="link">
          <Text variant="callout" tone="secondary">
            Crear una cuenta
          </Text>
        </Link>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing[4] },
  links: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing[3] },
});
