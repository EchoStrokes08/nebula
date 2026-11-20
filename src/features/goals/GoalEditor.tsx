import { router } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { KeyboardScroll } from '@/components/layout/KeyboardScroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/forms/Chip';
import { DateField } from '@/components/forms/DateField';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, spacing, userColors, type UserColor } from '@/design/tokens';
import { validate, type FieldErrors } from '@/features/auth/validation';
import { FormMessage } from '@/features/auth/FormMessage';
import { COLOR_NAMES } from '@/features/habits/format';
import { useToday } from '@/features/habits/useToday';
import { VISIBILITY } from '@/features/onboarding/options';
import type { DayKey } from '@/lib/dates';

import { createGoal, updateGoal, type Goal } from './api';
import { useGoalMutation } from './hooks';
import { goalFormSchema, type GoalForm } from './validation';

const METRICS = [
  { v: 'milestones', l: 'Hitos', h: 'Avanzas completando etapas concretas.' },
  { v: 'quantity', l: 'Cantidad', h: 'Un número medible: horas, libros, kilómetros…' },
  { v: 'tasks', l: 'Tareas', h: 'El progreso son las tareas vinculadas completadas.' },
] as const;

export function GoalEditor({ goal, presetKind }: { goal?: Goal; presetKind?: 'goal' | 'project' }) {
  const editing = !!goal;
  const today = useToday();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [kind, setKind] = useState<'goal' | 'project'>(goal?.kind ?? presetKind ?? 'goal');
  const [title, setTitle] = useState(goal?.title ?? '');
  const [description, setDescription] = useState(goal?.description ?? '');
  const [outcome, setOutcome] = useState(goal?.expectedOutcome ?? '');
  const [targetDate, setTargetDate] = useState<DayKey | null>(goal?.targetDate ?? null);
  const [metric, setMetric] = useState<GoalForm['metric']>(goal?.metric ?? (presetKind === 'project' ? 'tasks' : 'milestones'));
  const [metricTarget, setMetricTarget] = useState(goal?.metricTarget ? String(goal.metricTarget) : '');
  const [metricUnit, setMetricUnit] = useState(goal?.metricUnit ?? '');
  const [visibility, setVisibility] = useState<GoalForm['visibility']>(goal?.visibility ?? 'private');
  const [color, setColor] = useState<UserColor>(goal?.color ?? 'violet');
  const [milestones, setMilestones] = useState<string[]>([]);
  const [newMilestone, setNewMilestone] = useState('');
  const [errors, setErrors] = useState<FieldErrors<GoalForm>>({});
  const [failure, setFailure] = useState<string | null>(null);

  const save = useGoalMutation(async (v: GoalForm) => {
    const input = {
      kind: v.kind,
      title: v.title,
      description: v.description ?? null,
      expectedOutcome: v.expectedOutcome ?? null,
      targetDate: v.targetDate as DayKey | null,
      metric: v.metric,
      metricTarget: v.metric === 'quantity' ? v.metricTarget : null,
      metricUnit: v.metric === 'quantity' ? v.metricUnit : null,
      visibility: v.visibility,
      color: v.color,
    };
    if (editing) {
      await updateGoal(goal!.id, input);
      return goal!.id;
    }
    return createGoal({ ...input, milestones: v.milestones });
  });

  const submit = () => {
    setFailure(null);
    const v = validate(goalFormSchema, {
      kind,
      title,
      description: description || undefined,
      expectedOutcome: outcome || undefined,
      targetDate,
      metric,
      metricTarget: metricTarget.trim() ? Number(metricTarget.replace(',', '.')) : null,
      metricUnit: metricUnit.trim() || null,
      visibility,
      color,
      milestones,
    });
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    save.mutate(v.data, {
      onSuccess: (id) => (editing ? router.back() : router.replace({ pathname: '/meta/[id]', params: { id } })),
      onError: () => setFailure('No se pudo guardar. Comprueba la conexión.'),
    });
  };

  const addMilestone = () => {
    if (newMilestone.trim()) setMilestones((m) => [...m, newMilestone.trim()]);
    setNewMilestone('');
  };

  return (
    <KeyboardScroll contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[4], paddingBottom: insets.bottom + spacing[10] }, width >= 900 && styles.wide]} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text variant="title1" accessibilityRole="header">
          {editing ? 'Editar' : kind === 'project' ? 'Nuevo proyecto' : 'Nueva meta'}
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={10}>
          <X size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      {!editing ? (
        <View style={styles.wrap}>
          <Chip role="radio" label="Meta" selected={kind === 'goal'} onToggle={() => setKind('goal')} />
          <Chip role="radio" label="Proyecto con etapas" selected={kind === 'project'} onToggle={() => { setKind('project'); setMetric('tasks'); }} />
        </View>
      ) : null}

      <TextField label="Nombre" value={title} onChangeText={setTitle} error={errors.title} placeholder={kind === 'project' ? 'Publicar mi primera web' : 'Aprobar el examen de inglés B2'} maxLength={120} />
      <TextField label="Resultado esperado" value={outcome} onChangeText={setOutcome} placeholder="Qué será distinto cuando lo consigas" maxLength={500} />
      <DateField label="Fecha objetivo" value={targetDate} onChange={setTargetDate} today={today} />

      <Section title="Cómo se mide">
        <View style={styles.wrap}>
          {METRICS.map((m) => (
            <Chip key={m.v} role="radio" label={m.l} selected={metric === m.v} onToggle={() => setMetric(m.v)} />
          ))}
        </View>
        <Text variant="callout" tone="secondary">{METRICS.find((m) => m.v === metric)!.h}</Text>
        {metric === 'quantity' ? (
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField label="Objetivo" value={metricTarget} onChangeText={setMetricTarget} inputMode="decimal" error={errors.metricTarget} />
            </View>
            <View style={styles.flex}>
              <TextField label="Unidad" value={metricUnit} onChangeText={setMetricUnit} placeholder="horas" error={errors.metricUnit} maxLength={20} />
            </View>
          </View>
        ) : null}
        {metric === 'milestones' && !editing ? (
          <View style={styles.col}>
            {milestones.map((m, i) => (
              <View key={i} style={styles.line}>
                <Text variant="callout" tone="tertiary" tabular>{i + 1}.</Text>
                <Text style={styles.flex}>{m}</Text>
                <Pressable onPress={() => setMilestones((x) => x.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={`Quitar hito ${m}`} hitSlop={8}>
                  <X size={16} color={colors.textTertiary} />
                </Pressable>
              </View>
            ))}
            <View style={styles.line}>
              <View style={styles.flex}>
                <TextField label="Hito" value={newMilestone} onChangeText={setNewMilestone} onSubmitEditing={addMilestone} placeholder="Completar los fundamentos" />
              </View>
              <Pressable onPress={addMilestone} accessibilityRole="button" accessibilityLabel="Añadir hito" style={styles.add}>
                <Plus size={20} color={colors.accentSoft} />
              </Pressable>
            </View>
          </View>
        ) : null}
        {kind === 'project' ? (
          <Text variant="caption" tone="tertiary">Después podrás añadir las etapas como tareas y marcar de cuáles depende cada una.</Text>
        ) : null}
      </Section>

      <TextField label="Descripción" value={description} onChangeText={setDescription} multiline maxLength={2000} />

      <Section title="Visibilidad">
        <View style={styles.wrap}>
          {VISIBILITY.map((v) => (
            <Chip key={v.value} role="radio" label={v.label} selected={visibility === v.value} onToggle={() => setVisibility(v.value)} />
          ))}
        </View>
      </Section>

      <Section title="Color">
        <View style={styles.wrap}>
          {(Object.keys(userColors) as UserColor[]).map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              accessibilityRole="radio"
              accessibilityLabel={COLOR_NAMES[c]}
              accessibilityState={{ checked: color === c }} aria-checked={color === c}
              style={[styles.swatch, { backgroundColor: userColors[c] }, color === c && styles.swatchActive]}
            />
          ))}
        </View>
      </Section>

      {failure ? <FormMessage tone="danger">{failure}</FormMessage> : null}
      <Button label={editing ? 'Guardar cambios' : 'Crear'} onPress={submit} loading={save.isPending} fullWidth />
    </KeyboardScroll>
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
  scroll: { paddingHorizontal: spacing[5], gap: spacing[5] },
  wide: { maxWidth: 640, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: { gap: spacing[3] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  row: { flexDirection: 'row', gap: spacing[3] },
  col: { gap: spacing[2] },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  add: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  swatch: { width: 32, height: 32, borderRadius: 16, margin: 6 },
  swatchActive: { borderWidth: 3, borderColor: colors.text },
});
