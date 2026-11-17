import { BellOff } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/primitives/Card';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, spacing } from '@/design/tokens';

/**
 * Explicación previa a pedir un permiso del sistema, o estado «sin permiso» con salida clara.
 * Nunca bloquea la app: siempre hay una alternativa (`onSkip`).
 */
export function PermissionState({ icon, title, reason, denied, onRequest, onSkip }: {
  icon?: ReactNode; title: string; reason: string; denied?: boolean; onRequest?: () => void; onSkip?: () => void;
}) {
  return (
    <Card tone={denied ? 'warning' : 'default'} accessibilityRole="summary">
      <View style={styles.head}>
        {icon ?? <BellOff size={22} color={denied ? colors.warning : colors.accentSoft} accessibilityElementsHidden importantForAccessibility="no" />}
        <Text variant="title3" style={styles.flex}>{title}</Text>
      </View>
      <Text tone="secondary">{denied ? `${reason} El permiso está desactivado; puedes activarlo en los ajustes del sistema.` : reason}</Text>
      <View style={styles.actions}>
        {onSkip ? <Button label="Ahora no" variant="ghost" onPress={onSkip} /> : null}
        {onRequest ? <Button label={denied ? 'Abrir ajustes' : 'Permitir'} onPress={onRequest} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2], flexWrap: 'wrap' },
});
