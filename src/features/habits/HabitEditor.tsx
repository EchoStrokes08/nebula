import { router } from 'expo-router';
import { ArrowLeft, ChevronDown, ChevronUp, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { KeyboardScroll } from '@/components/layout/KeyboardScroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/forms/Chip';
import { TextField } from '@/components/forms/TextField';
import { TimePicker } from '@/components/forms/TimePicker';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing, userColors, type UserColor } from '@/design/tokens';
import { targetAt } from '@/domain/habits/evaluate';
import type { HabitKind } from '@/domain/habits/types';
import { validate, type FieldErrors } from '@/features/auth/validation';
import { FormMessage } from '@/features/auth/FormMessage';
import { createHabit, setTarget as setTargetVersion, updateHabit, type HabitRecord } from '@/features/habits/api';
import { COLOR_NAMES, KIND_LABEL } from '@/features/habits/format';
import { useHabitMutation } from '@/features/habits/hooks';
import { HABIT_ICONS, HabitIcon } from '@/features/habits/icons';
import { TemplatePicker } from '@/features/habits/TemplatePicker';
import { describeTemplate, type HabitTemplate } from '@/domain/habits/templates';
import { useToday } from '@/features/habits/useToday';
import { habitFormSchema, periodOptionsFor, type HabitForm } from '@/features/habits/validation';
import { WEEKDAYS } from '@/features/onboarding/options';
import { normalizeTime } from '@/lib/time';

const KINDS = Object.keys(KIND_LABEL) as HabitKind[];
const PERIOD_LABEL = { day: 'Al día', week: 'A la semana', month: 'Al mes' } as const;
const PRIORITY_LABEL = ['Baja', 'Media', 'Alta'];
const num = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')));

export interface HabitEditorProps {
  /** Si se pasa, el editor está en modo edición (el tipo no se puede cambiar). */
  habit?: HabitRecord;
}

