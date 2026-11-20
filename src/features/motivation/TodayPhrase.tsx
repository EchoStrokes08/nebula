import { router } from 'expo-router';
import { Quote } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import type { MotivationContext } from '@/domain/motivation/engine';

import { MotivationLine } from './MotivationLine';
import { useFeaturedPhrase } from './phrases';

/** Hoy: la frase principal elegida en Motivación; si no hay, el mensaje contextual del día. */
export function TodayPhrase({ moment }: { moment: MotivationContext['moment'] }) {
  const featured = useFeaturedPhrase();
  if (!featured) return <MotivationLine moment={moment} />;
  return (
    <Pressable onPress={() => router.push('/motivacion')} accessibilityRole="button" accessibilityHint="Abre Motivación para cambiar la frase" style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.head}>
        <Quote size={16} color={colors.accentSoft} />
        <Text variant="overline" tone="accent">TU FRASE</Text>
      </View>
      <Text variant="title3" style={styles.text}>{featured.text}</Text>
      {featured.author ? <Text variant="caption" tone="secondary">— {featured.author}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[2], padding: spacing[5], borderRadius: radius.xl, backgroundColor: 'rgba(128, 85, 232, 0.14)', borderWidth: 1, borderColor: colors.borderStrong },
  pressed: { opacity: 0.85 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  text: { color: colors.text },
});
