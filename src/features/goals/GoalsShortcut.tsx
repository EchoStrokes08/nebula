import { router } from 'expo-router';
import { ChevronRight, Flag } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';

import { useGoals } from './hooks';

/** Acceso a «Metas y proyectos» desde Hoy, Hábitos y Agenda (prompt §4). */
export function GoalsShortcut() {
  const goals = useGoals();
  const active = (goals.data ?? []).filter((g) => g.status === 'active').length;
  return (
    <Pressable
      onPress={() => router.push('/metas')}
      accessibilityRole="button"
     
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}
    >
      <Flag size={18} color={colors.accentSoft} />
      <Text variant="bodyStrong" style={styles.flex}>Metas y proyectos</Text>
      <Text variant="callout" tone="secondary" tabular>{goals.isLoading ? '' : `${active} activas`}</Text>
      <ChevronRight size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pressed: { backgroundColor: colors.surfacePressed },
  flex: { flex: 1 },
});
