import { router } from 'expo-router';
import { ArrowLeft, Briefcase, Info, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SkeletonList } from '@/components/feedback/Skeleton';
import { Chip } from '@/components/forms/Chip';
import { TextField } from '@/components/forms/TextField';
import { TimePicker } from '@/components/forms/TimePicker';
import { KeyboardScroll } from '@/components/layout/KeyboardScroll';
import { useToast } from '@/components/overlays/UndoToast';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { freeMinutes, freeWindows, type BusyBlock, type DayHours } from '@/domain/calendar/schedule';
import { saveSchedule } from '@/features/agenda/api';
import { useAgendaMutation, useSchedule } from '@/features/agenda/hooks';
import { WEEKDAYS } from '@/features/onboarding/options';
import { formatDuration, minutesOf } from '@/lib/time';

type Draft = { days: DayHours[]; busy: BusyBlock[]; perDay: boolean };

const DEFAULT_DAY = { start: '07:00', end: '22:00' };
const WEEKDAYS_ONLY = [1, 2, 3, 4, 5];

/** Bloques ocupados habituales para añadir con un toque (luego se ajustan). */
const SUGGESTIONS: BusyBlock[] = [
  { label: 'Clases', weekdays: WEEKDAYS_ONLY, start: '08:00', end: '12:00' },
  { label: 'Trabajo', weekdays: WEEKDAYS_ONLY, start: '09:00', end: '17:00' },
  { label: 'Comida', weekdays: [0, 1, 2, 3, 4, 5, 6], start: '13:00', end: '14:00' },
  { label: 'Gimnasio', weekdays: [1, 3, 5], start: '18:00', end: '19:00' },
];

const sameHours = (days: DayHours[]) => days.every((d) => d.start === days[0]?.start && d.end === days[0]?.end);
const endMin = (t: string) => (t === '23:59' || t === '24:00' ? 1440 : minutesOf(t));

/**
 * Disponibilidad como la cuenta una persona: «mi día va de 7 a 22» y «estoy ocupado en clase de
 * 8 a 12». Nebula calcula el tiempo libre (y además descuenta los eventos de la agenda al planificar).
 */
