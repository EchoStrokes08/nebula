import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';

/** Se muestra cuando faltan las variables de Supabase: la app no finge funcionar sin backend. */
export function ConfigRequired({ missing }: { missing: string[] }) {
  return (
    <View style={styles.root}>
      <View style={styles.card} accessibilityRole="alert">
        <Text variant="overline" tone="warning">
          CONFIGURACIÓN NECESARIA
        </Text>
        <Text variant="title2">Nebula necesita conectarse a su servidor</Text>
        <Text tone="secondary">
          Faltan variables de entorno. Copia <Text variant="bodyStrong">.env.example</Text> a{' '}
          <Text variant="bodyStrong">.env</Text>, completa los valores de tu proyecto de Supabase y reinicia la app.
        </Text>
        <View style={styles.list}>
          {missing.map((m) => (
            <Text key={m} variant="callout" tone="accent" tabular>
              • {m}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[5] },
  card: {
    maxWidth: 480,
    width: '100%',
    gap: spacing[3],
    padding: spacing[6],
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  list: { gap: spacing[1], marginTop: spacing[2] },
});
