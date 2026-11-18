import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calculator, Check, CheckCircle2, GraduationCap, Link2, Pause, Pencil, Play, Plus, Trash2, X, XCircle } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LinkifiedText } from '@/components/content/LinkText';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Chip } from '@/components/forms/Chip';
import { formatDay } from '@/components/forms/DateField';
import { TextField } from '@/components/forms/TextField';
import { Sheet } from '@/components/overlays/Sheet';
import { useToast } from '@/components/overlays/UndoToast';
import { ProgressRing } from '@/components/progress/ProgressRing';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing, userColors } from '@/design/tokens';
import { analyzeDag } from '@/domain/tasks/dag';
import * as api from '@/features/goals/api';
import { DependencyGraph } from '@/features/goals/DependencyGraph';
import { useGoalMutation, useGoalSummaries } from '@/features/goals/hooks';
import { formatNumber } from '@/features/habits/format';
import { useHabitsData } from '@/features/habits/hooks';
import { HabitIcon } from '@/features/habits/icons';
import { useToday } from '@/features/habits/useToday';
import { deleteGoalMessage } from '@/features/goals/deleteMessage';
import { TaskRow } from '@/features/tasks/TaskRow';
import { confirmAction } from '@/lib/confirm';
import { diffDays } from '@/lib/dates';
import { SkeletonList } from '@/components/feedback/Skeleton';

const STATUS_LABEL = { active: 'EN CURSO', paused: 'EN PAUSA', completed: 'COMPLETADA', abandoned: 'ABANDONADA' } as const;

