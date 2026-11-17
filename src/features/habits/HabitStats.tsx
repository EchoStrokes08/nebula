import { StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/charts/BarChart';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { bestWeekday, compareRecent, weekdayDistribution, weeklySeries } from '@/domain/habits/stats';
import type { HabitDef, HabitLog } from '@/domain/habits/types';
import type { DayKey } from '@/lib/dates';

const DAY_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const DAY_NAME = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function HabitStats({ habit, logs, today, weekStartsOn, color }: { habit: HabitDef; logs: HabitLog[]; today: DayKey; weekStartsOn: number; color: string }) {
  const series = weeklySeries(habit, logs, today, 8, weekStartsOn);
  const cmp = compareRecent(series, 4);
  const counts = weekdayDistribution(logs);
  const best = bestWeekday(counts);
  const enough = series.filter((s) => s.rate !== null).length >= 3;
  const order = Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);

  return (
    <View style={styles.card}>
      <Text variant="title3">Tendencia</Text>
      {!enough ? (
        <Text tone="secondary">Necesitas al menos 3 semanas de historial para ver la tendencia.</Text>
      ) : (
        <>
          <BarChart
            bars={series.map((s, i) => ({ label: `${s.weekStart.slice(8)}/${s.weekStart.slice(5, 7)}`, value: s.rate === null ? null : Math.round(s.rate * 100), highlight: i === series.length - 1 }))}
            max={100}
            color={color}
            summary={`Cumplimiento semanal de las últimas 8 semanas: ${series.map((s) => (s.rate === null ? 'sin datos' : `${Math.round(s.rate * 100)} %`)).join(', ')}`}
          />
          {cmp.delta !== null ? (
            <Text variant="callout" tone={cmp.delta >= 0 ? 'success' : 'warning'}>
              Últimas 4 semanas: {Math.round((cmp.current ?? 0) * 100)} % ({cmp.delta >= 0 ? '+' : '−'}
              {Math.abs(Math.round(cmp.delta * 100))} puntos frente a las 4 anteriores)
            </Text>
          ) : (
            <Text variant="callout" tone="tertiary">La comparación con el periodo anterior aparecerá con 8 semanas de historial.</Text>
          )}
        </>
      )}
      <Text variant="title3" style={styles.mt}>Por día de la semana</Text>
      <BarChart
        bars={order.map((d) => ({ label: DAY_SHORT[d]!, value: counts[d]!, highlight: d === best }))}
        color={color}
        height={80}
        summary={`Días con registro por día de la semana: ${order.map((d) => `${DAY_NAME[d]} ${counts[d]}`).join(', ')}`}
      />
      <Text variant="callout" tone="secondary">
        {best !== null ? `Tu día más constante es el ${DAY_NAME[best]}.` : 'Aún no hay un día que destaque (se necesitan al menos 8 días con registro).'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3], padding: spacing[5], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  mt: { marginTop: spacing[2] },
});
