import { Moon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { restOffer } from '@/domain/habits/rest';
import type { HabitDef, HabitLog } from '@/domain/habits/types';
import type { DayKey } from '@/lib/dates';

import * as api from './api';
import { useHabitMutation } from './hooks';

const weekday = (day: string) => new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));

/** Día de descanso planificado: uno por semana, decidido antes (D-05: nunca hacia atrás). */
export function RestCard({ habit, logs, today, weekStartsOn }: { habit: HabitDef; logs: HabitLog[]; today: DayKey; weekStartsOn: number }) {
  const rest = useHabitMutation((day: DayKey) => api.pauseHabit(habit.id, day, day));
  const offer = restOffer(habit, logs, today, weekStartsOn);
  if (offer.unavailable) return null;

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.row}>
        <Moon size={16} color={colors.accentSoft} />
        <Text variant="bodyStrong">Día de descanso</Text>
      </View>
      <Text variant="callout" tone="secondary">
        Uno por semana, decidido de antemano. Ese día no cuenta: tu racha sigue intacta y la constancia no baja.
      </Text>
      {offer.usedThisWeek ? <Text variant="caption" tone="tertiary">Esta semana descansas el {weekday(offer.usedThisWeek)}.</Text> : null}
      {offer.options.length ? (
        <View style={styles.row}>
          {offer.options.map((o) => (
            <Button key={o.day} label={`Descansar ${o.label}`} variant="secondary" loading={rest.isPending && rest.variables === o.day} onPress={() => rest.mutate(o.day)} />
          ))}
        </View>
      ) : !offer.usedThisWeek ? (
        <Text variant="caption" tone="tertiary">Hoy y mañana no hay días disponibles para descansar.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3], padding: spacing[5], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
});
