import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/primitives/Button';
import { spacing } from '@/design/tokens';
import { signOut, updatePassword } from '@/features/auth/api';
import { AuthShell } from '@/features/auth/AuthShell';
import { authErrorMessage } from '@/features/auth/errors';
import { FormMessage } from '@/features/auth/FormMessage';
import { useAuth } from '@/features/auth/session';
import { newPasswordSchema, validate, type FieldErrors } from '@/features/auth/validation';

export default function NuevaContrasena() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors<{ password: string; confirm: string }>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setMessage(null);
    const v = validate(newPasswordSchema, { password, confirm });
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    setBusy(true);
    try {
      await updatePassword(v.data.password);
      useAuth.getState().setRecovery(false);
    } catch (e) {
      setMessage(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Nueva contraseña" subtitle="Elige una contraseña que no uses en otros sitios.">
      <View style={styles.form}>
        <TextField label="Contraseña nueva" value={password} onChangeText={setPassword} error={errors.password} secure autoComplete="new-password" />
        <TextField label="Repítela" value={confirm} onChangeText={setConfirm} error={errors.confirm} secure autoComplete="new-password" onSubmitEditing={submit} />
        {message ? <FormMessage tone="danger">{message}</FormMessage> : null}
        <Button label="Guardar contraseña" onPress={submit} loading={busy} fullWidth />
        <Button label="Cancelar y salir" variant="ghost" onPress={() => signOut().catch(() => {})} />
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({ form: { gap: spacing[4] } });