export function HabitEditor({ habit }: HabitEditorProps) {
  const editing = !!habit;
  const today = useToday();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const initialTarget = habit ? targetAt(habit, today) : null;
  const str = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));
  const [name, setName] = useState(habit?.name ?? '');
  const [kind, setKind] = useState<HabitKind>(habit?.kind ?? 'binary');
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>(initialTarget?.period ?? 'day');
  const [target, setTarget] = useState(str(initialTarget?.target));
  const [unit, setUnit] = useState(habit?.unit ?? '');
  const [sessionMin, setSessionMin] = useState(str(initialTarget?.sessionMin));
  const [minTarget, setMinTarget] = useState(str(initialTarget?.minTarget));
  const [days, setDays] = useState<number[]>(habit && habit.scheduleDays.length ? habit.scheduleDays : [0, 1, 2, 3, 4, 5, 6]);
  const [icon, setIcon] = useState(habit?.icon ?? 'circle');
  const [color, setColor] = useState<UserColor>(habit?.color ?? 'violet');
  const [priority, setPriority] = useState(habit?.priority ?? 2);
  const [reminder, setReminder] = useState(habit?.reminderTime ?? '');
  const [errors, setErrors] = useState<FieldErrors<HabitForm>>({});
  // Crear: primero se elige una sugerencia (o «uno propio»); editar va directo al formulario.
  const [step, setStep] = useState<'elegir' | 'ajustar'>(editing ? 'ajustar' : 'elegir');
  const [template, setTemplate] = useState<HabitTemplate | null>(null);
  const [more, setMore] = useState(editing);
  const pickTemplate = (t: HabitTemplate) => {
    setTemplate(t);
    setName(t.name);
    setKind(t.kind);
    setPeriod(t.period);
    setTarget(t.kind === 'binary' ? '' : String(t.target));
    setUnit(t.unit ?? '');
    setSessionMin(str(t.sessionMin));
    setMinTarget(str(t.minTarget));
    setDays(t.days ?? [0, 1, 2, 3, 4, 5, 6]);
    setIcon(t.icon);
    setColor(t.color);
    setReminder(t.reminder ?? '');
    setErrors({});
    setMore(false);
    setStep('ajustar');
  };
  const startScratch = (initial?: string) => {
    setTemplate(null);
    if (initial) setName(initial);
    setMore(true);
    setStep('ajustar');
  };
  const [failure, setFailure] = useState<string | null>(null);
  const create = useHabitMutation(createHabit);
  const save = useHabitMutation(async (v: HabitForm) => {
    if (!habit) return;
    await updateHabit(habit.id, {
      name: v.name,
      icon: v.icon,
      color: v.color,
      priority: v.priority,
      schedule_days: v.scheduleDays.length === 7 ? [] : v.scheduleDays,
      suggested_time: normalizeTime(reminder) ?? null,
    });
    const t = targetAt(habit, today);
    const changed =
      !t ||
      t.period !== v.period ||
      t.target !== v.target ||
      (t.sessionMin ?? undefined) !== v.sessionMin ||
      (t.minTarget ?? undefined) !== v.minTarget;
    // Objetivo nuevo = versión nueva desde hoy; el pasado se sigue evaluando con el anterior.
    if (changed) await setTargetVersion(habit.id, today, { period: v.period, target: v.target, sessionMin: v.sessionMin, minTarget: v.minTarget });
  });
  const busy = create.isPending || save.isPending;

  const pickKind = (k: HabitKind) => {
    setKind(k);
    const options = periodOptionsFor(k);
    if (!options.includes(period)) setPeriod(options[0]!);
  };

  const submit = () => {
    setFailure(null);
    const v = validate(habitFormSchema, {
      name,
      kind,
      period,
      target: kind === 'binary' ? 1 : (num(target) ?? NaN),
      unit: unit || undefined,
      sessionMin: kind === 'flexible' ? num(sessionMin) : undefined,
      minTarget: num(minTarget),
      scheduleDays: period === 'day' ? days : [],
      icon,
      color,
      priority,
    });
    if (!v.ok) return setErrors(v.errors);
    if (reminder.trim() && !normalizeTime(reminder)) return setFailure('La hora del recordatorio no es válida (HH:MM).');
    setErrors({});
    const done = () => (router.canGoBack() ? router.back() : router.replace('/habitos'));
    if (editing) {
      save.mutate(v.data, { onSuccess: done, onError: () => setFailure('No se pudieron guardar los cambios. Comprueba la conexión.') });
      return;
    }
    create.mutate(
      { ...v.data, scheduleDays: v.data.scheduleDays.length === 7 ? [] : v.data.scheduleDays, startDay: today, reminderTime: normalizeTime(reminder) },
      {
        onSuccess: () => (router.canGoBack() ? router.back() : router.replace('/habitos')),
        onError: () => setFailure('No se pudo crear el hábito. Comprueba la conexión e inténtalo de nuevo.'),
      },
    );
  };

  const targetLabel =
    kind === 'reduction'
      ? 'Límite máximo'
      : kind === 'frequency'
        ? 'Veces'
        : kind === 'flexible'
          ? 'Sesiones'
          : kind === 'duration'
            ? 'Minutos'
            : 'Objetivo';

  return (
    <KeyboardScroll contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[4], paddingBottom: insets.bottom + spacing[10] }, width >= 900 && styles.wide, width >= 900 && step === 'elegir' && styles.wideChoose]}>
      <View style={styles.header}>
        <Text variant="title1" accessibilityRole="header">
          {editing ? 'Editar hábito' : 'Nuevo hábito'}
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={10}>
          <X size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      {step === 'elegir' ? (
        <>
          <Text tone="secondary">Elige uno de los más populares y ajústalo, o crea el tuyo.</Text>
          <TemplatePicker onPick={pickTemplate} onScratch={startScratch} />
        </>
      ) : null}
      {step === 'ajustar' && !editing ? (
        <Pressable onPress={() => setStep('elegir')} accessibilityRole="button" style={styles.backRow} hitSlop={8}>
          <ArrowLeft size={18} color={colors.textSecondary} />
          <Text variant="callout" tone="secondary">Elegir otro hábito</Text>
        </Pressable>
      ) : null}
      {step === 'ajustar' && template ? (
        <View style={[styles.summary, { borderColor: `${userColors[color]}66` }]}>
          <View style={[styles.summaryIcon, { backgroundColor: `${userColors[color]}22` }]}>
            <HabitIcon name={icon} size={26} color={userColors[color]} strokeWidth={2} />
          </View>
          <View style={styles.flex}>
            <Text variant="title3" numberOfLines={1}>{name || template.name}</Text>
            <Text variant="caption" tone="accent">{describeTemplate({ kind, period, target: kind === 'binary' ? 1 : (num(target) ?? 0), unit, sessionMin: num(sessionMin) })}</Text>
            <Text variant="caption" tone="tertiary">{template.why}</Text>
          </View>
        </View>
      ) : null}
      {step === 'ajustar' ? <>
      <TextField label="Nombre" value={name} onChangeText={setName} error={errors.name} placeholder="Practicar inglés" maxLength={80} />

      {more ? <Section title="Tipo">
        {editing ? (
          <Text variant="bodyStrong">{KIND_LABEL[kind].title}</Text>
        ) : (
          <View style={styles.wrap}>
            {KINDS.map((k) => (
              <Chip key={k} role="radio" label={KIND_LABEL[k].title} selected={kind === k} onToggle={() => pickKind(k)} />
            ))}
          </View>
        )}
        <Text variant="callout" tone="secondary">
          {editing ? 'El tipo no se puede cambiar porque cambiaría el significado de tu historial.' : KIND_LABEL[kind].help}
        </Text>
      </Section> : null}

      {kind !== 'binary' ? (
        <Section title="Objetivo">
          <View style={styles.wrap}>
            {periodOptionsFor(kind).map((p) => (
              <Chip key={p} role="radio" label={PERIOD_LABEL[p]} selected={period === p} onToggle={() => setPeriod(p)} />
            ))}
          </View>
          {errors.period ? <Text variant="caption" tone="danger">{errors.period}</Text> : null}
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField label={targetLabel} value={target} onChangeText={setTarget} keyboardType="decimal-pad" inputMode="decimal" error={errors.target} />
            </View>
            {['quantity', 'cumulative', 'reduction'].includes(kind) ? (
              <View style={styles.flex}>
                <TextField label="Unidad" value={unit} onChangeText={setUnit} placeholder="páginas" error={errors.unit} maxLength={20} editable={!editing} />
              </View>
            ) : null}
          </View>
          {kind === 'flexible' ? (
            <TextField label="Mínimo por sesión (min)" value={sessionMin} onChangeText={setSessionMin} keyboardType="decimal-pad" inputMode="decimal" error={errors.sessionMin} />
          ) : null}
          {kind !== 'reduction' && more ? (
            <TextField
              label="Versión mínima (opcional)"
              hint="Lo que harías en un día difícil. Se usa en el modo recuperación."
              value={minTarget}
              onChangeText={setMinTarget}
              keyboardType="decimal-pad"
              inputMode="decimal"
              error={errors.minTarget}
            />
          ) : null}
        </Section>
      ) : null}

      {period === 'day' ? (
        <Section title="Días">
          <View style={styles.wrap}>
            {WEEKDAYS.map((d) => (
              <Chip
                key={d.value}
                label={d.label}
                selected={days.includes(d.value)}
                onToggle={() => setDays((x) => (x.includes(d.value) ? x.filter((y) => y !== d.value) : [...x, d.value]))}
              />
            ))}
          </View>
          {errors.scheduleDays ? <Text variant="caption" tone="danger">{errors.scheduleDays}</Text> : null}
        </Section>
      ) : null}

      <Section title="Recordatorio">
        <View style={styles.wrap}>
          {['', '08:00', '13:00', '19:00', '21:00'].map((t) => (
            <Chip key={t || 'none'} role="radio" label={t || 'Sin recordatorio'} selected={(normalizeTime(reminder) ?? '') === t} onToggle={() => setReminder(t)} />
          ))}
        </View>
        {/* Siempre se puede elegir cualquier hora del día, no solo las sugeridas. */}
        <TimePicker label="Hora personalizada" value={reminder} onChange={setReminder} step={5} placeholder="Elegir cualquier hora" />
        <Text variant="caption" tone="secondary">Solo los días programados y si aún no lo has hecho. Respeta tus horas de silencio.</Text>
      </Section>

      {!editing ? (
        <Pressable onPress={() => setMore((m) => !m)} accessibilityRole="button" accessibilityState={{ expanded: more }} style={styles.more}>
          <Text variant="bodyStrong" style={styles.flex}>{more ? 'Menos opciones' : 'Más opciones'}</Text>
          <Text variant="caption" tone="tertiary">Tipo, versión mínima, icono, color y prioridad</Text>
          {more ? <ChevronUp size={18} color={colors.textSecondary} /> : <ChevronDown size={18} color={colors.textSecondary} />}
        </Pressable>
      ) : null}

      {more ? <>
      <Section title="Icono">
        <View style={styles.wrap}>
          {Object.entries(HABIT_ICONS).map(([key, { icon: I, label }]) => (
            <Pressable
              key={key}
              onPress={() => setIcon(key)}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked: icon === key }} aria-checked={icon === key}
              style={[styles.iconBtn, icon === key && { borderColor: userColors[color], backgroundColor: colors.accentMuted }]}
            >
              <I size={20} color={icon === key ? userColors[color] : colors.textSecondary} strokeWidth={1.8} />
            </Pressable>
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

      <Section title="Prioridad">
        <View style={styles.wrap}>
          {PRIORITY_LABEL.map((l, i) => (
            <Chip key={l} role="radio" label={l} selected={priority === i + 1} onToggle={() => setPriority(i + 1)} />
          ))}
        </View>
      </Section>
      </> : null}

      {editing ? (
        <Text variant="caption" tone="tertiary">
          Si cambias el objetivo, se aplicará desde hoy. Los días anteriores conservan el objetivo que tenían.
        </Text>
      ) : null}
      {failure ? <FormMessage tone="danger">{failure}</FormMessage> : null}
      <Button label={editing ? 'Guardar cambios' : 'Crear hábito'} onPress={submit} loading={busy} fullWidth />
      </> : null}
    </KeyboardScroll>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="overline" tone="accent">
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing[5], gap: spacing[6] },
  wide: { maxWidth: 640, width: '100%', alignSelf: 'center' },
  // Elegir sugerencia: índice de categorías + cuadrícula, necesita más ancho que el formulario.
  wideChoose: { maxWidth: 1080 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: { gap: spacing[3] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  row: { flexDirection: 'row', gap: spacing[3] },
  flex: { flex: 1 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  swatch: { width: 32, height: 32, borderRadius: 16, margin: 6 },
  swatchActive: { borderWidth: 3, borderColor: colors.text },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], alignSelf: 'flex-start' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], padding: spacing[4], borderRadius: radius.xl, backgroundColor: colors.card, borderWidth: 1 },
  summaryIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  more: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[2], padding: spacing[4], borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
});
