import { router } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/forms/Chip';
import { DateField } from '@/components/forms/DateField';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, spacing } from '@/design/tokens';
import { formatRecurrence, parseRecurrence } from '@/domain/tasks/recurrence';
import { validate, type FieldErrors } from '@/features/auth/validation';
import { FormMessage } from '@/features/auth/FormMessage';
import { useGoals } from '@/features/goals/hooks';
import { useTimeZone, useToday } from '@/features/habits/useToday';
import { WEEKDAYS } from '@/features/onboarding/options';
import type { DayKey } from '@/lib/dates';
import { normalizeTime } from '@/lib/time';

import { createTask, setTaskTags, updateTask, type Task } from './api';
import { useTaskMutation } from './hooks';
import { reminderInstant } from './reminders';
import { taskFormSchema, type TaskForm } from './validation';

const PRIORITIES = [
  { v: 3, l: 'Alta' },
  { v: 2, l: 'Media' },
  { v: 1, l: 'Baja' },
];
const ESTIMATES = [15, 30, 60, 90, 120];
const REMINDERS = [
  { v: null, l: 'Sin aviso' },
  { v: 0, l: 'A la hora' },
  { v: 15, l: '15 min antes' },
  { v: 60, l: '1 h antes' },
  { v: 1440, l: '1 día antes' },
];
type Freq = 'none' | 'DAILY' | 'WEEKLY' | 'MONTHLY';


