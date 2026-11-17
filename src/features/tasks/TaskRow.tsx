import { router } from 'expo-router';
import { Check, CheckCircle2, ExternalLink, Lock, Pencil, Repeat } from 'lucide-react-native';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { formatDay } from '@/components/forms/DateField';
import { openInSplit, useSplit } from '@/features/system/split';
import { useContextMenu } from '@/components/overlays/ContextMenu';
import { useToast } from '@/components/overlays/UndoToast';
import { Text } from '@/components/primitives/Text';
import { colors, hitTarget, radius, spacing } from '@/design/tokens';
import { dueBucket } from '@/domain/tasks/listing';
import type { DayKey } from '@/lib/dates';
import { formatDuration } from '@/lib/time';
import { platformHaptics } from '@/platform/haptics';

import type { Task } from './api';
import { useToggleTask } from './hooks';

const PRIORITY_COLOR: Record<number, string> = { 3: colors.danger, 2: colors.warning, 1: colors.info };
const PRIORITY_NAME: Record<number, string> = { 3: 'alta', 2: 'media', 1: 'baja' };

export function TaskRow({ task, today, blocked = false }: { task: Task; today: DayKey; blocked?: boolean }) {
  const toggle = useToggleTask();
  const toast = useToast((t) => t.show);
  const done = task.status === 'done';
  const bucket = dueBucket(task.dueDate, today);
  const subDone = task.subtasks.filter((s) => s.done).length;

  const onToggle = () => {
    if (blocked && !done) {
      toast('Esta tarea depende de otras que aún no has terminado.');
      return;
    }
    toggle.mutate(task, { onError: () => toast('No se pudo guardar. Revisa la conexión.') });
    if (!done) {
      platformHaptics.success();
      toast(task.recurrence ? `«${task.title}» completada · se creó la siguiente` : `«${task.title}» completada`, task.recurrence ? undefined : () => toggle.mutate({ ...task, status: 'done' }));
    }
  };

  const selected = useSplit((st) => st.active.task && st.selected.task === task.id);
  const open = () => { if (!openInSplit('task', task.id)) router.push({ pathname: '/tarea/[id]', params: { id: task.id } }); };
  const ctx = useContextMenu(task.title, [
    { label: done ? 'Reabrir' : 'Completar', icon: CheckCircle2, onSelect: onToggle },
    { label: 'Abrir', icon: ExternalLink, onSelect: open },
    { label: 'Editar', icon: Pencil, onSelect: () => router.push({ pathname: '/tarea/editar/[id]', params: { id: task.id } }) },
  ]);

  const meta: string[] = [];
  if (task.dueDate) meta.push(`${formatDay(task.dueDate, today)}${task.dueTime ? ` · ${task.dueTime.slice(0, 5)}` : ''}`);
  if (task.estimateMinutes) meta.push(formatDuration(task.estimateMinutes));
  if (task.subtasks.length) meta.push(`${subDone}/${task.subtasks.length} subtareas`);
  if (task.postponedCount >= 3 && !done) meta.push(`aplazada ${task.postponedCount} veces`);

  return (
    <View style={[styles.row, done && styles.rowDone, selected && styles.rowSelected]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done, disabled: blocked && !done }} aria-checked={done}
        accessibilityLabel={done ? `Reabrir ${task.title}` : blocked ? `${task.title} está bloqueada` : `Completar ${task.title}`}
        style={(s: { pressed: boolean; hovered?: boolean; focused?: boolean }) => [
          styles.check,
          (s.pressed || s.hovered) && !done && styles.checkHover,
          s.focused && Platform.OS === 'web' && styles.focus,
        ]}
      >
        <View style={[styles.circle, { borderColor: done ? colors.accent : PRIORITY_COLOR[task.priority] }, done && styles.circleDone]}>
          {done ? <Check size={14} color={colors.textOnAccent} strokeWidth={3} /> : blocked ? <Lock size={12} color={colors.textTertiary} /> : null}
        </View>
      </Pressable>
      <Pressable
        style={styles.main}
        onPress={open}
        accessibilityState={{ selected }}
        {...ctx.triggerProps}
        accessibilityRole="button"
        accessibilityLabel={`${task.title}. Prioridad ${PRIORITY_NAME[task.priority]}. ${meta.join('. ')}`}
      >
        <Text variant="bodyStrong" numberOfLines={2} style={done && styles.titleDone}>
          {task.title}
        </Text>
        {meta.length || task.tags.length || task.recurrence ? (
          <View style={styles.meta}>
            {task.recurrence ? <Repeat size={12} color={colors.textTertiary} /> : null}
            <Text variant="caption" tone={bucket === 'vencidas' && !done ? 'danger' : bucket === 'hoy' && !done ? 'warning' : 'tertiary'} numberOfLines={1}>
              {meta.join('  ·  ')}
            </Text>
            {task.tags.map((t) => (
              <Text key={t.id} variant="caption" tone="accent">
                #{t.name}
              </Text>
            ))}
          </View>
        ) : null}
      </Pressable>
      {ctx.menu}
    </View>
  );
}

const styles = StyleSheet.create({
  rowSelected: { borderColor: colors.accentBright, backgroundColor: colors.accentMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], paddingLeft: spacing[2], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  rowDone: { opacity: 0.6 },
  check: { width: hitTarget, height: hitTarget, alignItems: 'center', justifyContent: 'center', borderRadius: hitTarget / 2, borderWidth: 0 },
  circle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  circleDone: { backgroundColor: colors.accent },
  checkHover: { backgroundColor: colors.surfaceRaised },
  focus: { outlineColor: colors.borderFocus, outlineWidth: 2, outlineStyle: 'solid' } as object,
  main: { flex: 1, gap: 2, paddingVertical: spacing[3], paddingRight: spacing[4] },
  titleDone: { textDecorationLine: 'line-through', color: colors.textSecondary },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[2] },
});
