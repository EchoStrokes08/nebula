import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { navLayoutFor } from '@/components/navigation/sections';
import { Text } from '@/components/primitives/Text';
import { colors, spacing } from '@/design/tokens';

export interface ScreenProps {
  title: string;
  overline?: string;
  trailing?: ReactNode;
  children?: ReactNode;
  /** Enlace de vuelta sobre el título (pantallas secundarias). */
  back?: { label?: string; fallback: '/retos' | '/perfil' | '/hoy' | '/agenda' | '/habitos' };
  /** Ancho máximo mayor para layouts de columnas en escritorio. */
  wide?: boolean;
}

/** Contenedor de pantalla: cabecera, desplazamiento y ancho máximo legible en escritorio. */
export function Screen({ title, overline, trailing, children, back, wide }: ScreenProps) {
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
            <Text variant="overline" tone="accent">
              {overline.toUpperCase()}
            </Text>
          ) : null}
          <Text variant={desktop ? 'display' : 'title1'} accessibilityRole="header">
            {title}
          </Text>
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
  titleBox: { flexGrow: 1, flexShrink: 0, maxWidth: '100%' },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], alignSelf: 'flex-start', marginBottom: -spacing[3] },
});
