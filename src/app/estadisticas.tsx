import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ArrowLeft, ClipboardCheck, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { ShareBars } from '@/components/charts/ShareBars';
import { StatTile } from '@/components/charts/StatTile';
import { YearHeatmap } from '@/components/charts/YearHeatmap';
import { Chip } from '@/components/forms/Chip';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { consistency, recentPeriods } from '@/domain/habits/evaluate';
import { bestFocusWindow, bestSessionLength, compare, dailyCompletion, distractionPatterns, distribution, periodStats, previousRange } from '@/domain/stats/stats';
import { DISTRACTION_KINDS } from '@/features/agenda/api';
import { useDistractions, useFocusSessions } from '@/features/agenda/hooks';
import { useAuth } from '@/features/auth/session';
import { useGoals } from '@/features/goals/hooks';
import { fetchLogsSince } from '@/features/habits/api';
import { percent } from '@/features/habits/format';
import { useHabitsData } from '@/features/habits/hooks';
import { useTimeZone, useToday } from '@/features/habits/useToday';
import { useMyProfile } from '@/features/profile/useMyProfile';
import { useTasks } from '@/features/tasks/hooks';
import { addDays, dayKeyOf, dayRange, startOfMonth, startOfWeek, type DayKey } from '@/lib/dates';
import { formatDuration } from '@/lib/time';

type Period = 'semana' | 'mes';
const DOW = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

