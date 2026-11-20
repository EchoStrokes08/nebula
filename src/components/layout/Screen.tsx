import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReducedMotion } from '@/hooks/useReducedMotion';

import { navLayoutFor } from '@/components/navigation/sections';
import { Text } from '@/components/primitives/Text';
import { colors, fontFamily, spacing } from '@/design/tokens';

export interface ScreenProps {
  title: string;
  /** Remate del título en cursiva y luz cálida (p. ej. «Buenas *noches*»). */
  titleAccent?: string;
  overline?: string;
  /** Frase corta bajo el título que da contexto a la pantalla. */
  subtitle?: string;
  trailing?: ReactNode;
  children?: ReactNode;
  /** Enlace de vuelta sobre el título (pantallas secundarias). */
  back?: { label?: string; fallback: '/retos' | '/perfil' | '/hoy' | '/agenda' | '/habitos' };
  /** Ancho máximo mayor para layouts de columnas en escritorio. */
  wide?: boolean;
}

/** Contenedor de pantalla: cabecera, desplazamiento y ancho máximo legible en escritorio. */
export function Screen({ title, titleAccent, overline, subtitle, trailing, children, back, wide }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = navLayoutFor(width) === 'sidebar';
  const reduced = useReducedMotion();
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.content,
        { paddingTop: (desktop ? spacing[10] : spacing[4]) + insets.top },
        // En Android deja sitio al botón flotante de captura.
        !desktop && styles.fabSpace,
        desktop && styles.desktop,
        desktop && wide && styles.wideContent,
      ]}
    >
      {back ? (
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace(back.fallback))}
          accessibilityRole="button"
          accessibilityLabel={back.label ?? 'Volver'}
          style={styles.back}
          hitSlop={8}
        >
          <ArrowLeft size={20} color={colors.textSecondary} />
          <Text variant="callout" tone="secondary">{back.label ?? 'Volver'}</Text>
        </Pressable>
      ) : null}
      <Animated.View entering={reduced ? undefined : FadeInDown.duration(380)} style={styles.header}>
        <View style={styles.titleBox}>
          {/* Regla de «carta estelar»: una estrella, la coordenada (fecha o contexto) y una línea fina. */}
          <View style={styles.rule} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Text style={styles.star}>✦</Text>
            {overline ? <Text variant="overline" style={styles.overline} numberOfLines={1}>{overline.toUpperCase()}</Text> : null}
            <View style={styles.line} />
          </View>
          {overline ? <Text variant="caption" style={styles.srOnly}>{overline}</Text> : null}
          <Text accessibilityRole="header" style={[styles.title, desktop && styles.titleDesktop]}>
            {title}
            {titleAccent ? <Text style={[styles.title, desktop && styles.titleDesktop, styles.accent]}>{` ${titleAccent}`}</Text> : null}
          </Text>
          {subtitle ? <Text variant="callout" tone="secondary" style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {trailing}
      </Animated.View>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[12], gap: spacing[6] },
  desktop: { paddingHorizontal: spacing[10], maxWidth: 1040, width: '100%', alignSelf: 'center' },
  fabSpace: { paddingBottom: spacing[16] + spacing[8] },
  wideContent: { maxWidth: 1480 },
  // En pantallas estrechas las acciones bajan de línea antes que partir el título.
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing[3] },
  titleBox: { flexGrow: 1, flexShrink: 0, maxWidth: '100%', gap: spacing[2] },
  rule: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: -spacing[1] },
  star: { color: colors.star, fontSize: 12, lineHeight: 14, textShadowColor: 'rgba(244, 221, 176, 0.9)', textShadowRadius: 8 },
  overline: { color: colors.star, opacity: 0.9, flexShrink: 1 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, minWidth: 24, backgroundColor: colors.hairline },
  srOnly: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  title: { fontFamily: fontFamily.serif, color: colors.text, fontSize: 42, lineHeight: 46, letterSpacing: -0.6 },
  titleDesktop: { fontSize: 56, lineHeight: 60, letterSpacing: -1 },
  accent: { fontFamily: fontFamily.serifItalic, color: colors.star, textShadowColor: 'rgba(244, 221, 176, 0.35)', textShadowRadius: 18 },
  subtitle: { maxWidth: 520 },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], alignSelf: 'flex-start', marginBottom: -spacing[3] },
});
