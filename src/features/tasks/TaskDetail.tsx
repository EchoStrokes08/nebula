import { router } from 'expo-router';
import { ArrowLeft, CalendarClock, Check, Link2, Lock, Pencil, Plus, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Chip } from '@/components/forms/Chip';
import { formatDay } from '@/components/forms/DateField';
import { TextField } from '@/components/forms/TextField';
import { Sheet } from '@/components/overlays/Sheet';
import { useToast } from '@/components/overlays/UndoToast';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { analyzeDag, wouldCreateCycle } from '@/domain/tasks/dag';
import { describeRecurrence } from '@/domain/tasks/recurrence';
import { useGoals } from '@/features/goals/hooks';
import { useToday } from '@/features/habits/useToday';
import { selectInSplit } from '@/features/system/split';
import * as api from '@/features/tasks/api';
import { useTaskMutation, useTasks, useToggleTask } from '@/features/tasks/hooks';
import { confirmAction } from '@/lib/confirm';
import { addDays } from '@/lib/dates';
import { formatDuration } from '@/lib/time';
import { SkeletonList } from '@/components/feedback/Skeleton';

const PRIORITY = { 3: 'Alta', 2: 'Media', 1: 'Baja' } as Record<number, string>;

/** Detalle de tarea: pantalla propia o columna derecha en escritorio ancho. */
export function TaskDetail({ id, embedded }: { id: string; embedded?: boolean }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const today = useToday();
  const tasks = useTasks();
  const goals = useGoals();
  const toggle = useToggleTask();
  const toast = useToast((t) => t.show);
  const [newSub, setNewSub] = useState('');
  const [picker, setPicker] = useState(false);
  const mutate = useTaskMutation(async (fn: () => Promise<unknown>) => fn());
  const back = () => (embedded ? selectInSplit('task', null) : router.canGoBack() ? router.back() : router.replace('/agenda'));

  const all = tasks.data ?? [];
  const task = all.find((t) => t.id === id);
  if (tasks.isLoading) return <View style={styles.center}><SkeletonList rows={3} /></View>;
  if (!task) {
    return (
      <View style={styles.center}>
        <EmptyState title={tasks.error ? 'No se pudo cargar la tarea' : 'Esta tarea ya no existe'} />
        <Button label="Volver" variant="secondary" onPress={back} />
      </View>
    );
  }

  const edges = all.flatMap((t) => t.dependsOn.map((d) => ({ taskId: t.id, dependsOn: d })));
  const dag = analyzeDag(all.map((t) => ({ id: t.id, done: t.status === 'done' || t.status === 'cancelled', estimateMinutes: t.estimateMinutes })), edges);
  const blocked = dag.blocked.has(task.id);
  const prereqs = all.filter((t) => task.dependsOn.includes(t.id));
  const dependents = all.filter((t) => t.dependsOn.includes(task.id));
  const candidates = all.filter((t) => t.id !== task.id && !task.dependsOn.includes(t.id) && t.status !== 'cancelled' && !wouldCreateCycle(edges, task.id, t.id) && (task.goalId ? t.goalId === task.goalId : true));
  const goal = goals.data?.find((g) => g.id === task.goalId);
  const done = task.status === 'done';
  const run = (fn: () => Promise<unknown>, msg = 'No se pudo guardar. Revisa la conexión.') => mutate.mutate(fn, { onError: () => toast(msg) });

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: embedded ? spacing[10] : insets.top + spacing[4], paddingBottom: insets.bottom + spacing[12] }, width >= 900 && !embedded && styles.wide]} keyboardShouldPersistTaps="handled">
      {!embedded ? (
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Volver" style={styles.back} hitSlop={8}>
          <ArrowLeft size={20} color={colors.textSecondary} />
          <Text variant="callout" tone="secondary">Volver</Text>
        </Pressable>
      ) : null}

      <View style={styles.head}>
        <Text variant="overline" tone={done ? 'success' : blocked ? 'warning' : 'accent'}>
          {done ? 'COMPLETADA' : blocked ? 'BLOQUEADA' : `PRIORIDAD ${PRIORITY[task.priority]!.toUpperCase()}`}
        </Text>
        <Text variant="title1" accessibilityRole="header" style={done && styles.strike}>{task.title}</Text>
        <View style={styles.metaWrap}>
          {task.dueDate ? <Meta text={`${formatDay(task.dueDate, today)}${task.dueTime ? ` · ${task.dueTime.slice(0, 5)}` : ''}`} tone={task.dueDate < today && !done ? 'danger' : 'secondary'} /> : null}
          {task.estimateMinutes ? <Meta text={formatDuration(task.estimateMinutes)} /> : null}
          {task.recurrence ? <Meta text={describeRecurrence(task.recurrence) ?? ''} /> : null}
          {goal ? <Meta text={`Meta: ${goal.title}`} /> : null}
          {task.postponedCount ? <Meta text={`Aplazada ${task.postponedCount} ${task.postponedCount === 1 ? 'vez' : 'veces'}`} tone={task.postponedCount >= 3 ? 'warning' : 'secondary'} /> : null}
        </View>
        {task.tags.length ? <Text variant="callout" tone="accent">{task.tags.map((t) => `#${t.name}`).join('  ')}</Text> : null}
      </View>

      {blocked ? (
        <View style={[styles.card, styles.warn]}>
          <Text variant="bodyStrong">Antes tienes que terminar:</Text>
          {prereqs.filter((p) => p.status !== 'done').map((p) => (
            <Text key={p.id} tone="secondary">• {p.title}</Text>
          ))}
        </View>
      ) : null}
      {task.postponedCount >= 3 && !done ? (
        <View style={[styles.card, styles.warn]}>
          <Text variant="bodyStrong">La has aplazado {task.postponedCount} veces.</Text>
          <Text tone="secondary">Divídela en un primer paso de 10 minutos o decide si sigue siendo importante.</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          label={done ? 'Reabrir' : 'Completar'}
          icon={<Check size={18} color={done ? colors.text : colors.textOnAccent} />}
          variant={done ? 'secondary' : 'primary'}
          disabled={blocked && !done}
          onPress={() => toggle.mutate(task, { onError: () => toast('No se pudo guardar.') })}
        />
        {!done ? (
          <Button
            label="Mañana"
            variant="secondary"
            icon={<CalendarClock size={18} color={colors.text} />}
            onPress={() => run(() => api.updateTask(task.id, { dueDate: addDays(task.dueDate && task.dueDate > today ? task.dueDate : today, 1) }))}
          />
        ) : null}
        <Button label="Editar" variant="secondary" icon={<Pencil size={18} color={colors.text} />} onPress={() => router.push({ pathname: '/tarea/editar/[id]', params: { id: task.id } })} />
      </View>

      {task.notes ? (
        <View style={styles.card}>
          <Text variant="title3">Notas</Text>
          <Text tone="secondary">{task.notes}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text variant="title3">Subtareas</Text>
        {task.subtasks.map((s) => (
          <View key={s.id} style={styles.line}>
            <Pressable
              onPress={() => run(() => api.toggleSubtask(s.id, !s.done))}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: s.done }} aria-checked={s.done}
              accessibilityLabel={s.title}
              style={styles.subCheck}
            >
              <View style={[styles.box, s.done && styles.boxDone]}>{s.done ? <Check size={12} color={colors.textOnAccent} strokeWidth={3} /> : null}</View>
            </Pressable>
            <Text style={[styles.flex, s.done && styles.strike]}>{s.title}</Text>
            <Pressable onPress={() => run(() => api.deleteSubtask(s.id))} accessibilityRole="button" accessibilityLabel={`Eliminar subtarea ${s.title}`} hitSlop={8}>
              <X size={16} color={colors.textTertiary} />
            </Pressable>
          </View>
        ))}
        <View style={styles.addRow}>
          <View style={styles.flex}>
            <TextField
              label="Nueva subtarea"
              value={newSub}
              onChangeText={setNewSub}
              onSubmitEditing={() => {
                if (!newSub.trim()) return;
                run(() => api.addSubtask(task.id, newSub.trim(), task.subtasks.length));
                setNewSub('');
              }}
            />
          </View>
          <Pressable
            onPress={() => {
              if (!newSub.trim()) return;
              run(() => api.addSubtask(task.id, newSub.trim(), task.subtasks.length));
              setNewSub('');
            }}
            accessibilityRole="button"
            accessibilityLabel="Añadir subtarea"
            style={styles.addBtn}
          >
            <Plus size={20} color={colors.accentSoft} />
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text variant="title3">Dependencias</Text>
        {prereqs.length === 0 ? <Text tone="secondary">No depende de otras tareas.</Text> : null}
        {prereqs.map((p) => (
          <View key={p.id} style={styles.line}>
            {p.status === 'done' ? <Check size={16} color={colors.success} /> : <Lock size={16} color={colors.warning} />}
            <Text style={styles.flex}>{p.title}</Text>
            <Pressable onPress={() => run(() => api.removeDependency(task.id, p.id))} accessibilityRole="button" accessibilityLabel={`Quitar dependencia de ${p.title}`} hitSlop={8}>
              <X size={16} color={colors.textTertiary} />
            </Pressable>
          </View>
        ))}
        {dependents.length ? (
          <Text variant="callout" tone="secondary">Desbloquea: {dependents.map((d) => d.title).join(', ')}</Text>
        ) : null}
        <Button label="Añadir prerrequisito" variant="ghost" icon={<Link2 size={18} color={colors.accentSoft} />} onPress={() => setPicker(true)} />
      </View>

      <Button
        label="Eliminar tarea"
        variant="danger"
        icon={<Trash2 size={18} color={colors.danger} />}
        onPress={() =>
          confirmAction('Eliminar tarea', `Se eliminará «${task.title}» con sus subtareas.`, 'Eliminar', () =>
            mutate.mutate(() => api.deleteTask(task.id), { onSuccess: back, onError: () => toast('No se pudo eliminar.') }),
          )
        }
      />

      <Sheet visible={picker} onClose={() => setPicker(false)} title="Esta tarea depende de…">
        {candidates.length === 0 ? (
          <Text tone="secondary">No hay tareas disponibles (las que crearían un ciclo no se muestran).</Text>
        ) : (
          <View style={styles.wrap}>
            {candidates.slice(0, 30).map((c) => (
              <Chip
                key={c.id}
                label={c.title}
                selected={false}
                onToggle={() => {
                  setPicker(false);
                  run(() => api.addDependency(task.id, c.id), 'No se pudo añadir la dependencia.');
                }}
              />
            ))}
          </View>
        )}
      </Sheet>
    </ScrollView>
  );
}

function Meta({ text, tone = 'secondary' }: { text: string; tone?: 'secondary' | 'danger' | 'warning' }) {
  return <Text variant="callout" tone={tone}>{text}</Text>;
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing[5], gap: spacing[5] },
  wide: { maxWidth: 760, width: '100%', alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4], padding: spacing[6] },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], alignSelf: 'flex-start' },
  head: { gap: spacing[2] },
  metaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  card: { gap: spacing[3], padding: spacing[5], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  warn: { borderColor: colors.warning, backgroundColor: colors.warningMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  subCheck: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  box: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  boxDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] },
  addBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  strike: { textDecorationLine: 'line-through', color: colors.textSecondary },
  flex: { flex: 1 },
});
