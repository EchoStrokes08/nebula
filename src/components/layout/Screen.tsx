import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, Sparkles } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { navLayoutFor } from '@/components/navigation/sections';
import { Text } from '@/components/primitives/Text';
import { colors, gradients, radius, spacing } from '@/design/tokens';

export interface ScreenProps {
  title: string;
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
export function Screen({ title, overline, subtitle, trailing, children, back, wide }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = navLayoutFor(width) === 'sidebar';
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
      <View style={styles.header}>
        <View style={styles.titleBox}>
          {overline ? (
            <View style={styles.pill}>
              <Sparkles size={12} color={colors.accentSoft} />
              <Text variant="overline" tone="accent">
                {overline.toUpperCase()}
              </Text>
            </View>
          ) : null}
          <Text variant={desktop ? 'display' : 'title1'} accessibilityRole="header" style={desktop ? styles.titleDesktop : styles.title}>
            {title}
          </Text>
          <LinearGradient colors={gradients.aurora} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bar} />
          {subtitle ? <Text variant="callout" tone="secondary" style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {trailing}
      </View>
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
  pill: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], alignSelf: 'flex-start', paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.pill, backgroundColor: 'rgba(128, 85, 232, 0.2)', borderWidth: 1, borderColor: 'rgba(169, 135, 255, 0.35)' },
  title: { fontSize: 30, lineHeight: 36, textShadowColor: 'rgba(169, 135, 255, 0.55)', textShadowRadius: 18 },
  titleDesktop: { fontSize: 40, lineHeight: 46, textShadowColor: 'rgba(169, 135, 255, 0.55)', textShadowRadius: 22 },
  bar: { width: 56, height: 4, borderRadius: radius.pill },
  subtitle: { maxWidth: 520 },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], alignSelf: 'flex-start', marginBottom: -spacing[3] },
});
