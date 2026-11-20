import { router } from 'expo-router';
import { CheckSquare, ChevronRight, Flame, KeyRound, Leaf, RotateCcw, Sun } from 'lucide-react-native';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GlassCard } from '@/components/primitives/GlassCard';
import { TodayOrbit } from '@/features/home/TodayOrbit';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { GoalsShortcut } from '@/features/goals/GoalsShortcut';
import { TodayPhrase } from '@/features/motivation/TodayPhrase';
import { NotificationPrompt } from '@/features/notifications/NotificationPrompt';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, fontFamily, radius, spacing } from '@/design/tokens';
import { formatNumber, unitLabel } from '@/features/habits/format';
import { HabitList, isForToday } from '@/features/habits/HabitList';
import { useHabitSummaries } from '@/features/habits/hooks';
import { tasksForToday } from '@/domain/tasks/listing';
import { useTasks } from '@/features/tasks/hooks';
import { TaskRow } from '@/features/tasks/TaskRow';
import { analyzeDag } from '@/domain/tasks/dag';
import { SkeletonList } from '@/components/feedback/Skeleton';
import { QuickActionsRow } from '@/features/home/QuickActionsRow';
import { EssentialDay, useEssentialMode } from '@/features/home/EssentialDay';
import { NotesBoard } from '@/features/notes/PostIt';
import { useMyProfile } from '@/features/profile/useMyProfile';

function greeting(hour: number) {
  if (hour < 6) return 'Buenas noches';
  if (hour < 13) return 'Buenos días';
  if (hour < 21) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Fecha del día civil del usuario (misma zona que el resto de cálculos). */
const dayLabel = (day: string) => new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));

