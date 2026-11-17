import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { spacing } from '@/design/tokens';
import { AuthShell } from '@/features/auth/AuthShell';
import { GoogleButton } from '@/features/auth/GoogleButton';

export default function Bienvenida() {
  return (
    <AuthShell title="Tu día, claro. Tu progreso, real." subtitle="Organiza hábitos, tareas y metas. Compite y colabora con tus amigos con reglas justas.">
      <View style={styles.actions}>
        <GoogleButton />
        <Button label="Crear cuenta con correo" onPress={() => router.push('/registro')} fullWidth />
        <Button label="Ya tengo cuenta" variant="secondary" onPress={() => router.push('/entrar')} fullWidth />
      </View>
      <Text variant="caption" tone="tertiary">
        Tus datos son privados por defecto. Tú decides qué ven tus amigos.
      </Text>
    </AuthShell>
  );
}

const styles = StyleSheet.create({ actions: { gap: spacing[3] } });
