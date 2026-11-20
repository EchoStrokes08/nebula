import { CircleHelp, Trash2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Sheet } from '@/components/overlays/Sheet';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, spacing } from '@/design/tokens';

/**
 * Confirmación con el estilo de Nebula (en lugar del `Alert` de Android o el `confirm` del
 * navegador): hoja inferior en el móvil y modal centrado en escritorio. Las acciones destructivas
 * van en rojo y nunca son el botón por defecto.
 */
export function ConfirmDialog({ visible, title, message, confirmLabel, destructive = true, loading, onConfirm, onCancel }: {
  visible: boolean; title: string; message: string; confirmLabel: string; destructive?: boolean; loading?: boolean; onConfirm(): void; onCancel(): void;
}) {
  const Icon = destructive ? Trash2 : CircleHelp;
  return (
    <Sheet visible={visible} onClose={onCancel} title={title}>
      <View style={styles.body}>
        <View style={[styles.icon, destructive ? styles.iconDanger : styles.iconAccent]}>
          <Icon size={22} color={destructive ? colors.danger : colors.accentSoft} />
        </View>
        <Text tone="secondary" style={styles.flex}>{message}</Text>
      </View>
      <View style={styles.actions}>
        <View style={styles.flex}><Button label="Cancelar" variant="secondary" fullWidth onPress={onCancel} /></View>
        <View style={styles.flex}><Button label={confirmLabel} variant={destructive ? 'danger' : 'primary'} fullWidth loading={loading} onPress={onConfirm} /></View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  iconDanger: { backgroundColor: colors.dangerMuted, borderColor: 'rgba(240, 122, 138, 0.35)' },
  iconAccent: { backgroundColor: colors.accentMuted, borderColor: colors.borderStrong },
  actions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[1] },
  flex: { flex: 1 },
});