export default function HoyScreen() {
  const { summaries, today, isLoading, error, refetch } = useHabitSummaries();
  const firstName = useMyProfile().data?.display_name?.split(' ')[0];
  // «Buenas *noches*» o «Buenas noches, *Ana*»: la última parte va en cursiva cálida.
  const g = greeting(new Date().getHours());
  const [helloTitle, helloAccent] = firstName ? [`${g},`, firstName] : [g.split(' ')[0] ?? g, g.split(' ').slice(1).join(' ')];
  const forToday = (summaries ?? []).filter(isForToday);
  const pending = forToday.filter((s) => s.current.status !== 'met');
  const done = forToday.length - pending.length;
  const recovery = (summaries ?? []).filter((s) => s.recovery && !s.habit.archived);
  const tasks = useTasks();
  const allTasks = tasks.data ?? [];
  const todayTasks = tasksForToday(allTasks, today);
  const dag = analyzeDag(
    allTasks.map((t) => ({ id: t.id, done: t.status === 'done' || t.status === 'cancelled' })),
    allTasks.flatMap((t) => t.dependsOn.map((d) => ({ taskId: t.id, dependsOn: d }))),
  );
  // La tarea pendiente que desbloquea más trabajo (F05-014).
  const key = [...dag.ready].map((id) => ({ id, n: dag.unlocks.get(id) ?? 0 })).sort((a, b) => b.n - a.n)[0];
  const keyTask = key && key.n > 0 ? allTasks.find((t) => t.id === key.id) : undefined;

  const best = Math.max(0, ...forToday.map((s) => s.streak.current));
  const reduced = useReducedMotion();
  // Entrada escalonada de los bloques (sin movimiento si el sistema lo pide).
  const enter = (i: number) => (reduced ? undefined : FadeInDown.duration(420).delay(60 + i * 70));
  const [essential, setEssential] = useEssentialMode(today);

  if (essential && summaries) {
    return (
      <Screen title={helloTitle} titleAccent={helloAccent} overline={dayLabel(today)}>
        <TodayPhrase moment={new Date().getHours() >= 21 ? 'cierre' : 'inicio'} />
        <EssentialDay habits={forToday} tasks={allTasks} today={today} onExit={() => setEssential(false)} />
      </Screen>
    );
  }

  return (
    <Screen title={helloTitle} titleAccent={helloAccent} overline={dayLabel(today)}>
      <TodayPhrase moment={new Date().getHours() >= 21 ? 'cierre' : 'inicio'} />
      {forToday.length || todayTasks.length ? (
        <Animated.View entering={enter(0)}>
          <TodayOrbit
            progress={forToday.length ? done / forToday.length : 0}
            headline={pending.length === 0 && forToday.length ? '¡Día completado!' : pending.length === 1 ? 'Te queda 1 hábito' : forToday.length ? `Te quedan ${pending.length} hábitos` : 'Sin hábitos para hoy'}
            caption={todayTasks.length ? `y ${todayTasks.length} ${todayTasks.length === 1 ? 'tarea' : 'tareas'} en tu agenda` : 'Lo importante de tu día, de un vistazo.'}
            stats={[
              { label: 'Hábitos', value: `${done}/${forToday.length}`, href: '/habitos' },
              { label: 'Tareas hoy', value: String(todayTasks.length), href: '/agenda' },
              { label: best === 1 ? 'Día de racha' : 'Días de racha', value: String(best) },
            ]}
          />
        </Animated.View>
      ) : null}
      {forToday.length || todayTasks.length ? (
        <Button label="¿Día difícil? Ver solo lo esencial" variant="ghost" icon={<Leaf size={16} color={colors.success} />} onPress={() => setEssential(true)} />
      ) : null}
      <NotificationPrompt />
      <QuickActionsRow />
      <NotesBoard today={today} />
      <GoalsShortcut />
      {recovery.length ? (
        <GlassCard edge="rgba(169, 135, 255, 0.55)" style={styles.recovery} accessibilityRole="summary">
          <View style={styles.recoveryHead}>
            <RotateCcw size={14} color={colors.accentSoft} />
            <Text variant="overline" tone="accent">RETOMA HOY</Text>
          </View>
          {recovery.map((s, i) => (
            <View key={s.habit.id} style={[styles.recoveryItem, i > 0 && styles.hairline]}>
              <Text variant="callout">
                Llevas {s.recovery!.missedInARow} días sin {s.habit.name.toLowerCase()}. Hoy puedes reiniciar con{' '}
                <Text variant="callout" style={styles.strong}>
                  {s.habit.kind === 'binary' ? 'una sola vez' : `${formatNumber(s.recovery!.suggestedTarget)} ${unitLabel(s.habit.kind, s.habit.unit)}`}
                </Text>.
              </Text>
            </View>
          ))}
        </GlassCard>
      ) : null}

      {todayTasks.length ? (
        <View style={styles.section}>
          <SectionHeader icon={CheckSquare} title="Tareas" meta={`${todayTasks.length} para hoy`} color={colors.info} />
          {todayTasks.map((t) => (
            <TaskRow key={t.id} task={t} today={today} blocked={dag.blocked.has(t.id)} />
          ))}
        </View>
      ) : null}

      {keyTask ? (
        <View style={styles.section}>
          <SectionHeader icon={KeyRound} title="Lo que más desbloquea" color={colors.success} />
          <GlassCard onPress={() => router.push({ pathname: '/tarea/[id]', params: { id: keyTask.id } })} accessibilityLabel={`${keyTask.title}. Libera ${key!.n} tareas`} style={styles.keyTask} radius={radius.lg}>
            <View style={styles.keyDot} />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{keyTask.title}</Text>
              <Text variant="callout" tone="secondary">
                Terminarla libera {key!.n} {key!.n === 1 ? 'tarea que depende' : 'tareas que dependen'} de ella.
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textTertiary} />
          </GlassCard>
        </View>
      ) : null}

      {isLoading ? (
        <SkeletonList rows={3} />
      ) : error ? (
        <EmptyState title="No se pudo cargar tu día" description="Comprueba la conexión." action={<Button label="Reintentar" variant="secondary" onPress={() => refetch()} />} />
      ) : forToday.length === 0 ? (
        <EmptyState
          icon={<Sun size={28} color={colors.accentSoft} strokeWidth={1.6} />}
          title={(summaries?.length ?? 0) === 0 ? 'Tu día empieza aquí' : 'Hoy no tienes hábitos programados'}
          description={(summaries?.length ?? 0) === 0 ? 'Crea un hábito y aparecerá aquí cada día que toque.' : 'Aprovecha para avanzar en tus tareas o descansar.'}
          action={(summaries?.length ?? 0) === 0 ? <Button label="Crear un hábito" onPress={() => router.push('/habito/nuevo')} /> : undefined}
        />
      ) : (
        <View style={styles.section}>
          <SectionHeader icon={Flame} title="Hábitos" meta={`${done} de ${forToday.length}`} color={colors.warning} />
          <HabitList items={[...pending, ...forToday.filter((s) => s.current.status === 'met')]} today={today} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[3] },
  flex: { flex: 1, gap: spacing[1] },
  keyTask: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], padding: spacing[4], paddingVertical: spacing[5] },
  keyDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.success, boxShadow: '0 0 10px rgba(111, 214, 160, 0.9)' } as object,
  recovery: { paddingHorizontal: spacing[5], paddingVertical: spacing[4] },
  recoveryHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[1] },
  recoveryItem: { paddingVertical: spacing[3] },
  hairline: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(199, 169, 255, 0.2)' },
  strong: { color: colors.accentSoft, fontFamily: fontFamily.semibold },
});