export function TaskEditor({ task, presetGoalId }: { task?: Task; presetGoalId?: string }) {
  const editing = !!task;
  const today = useToday();
  const tz = useTimeZone();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const goals = useGoals();
  const rec = task?.recurrence ? parseRecurrence(task.recurrence) : null;

  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [priority, setPriority] = useState(task?.priority ?? 2);
  const [dueDate, setDueDate] = useState<DayKey | null>(task?.dueDate ?? null);
  const [dueTime, setDueTime] = useState(task?.dueTime?.slice(0, 5) ?? '');
  const [estimate, setEstimate] = useState(task?.estimateMinutes ? String(task.estimateMinutes) : '');
  const [freq, setFreq] = useState<Freq>(rec?.freq ?? 'none');
  const [byDay, setByDay] = useState<number[]>(rec?.byDay ?? []);
  const [reminder, setReminder] = useState<number | null>(null);
  const [goalId, setGoalId] = useState<string | null>(task?.goalId ?? presetGoalId ?? null);
  const [tags, setTags] = useState(task?.tags.map((t) => t.name).join(', ') ?? '');
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [newSub, setNewSub] = useState('');
  const [errors, setErrors] = useState<FieldErrors<TaskForm>>({});
  const [failure, setFailure] = useState<string | null>(null);

  const save = useTaskMutation(async (v: TaskForm) => {
    const payload = {
      title: v.title,
      notes: v.notes ?? null,
      priority: v.priority,
      dueDate: v.dueDate as DayKey | null,
      dueTime: v.dueTime,
      estimateMinutes: v.estimateMinutes,
      recurrence: v.recurrence,
      goalId: v.goalId,
      reminderAt: v.dueDate && v.reminderMinutesBefore !== null ? reminderInstant(v.dueDate as DayKey, v.dueTime, v.reminderMinutesBefore, tz) : editing ? task!.reminderAt : null,
    };
    const tagNames = tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (editing) {
      await updateTask(task!.id, payload);
      await setTaskTags(task!.id, tagNames);
      return task!.id;
    }
    return createTask({ ...payload, subtasks, tagNames });
  });

  const submit = () => {
    setFailure(null);
    const time = dueTime.trim() ? normalizeTime(dueTime) : null;
    if (dueTime.trim() && !time) return setErrors({ dueTime: 'Usa el formato HH:MM.' });
    const recurrence = freq === 'none' ? null : formatRecurrence({ freq, interval: 1, byDay: freq === 'WEEKLY' ? byDay : [] });
    const v = validate(taskFormSchema, {
      title,
      notes: notes || undefined,
      priority,
      dueDate,
      dueTime: time,
      estimateMinutes: estimate.trim() ? Number(estimate) : null,
      recurrence,
      reminderMinutesBefore: reminder,
      goalId,
    });
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    save.mutate(v.data, {
      onSuccess: () => (router.canGoBack() ? router.back() : router.replace('/agenda')),
      onError: () => setFailure('No se pudo guardar la tarea. Comprueba la conexión.'),
    });
  };

  const activeGoals = (goals.data ?? []).filter((g) => g.status === 'active');

  return (
    <ScrollView
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[4], paddingBottom: insets.bottom + spacing[10] }, width >= 900 && styles.wide]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text variant="title1" accessibilityRole="header">
          {editing ? 'Editar tarea' : 'Nueva tarea'}
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={10}>
          <X size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <TextField label="Qué hay que hacer" value={title} onChangeText={setTitle} error={errors.title} placeholder="Terminar el informe de laboratorio" maxLength={200} autoFocus={!editing} />

      <Section title="Prioridad">
        <View style={styles.wrap}>
          {PRIORITIES.map((p) => (
            <Chip key={p.v} role="radio" label={p.l} selected={priority === p.v} onToggle={() => setPriority(p.v)} />
          ))}
        </View>
      </Section>

      <Section title="Cuándo">
        <DateField label="Fecha límite" value={dueDate} onChange={setDueDate} today={today} />
        {dueDate ? <TextField label="Hora (opcional)" value={dueTime} onChangeText={setDueTime} placeholder="18:00" error={errors.dueTime} inputMode="numeric" maxLength={5} /> : null}
        <Text variant="caption" tone="secondary">Repetir</Text>
        <View style={styles.wrap}>
          {(['none', 'DAILY', 'WEEKLY', 'MONTHLY'] as Freq[]).map((f) => (
            <Chip key={f} role="radio" label={{ none: 'No', DAILY: 'Cada día', WEEKLY: 'Cada semana', MONTHLY: 'Cada mes' }[f]} selected={freq === f} onToggle={() => setFreq(f)} />
          ))}
        </View>
        {freq === 'WEEKLY' ? (
          <View style={styles.wrap}>
            {WEEKDAYS.map((d) => (
              <Chip key={d.value} label={d.label} selected={byDay.includes(d.value)} onToggle={() => setByDay((x) => (x.includes(d.value) ? x.filter((y) => y !== d.value) : [...x, d.value]))} />
            ))}
          </View>
        ) : null}
        {errors.recurrence ? <Text variant="caption" tone="danger">{errors.recurrence}</Text> : null}
        {dueDate ? (
          <>
            <Text variant="caption" tone="secondary">Recordatorio</Text>
            <View style={styles.wrap}>
              {REMINDERS.map((r) => (
                <Chip key={String(r.v)} role="radio" label={r.l} selected={reminder === r.v} onToggle={() => setReminder(r.v)} />
              ))}
            </View>
            {editing && task?.reminderAt && reminder === null ? (
              <Text variant="caption" tone="tertiary">Mantiene el recordatorio actual.</Text>
            ) : null}
          </>
        ) : null}
      </Section>

      <Section title="Esfuerzo">
        <View style={styles.wrap}>
          {ESTIMATES.map((m) => (
            <Chip key={m} role="radio" label={m < 60 ? `${m} min` : `${m / 60} h`.replace('.5', ',5')} selected={estimate === String(m)} onToggle={() => setEstimate(String(m))} />
          ))}
        </View>
        <TextField label="Duración estimada (min)" value={estimate} onChangeText={setEstimate} inputMode="numeric" error={errors.estimateMinutes} />
      </Section>

      {activeGoals.length ? (
        <Section title="Meta o proyecto">
          <View style={styles.wrap}>
            <Chip role="radio" label="Ninguna" selected={goalId === null} onToggle={() => setGoalId(null)} />
            {activeGoals.map((g) => (
              <Chip key={g.id} role="radio" label={g.title} selected={goalId === g.id} onToggle={() => setGoalId(g.id)} />
            ))}
          </View>
        </Section>
      ) : null}

      <Section title="Detalles">
        <TextField label="Etiquetas (separadas por comas)" value={tags} onChangeText={setTags} placeholder="universidad, urgente" autoCapitalize="none" />
        <TextField label="Notas" value={notes} onChangeText={setNotes} multiline maxLength={5000} error={errors.notes} />
        {!editing ? (
          <View style={styles.col}>
            {subtasks.map((s, i) => (
              <View key={i} style={styles.subRow}>
                <Text style={styles.flex}>• {s}</Text>
                <Pressable onPress={() => setSubtasks((x) => x.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={`Quitar subtarea ${s}`} hitSlop={8}>
                  <X size={16} color={colors.textTertiary} />
                </Pressable>
              </View>
            ))}
            <View style={styles.subRow}>
              <View style={styles.flex}>
                <TextField
                  label="Subtarea"
                  value={newSub}
                  onChangeText={setNewSub}
                  onSubmitEditing={() => {
                    if (newSub.trim()) setSubtasks((x) => [...x, newSub.trim()]);
                    setNewSub('');
                  }}
                />
              </View>
              <Pressable
                onPress={() => {
                  if (newSub.trim()) setSubtasks((x) => [...x, newSub.trim()]);
                  setNewSub('');
                }}
                accessibilityRole="button"
                accessibilityLabel="Añadir subtarea"
                style={styles.addSub}
              >
                <Plus size={20} color={colors.accentSoft} />
              </Pressable>
            </View>
          </View>
        ) : null}
      </Section>

      {failure ? <FormMessage tone="danger">{failure}</FormMessage> : null}
      <Button label={editing ? 'Guardar cambios' : 'Crear tarea'} onPress={submit} loading={save.isPending} fullWidth />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="overline" tone="accent">{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing[5], gap: spacing[6] },
  wide: { maxWidth: 640, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: { gap: spacing[3] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  col: { gap: spacing[2] },
  subRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] },
  addSub: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