export default function Estadisticas() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const today = useToday();
  const tz = useTimeZone();
  const uid = useAuth((s) => s.session?.user.id);
  const weekStartsOn = useMyProfile().data?.week_starts_on ?? 1;
  const [period, setPeriod] = useState<Period>('semana');
  const { habits } = useHabitsData();
  const yearLogs = useQuery({ queryKey: ['habit_logs_year', uid, today], queryFn: () => fetchLogsSince(addDays(today, -371)), enabled: !!uid });
  const tasks = useTasks();
  const focus = useFocusSessions();
  const distractions = useDistractions();
  const goals = useGoals();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/perfil'));

  const loading = habits.isLoading || yearLogs.isLoading || tasks.isLoading || focus.isLoading;
  const habitsWithLogs = (habits.data ?? []).map((h) => ({ ...h, logs: (yearLogs.data ?? []).filter((l) => l.habitId === h.id) }));
  const from: DayKey = period === 'semana' ? startOfWeek(today, weekStartsOn) : startOfMonth(today);
  const to = today;
  const [pFrom, pTo] = previousRange(from, addDays(from, period === 'semana' ? 6 : 29));
  const completion = dailyCompletion(habitsWithLogs, addDays(today, -371), today, today);
  const focusDays = (focus.data ?? []).filter((f) => f.endedAt).map((f) => ({ day: dayKeyOf(new Date(f.startedAt), tz), minutes: Math.round(f.focusedSeconds / 60) }));
  const tasksDone = (tasks.data ?? []).filter((t) => t.completedAt).map((t) => ({ day: dayKeyOf(new Date(t.completedAt!), tz) }));
  const input = { completion, focus: focusDays, tasksDone };
  const current = periodStats(input, from, to);
  const previous = periodStats(input, pFrom, pTo);
  const delta = compare(current, previous);

  // Evolución: por día (semana) o por semana (mes, últimas 8).
  const evo =
    period === 'semana'
      ? dayRange(from, addDays(from, 6)).map((d) => {
          const c = completion.get(d);
          return { label: DOW[new Date(`${d}T12:00:00Z`).getUTCDay()]!, current: d === today, rate: d > today || !c?.evaluated ? null : c.met / c.evaluated, focus: d > today ? null : focusDays.filter((f) => f.day === d).reduce((a, f) => a + f.minutes, 0) };
        })
      : Array.from({ length: 8 }, (_, i) => {
          const ws = addDays(startOfWeek(today, weekStartsOn), -7 * (7 - i));
          const s = periodStats(input, ws, addDays(ws, 6) > today ? today : addDays(ws, 6));
          return { label: `${ws.slice(8)}/${ws.slice(5, 7)}`, current: i === 7, rate: s.completionRate, focus: s.focusMinutes };
        });

  const focusDist = distribution(
    (focus.data ?? []).filter((f) => f.endedAt && dayKeyOf(new Date(f.startedAt), tz) >= from).map((f) => ({
      label: habits.data?.find((h) => h.id === f.habitId)?.name ?? tasks.data?.find((t) => t.id === f.taskId)?.title ?? 'Sin vincular',
      minutes: Math.round(f.focusedSeconds / 60),
    })),
  );
  const sessionsForPatterns = (focus.data ?? []).filter((f) => f.endedAt).map((f) => ({ startHour: new Date(f.startedAt).getHours(), minutes: Math.round(f.focusedSeconds / 60), endedEarly: f.endedEarly }));
  const window = bestFocusWindow(sessionsForPatterns);
  const lengthBest = bestSessionLength(sessionsForPatterns);
  const radar = distractionPatterns((distractions.data ?? []).map((d) => ({ kind: d.kind, abandoned: d.abandoned_session, minutes: d.duration_minutes })));
  const kindLabel = (k: string) => DISTRACTION_KINDS.find((x) => x.v === k)?.l.toLowerCase() ?? k;
  const consistent = (habits.data ?? [])
    .filter((h) => !h.archived)
    .map((h) => ({ h, c: consistency(recentPeriods(h, (yearLogs.data ?? []).filter((l) => l.habitId === h.id), today, 31).slice(1)) }))
    .filter((x) => x.c.evaluated >= 7)
    .sort((a, b) => (b.c.ratio ?? 0) - (a.c.ratio ?? 0))
    .slice(0, 3);
  const postponed = (tasks.data ?? []).filter((t) => t.status !== 'done' && t.postponedCount > 0).sort((a, b) => b.postponedCount - a.postponedCount).slice(0, 3);
  const goalsDone = (goals.data ?? []).filter((g) => g.status === 'completed').length;
  const highPriorityFocus = (focus.data ?? []).filter((f) => f.taskId && tasks.data?.find((t) => t.id === f.taskId)?.priority === 3).reduce((a, f) => a + f.focusedSeconds, 0);
  const totalFocus = (focus.data ?? []).reduce((a, f) => a + f.focusedSeconds, 0);
  const anyData = (yearLogs.data?.length ?? 0) + (focus.data?.length ?? 0) + tasksDone.length > 0;

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[4], paddingBottom: insets.bottom + spacing[12] }, width >= 900 && styles.wide]}>
      <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Volver a Perfil" style={styles.back} hitSlop={8}>
        <ArrowLeft size={20} color={colors.textSecondary} />
        <Text variant="callout" tone="secondary">Perfil</Text>
      </Pressable>
      <Text variant="title1" accessibilityRole="header">Estadísticas</Text>
      <View style={styles.wrap}>
        <Chip role="radio" label="Esta semana" selected={period === 'semana'} onToggle={() => setPeriod('semana')} />
        <Chip role="radio" label="Este mes" selected={period === 'mes'} onToggle={() => setPeriod('mes')} />
        <Button label="Revisión de compromisos" variant="ghost" icon={<ClipboardCheck size={18} color={colors.accentSoft} />} onPress={() => router.push('/revision')} />
      </View>
      <Button label="Tu resumen del mes y del año" variant="secondary" icon={<Sparkles size={18} color={colors.accentSoft} />} onPress={() => router.push('/resumen')} />

      {loading ? <Text tone="secondary">Calculando…</Text> : null}
      {!loading && !anyData ? (
        <View style={styles.card}>
          <Text variant="title3">Aún no hay datos</Text>
          <Text tone="secondary">Registra hábitos, completa tareas o haz sesiones de enfoque. Aquí solo aparecerán cifras calculadas con tus propios registros.</Text>
        </View>
      ) : null}

      <View style={styles.tiles}>
        <StatTile label="Cumplimiento de hábitos" value={percent(current.completionRate)} delta={delta.completion} deltaLabel={delta.completion !== null ? `${Math.abs(Math.round(delta.completion * 100))} pts` : undefined} />
        <StatTile label="Tiempo de enfoque" value={formatDuration(current.focusMinutes)} delta={delta.focus} />
        <StatTile label="Tareas terminadas" value={String(current.tasksCompleted)} delta={delta.tasks} />
        <StatTile label="Días activos" value={String(current.activeDays)} delta={previous.activeDays ? (current.activeDays - previous.activeDays) / previous.activeDays : null} />
      </View>

      <View style={styles.card}>
        <Text variant="title3">Evolución del cumplimiento</Text>
        <BarChart
          bars={evo.map((e) => ({ label: e.label, value: e.rate === null ? null : Math.round(e.rate * 100), highlight: e.current }))}
          max={100}
          summary={`Cumplimiento ${period === 'semana' ? 'por día' : 'por semana'}: ${evo.map((e) => `${e.label} ${e.rate === null ? 'sin datos' : `${Math.round(e.rate * 100)} %`}`).join(', ')}`}
        />
        <Text variant="title3" style={styles.mt}>Minutos de enfoque</Text>
        <LineChart values={evo.map((e) => e.focus)} labels={evo.map((e) => e.label)} color={colors.success} summary={`Minutos de enfoque: ${evo.map((e) => `${e.label} ${e.focus ?? 'sin datos'}`).join(', ')}`} />
      </View>

      <View style={styles.card}>
        <Text variant="title3">Mapa de consistencia (último año)</Text>
        <YearHeatmap
          today={today}
          weekStartsOn={weekStartsOn}
          rateFor={(d) => {
            const c = completion.get(d);
            return c && c.evaluated ? c.met / c.evaluated : null;
          }}
          summary={`Días con todos los hábitos cumplidos en el último año: ${[...completion.values()].filter((c) => c.evaluated && c.met === c.evaluated).length}`}
        />
      </View>

      <View style={styles.card}>
        <Text variant="title3">¿En qué se fue tu enfoque?</Text>
        {focusDist.length ? <ShareBars items={focusDist.map((d) => ({ label: d.label, value: d.minutes, share: d.share }))} format={formatDuration} /> : <Text tone="secondary">Sin sesiones de enfoque en este periodo.</Text>}
      </View>

      <View style={styles.card}>
        <Text variant="title3">Perfil de productividad</Text>
        <Text variant="caption" tone="tertiary">Comparación contigo mismo. Los patrones solo aparecen con datos suficientes.</Text>
        <Insight title="Tu mejor franja" text={window ? `Entre las ${window.from}:00 y las ${window.to}:00 concentras el ${Math.round(window.share * 100)} % de tu enfoque completado.` : `Necesitas al menos 8 sesiones de enfoque (llevas ${sessionsForPatterns.length}).`} />
        <Insight title="Duración que mejor terminas" text={lengthBest ? `Tus sesiones de ${lengthBest.from}–${lengthBest.to === 600 ? '+' : lengthBest.to} min las terminas el ${Math.round(lengthBest.completion * 100)} % de las veces (${lengthBest.n} sesiones).` : 'Aún no hay suficientes sesiones de distintas duraciones para compararlas.'} />
        <Insight title="Hábitos más constantes" text={consistent.length ? consistent.map((x) => `${x.h.name} (${percent(x.c.ratio)})`).join(' · ') : 'Aparecerán cuando lleves al menos una semana registrando.'} />
        <Insight title="Lo que más aplazas" text={postponed.length ? postponed.map((t) => `${t.title} (${t.postponedCount}×)`).join(' · ') : 'Nada aplazado. Buen trabajo.'} />
        <Insight title="Tiempo en prioridades altas" text={totalFocus ? `${Math.round((highPriorityFocus / totalFocus) * 100)} % de tu enfoque fue para tareas de prioridad alta.` : 'Vincula tus sesiones de enfoque a tareas para medirlo.'} />
        <Insight title="Metas completadas" text={String(goalsDone)} />
      </View>

      <View style={styles.card}>
        <Text variant="title3">Radar de distracciones</Text>
        {radar ? (
          <>
            <Text>Lo que más te interrumpe: <Text variant="bodyStrong">{kindLabel(radar.mostFrequent.kind)}</Text> ({Math.round(radar.mostFrequent.share * 100)} % de {radar.total} registros).</Text>
            {radar.abandonsMost ? <Text>Sueles abandonar las sesiones cuando aparecen <Text variant="bodyStrong">{kindLabel(radar.abandonsMost.kind)}</Text> ({radar.abandonsMost.n} veces).</Text> : null}
            {radar.minutesLost ? <Text tone="secondary">Tiempo perdido registrado: {formatDuration(radar.minutesLost)}.</Text> : null}
            <BarChart bars={radar.byKind.map((k) => ({ label: kindLabel(k.kind).slice(0, 5), value: k.n }))} height={80} summary={radar.byKind.map((k) => `${kindLabel(k.kind)}: ${k.n}`).join(', ')} />
          </>
        ) : (
          <Text tone="secondary">Registra lo que te interrumpe al terminar una sesión de enfoque. Con 5 registros verás tus patrones (llevas {distractions.data?.length ?? 0}).</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text variant="title3">Últimas sesiones de enfoque</Text>
        {(focus.data ?? []).filter((f) => f.endedAt).slice(0, 10).map((f) => (
          <View key={f.id} style={styles.session}>
            <Text variant="callout" tabular style={styles.sessionDate}>{new Date(f.startedAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })} · {new Date(f.startedAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</Text>
            <Text variant="bodyStrong" tabular>{formatDuration(Math.max(1, Math.round(f.focusedSeconds / 60)))}</Text>
            <Text variant="caption" tone="tertiary" style={styles.flex} numberOfLines={1}>
              {habits.data?.find((h) => h.id === f.habitId)?.name ?? tasks.data?.find((t) => t.id === f.taskId)?.title ?? ''}{f.endedEarly ? ' · terminada antes' : ''}
            </Text>
          </View>
        ))}
        {!(focus.data ?? []).some((f) => f.endedAt) ? <Text tone="secondary">Aún no has hecho sesiones de enfoque.</Text> : null}
      </View>
    </ScrollView>
  );
}

function Insight({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.insight}>
      <Text variant="caption" tone="accent">{title.toUpperCase()}</Text>
      <Text>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing[5], gap: spacing[5] },
  wide: { maxWidth: 960, width: '100%', alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], alignSelf: 'flex-start' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], alignItems: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  card: { gap: spacing[3], padding: spacing[5], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  mt: { marginTop: spacing[2] },
  insight: { gap: 2, paddingTop: spacing[2], borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  session: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  sessionDate: { width: 120 },
  flex: { flex: 1 },
});
