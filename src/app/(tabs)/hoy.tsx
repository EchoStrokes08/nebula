import { router } from 'expo-router';
import { Plus, Sun } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { GoalsShortcut } from '@/features/goals/GoalsShortcut';
import { MotivationLine } from '@/features/motivation/MotivationLine';
import { NotificationPrompt } from '@/features/notifications/NotificationPrompt';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { formatNumber, unitLabel } from '@/features/habits/format';
import { HabitList, isForToday } from '@/features/habits/HabitList';
import { useHabitSummaries } from '@/features/habits/hooks';
import { tasksForToday } from '@/domain/tasks/listing';
import { useTasks } from '@/features/tasks/hooks';
import { TaskRow } from '@/features/tasks/TaskRow';
import { analyzeDag } from '@/domain/tasks/dag';
import { SkeletonList } from '@/components/feedback/Skeleton';

/** Fecha del día civil del usuario (misma zona que el resto de cálculos). */
const dayLabel = (day: string) => new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));

export default function HoyScreen() {
  const { summaries, today, isLoading, error, refetch } = useHabitSummaries();
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

  return (
    <Screen
      title="Hoy"
      overline={dayLabel(today)}
      trailing={<Button label="Hábito" variant="secondary" icon={<Plus size={18} color={colors.text} />} onPress={() => router.push('/habito/nuevo')} />}
    >
      <MotivationLine moment={new Date().getHours() >= 21 ? 'cierre' : 'inicio'} />
      <NotificationPrompt />
      <Button label="Capturar una idea" variant="secondary" onPress={() => router.push('/captura')} />
      <GoalsShortcut />
      {recovery.map((s) => (
        <View key={s.habit.id} style={styles.recovery} accessibilityRole="summary">
          <Text variant="overline" tone="accent">RETOMA HOY</Text>
          <Text variant="bodyStrong">
            Llevas {s.recovery!.missedInARow} días sin {s.habit.name.toLowerCase()}. Hoy puedes reiniciar con{' '}
            {s.habit.kind === 'binary' ? 'una sola vez' : `${formatNumber(s.recovery!.suggestedTarget)} ${unitLabel(s.habit.kind, s.habit.unit)}`}.
          </Text>
        </View>
      ))}

      {todayTasks.length ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text variant="title3">Tareas</Text>
            <Text variant="callout" tone="secondary" tabular>{todayTasks.length} para hoy</Text>
          </View>
          {todayTasks.map((t) => (
            <TaskRow key={t.id} task={t} today={today} blocked={dag.blocked.has(t.id)} />
          ))}
        </View>
      ) : null}

      {keyTask ? (
        <View style={styles.keyTask} accessibilityRole="summary">
          <Text variant="overline" tone="accent">LO QUE MÁS DESBLOQUEA</Text>
          <Text variant="bodyStrong">{keyTask.title}</Text>
          <Text variant="callout" tone="secondary">Terminarla libera {key!.n} {key!.n === 1 ? 'tarea' : 'tareas'} que dependen de ella.</Text>
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
          <View style={styles.sectionHead}>
            <Text variant="title3">Hábitos</Text>
            <Text variant="callout" tone="secondary" tabular>
              {done} de {forToday.length}
            </Text>
          </View>
          <HabitList items={[...pending, ...forToday.filter((s) => s.current.status === 'met')]} today={today} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[3] },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  keyTask: { gap: spacing[1], padding: spacing[4], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  recovery: { gap: spacing[2], padding: spacing[4], borderRadius: radius.lg, backgroundColor: colors.accentMuted, borderWidth: 1, borderColor: colors.accent },
});
