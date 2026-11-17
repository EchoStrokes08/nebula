import { X } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/social/Avatar';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';

type Status = 'invited' | 'accepted' | 'declined' | 'left';
const statusLabel: Record<Status, string> = { invited: 'Pendiente', accepted: 'Aceptó', declined: 'Rechazó', left: 'Abandonó' };
const statusTone: Record<Status, 'warning' | 'success' | 'danger' | 'tertiary'> = { invited: 'warning', accepted: 'success', declined: 'danger', left: 'tertiary' };

/** Persona invitada a un reto o círculo, con su estado y, opcionalmente, botón para quitarla. */
export function ParticipantChip({ name, handle, status, onRemove }: { name: string; handle: string; status?: Status; onRemove?: () => void }) {
  return (
    <View style={styles.chip}>
      <Avatar name={name} seed={handle} size={24} />
      <Text variant="callout">{name}</Text>
      {status ? <Text variant="caption" tone={statusTone[status]}>{statusLabel[status]}</Text> : null}
      {onRemove ? (
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Quitar a ${name}`} hitSlop={12} style={styles.remove}>
          <X size={14} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[1], paddingLeft: spacing[1], paddingRight: spacing[3], borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, minHeight: 36 },
  remove: { padding: spacing[1] },
});
