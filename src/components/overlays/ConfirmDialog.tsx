import { StyleSheet, View } from 'react-native';

import { Sheet } from '@/components/overlays/Sheet';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { spacing } from '@/design/tokens';

/**
 * Confirmación con el estilo de Nebula (en lugar del `confirm` del navegador). Las acciones
 * destructivas usan la variante `danger` y nunca son el botón por defecto.
 */
export function ConfirmDialog({ visible, title, message, confirmLabel, destructive = true, loading, onConfirm, onCancel }: {
  visible: boolean; title: string; message: string; confirmLabel: string; destructive?: boolean; loading?: boolean; onConfirm(): void; onCancel(): void;
}) {
  return (
    <Sheet visible={visible} onClose={onCancel} title={title}>
      <Text tone="secondary">{message}</Text>
      <View style={styles.actions}>
        <Button label="Cancelar" variant="ghost" onPress={onCancel} />
        <Button label={confirmLabel} variant={destructive ? 'danger' : 'primary'} loading={loading} onPress={onConfirm} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({ actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2], flexWrap: 'wrap' } });