export default function MetaDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const today = useToday();
  const { summaries, isLoading, error } = useGoalSummaries();
  const { habits } = useHabitsData();
  const toast = useToast((t) => t.show);
  const mutate = useGoalMutation(async (fn: () => Promise<unknown>) => fn());
  const [progressSheet, setProgressSheet] = useState(false);
  const [habitSheet, setHabitSheet] = useState(false);
  const [delta, setDelta] = useState('');
  const [note, setNote] = useState('');
  const [deltaError, setDeltaError] = useState<string | null>(null);
  const [newMilestone, setNewMilestone] = useState('');
  const back = () => (router.canGoBack() ? router.back() : router.replace('/metas'));
  const run = (fn: () => Promise<unknown>, onSuccess?: () => void) => mutate.mutate(fn, { onSuccess, onError: () => toast('No se pudo guardar. Revisa la conexión.') });

  const s = summaries?.find((x) => x.goal.id === id);
  if (isLoading) return <View style={styles.center}><SkeletonList rows={3} /></View>;
  if (!s) {
    return (
      <View style={styles.center}>
        <EmptyState title={error ? 'No se pudo cargar la meta' : 'Esta meta ya no existe'} />
        <Button label="Volver" variant="secondary" onPress={back} />
      </View>
    );
  }

  const { goal, progress, linkedTasks, linkedHabits } = s;
  const color = userColors[goal.color];
  const daysLeft = goal.targetDate ? diffDays(today, goal.targetDate) : null;
  const remaining = Math.max(0, progress.target - progress.value);
  const unit = goal.metric === 'quantity' ? (goal.metricUnit ?? '') : goal.metric === 'milestones' ? 'hitos' : 'tareas';
  const weeklyNeeded = daysLeft !== null && daysLeft > 0 && remaining > 0 ? remaining / (daysLeft / 7) : null;
  const dag = analyzeDag(
    linkedTasks.map((t) => ({ id: t.id, done: t.status === 'done' || t.status === 'cancelled', estimateMinutes: t.estimateMinutes })),
    linkedTasks.flatMap((t) => t.dependsOn.map((d) => ({ taskId: t.id, dependsOn: d }))),
  );
  const hasEdges = linkedTasks.some((t) => t.dependsOn.length);
  const closed = goal.status === 'completed' || goal.status === 'abandoned';

  const submitDelta = () => {
    const n = Number(delta.replace(',', '.'));
    if (!delta.trim() || !Number.isFinite(n) || n === 0) return setDeltaError('Introduce una cantidad distinta de 0 (negativa para corregir).');
    setDeltaError(null);
    run(() => api.addProgress(goal.id, n, note.trim() || null), () => {
      setProgressSheet(false);
      setDelta('');
      setNote('');
    });
  };

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[4], paddingBottom: insets.bottom + spacing[12] }, width >= 900 && styles.wide]} keyboardShouldPersistTaps="handled">
      <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Volver a Metas" style={styles.back} hitSlop={8}>
        <ArrowLeft size={20} color={colors.textSecondary} />
        <Text variant="callout" tone="secondary">Metas</Text>
      </Pressable>

      <View style={styles.hero}>
        <ProgressRing progress={progress.ratio ?? 0} size={96} stroke={6} color={color} label={`Progreso de ${goal.title}`}>
          <Text variant="title2" tabular>{progress.ratio === null ? '—' : `${Math.round(progress.ratio * 100)}%`}</Text>
        </ProgressRing>
        <View style={styles.flex}>
          <Text variant="overline" style={{ color }}>{goal.kind === 'project' ? 'PROYECTO · ' : ''}{STATUS_LABEL[goal.status]}</Text>
          <Text variant="title1" accessibilityRole="header">{goal.title}</Text>
          <Text tone="secondary" tabular>
            {progress.ratio === null ? (goal.metric === 'milestones' ? 'Añade hitos para medir el avance' : goal.metric === 'tasks' ? 'Vincula tareas para medir el avance' : 'Sin avance registrado') : `${formatNumber(progress.value)} de ${formatNumber(progress.target)} ${unit}`}
          </Text>
        </View>
      </View>

      {goal.expectedOutcome ? <Text tone="secondary">«{goal.expectedOutcome}»</Text> : null}
      {goal.description ? <LinkifiedText>{goal.description}</LinkifiedText> : null}

      {goal.targetDate && !closed ? (
        <View style={[styles.card, daysLeft !== null && daysLeft < 0 && styles.warn]}>
          <Text variant="bodyStrong">
            {daysLeft! < 0 ? `El plazo venció hace ${-daysLeft!} días (${formatDay(goal.targetDate, today)}).` : daysLeft === 0 ? 'El plazo es hoy.' : `Quedan ${daysLeft} días (${formatDay(goal.targetDate, today)}).`}
          </Text>
          {weeklyNeeded !== null ? (
            <Text tone="secondary">Para llegar a tiempo necesitas unos {formatNumber(Math.round(weeklyNeeded * 10) / 10)} {unit} por semana. Es un cálculo, no una predicción.</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        {goal.metric === 'quantity' && !closed ? <Button label="Registrar avance" icon={<Plus size={18} color={colors.textOnAccent} />} onPress={() => setProgressSheet(true)} /> : null}
        {!closed ? <Button label="Plan con IA" variant="secondary" icon={<GraduationCap size={18} color={colors.text} />} onPress={() => router.push({ pathname: '/asistente', params: { meta: goal.title } })} /> : null}
        <Button label="Simular" variant="secondary" icon={<Calculator size={18} color={colors.text} />} onPress={() => router.push({ pathname: '/simulador', params: { meta: goal.id } })} />
        <Button label="Editar" variant="secondary" icon={<Pencil size={18} color={colors.text} />} onPress={() => router.push({ pathname: '/meta/editar/[id]', params: { id: goal.id } })} />
      </View>

      {goal.metric === 'milestones' || goal.milestones.length ? (
        <View style={styles.card}>
          <Text variant="title3">Hitos</Text>
          {goal.milestones.map((m, i) => (
            <View key={m.id} style={styles.line}>
              <Pressable
                onPress={() => run(() => api.setMilestoneDone(m.id, !m.doneAt))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !!m.doneAt }} aria-checked={!!m.doneAt}
                accessibilityLabel={m.title}
                style={styles.checkHit}
              >
                <View style={[styles.box, !!m.doneAt && { backgroundColor: color, borderColor: color }]}>{m.doneAt ? <Check size={12} color={colors.bg} strokeWidth={3} /> : null}</View>
              </Pressable>
              <Text variant="callout" tone="tertiary" tabular>{i + 1}</Text>
              <Text style={[styles.flex, !!m.doneAt && styles.strike]}>{m.title}</Text>
              <Pressable onPress={() => confirmAction('Eliminar hito', `Se eliminará «${m.title}».`, 'Eliminar', () => run(() => api.deleteMilestone(m.id)))} accessibilityRole="button" accessibilityLabel={`Eliminar hito ${m.title}`} hitSlop={8}>
                <X size={16} color={colors.textTertiary} />
              </Pressable>
            </View>
          ))}
          <View style={styles.line}>
            <View style={styles.flex}>
              <TextField
                label="Nuevo hito"
                value={newMilestone}
                onChangeText={setNewMilestone}
                onSubmitEditing={() => {
                  if (!newMilestone.trim()) return;
                  run(() => api.addMilestone(goal.id, newMilestone.trim(), goal.milestones.length));
                  setNewMilestone('');
                }}
              />
            </View>
            <Pressable
              onPress={() => {
                if (!newMilestone.trim()) return;
                run(() => api.addMilestone(goal.id, newMilestone.trim(), goal.milestones.length));
                setNewMilestone('');
              }}
              accessibilityRole="button"
              accessibilityLabel="Añadir hito"
              style={styles.addBtn}
            >
              <Plus size={20} color={colors.accentSoft} />
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text variant="title3">{goal.kind === 'project' ? 'Etapas' : 'Tareas'}</Text>
          <Button label="Añadir" variant="ghost" icon={<Plus size={18} color={colors.accentSoft} />} onPress={() => router.push({ pathname: '/tarea/nueva', params: { meta: goal.id } })} />
        </View>
        {linkedTasks.length === 0 ? (
          <Text tone="secondary">{goal.kind === 'project' ? 'Añade las etapas del proyecto y marca de cuáles depende cada una.' : 'Ninguna tarea vinculada.'}</Text>
        ) : null}
        {hasEdges ? (
          <>
            <DependencyGraph tasks={linkedTasks} dag={dag} />
            <Text variant="caption" tone="tertiary">
              {dag.blocked.size ? `${dag.blocked.size} bloqueadas · ` : ''}{dag.ready.size} listas para empezar{dag.criticalPath.length > 1 ? ` · ruta crítica de ${dag.criticalPath.length} pasos (línea resaltada)` : ''}
            </Text>
          </>
        ) : null}
        {/* Lista en orden de dependencias: alternativa accesible al grafo. */}
        {dag.order
          .map((tid) => linkedTasks.find((t) => t.id === tid)!)
          .filter(Boolean)
          .map((t) => (
            <TaskRow key={t.id} task={t} today={today} blocked={dag.blocked.has(t.id)} />
          ))}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text variant="title3">Hábitos que la impulsan</Text>
          <Button label="Vincular" variant="ghost" icon={<Link2 size={18} color={colors.accentSoft} />} onPress={() => setHabitSheet(true)} />
        </View>
        {linkedHabits.length === 0 ? <Text tone="secondary">Vincula los hábitos que te acercan a esta meta.</Text> : null}
        {linkedHabits.map((h) => (
          <View key={h.id} style={styles.line}>
            <HabitIcon name={h.icon} size={18} color={userColors[h.color]} />
            <Pressable style={styles.flex} onPress={() => router.push({ pathname: '/habito/[id]', params: { id: h.id } })} accessibilityRole="button">
              <Text>{h.name}</Text>
            </Pressable>
            <Pressable onPress={() => run(() => api.linkHabitToGoal(h.id, null))} accessibilityRole="button" accessibilityLabel={`Desvincular ${h.name}`} hitSlop={8}>
              <X size={16} color={colors.textTertiary} />
            </Pressable>
          </View>
        ))}
        {goal.metric === 'quantity' && linkedHabits.length ? (
          <Text variant="caption" tone="tertiary">Los registros de hábitos con la misma unidad ({goal.metricUnit}) suman al progreso desde que creaste la meta.</Text>
        ) : null}
      </View>

      {goal.progressEvents.length ? (
        <View style={styles.card}>
          <Text variant="title3">Historial de avance</Text>
          {goal.progressEvents.slice(0, 20).map((e) => (
            <View key={e.id} style={styles.line}>
              <Text variant="bodyStrong" tabular tone={e.delta < 0 ? 'warning' : 'primary'}>{e.delta > 0 ? '+' : ''}{formatNumber(e.delta)} {goal.metricUnit}</Text>
              <Text variant="caption" tone="tertiary" style={styles.flex}>{new Date(e.createdAt).toLocaleDateString('es')}{e.note ? ` · ${e.note}` : ''}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        {goal.status === 'active' ? (
          <>
            <Button label="Marcar completada" variant="secondary" icon={<CheckCircle2 size={18} color={colors.success} />} onPress={() => run(() => api.updateGoal(goal.id, { status: 'completed' }))} />
            <Button label="Pausar" variant="secondary" icon={<Pause size={18} color={colors.text} />} onPress={() => run(() => api.updateGoal(goal.id, { status: 'paused' }))} />
            <Button
              label="Abandonar"
              variant="secondary"
              icon={<XCircle size={18} color={colors.text} />}
              onPress={() => confirmAction('Abandonar meta', 'Se conservará en tu historial como abandonada. Puedes reactivarla.', 'Abandonar', () => run(() => api.updateGoal(goal.id, { status: 'abandoned' })))}
            />
          </>
        ) : (
          <Button label="Reactivar" variant="secondary" icon={<Play size={18} color={colors.text} />} onPress={() => run(() => api.updateGoal(goal.id, { status: 'active' }))} />
        )}
        <Button
          label="Eliminar"
          variant="danger"
          icon={<Trash2 size={18} color={colors.danger} />}
          onPress={() =>
            confirmAction('Eliminar meta', deleteGoalMessage(goal.title, linkedTasks.length, linkedHabits.length), 'Eliminar', () =>
              run(() => api.deleteGoal(goal.id), () => router.replace('/metas')),
            )
          }
        />
      </View>

      <Sheet visible={progressSheet} onClose={() => setProgressSheet(false)} title="Registrar avance">
        <TextField label={`Cantidad (${goal.metricUnit})`} value={delta} onChangeText={setDelta} inputMode="decimal" error={deltaError} hint="Usa un número negativo para corregir un error." />
        <TextField label="Nota (opcional)" value={note} onChangeText={setNote} maxLength={500} />
        <View style={styles.sheetActions}>
          <Button label="Cancelar" variant="ghost" onPress={() => setProgressSheet(false)} />
          <Button label="Registrar" onPress={submitDelta} loading={mutate.isPending} />
        </View>
      </Sheet>

      <Sheet visible={habitSheet} onClose={() => setHabitSheet(false)} title="Vincular hábitos">
        {(habits.data ?? []).filter((h) => !h.archived).length === 0 ? <Text tone="secondary">Aún no tienes hábitos.</Text> : null}
        <View style={styles.wrap}>
          {(habits.data ?? [])
            .filter((h) => !h.archived)
            .map((h) => (
              <Chip key={h.id} label={h.name} selected={h.goalId === goal.id} onToggle={() => run(() => api.linkHabitToGoal(h.id, h.goalId === goal.id ? null : goal.id))} />
            ))}
        </View>
        <Button label="Listo" variant="secondary" onPress={() => setHabitSheet(false)} />
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing[5], gap: spacing[5] },
  wide: { maxWidth: 820, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4], padding: spacing[6] },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], alignSelf: 'flex-start' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing[5] },
  card: { gap: spacing[3], padding: spacing[5], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  warn: { borderColor: colors.warning, backgroundColor: colors.warningMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  checkHit: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  box: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2] },
  strike: { textDecorationLine: 'line-through', color: colors.textSecondary },
  flex: { flex: 1 },
});

