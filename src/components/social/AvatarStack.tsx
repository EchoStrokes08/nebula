import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/social/Avatar';
import { Text } from '@/components/primitives/Text';
import { colors, spacing } from '@/design/tokens';

export interface Person { name: string; seed: string }

/** Avatares solapados con contador de los que no caben («+3»). */
export function AvatarStack({ people, max = 4, size = 28 }: { people: Person[]; max?: number; size?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <View style={styles.row} accessible accessibilityLabel={`${people.length} participantes: ${people.map((p) => p.name).join(', ')}`}>
      {shown.map((p, i) => (
        <View key={p.seed} style={[styles.ring, i > 0 && { marginLeft: -size / 3 }]}>
          <Avatar name={p.name} seed={p.seed} size={size} />
        </View>
      ))}
      {rest > 0 ? <Text variant="caption" tone="secondary" style={styles.more}>+{rest}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  ring: { borderRadius: 999, borderWidth: 2, borderColor: colors.surface },
  more: { marginLeft: spacing[2] },
});
