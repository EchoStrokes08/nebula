import AsyncStorage from '@react-native-async-storage/async-storage';
import { Lightbulb } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { useToast } from '@/components/overlays/UndoToast';
import { Button } from '@/components/primitives/Button';
import { Card } from '@/components/primitives/Card';
import { Text } from '@/components/primitives/Text';
import { colors, spacing } from '@/design/tokens';
import { adaptiveRecommendations, type AdaptiveRecommendation } from '@/domain/habits/adaptive';
import { targetAt } from '@/domain/habits/evaluate';
import type { DayKey } from '@/lib/dates';

import * as api from './api';
import type { HabitRecord, LogRecord } from './api';
import { useHabitMutation } from './hooks';

/** Recomendaciones descartadas (por id; el id incluye el valor propuesto, así una nueva propuesta vuelve a mostrarse). */
export const useDismissed = create<{ ids: string[]; dismiss(id: string): void }>()(
  persist((set) => ({ ids: [], dismiss: (id) => set((s) => ({ ids: [...s.ids.slice(-199), id] })) }), { name: 'nebula-dismissed-recs', storage: createJSONStorage(() => AsyncStorage) }),
);

export async function applyRecommendation(habit: HabitRecord, rec: AdaptiveRecommendation, today: DayKey) {
  const c = rec.change;
  if (c.type === 'target') {
    const t = targetAt(habit, today);
    if (!t) throw new Error('El hábito no tiene objetivo vigente.');
    await api.setTarget(habit.id, today, { period: t.period, target: c.target, sessionMin: t.sessionMin ?? null, minTarget: t.minTarget != null ? Math.min(t.minTarget, c.target) : null });
  } else if (c.type === 'days') await api.updateHabit(habit.id, { schedule_days: c.days });
  else if (c.type === 'time') await api.updateHabit(habit.id, { suggested_time: c.time });
}

/** Tarjeta de recomendaciones adaptativas del detalle de hábito (F04-021). */
export function HabitRecommendations({ habit, logs, today, timeZone, weekStartsOn }: { habit: HabitRecord; logs: LogRecord[]; today: DayKey; timeZone: string; weekStartsOn: number }) {
  const result = useMemo(() => adaptiveRecommendations({ habit, logs, today, timeZone, weekStartsOn }), [habit, logs, today, timeZone, weekStartsOn]);
  const dismissed = useDismissed((s) => s.ids);
  const dismiss = useDismissed((s) => s.dismiss);
  const toast = useToast((t) => t.show);
  const apply = useHabitMutation((rec: AdaptiveRecommendation) => applyRecommendation(habit, rec, today));
  if (result.status === 'insufficient') {
    return (
      <Card>
        <Text variant="title3">Recomendaciones</Text>
        <Text tone="secondary">Necesitas {result.needed} periodos cerrados para recibir sugerencias fiables. Llevas {result.have}.</Text>
      </Card>
    );
  }
  const items = result.items.filter((i) => !dismissed.includes(i.id));
  if (!items.length) return null;
  return (
    <Card>
      <View style={styles.head}>
        <Lightbulb size={18} color={colors.accentSoft} />
        <Text variant="title3">Recomendaciones</Text>
      </View>
      {items.map((r) => (
        <View key={r.id} style={styles.item} accessibilityRole="summary">
          <Text variant="bodyStrong">{r.title}</Text>
          <Text variant="callout" tone="secondary">{r.reason}</Text>
          <Text variant="caption" tone="accent">{r.preview}</Text>
          <View style={styles.actions}>
            <Button label="Descartar" variant="ghost" onPress={() => dismiss(r.id)} />
            {r.change.type !== 'none' ? (
              <Button
                label="Aplicar"
                variant="secondary"
                loading={apply.isPending && apply.variables?.id === r.id}
                onPress={() => apply.mutate(r, { onSuccess: () => { dismiss(r.id); toast('Cambio aplicado desde hoy'); }, onError: () => toast('No se pudo aplicar. Revisa la conexión.') })}
              />
            ) : null}
          </View>
        </View>
      ))}
      <Text variant="caption" tone="tertiary">Sugerencias calculadas con tus registros; nada cambia sin tu confirmación.</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  item: { gap: spacing[1], paddingTop: spacing[3], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2] },
});
