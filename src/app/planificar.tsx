import { router, useLocalSearchParams } from 'expo-router';
import { AlertTriangle, ArrowLeft, Check, Settings2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/forms/Chip';
import { formatDay } from '@/components/forms/DateField';
import { useToast } from '@/components/overlays/UndoToast';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { atLocal, localMinutes } from '@/domain/calendar/expand';
import { planDay, type PlanTask } from '@/domain/planning/scheduler';
import { overload, viableDay, type ViableMode } from '@/domain/planning/viableDay';
import { useAgendaMutation, useAvailability } from '@/features/agenda/hooks';
import { useAgendaItems } from '@/features/agenda/useAgendaItems';
import { useTimeZone, useToday } from '@/features/habits/useToday';
import { usePreferences } from '@/features/profile/usePreferences';
import { updateTask } from '@/features/tasks/api';
import { useTasks } from '@/features/tasks/hooks';
import { DEFAULT_ESTIMATE, toPlanTasks } from '@/features/tasks/planTasks';
import { addDays, diffDays, isDayKey, type DayKey } from '@/lib/dates';
import { formatDuration, hhmm, minutesOf } from '@/lib/time';

const MODES: { v: ViableMode; l: string; h: string }[] = [
  { v: 'completo', l: 'Completo', h: 'Todo lo que cabe, por orden de urgencia e importancia.' },
  { v: 'esencial', l: 'Esencial', h: 'Solo lo vencido, lo que vence hoy y la prioridad alta que quepa.' },
  { v: 'recuperacion', l: 'Recuperación', h: 'Un día ligero: la mitad de tu tiempo y como mucho tres tareas imprescindibles.' },
];
const DEFAULT_WINDOWS = [
  { start: 9 * 60, end: 13 * 60 },
  { start: 15 * 60, end: 19 * 60 },
];

export default function Planificar() {
  const params = useLocalSearchParams<{ dia?: string; desde?: string }>();
  const today = useToday();
  const day = (params.dia && isDayKey(params.dia) ? params.dia : today) as DayKey;
  const tz = useTimeZone();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tasks = useTasks();
  const availability = useAvailability();
  const prefs = usePreferences();
  const { items } = useAgendaItems(day, day);
  const toast = useToast((t) => t.show);
  const [mode, setMode] = useState<ViableMode>('completo');
  const [deferIds, setDeferIds] = useState<string[]>([]);
  const apply = useAgendaMutation(async (v: { place: { id: string; start: number; end: number }[]; defer: string[] }) => {
    for (const p of v.place) await updateTask(p.id, { scheduledStart: atLocal(day, p.start, tz).toISOString(), scheduledEnd: atLocal(day, p.end, tz).toISOString() });
    for (const id of v.defer) {
      const t = tasks.data?.find((x) => x.id === id);
      await updateTask(id, { dueDate: addDays(t?.dueDate && t.dueDate > day ? t.dueDate : day, 1) });
    }
  });
  const back = () => (router.canGoBack() ? router.back() : router.replace('/agenda'));

  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const windows = (availability.data ?? []).filter((w) => w.weekday === weekday).map((w) => ({ start: minutesOf(w.start), end: minutesOf(w.end) }));
  const usingDefault = windows.length === 0;
  const available = usingDefault ? DEFAULT_WINDOWS : windows;
  const busy = items.filter((i) => !i.allDay && i.kind !== 'focus').map((i) => ({ start: i.start, end: i.end }));
  const all = tasks.data ?? [];
  const candidates: PlanTask[] = toPlanTasks(all, day, (t) => !t.scheduledStart && (!t.dueDate || diffDays(day, t.dueDate) <= 7));
  const preferred = (prefs.data?.focusWindows ?? []).map((w) => ({ start: minutesOf(w.start), end: minutesOf(w.end) }));
  // `desde` (HH:MM): el asistente pide reorganizar a partir de una hora («reorganiza mi tarde»).
  const from = params.desde && /^\d{2}:\d{2}$/.test(params.desde) ? minutesOf(params.desde) : 0;
  const notBefore = day === today ? Math.ceil(Math.max(localMinutes(new Date(), tz), from) / 5) * 5 : from || undefined;
  const capacity = planDay([], available, busy, { notBefore }).availableMinutes;
  const viable = viableDay(candidates, capacity, mode);
  const plan = planDay(candidates.filter((c) => viable.keep.includes(c.id)), available, busy, { notBefore, preferred, minChunk: Number.POSITIVE_INFINITY });
  const load = overload(candidates.reduce((a, c) => a + c.minutes, 0), capacity);
  const title = (id: string) => all.find((t) => t.id === id)?.title ?? '';
  const defaulted = (id: string) => !all.find((t) => t.id === id)?.estimateMinutes;
  const notPlaced = [...plan.unplaced.map((u) => u.taskId), ...viable.defer];

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[4], paddingBottom: insets.bottom + spacing[12] }, width >= 900 && styles.wide]}>
      <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Volver a Agenda" style={styles.back} hitSlop={8}>
        <ArrowLeft size={20} color={colors.textSecondary} />
        <Text variant="callout" tone="secondary">Agenda</Text>
      </Pressable>
      <View style={styles.head}>
        <Text variant="overline" tone="accent">PLANIFICAR · {formatDay(day, today).toUpperCase()}</Text>
        <Text variant="title1" accessibilityRole="header">Día viable</Text>
        <Text tone="secondary">Nebula propone; tú decides. No se mueve ni se elimina nada sin tu confirmación.</Text>
      </View>

      {usingDefault ? (
        <Pressable onPress={() => router.push('/disponibilidad')} style={styles.notice} accessibilityRole="button">
          <Settings2 size={18} color={colors.info} />
          <Text variant="callout" style={styles.flex}>Uso un horario por defecto (9–13 y 15–19). Configura tu disponibilidad para planes más realistas.</Text>
        </Pressable>
      ) : null}

      <View style={styles.wrap}>
        {MODES.map((m) => <Chip key={m.v} role="radio" label={m.l} selected={mode === m.v} onToggle={() => { setMode(m.v); setDeferIds([]); }} />)}
      </View>
      <Text variant="callout" tone="secondary">{MODES.find((m) => m.v === mode)!.h}</Text>

      {load.over ? (
        <View style={[styles.card, styles.warn]} accessibilityRole="alert">
          <View style={styles.line}><AlertTriangle size={18} color={colors.warning} /><Text variant="bodyStrong" style={styles.flex}>Más trabajo que tiempo</Text></View>
          <Text tone="secondary">Tienes {formatDuration(load.excessMinutes + capacity)} de tareas y {formatDuration(capacity)} libres. Aplaza, divide o reduce: el modo Esencial te ayuda a elegir.</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text variant="title3">Propuesta</Text>
        {candidates.length === 0 ? <Text tone="secondary">No hay tareas pendientes sin programar para estos días.</Text> : null}
        {plan.placed.length === 0 && candidates.length > 0 ? <Text tone="secondary">No hay huecos suficientes con los compromisos actuales.</Text> : null}
        {plan.placed.map((p) => (
          <View key={p.taskId} style={styles.slot}>
            <Text variant="bodyStrong" tabular style={styles.time}>{hhmm(p.start)}–{hhmm(p.end)}</Text>
            <View style={styles.flex}>
              <Text variant="bodyStrong">{title(p.taskId)}</Text>
              <Text variant="caption" tone="tertiary">{plan.reasons[p.taskId]}{defaulted(p.taskId) ? ` · ${DEFAULT_ESTIMATE} min estimados por defecto` : ''}</Text>
            </View>
          </View>
        ))}
        {plan.placed.length ? (
          <Text variant="caption" tone="tertiary">{formatDuration(plan.placed.reduce((a, p) => a + p.end - p.start, 0))} planificados de {formatDuration(capacity)} libres, con descansos de 10 min.</Text>
        ) : null}
      </View>

      {notPlaced.length ? (
        <View style={styles.card}>
          <Text variant="title3">Fuera de este plan</Text>
          <Text variant="callout" tone="secondary">Marca las que quieras pasar a mañana. Las demás se quedan como están.</Text>
          {notPlaced.map((id) => {
            const selected = deferIds.includes(id);
            const reason = plan.unplaced.find((u) => u.taskId === id)?.reason;
            return (
              <Pressable key={id} onPress={() => setDeferIds((x) => (selected ? x.filter((y) => y !== id) : [...x, id]))} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} aria-checked={selected} style={styles.slot}>
                <View style={[styles.box, selected && styles.boxOn]}>{selected ? <Check size={12} color={colors.textOnAccent} strokeWidth={3} /> : null}</View>
                <View style={styles.flex}>
                  <Text>{title(id)}</Text>
                  <Text variant="caption" tone="tertiary">{reason === 'bloqueada' ? 'Depende de tareas sin terminar' : reason === 'sin_hueco' ? 'No cabe en los huecos libres' : 'No es esencial hoy'}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Button
        label={plan.placed.length ? `Aceptar plan${deferIds.length ? ` y aplazar ${deferIds.length}` : ''}` : deferIds.length ? `Aplazar ${deferIds.length}` : 'Nada que aplicar'}
        disabled={!plan.placed.length && !deferIds.length}
        loading={apply.isPending}
        onPress={() =>
          apply.mutate(
            { place: plan.placed.map((p) => ({ id: p.taskId, start: p.start, end: p.end })), defer: deferIds },
            { onSuccess: () => { toast('Plan aplicado'); back(); }, onError: () => toast('No se pudo aplicar el plan. Revisa la conexión.') },
          )
        }
        fullWidth
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing[5], gap: spacing[5] },
  wide: { maxWidth: 760, width: '100%', alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], alignSelf: 'flex-start' },
  head: { gap: spacing[2] },
  notice: { flexDirection: 'row', gap: spacing[3], padding: spacing[4], borderRadius: radius.lg, backgroundColor: colors.infoMuted },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  card: { gap: spacing[3], padding: spacing[5], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  warn: { borderColor: colors.warning, backgroundColor: colors.warningMuted },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  slot: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  time: { width: 104 },
  box: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  flex: { flex: 1 },
});
