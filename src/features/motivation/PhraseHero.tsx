import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text as RNText, useWindowDimensions, View, type TextStyle } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, fontFamily, spacing } from '@/design/tokens';

const GRADIENT = ['#C9B6FF', '#E58FD0', '#7DF3FF'] as const;

/**
 * Tamaño de la frase según su longitud y el ancho de pantalla: destacada, pero proporcionada
 * (en el móvil no debe pasar de unas tres o cuatro líneas).
 */
export function phraseSize(text: string, compact: boolean): { fontSize: number; lineHeight: number } {
  const [large, medium, small] = compact ? [22, 20, 18] : [27, 24, 21];
  const size = text.length > 140 ? small : text.length > 90 ? medium : large;
  return { fontSize: size, lineHeight: Math.round(size * 1.25) };
}

export interface PhraseHeroProps {
  text: string;
  author?: string | null;
  label: string;
  onPress?: () => void;
  accessibilityHint?: string;
}

/** Frase del día en Hoy: sin caja, cursiva serif entre comillas rosas y firma con degradado. */
export function PhraseHero({ text, author, label, onPress, accessibilityHint }: PhraseHeroProps) {
  const compact = useWindowDimensions().width < 600;
  const size = phraseSize(text, compact);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${label}: ${text}${author ? `, ${author}` : ''}`}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.root, compact && styles.rootCompact, pressed && styles.pressed]}
    >
      <Text variant="overline" tone="accent" style={styles.label}>{label}</Text>
      <Text style={[styles.text, size]}>
        <RNText style={styles.mark}>“</RNText>
        {text}
        <RNText style={styles.mark}>”</RNText>
      </Text>
      <View style={styles.signature}>
        <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.rule} />
        {author ? <Text variant="callout" style={styles.author}>{author}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[3], paddingVertical: spacing[2], maxWidth: 760 },
  rootCompact: { gap: spacing[2], paddingVertical: spacing[1] },
  pressed: { opacity: 0.7 },
  mark: { fontFamily: fontFamily.serif, color: '#E58FD0', textShadowColor: 'rgba(229, 143, 208, 0.6)', textShadowRadius: 14 } as TextStyle,
  label: { letterSpacing: 2.4 },
  text: {
    fontFamily: fontFamily.serifItalic,
    color: colors.text,
    letterSpacing: -0.2,
    textShadowColor: 'rgba(229, 143, 208, 0.3)',
    textShadowRadius: 14,
  } as TextStyle,
  signature: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  rule: { width: 28, height: 2, borderRadius: 2 },
  author: { color: colors.accentSoft, fontFamily: fontFamily.semibold },
});
