import { router } from 'expo-router';
import { Quote } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

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
    <Pressable onPress={() => router.push('/motivacion')} accessibilityRole="button" accessibilityHint="Abre Motivación para cambiar la frase" style={({ pressed }) => [styles.root, pressed && styles.pressed]}>
      <LinearGradient colors={['#C9B6FF', '#E58FD0', '#7DF3FF']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.bar} />
      <View style={styles.body}>
        <View style={styles.head}>
          <Quote size={14} color={colors.accentSoft} />
          <Text variant="overline" tone="accent">TU FRASE</Text>
        </View>
        <Text variant="bodyStrong" style={styles.text}>{featured.text}</Text>
        {featured.author ? <Text variant="caption" tone="tertiary">— {featured.author}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', gap: spacing[4], paddingVertical: spacing[1] },
  bar: { width: 3, borderRadius: radius.pill, boxShadow: '0 0 12px rgba(229, 143, 208, 0.8)' } as ViewStyle,
  body: { flex: 1, gap: spacing[1] },
  pressed: { opacity: 0.7 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  text: { color: colors.text, fontSize: 17, lineHeight: 25 },
});
