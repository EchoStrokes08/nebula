import { router } from 'expo-router';
import { ArrowLeft, Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { KeyboardScroll } from '@/components/layout/KeyboardScroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TimePicker } from '@/components/forms/TimePicker';
import { TimeRangeSlider } from '@/components/forms/TimeSlider';
import { useToast } from '@/components/overlays/UndoToast';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { saveAvailability, type Window } from '@/features/agenda/api';
import { useAgendaMutation, useAvailability } from '@/features/agenda/hooks';
import { WEEKDAYS } from '@/features/onboarding/options';
import { minutesOf, normalizeTime } from '@/lib/time';
import { SkeletonList } from '@/components/feedback/Skeleton';

type Draft = { weekday: number; start: string; end: string };

/** El deslizador llega a las 24:00; el servidor y los campos de hora usan 23:59 como fin del día. */
const endOfDay = (t: string) => (t === '24:00' ? '23:59' : t);

export default function Disponibilidad() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const availability = useAvailability();
  const toast = useToast((t) => t.show);
  const [draft, setDraft] = useState<Draft[] | null>(null);
  const save = useAgendaMutation(saveAvailability);
  const current: Draft[] = draft ?? (availability.data ?? []).map((w: Window) => ({ weekday: w.weekday, start: w.start, end: w.end }));
  const set = (i: number, patch: Partial<Draft>) => setDraft(current.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const back = () => (router.canGoBack() ? router.back() : router.replace('/agenda'));

  const submit = () => {
    const clean: Draft[] = [];
    for (const d of current) {
      const s = normalizeTime(d.start);
      const e = normalizeTime(endOfDay(d.end));
      if (!s || !e || minutesOf(e) <= minutesOf(s)) return toast('Revisa las horas: cada franja debe terminar después de empezar.');
      clean.push({ weekday: d.weekday, start: s, end: e });
    }
    save.mutate(clean, { onSuccess: () => { toast('Disponibilidad guardada'); back(); }, onError: () => toast('No se pudo guardar.') });
  };

  return (
    <KeyboardScroll contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[4], paddingBottom: insets.bottom + spacing[12] }, width >= 900 && styles.wide]} keyboardShouldPersistTaps="handled">
      <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Volver" style={styles.back} hitSlop={8}>
        <ArrowLeft size={20} color={colors.textSecondary} />
        <Text variant="callout" tone="secondary">Volver</Text>
      </Pressable>
      <Text variant="title1" accessibilityRole="header">Tu disponibilidad</Text>
      <Text tone="secondary">Las franjas en las que puedes trabajar en tus tareas. El planificador solo usa estos huecos, descontando tus eventos.</Text>
      {availability.isLoading ? <SkeletonList rows={3} /> : null}
      {WEEKDAYS.map((d) => {
        const rows = current.map((w, i) => ({ w, i })).filter((x) => x.w.weekday === d.value);
        return (
          <View key={d.value} style={styles.card}>
            <View style={styles.row}>
              <Text variant="bodyStrong" style={styles.flex}>{d.name}</Text>
              <Button label="Franja" variant="ghost" icon={<Plus size={16} color={colors.accentSoft} />} onPress={() => setDraft([...current, { weekday: d.value, start: '09:00', end: '13:00' }])} />
            </View>
            {rows.length === 0 ? <Text variant="callout" tone="tertiary">Sin franjas: no se planificará este día.</Text> : null}
            {rows.map(({ w, i }) => (
              <View key={i} style={styles.slot}>
                <View style={[styles.flex, styles.slotBody]}>
                  <TimeRangeSlider label={`Franja del ${d.name}`} start={w.start} end={w.end} onChange={(r) => set(i, r)} />
                  <View style={styles.times}>
                    <View style={styles.flex}><TimePicker label="Empieza" value={w.start} max={minutesOf(endOfDay(w.end)) - 5} onChange={(v) => set(i, { start: v })} /></View>
                    <View style={styles.flex}><TimePicker label="Termina" value={endOfDay(w.end)} min={minutesOf(w.start) + 5} onChange={(v) => set(i, { end: v })} /></View>
                  </View>
                </View>
                <Pressable onPress={() => setDraft(current.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={`Quitar franja del ${d.name}`} style={styles.remove}>
                  <X size={18} color={colors.textTertiary} />
                </Pressable>
              </View>
            ))}
          </View>
        );
      })}
      <Button label="Guardar" onPress={submit} loading={save.isPending} disabled={!draft} fullWidth />
    </KeyboardScroll>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing[5], gap: spacing[4] },
  wide: { maxWidth: 640, width: '100%', alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], alignSelf: 'flex-start' },
  card: { gap: spacing[3], padding: spacing[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[3] },
  slot: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  slotBody: { gap: spacing[3] },
  times: { flexDirection: 'row', gap: spacing[3] },
  remove: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
