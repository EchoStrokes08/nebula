import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, fontFamily, spacing } from '@/design/tokens';
import { formatElapsed, progressAt } from '@/domain/assistant/progress';

/**
 * Lo que hace el asistente mientras responde: etapas con su estado y el tiempo transcurrido.
 * `notice` (reintento tras una saturación o un corte) se muestra encima de las etapas.
 */
export function AssistantProgress({ kind, notice }: { kind: 'plan' | 'chat'; notice?: string }) {
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(started);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = Math.max(0, (now - started) / 1000);
  const { steps, current, slow } = progressAt(kind, elapsed);
  const hint = kind === 'plan'
    ? (slow ? ' · tarda más de lo normal; sigo esperando la respuesta' : ' · un plan detallado suele tardar entre medio minuto y dos')
    : (slow ? ' · tarda más de lo normal' : '');
  return (
    <View style={styles.root} accessibilityRole="progressbar" accessibilityLabel={`${steps[current]!.label}. ${formatElapsed(elapsed)}`} accessibilityLiveRegion="polite">
      {notice ? <Text variant="callout" tone="warning">{notice}</Text> : null}
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={s.label} style={styles.step}>
            <View style={[styles.mark, done && styles.markDone]}>
              {done ? <Check size={11} color={colors.textOnAccent} strokeWidth={3} /> : active ? <ActivityIndicator size="small" color={colors.accentSoft} /> : <View style={styles.dot} />}
            </View>
            <Text variant="callout" tone={active ? undefined : 'tertiary'} style={active ? styles.active : undefined}>{s.label}</Text>
          </View>
        );
      })}
      <Text variant="caption" tone="tertiary" tabular>{formatElapsed(elapsed)}{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[2] },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  mark: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  markDone: { backgroundColor: colors.success },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  active: { fontFamily: fontFamily.semibold },
});
