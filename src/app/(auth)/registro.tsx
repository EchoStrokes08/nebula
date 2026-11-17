import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { spacing } from '@/design/tokens';
import { deviceTimeZone, isHandleAvailable, resendConfirmation, signUp } from '@/features/auth/api';
import { AuthShell } from '@/features/auth/AuthShell';
import { authErrorMessage } from '@/features/auth/errors';
import { FormMessage } from '@/features/auth/FormMessage';
import { GoogleButton, OrDivider } from '@/features/auth/GoogleButton';
import { HANDLE_RE, signUpSchema, validate, type FieldErrors } from '@/features/auth/validation';

type Fields = { displayName: string; handle: string; email: string; password: string };

export default function Registro() {
  const [form, setForm] = useState<Fields>({ displayName: '', handle: '', email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors<Fields>>({});
  const [check, setCheck] = useState<{ handle: string; free: boolean } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Fields) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Comprobación de @usuario con retardo para no consultar en cada pulsación.
  const candidate = form.handle.trim().toLowerCase();
  const validHandle = HANDLE_RE.test(candidate);
  const handleState: 'idle' | 'checking' | 'free' | 'taken' = !validHandle
    ? 'idle'
    : check?.handle !== candidate
      ? 'checking'
      : check.free
        ? 'free'
        : 'taken';

  useEffect(() => {
    if (!validHandle) return;
    let cancelled = false;
    const t = setTimeout(() => {
      isHandleAvailable(candidate)
        .then((free) => !cancelled && setCheck({ handle: candidate, free }))
        .catch(() => {});
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [candidate, validHandle]);

  const submit = async () => {
    setMessage(null);
    const v = validate(signUpSchema, form);
    if (!v.ok) return setErrors(v.errors);
    if (handleState === 'taken') return setErrors({ handle: 'Ese @usuario ya está en uso.' });
    setErrors({});
    setBusy(true);
    try {
      const { needsConfirmation } = await signUp({ ...v.data, timezone: deviceTimeZone() });
      if (needsConfirmation) setSentTo(v.data.email);
    } catch (e) {
      setMessage(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <AuthShell title="Revisa tu correo" subtitle={`Te enviamos un enlace de confirmación a ${sentTo}.`}>
        <Text tone="secondary">Ábrelo en este dispositivo para entrar directamente, o confírmalo y vuelve aquí para iniciar sesión.</Text>
        {message ? <FormMessage tone="success">{message}</FormMessage> : null}
        <View style={styles.form}>
          <Button
            label="Reenviar correo"
            variant="secondary"
            onPress={() =>
              resendConfirmation(sentTo)
                .then(() => setMessage('Correo reenviado.'))
                .catch((e) => setMessage(authErrorMessage(e)))
            }
          />
          <Link href="/entrar" accessibilityRole="link">
            <Text variant="callout" tone="accent">
              Ya lo confirmé, iniciar sesión
            </Text>
          </Link>
        </View>
      </AuthShell>
    );
  }

  const handleHint =
    handleState === 'checking'
      ? 'Comprobando…'
      : handleState === 'free'
        ? 'Disponible.'
        : 'Así te encontrarán tus amigos. Tu correo nunca es público.';

  return (
    <AuthShell title="Crear cuenta" subtitle="Menos de un minuto. Después personalizas lo demás.">
      <GoogleButton />
      <OrDivider />
      <View style={styles.form}>
        <TextField label="Nombre visible" value={form.displayName} onChangeText={set('displayName')} error={errors.displayName} autoComplete="name" />
        <TextField
          label="@usuario"
          value={form.handle}
          onChangeText={set('handle')}
          error={errors.handle ?? (handleState === 'taken' ? 'Ese @usuario ya está en uso.' : null)}
          hint={handleHint}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={Platform.OS === 'web' ? 'username' : 'username-new'}
        />
        <TextField
          label="Correo"
          value={form.email}
          onChangeText={set('email')}
          error={errors.email}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          inputMode="email"
        />
        <TextField
          label="Contraseña"
          value={form.password}
          onChangeText={set('password')}
          error={errors.password}
          hint="Al menos 10 caracteres, con letras y números."
          secure
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={submit}
        />
        {message ? <FormMessage tone="danger">{message}</FormMessage> : null}
        <Button label="Crear cuenta" onPress={submit} loading={busy} fullWidth />
      </View>
      <Link href="/entrar" accessibilityRole="link">
        <Text variant="callout" tone="secondary">
          Ya tengo cuenta
        </Text>
      </Link>
    </AuthShell>
  );
}

const styles = StyleSheet.create({ form: { gap: spacing[4] } });
