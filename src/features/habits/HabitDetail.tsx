import { router } from 'expo-router';
import { Archive, ArrowLeft, Pause, Pencil, Play, RotateCcw, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LinkifiedText } from '@/components/content/LinkText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing, userColors } from '@/design/tokens';
import { evaluatePeriod, isPaused, targetAt } from '@/domain/habits/evaluate';
import * as api from '@/features/habits/api';
import { ConsistencyGrid } from '@/features/habits/ConsistencyGrid';
import { formatNumber, KIND_LABEL, percent, progressText, unitLabel } from '@/features/habits/format';
import { HabitRow } from '@/features/habits/HabitRow';
import { HabitStats } from '@/features/habits/HabitStats';
import { RestCard } from '@/features/habits/RestCard';
import { HabitRecommendations } from '@/features/habits/Recommendations';
import { useTimeZone } from '@/features/habits/useToday';
import { useHabitMutation, useHabitSummaries, useUndoLog } from '@/features/habits/hooks';
import { useMyProfile } from '@/features/profile/useMyProfile';
import { selectInSplit } from '@/features/system/split';
import { confirmAction } from '@/lib/confirm';
import { SkeletonList } from '@/components/feedback/Skeleton';

/** Detalle de hábito: pantalla propia en Android o columna derecha en escritorio ancho. */
export function HabitDetail({ id, embedded }: { id: string; embedded?: boolean }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { summaries, today, isLoading, error } = useHabitSummaries();
  const weekStartsOn = useMyProfile().data?.week_starts_on ?? 1;
  const timeZone = useTimeZone();
  const s = summaries?.find((x) => x.habit.id === id);
  const undo = useUndoLog();
  const [showAll, setShowAll] = useState(false);
  const pause = useHabitMutation(() => api.pauseHabit(id, today, null));
  const resume = useHabitMutation(() => api.resumeHabit(id, today));
  const archive = useHabitMutation((archived: boolean) => api.updateHabit(id, { status: archived ? 'archived' : 'active' }));
  const remove = useHabitMutation(() => api.deleteHabit(id));

  // El React Compiler memoiza esta función; no hace falta useMemo.
  const cellFor = (day: import('@/lib/dates').DayKey) => {
      if (!s) return 'none' as const;
      if (day < s.habit.startDay) return 'none' as const;
      const t = targetAt(s.habit, day);
      if (!t || t.period !== 'day') {
        // Para periodos semanales/mensuales se marca el día si hubo registro.
        return s.logs.some((l) => l.dayKey === day && l.value > 0) ? ('met' as const) : ('none' as const);
      }
      const r = evaluatePeriod(s.habit, s.logs, day, today, weekStartsOn);
      return r.status === 'met' ? 'met' : r.status === 'partial' ? 'partial' : r.status === 'missed' ? 'missed' : 'none';
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/habitos'));

  if (isLoading) return <View style={styles.center}><SkeletonList rows={3} /></View>;
  if (error || !s) {
    return (
      <View style={styles.center}>
        <EmptyState title={error ? 'No se pudo cargar el hábito' : 'Este hábito ya no existe'} description={error ? 'Comprueba la conexión.' : undefined} />
        {!embedded ? <Button label="Volver" variant="secondary" onPress={back} /> : null}
      </View>
    );
  }

  const { habit } = s;
  const color = userColors[habit.color];
  const t = targetAt(habit, today);
  const paused = isPaused(habit, today);
  const history = [...s.logs].sort((a, b) => (a.dayKey < b.dayKey ? 1 : a.dayKey > b.dayKey ? -1 : b.loggedAt.localeCompare(a.loggedAt)));
  const u = unitLabel(habit.kind, habit.unit);

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: embedded ? spacing[10] : insets.top + spacing[4], paddingBottom: insets.bottom + spacing[12] }, width >= 900 && !embedded && styles.wide]}>
      {!embedded ? (
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Volver a Hábitos" style={styles.back} hitSlop={8}>
          <ArrowLeft size={20} color={colors.textSecondary} />
          <Text variant="callout" tone="secondary">Hábitos</Text>
        </Pressable>
      ) : null}

      <View style={styles.head}>
        <Text variant="overline" style={{ color }}>{KIND_LABEL[habit.kind].title.toUpperCase()}{habit.archived ? ' · ARCHIVADO' : ''}</Text>
        <Text variant="title1" accessibilityRole="header">{habit.name}</Text>
        {t ? <Text tone="secondary">{progressText(habit.kind, habit.unit, s.current, t.period)}</Text> : null}
      </View>

      {habit.description ? <LinkifiedText>{habit.description}</LinkifiedText> : null}

      {!habit.archived ? <HabitRow s={s} today={today} /> : null}

      {s.recovery ? (
        <View style={[styles.card, styles.recovery]} accessibilityRole="summary">
          <Text variant="overline" tone="accent">MODO RECUPERACIÓN</Text>
          <Text variant="bodyStrong">
            Llevas {s.recovery.missedInARow} días sin {habit.name.toLowerCase()}. Hoy puedes retomar con{' '}
            {habit.kind === 'binary' ? 'una sola vez' : `${formatNumber(s.recovery.suggestedTarget)} ${u}`}.
          </Text>
          <Text variant="callout" tone="secondary">Tu historial se mantiene intacto. Lo importante es volver a empezar.</Text>
        </View>
      ) : null}

      <View style={styles.stats}>
        <Stat label="Constancia 30 días" value={percent(s.consistency30.ratio)} hint={s.consistency30.evaluated ? `${s.consistency30.met} de ${s.consistency30.evaluated}` : 'Aún sin días cerrados'} />
        <Stat label="Racha actual" value={String(s.streak.current)} hint={t?.period === 'week' ? 'semanas' : t?.period === 'month' ? 'meses' : 'días'} />
        <Stat label="Mejor racha" value={String(s.streak.best)} hint="en los últimos 60 periodos" />
      </View>

      <View style={styles.card}>
        <Text variant="title3">Últimas 12 semanas</Text>
        <ConsistencyGrid
          today={today}
          weekStartsOn={weekStartsOn}
          cellFor={cellFor}
          color={color}
          summary={`Constancia de los últimos 30 días: ${percent(s.consistency30.ratio)}`}
        />
      </View>

      <HabitStats habit={habit} logs={s.logs} today={today} weekStartsOn={weekStartsOn} color={color} />

      {!habit.archived ? <HabitRecommendations habit={habit} logs={s.logs} today={today} timeZone={timeZone} weekStartsOn={weekStartsOn} /> : null}

      <View style={styles.card}>
        <Text variant="title3">Historial</Text>
        {history.length === 0 ? (
          <Text tone="secondary">Todavía no hay registros.</Text>
        ) : (
          (showAll ? history : history.slice(0, 8)).map((l) => (
            <View key={l.id} style={styles.logRow}>
              <View style={styles.flex}>
                <Text variant="bodyStrong" tabular>
                  {l.dayKey.split('-').reverse().join('/')}
                  {habit.kind !== 'binary' ? `  ·  ${formatNumber(l.value)} ${habit.kind === 'flexible' ? 'min' : u}` : ''}
                </Text>
                <Text variant="caption" tone="tertiary">
                  {l.source === 'timer' ? 'Con temporizador' : 'Autodeclarado'}
                  {l.note ? `  ·  ${l.note}` : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => confirmAction('Eliminar registro', 'El progreso se recalculará sin este registro.', 'Eliminar', () => undo.mutate(l.id))}
                accessibilityRole="button"
                accessibilityLabel={`Eliminar registro del ${l.dayKey}`}
                hitSlop={10}
              >
                <Trash2 size={18} color={colors.textTertiary} />
              </Pressable>
            </View>
          ))
        )}
        {history.length > 8 && !showAll ? <Button label={`Ver todo (${history.length})`} variant="ghost" onPress={() => setShowAll(true)} /> : null}
      </View>

      <View style={styles.actions}>
        {!habit.archived ? (
          <Button
            label="Editar"
            variant="secondary"
            icon={<Pencil size={18} color={colors.text} />}
            onPress={() => router.push({ pathname: '/habito/editar/[id]', params: { id: habit.id } })}
          />
        ) : null}
        {!habit.archived ? (
          paused ? (
            <Button label="Reanudar" variant="secondary" icon={<Play size={18} color={colors.text} />} loading={resume.isPending} onPress={() => resume.mutate(undefined)} />
          ) : (
            <Button label="Pausar" variant="secondary" icon={<Pause size={18} color={colors.text} />} loading={pause.isPending} onPress={() => pause.mutate(undefined)} />
          )
        ) : null}
        <Button
          label={habit.archived ? 'Restaurar' : 'Archivar'}
          variant="secondary"
          icon={habit.archived ? <RotateCcw size={18} color={colors.text} /> : <Archive size={18} color={colors.text} />}
          loading={archive.isPending}
          onPress={() => archive.mutate(!habit.archived)}
        />
        <Button
          label="Eliminar"
          variant="danger"
          icon={<Trash2 size={18} color={colors.danger} />}
          onPress={() =>
            confirmAction('Eliminar hábito', `Se borrarán «${habit.name}» y todos sus registros. No se puede deshacer. Si solo quieres dejarlo, archívalo.`, 'Eliminar', () =>
              remove.mutate(undefined, { onSuccess: () => (embedded ? selectInSplit('habit', null) : router.replace('/habitos')) }),
            )
          }
        />
      </View>
      {!paused ? <RestCard habit={habit} logs={s.logs} today={today} weekStartsOn={weekStartsOn} /> : null}
    </ScrollView>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}, ${hint}`}>
      <Text variant="caption" tone="secondary">{label}</Text>
      <Text variant="metric" tabular>{value}</Text>
      <Text variant="caption" tone="tertiary">{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing[5], gap: spacing[5] },
  wide: { maxWidth: 760, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4], padding: spacing[6] },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], alignSelf: 'flex-start' },
  head: { gap: spacing[1] },
  card: { gap: spacing[3], padding: spacing[5], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  recovery: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  stats: { flexDirection: 'row', gap: spacing[3] },
  stat: { flex: 1, gap: 2, padding: spacing[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
});
