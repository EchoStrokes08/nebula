import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { KeyboardScroll } from '@/components/layout/KeyboardScroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TextField } from '@/components/forms/TextField';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { MIN_HISTORY, simulate } from '@/domain/goals/simulator';
import { useGoalSummaries } from '@/features/goals/hooks';
import { formatNumber } from '@/features/habits/format';
import { useToday } from '@/features/habits/useToday';
import { addDays, diffDays, startOfWeek } from '@/lib/dates';

const fmtWeeks = (w: number | null) => (w === null ? 'nunca con ese ritmo' : `${formatNumber(w)} semanas`);

export default function Simulador() {
  const { meta } = useLocalSearchParams<{ meta?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const today = useToday();
  const { summaries } = useGoalSummaries();
  const s = summaries?.find((x) => x.goal.id === meta);
  const remainingDefault = s ? Math.max(0, s.progress.target - s.progress.value) : 72;
  const weeksDefault = s?.goal.targetDate ? Math.max(0, Math.round((diffDays(today, s.goal.targetDate) / 7) * 10) / 10) : 12;
  const unit = s ? (s.goal.metric === 'quantity' ? (s.goal.metricUnit ?? '') : s.goal.metric === 'milestones' ? 'hitos' : 'tareas') : 'horas';

  const [remaining, setRemaining] = useState(String(remainingDefault));
  const [perWeek, setPerWeek] = useState('6');
  const [weeks, setWeeks] = useState(String(weeksDefault));

  // Historial real: avance semanal de los eventos de progreso de las últimas 8 semanas cerradas.
  const history: number[] = [];
  if (s && s.goal.metric === 'quantity') {
    const thisWeek = startOfWeek(today, 1);
    for (let w = 8; w >= 1; w--) {
      const start = addDays(thisWeek, -7 * w);
      if (start < s.goal.createdAt.slice(0, 10)) continue;
      const end = addDays(start, 6);
      history.push(s.goal.progressEvents.filter((e) => e.createdAt.slice(0, 10) >= start && e.createdAt.slice(0, 10) <= end).reduce((a, e) => a + e.delta, 0));
    }
  }

  const num = (v: string) => Number(v.replace(',', '.'));
  const valid = [remaining, perWeek].every((v) => v.trim() !== '' && Number.isFinite(num(v)) && num(v) >= 0);
  const result = valid ? simulate({ remaining: num(remaining), plannedPerWeek: num(perWeek), weeksUntilDeadline: weeks.trim() ? num(weeks) : null, history }) : null;

  return (
    <KeyboardScroll contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[4], paddingBottom: insets.bottom + spacing[12] }, width >= 900 && styles.wide]} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/metas'))} accessibilityRole="button" accessibilityLabel="Volver" style={styles.back} hitSlop={8}>
        <ArrowLeft size={20} color={colors.textSecondary} />
        <Text variant="callout" tone="secondary">Volver</Text>
      </Pressable>
      <View style={styles.head}>
        <Text variant="overline" tone="accent">SIMULADOR</Text>
        <Text variant="title1" accessibilityRole="header">{s ? s.goal.title : 'Antes de comprometerte'}</Text>
        <Text tone="secondary">Calcula cuánto tardarías con distintos ritmos. Cambia los valores para comparar escenarios.</Text>
      </View>

      <View style={styles.row}>
        <View style={styles.flex}><TextField label={`Pendiente (${unit})`} value={remaining} onChangeText={setRemaining} inputMode="decimal" /></View>
        <View style={styles.flex}><TextField label={`Ritmo (${unit}/semana)`} value={perWeek} onChangeText={setPerWeek} inputMode="decimal" /></View>
      </View>
      <TextField label="Semanas hasta el plazo (opcional)" value={weeks} onChangeText={setWeeks} inputMode="decimal" />

      {!result ? (
        <Text tone="danger">Introduce números válidos.</Text>
      ) : (
        <>
          <View style={styles.card}>
            <Text variant="overline" tone="secondary">CÁLCULO</Text>
            <Text variant="callout" tone="tertiary">Aritmética exacta con los datos que has indicado.</Text>
            {result.calculation.map((c) => (
              <View key={c.name} style={[styles.scenario, c.name === 'medio' && styles.scenarioMain]}>
                <View style={styles.flex}>
                  <Text variant="bodyStrong">{c.name[0]!.toUpperCase() + c.name.slice(1)} · {formatNumber(Math.round(c.perWeek * 10) / 10)} {unit}/semana</Text>
                  <Text variant="callout" tone="secondary">Terminarías en {fmtWeeks(c.weeks)}</Text>
                </View>
                {c.meetsDeadline !== null ? (
                  <Text variant="caption" tone={c.meetsDeadline ? 'success' : 'warning'}>{c.meetsDeadline ? 'Llega a tiempo' : 'No llega'}</Text>
                ) : null}
              </View>
            ))}
            {result.requiredPerWeek !== null ? (
              <Text variant="callout">Para cumplir el plazo necesitas {formatNumber(Math.round(result.requiredPerWeek * 10) / 10)} {unit} por semana.</Text>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text variant="overline" tone="secondary">ESTIMACIÓN CON TU HISTORIAL</Text>
            {result.estimate ? (
              <>
                <Text>
                  Tu ritmo real medio ha sido {formatNumber(Math.round(result.estimate.observedPerWeek * 10) / 10)} {unit}/semana en las últimas {result.estimate.basedOnWeeks} semanas.
                  Con ese ritmo terminarías en unas {fmtWeeks(result.estimate.weeksLikely)} (entre {fmtWeeks(result.estimate.weeksRange[0])} y {fmtWeeks(result.estimate.weeksRange[1])}).
                </Text>
                <Text variant="caption" tone="tertiary">Es una estimación estadística basada en tu variación semanal, no una garantía.</Text>
              </>
            ) : (
              <Text tone="secondary">
                Se necesitan al menos {MIN_HISTORY} semanas de avance registrado en esta meta para estimar con tu ritmo real. Hasta entonces, solo se muestra el cálculo.
              </Text>
            )}
          </View>
        </>
      )}
    </KeyboardScroll>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing[5], gap: spacing[5] },
  wide: { maxWidth: 720, width: '100%', alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], alignSelf: 'flex-start' },
  head: { gap: spacing[2] },
  row: { flexDirection: 'row', gap: spacing[3] },
  flex: { flex: 1 },
  card: { gap: spacing[3], padding: spacing[5], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  scenario: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radius.md, backgroundColor: colors.bgAlt },
  scenarioMain: { borderWidth: 1, borderColor: colors.accent },
});
