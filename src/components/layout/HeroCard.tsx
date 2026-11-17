import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { glassBlur } from '@/components/primitives/Card';
import { Text } from '@/components/primitives/Text';
import { colors, gradients, radius, spacing } from '@/design/tokens';

export interface HeroStat {
  label: string;
  value: string;
}

/**
 * Tarjeta destacada con degradado de nebulosa: resume el estado de la pantalla con un elemento
 * visual (anillo, icono) y dos o tres cifras grandes en lugar de párrafos.
 */
export function HeroCard({ visual, eyebrow, headline, stats, children }: { visual?: ReactNode; eyebrow?: string; headline: string; stats?: HeroStat[]; children?: ReactNode }) {
  return (
    <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.root, glassBlur]} accessibilityRole="summary">
      <View style={styles.glow} pointerEvents="none" />
      <View style={styles.top}>
        {visual}
        <View style={styles.copy}>
          {eyebrow ? <Text variant="overline" style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}
          <Text variant="title2">{headline}</Text>
        </View>
      </View>
      {stats?.length ? (
        <View style={styles.stats}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat}>
              <Text variant="metric" tabular>{s.value}</Text>
              <Text variant="caption" tone="secondary">{s.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[4], padding: spacing[5], borderRadius: radius.xl + 4, borderWidth: 1, borderColor: 'rgba(199, 169, 255, 0.35)', overflow: 'hidden' },
  glow: { position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(229, 143, 208, 0.18)' },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  copy: { flex: 1, gap: spacing[1] },
  eyebrow: { color: colors.accentSoft },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  stat: { flexGrow: 1, flexBasis: 90, gap: 2, paddingVertical: spacing[3], paddingHorizontal: spacing[4], borderRadius: radius.lg, backgroundColor: 'rgba(11, 8, 21, 0.45)', borderWidth: 1, borderColor: 'rgba(199, 169, 255, 0.16)' },
});