export default function Disponibilidad() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const schedule = useSchedule();
  const toast = useToast((t) => t.show);
  const [draft, setDraft] = useState<Draft | null>(null);
  const save = useAgendaMutation(saveSchedule);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/agenda'));

  const loaded = schedule.data;
  const current: Draft = draft ?? {
    days: loaded && (loaded.days.length || loaded.legacy) ? loaded.days : WEEKDAYS.map((d) => ({ weekday: d.value, ...DEFAULT_DAY })),
    busy: loaded?.busy ?? [],
    perDay: loaded ? !sameHours(loaded.days) : false,
  };
  const update = (patch: Partial<Draft>) => setDraft({ ...current, ...patch });
  const common = current.days[0] ?? { weekday: 1, ...DEFAULT_DAY };

  const toggleDay = (weekday: number) => {
    const on = current.days.some((d) => d.weekday === weekday);
    update({ days: on ? current.days.filter((d) => d.weekday !== weekday) : [...current.days, { weekday, start: common.start, end: common.end }].sort((a, b) => a.weekday - b.weekday) });
  };
  const setCommon = (patch: Partial<DayHours>) => update({ days: current.days.map((d) => ({ ...d, ...patch })) });
  const setDay = (weekday: number, patch: Partial<DayHours>) => update({ days: current.days.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)) });
  const setBusy = (i: number, patch: Partial<BusyBlock>) => update({ busy: current.busy.map((b, j) => (j === i ? { ...b, ...patch } : b)) });

  const errors = [
    ...current.days.filter((d) => endMin(d.end) <= minutesOf(d.start)).map((d) => `El ${WEEKDAYS.find((w) => w.value === d.weekday)?.name.toLowerCase()} debe terminar después de empezar.`),
    ...current.busy.filter((b) => endMin(b.end) <= minutesOf(b.start)).map((b) => `«${b.label || 'Ocupado'}» debe terminar después de empezar.`),
    ...current.busy.filter((b) => !b.weekdays.length).map((b) => `Elige al menos un día para «${b.label || 'Ocupado'}».`),
  ];
  const free = freeWindows(current.days, current.busy);

  const submit = () => {
    if (errors.length) return toast(errors[0]!);
    const busy = current.busy.map((b) => ({ ...b, label: b.label.trim() || 'Ocupado' }));
    save.mutate({ days: current.days, busy }, { onSuccess: () => { toast('Disponibilidad guardada'); back(); }, onError: () => toast('No se pudo guardar.') });
  };

  return (
    <KeyboardScroll contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[4], paddingBottom: insets.bottom + spacing[12] }, width >= 900 && styles.wide]}>
      <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Volver" style={styles.back} hitSlop={8}>
        <ArrowLeft size={20} color={colors.textSecondary} />
        <Text variant="callout" tone="secondary">Volver</Text>
      </Pressable>
      <Text variant="title1" accessibilityRole="header">Tu disponibilidad</Text>
      <Text tone="secondary">Cuéntanos cómo es tu día y cuándo estás ocupado. Nebula planifica tus tareas en el tiempo libre que queda.</Text>
      {schedule.isLoading ? <SkeletonList rows={3} /> : null}
      {loaded?.legacy && !draft ? (
        <View style={[styles.card, styles.notice]}>
          <Info size={18} color={colors.info} />
          <Text variant="callout" tone="secondary" style={styles.flex}>Convertimos tus franjas libres anteriores: los huecos entre ellas aparecen como «Ocupado». Ponles nombre si quieres y guarda.</Text>
        </View>
      ) : null}

      <Text variant="overline" tone="accent">TU DÍA</Text>
      <View style={styles.card}>
        <Text variant="callout" tone="secondary">Días en los que Nebula puede planificar</Text>
        <View style={styles.wrap}>
          {WEEKDAYS.map((d) => <Chip key={d.value} label={d.label} selected={current.days.some((x) => x.weekday === d.value)} onToggle={() => toggleDay(d.value)} />)}
        </View>
        {!current.perDay && current.days.length ? (
          <View style={styles.times}>
            <View style={styles.flex}><TimePicker label="Empiezas" value={common.start} max={endMin(common.end) - 15} onChange={(v) => setCommon({ start: v })} /></View>
            <View style={styles.flex}><TimePicker label="Terminas" value={common.end} min={minutesOf(common.start) + 15} onChange={(v) => setCommon({ end: v })} /></View>
          </View>
        ) : null}
        <View style={styles.switchRow}>
          <Text style={styles.flex}>Horario distinto según el día</Text>
          <Switch accessibilityLabel="Horario distinto según el día" value={current.perDay} onValueChange={(on) => update({ perDay: on, days: on ? current.days : current.days.map((d) => ({ ...d, start: common.start, end: common.end })) })} />
        </View>
        {current.perDay ? current.days.map((d) => (
          <View key={d.weekday} style={styles.dayRow}>
            <Text variant="bodyStrong" style={styles.dayName}>{WEEKDAYS.find((w) => w.value === d.weekday)?.name}</Text>
            <View style={styles.times}>
              <View style={styles.flex}><TimePicker label="Empiezas" value={d.start} max={endMin(d.end) - 15} onChange={(v) => setDay(d.weekday, { start: v })} /></View>
              <View style={styles.flex}><TimePicker label="Terminas" value={d.end} min={minutesOf(d.start) + 15} onChange={(v) => setDay(d.weekday, { end: v })} /></View>
            </View>
          </View>
        )) : null}
        {!current.days.length ? <Text variant="callout" tone="warning">Sin días elegidos, Nebula no planificará nada.</Text> : null}
      </View>

      <Text variant="overline" tone="accent">CUANDO ESTÁS OCUPADO</Text>
      {current.busy.map((b, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.blockHead}>
            <View style={styles.flex}>
              <TextField label="Qué es" value={b.label} onChangeText={(label) => setBusy(i, { label })} placeholder="Clases, trabajo, gimnasio…" maxLength={60} />
            </View>
            <Pressable onPress={() => update({ busy: current.busy.filter((_, j) => j !== i) })} accessibilityRole="button" accessibilityLabel={`Quitar ${b.label || 'bloque ocupado'}`} style={styles.remove} hitSlop={6}>
              <X size={18} color={colors.textTertiary} />
            </Pressable>
          </View>
          <View style={styles.wrap}>
            {WEEKDAYS.map((d) => (
              <Chip key={d.value} label={d.label} selected={b.weekdays.includes(d.value)} onToggle={() => setBusy(i, { weekdays: b.weekdays.includes(d.value) ? b.weekdays.filter((x) => x !== d.value) : [...b.weekdays, d.value].sort() })} />
            ))}
          </View>
          <View style={styles.times}>
            <View style={styles.flex}><TimePicker label="Desde" value={b.start} max={endMin(b.end) - 5} onChange={(v) => setBusy(i, { start: v })} /></View>
            <View style={styles.flex}><TimePicker label="Hasta" value={b.end} min={minutesOf(b.start) + 5} onChange={(v) => setBusy(i, { end: v })} /></View>
          </View>
        </View>
      ))}
      {!current.busy.length ? <Text variant="callout" tone="tertiary">Nada fijo por ahora. Añade tus clases, trabajo o lo que se repita cada semana.</Text> : null}
      <View style={styles.wrap}>
        {SUGGESTIONS.filter((s) => !current.busy.some((b) => b.label === s.label)).map((s) => (
          <Chip key={s.label} label={`+ ${s.label}`} selected={false} onToggle={() => update({ busy: [...current.busy, { ...s }] })} />
        ))}
      </View>
      <Button label="Añadir bloque ocupado" variant="secondary" icon={<Briefcase size={18} color={colors.text} />} onPress={() => update({ busy: [...current.busy, { label: '', weekdays: [...WEEKDAYS_ONLY], start: '09:00', end: '10:00' }] })} />

      <Text variant="overline" tone="accent">TU TIEMPO LIBRE</Text>
      <View style={styles.card}>
        {WEEKDAYS.map((d) => {
          const day = current.days.find((x) => x.weekday === d.value);
          const mins = freeMinutes(free, d.value);
          return (
            <View key={d.value} style={styles.freeRow} accessibilityLabel={`${d.name}: ${day ? `${formatDuration(mins)} libres` : 'no se planifica'}`}>
              <Text variant="caption" tone="secondary" style={styles.freeDay}>{d.label}</Text>
              <View style={styles.bar}>
                {day ? <View style={[styles.daySpan, { left: `${(minutesOf(day.start) / 1440) * 100}%`, width: `${((endMin(day.end) - minutesOf(day.start)) / 1440) * 100}%` }]} /> : null}
                {free.filter((w) => w.weekday === d.value).map((w) => (
                  <View key={w.start} style={[styles.freeSpan, { left: `${(minutesOf(w.start) / 1440) * 100}%`, width: `${((endMin(w.end) - minutesOf(w.start)) / 1440) * 100}%` }]} />
                ))}
              </View>
              <Text variant="caption" tabular tone={day ? 'primary' : 'tertiary'} style={styles.freeTotal}>{day ? formatDuration(mins) : 'No se planifica'}</Text>
            </View>
          );
        })}
        <View style={styles.legend}>
          <View style={[styles.swatch, { backgroundColor: colors.accentBright }]} /><Text variant="caption" tone="tertiary">Libre para planificar</Text>
          <View style={[styles.swatch, { backgroundColor: colors.surfaceRaised }]} /><Text variant="caption" tone="tertiary">Ocupado</Text>
        </View>
        <Text variant="caption" tone="tertiary">Al planificar también se descuentan tus eventos de la agenda y de Google Calendar.</Text>
      </View>

      <Button label="Guardar" onPress={submit} loading={save.isPending} disabled={!draft || errors.length > 0} fullWidth />
    </KeyboardScroll>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing[5], gap: spacing[4] },
  wide: { maxWidth: 640, width: '100%', alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], alignSelf: 'flex-start' },
  card: { gap: spacing[3], padding: spacing[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  notice: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.infoMuted },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  times: { flexDirection: 'row', gap: spacing[3] },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  dayRow: { gap: spacing[2], paddingTop: spacing[2], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  dayName: { color: colors.textSecondary },
  blockHead: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] },
  remove: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  freeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  freeDay: { width: 16 },
  bar: { flex: 1, height: 12, borderRadius: radius.pill, backgroundColor: colors.track, overflow: 'hidden' },
  daySpan: { position: 'absolute', top: 0, bottom: 0, backgroundColor: colors.surfaceRaised },
  freeSpan: { position: 'absolute', top: 0, bottom: 0, backgroundColor: colors.accentBright },
  freeTotal: { width: 104, textAlign: 'right' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  flex: { flex: 1 },
});
