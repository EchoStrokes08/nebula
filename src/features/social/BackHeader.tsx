import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, spacing } from '@/design/tokens';

export function BackLink({ label = 'Volver', fallback = '/retos' }: { label?: string; fallback?: '/retos' | '/perfil' | '/hoy' }) {
  return (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))} accessibilityRole="button" accessibilityLabel={label} style={styles.back} hitSlop={8}>
      <ArrowLeft size={20} color={colors.textSecondary} />
      <Text variant="callout" tone="secondary">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({ back: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], alignSelf: 'flex-start' } });
