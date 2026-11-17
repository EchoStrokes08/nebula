import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDay } from '@/components/forms/DateField';
import { ProgressBar } from '@/components/progress/ProgressBar';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { commitmentReview } from '@/domain/stats/stats';
import { useAuth } from '@/features/auth/session';
import { percent } from '@/features/habits/format';
import { useTimeZone, useToday } from '@/features/habits/useToday';
import { useMyProfile } from '@/features/profile/useMyProfile';
import { fetchTaskHistory } from '@/features/tasks/api';
import { useTasks } from '@/features/tasks/hooks';
import { addDays, dayKeyOf, startOfWeek, type DayKey } from '@/lib/dates';
import { SkeletonList } from '@/components/feedback/Skeleton';
import { WeeklySummary } from '@/features/intelligence/WeeklySummary';

const GROUPS = [
  { key: 'completed', title: 'Completado', tone: 'success' },
  { key: 'rescheduled', title: 'Reprogramado', tone: 'warning' },
  { key: 'abandoned', title: 'Abandonado', tone: 'danger' },
  { key: 'pending', title: 'Sigue pendiente', tone: 'secondary' },
] as const;

/** Revisión de compromisos (prompt §13.3): conecta lo que decidiste con lo que pasó. */
export default function Revision() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const today = useToday();
  const tz = useTimeZone();
  const uid = useAuth((s) => s.session?.user.id);
  const weekStartsOn = useMyProfile().data?.week_starts_on ?? 1;
  const [offset, setOffset] = useState(0);
  const from: DayKey = addDays(startOfWeek(today, weekStartsOn), -7 * offset);
  const to = addDays(from, 6);
  const tasks = useTasks();
  const history = useQuery({ queryKey: ['task_history', uid, from], queryFn: () => fetchTaskHistory(new Date(`${addDays(from, -1)}T00:00:00Z`).toISOString()), enabled: !!uid });
  const review = commitmentReview(
    {
      tasks: (tasks.data ?? []).map((t) => ({ id: t.id, dueDate: t.dueDate, status: t.status })),
      history: (history.data ?? []).map((h) => ({ taskId: h.taskId, event: h.event, oldDue: h.oldDue, newDue: h.newDue, atDay: dayKeyOf(new Date(h.at), tz) })),
    },
    from,
    to,
  );
  const title = (id: string) => tasks.data?.find((t) => t.id === id)?.title ?? 'Tarea eliminada';

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[4], paddingBottom: insets.bottom + spacing[12] }, width >= 900 && styles.wide]}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/perfil'))} accessibilityRole="button" accessibilityLabel="Volver" style={styles.back} hitSlop={8}>
        <ArrowLeft size={20} color={colors.textSecondary} />
        <Text variant="callout" tone="secondary">Volver</Text>
      </Pressable>
      <Text variant="title1" accessibilityRole="header">Revisión semanal</Text>
      <View style={styles.nav}>
        <Pressable onPress={() => setOffset(offset + 1)} accessibilityRole="button" accessibilityLabel="Semana anterior" hitSlop={8} style={styles.navBtn}><ChevronLeft size={20} color={colors.textSecondary} /></Pressable>
        <Text variant="title3" style={styles.navTitle}>{formatDay(from, today)} – {formatDay(to, today)}</Text>
        <Pressable onPress={() => setOffset(Math.max(0, offset - 1))} disabled={offset === 0} accessibilityRole="button" accessibilityLabel="Semana siguiente" hitSlop={8} style={[styles.navBtn, offset === 0 && styles.disabled]}><ChevronRight size={20} color={colors.textSecondary} /></Pressable>
      </View>

      <WeeklySummary from={from} to={to} today={today} />
      {tasks.isLoading || history.isLoading ? <SkeletonList rows={3} /> : null}
      <View style={styles.card}>
        <Text variant="overline" tone="accent">LO QUE TE PROPUSISTE</Text>
        <Text variant="display" tabular>{review.promised.length}</Text>
        <Text tone="secondary">tareas con fecha en esta semana</Text>
        {review.keptRate !== null ? (
          <>
            <ProgressBar progress={review.keptRate} color={colors.success} />
            <Text variant="callout">Cumpliste el {percent(review.keptRate)} de lo que prometiste.</Text>
          </>
        ) : (
          <Text tone="secondary">No te comprometiste con ninguna tarea con fecha esta semana.</Text>
        )}
      </View>

      {GROUPS.map((g) => {
        const ids = review[g.key];
        return (
          <View key={g.key} style={styles.card}>
            <View style={styles.row}>
              <Text variant="title3" style={styles.flex}>{g.title}</Text>
              <Text variant="title3" tone={g.tone} tabular>{ids.length}</Text>
            </View>
            {ids.length === 0 ? <Text variant="callout" tone="tertiary">Nada.</Text> : null}
            {ids.map((id) => (
              <Pressable key={id} onPress={() => router.push({ pathname: '/tarea/[id]', params: { id } })} accessibilityRole="button">
                <Text>• {title(id)}</Text>
              </Pressable>
            ))}
          </View>
        );
      })}
      {review.rescheduled.length >= 3 ? (
        <View style={[styles.card, styles.warn]}>
          <Text variant="bodyStrong">Has reprogramado {review.rescheduled.length} compromisos.</Text>
          <Text tone="secondary">Quizá estás planificando más de lo que cabe. Prueba el modo Esencial al planificar el día.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing[5], gap: spacing[4] },
  wide: { maxWidth: 720, width: '100%', alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], alignSelf: 'flex-start' },
  nav: { flexDirection: 'row', alignItems: 'center' },
  navBtn: { padding: spacing[2] },
  navTitle: { flex: 1, textAlign: 'center' },
  disabled: { opacity: 0.3 },
  card: { gap: spacing[2], padding: spacing[5], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  warn: { borderColor: colors.warning, backgroundColor: colors.warningMuted },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});
