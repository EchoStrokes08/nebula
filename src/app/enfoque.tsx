import { router, useLocalSearchParams } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { ArrowLeft, ExternalLink, PictureInPicture2, Pause, Play, SkipForward, Square } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/forms/Chip';
import { Stepper } from '@/components/forms/Stepper';
import { TextField } from '@/components/forms/TextField';
import { Sheet } from '@/components/overlays/Sheet';
import { useToast } from '@/components/overlays/UndoToast';
import { ProgressRing } from '@/components/progress/ProgressRing';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { formatClock, isPhaseOver, phaseElapsed, PRESETS, remainingMs, type FocusConfig, type FocusMode, type SessionSummary } from '@/domain/focus/timer';
import * as agendaApi from '@/features/agenda/api';
import { useAgendaMutation } from '@/features/agenda/hooks';
import { insertLog } from '@/features/habits/api';
import { useHabitsData } from '@/features/habits/hooks';
import { useTimeZone } from '@/features/habits/useToday';
import { useFocus } from '@/features/focus/store';
import { usePomodoroSettings } from '@/features/focus/settings';
import { describePomodoro, pomodoroConfig, POMODORO_LIMITS, POMODORO_PRESETS, samePomodoro } from '@/domain/focus/pomodoro';
import { useTasks } from '@/features/tasks/hooks';
import { MotivationLine } from '@/features/motivation/MotivationLine';
import { dayKeyOf } from '@/lib/dates';
import { getDesktopBridge } from '@/platform/desktopBridge';
import { ensureNotificationPermission } from '@/features/notifications/NotificationPrompt';
import { formatDuration } from '@/lib/time';

const MODES: { v: FocusMode; l: string; h: string }[] = [
  { v: 'pomodoro', l: 'Pomodoro', h: '' },
  { v: 'custom', l: 'Libre', h: 'Un solo bloque de la duración que elijas.' },
  { v: 'long', l: 'Sesión larga', h: '90 min de trabajo profundo y 15 de descanso.' },
];

function KeepAwake() {
  useKeepAwake('nebula-focus');
  return null;
}

/** Hora actual en estado: se actualiza cada segundo mientras haya una sesión en marcha. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    if (!active) return () => clearTimeout(first);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [active]);
  return now;
}

export default function Enfoque() {
  const params = useLocalSearchParams<{ habito?: string; tarea?: string; mini?: string }>();
  const desktop = getDesktopBridge();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tz = useTimeZone();
  const { habits } = useHabitsData();
  const tasks = useTasks();
  const toast = useToast((t) => t.show);
  const focus = useFocus();
  const timer = focus.timer;
  const now = useNow(!!timer && timer.pausedAt === null);

  const [mode, setMode] = useState<FocusMode>('pomodoro');
  const [customMin, setCustomMin] = useState('45');
  const pomodoro = usePomodoroSettings((st) => st.settings);
  const setPomodoro = usePomodoroSettings((st) => st.set);
  const [habitId, setHabitId] = useState<string | null>(params.habito ?? null);
  const [taskId, setTaskId] = useState<string | null>(params.tarea ?? null);
  const [summary, setSummary] = useState<(SessionSummary & { sessionId?: string }) | null>(null);
  const [radar, setRadar] = useState(false);

  const save = useAgendaMutation(async (s: SessionSummary) => {
    const sessionId = await agendaApi.saveFocusSession({
      clientId: s.clientId,
      mode: s.mode,
      plannedMinutes: s.plannedMinutes,
      startedAt: new Date(s.startedAt).toISOString(),
      endedAt: new Date(s.endedAt).toISOString(),
      focusedSeconds: s.focusedSeconds,
      pausedSeconds: s.pausedSeconds,
      endedEarly: s.endedEarly,
      habitId: s.habitId,
      taskId: s.taskId,
    });
    // Registro automático en el hábito vinculado (origen «temporizador», no autodeclarado).
    const habit = habits.data?.find((h) => h.id === s.habitId);
    const minutes = Math.floor(s.focusedSeconds / 60);
    if (habit && minutes > 0 && ['duration', 'flexible', 'binary', 'frequency'].includes(habit.kind)) {
      await insertLog({
        clientId: s.clientId,
        habitId: habit.id,
        dayKey: dayKeyOf(new Date(s.endedAt), tz),
        value: habit.kind === 'binary' || habit.kind === 'frequency' ? 1 : minutes,
        tz,
        source: 'timer',
        note: 'Sesión de enfoque',
      });
    }
    return sessionId;
  });

  const close = (s: SessionSummary | null) => {
    if (!s) return;
    save.mutate(s, {
      onSuccess: (sessionId) => setSummary({ ...s, sessionId }),
      onError: () => {
        setSummary(s);
        toast('No se pudo guardar la sesión. Revisa la conexión.');
      },
    });
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/agenda'));
  const activeHabits = (habits.data ?? []).filter((h) => !h.archived && ['duration', 'flexible', 'binary', 'frequency'].includes(h.kind));
  const openTasks = (tasks.data ?? []).filter((t) => t.status === 'todo' || t.status === 'in_progress').slice(0, 20);

  // --- Mini-ventana de escritorio (siempre visible) ------------------------------------------
  if (params.mini === '1') {
    if (!timer) {
      return (
        <View style={styles.mini}>
          <Text variant="bodyStrong">Sin sesión de enfoque</Text>
          <Button label="Abrir Nebula" variant="secondary" onPress={() => void desktop?.focus.openMain()} />
        </View>
      );
    }
    const paused = timer.pausedAt !== null;
    const over = isPhaseOver(timer, now);
    return (
      <View style={styles.mini}>
        <Text variant="overline" tone={timer.phase === 'focus' ? 'accent' : 'info'}>
          {timer.phase === 'focus' ? `ENFOQUE · ${timer.cycle}` : 'DESCANSO'}{paused ? ' · PAUSA' : ''}
        </Text>
        <Text variant="display" tabular accessibilityRole="timer">{over ? '00:00' : formatClock(remainingMs(timer, now))}</Text>
        <View style={styles.controls}>
          {over ? null : paused ? (
            <Button label="Continuar" icon={<Play size={16} color={colors.textOnAccent} />} onPress={focus.resume} />
          ) : (
            <Button label="Pausar" variant="secondary" icon={<Pause size={16} color={colors.text} />} onPress={focus.pause} />
          )}
          <Button label="Abrir" variant="ghost" icon={<ExternalLink size={16} color={colors.accentSoft} />} onPress={() => void desktop?.focus.openMain()} />
        </View>
      </View>
    );
  }

  // --- Resumen al terminar -----------------------------------------------------------------
  if (summary) {
    const task = tasks.data?.find((t) => t.id === summary.taskId);
    return (
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[8] }, width >= 900 && styles.wide]}>
        <Text variant="overline" tone="success">SESIÓN TERMINADA</Text>
        <Text variant="display" tabular>{formatDuration(Math.max(1, Math.round(summary.focusedSeconds / 60)))}</Text>
        <Text tone="secondary">
          de enfoque real{summary.pausedSeconds > 60 ? ` · ${formatDuration(Math.round(summary.pausedSeconds / 60))} en pausa` : ''}
          {summary.endedEarly ? ' · terminada antes de tiempo' : ''}
        </Text>
        {summary.habitId ? <Text variant="callout" tone="secondary">Registrada en tu hábito con el temporizador.</Text> : null}
        <View style={styles.actions}>
          {task && task.status !== 'done' ? <Button label={`Completar «${task.title}»`} variant="secondary" onPress={() => router.push({ pathname: '/tarea/[id]', params: { id: task.id } })} /> : null}
          <Button label="¿Algo te interrumpió?" variant="secondary" onPress={() => setRadar(true)} />
          <Button label="Listo" onPress={back} />
        </View>
        <DistractionSheet visible={radar} onClose={() => setRadar(false)} sessionId={summary.sessionId ?? null} abandoned={summary.endedEarly} />
      </ScrollView>
    );
  }

  // --- Sesión activa -----------------------------------------------------------------------
  if (timer) {
    const total = (timer.phase === 'focus' ? timer.config.focusMinutes : timer.phase === 'break' ? timer.config.breakMinutes : timer.config.longBreakMinutes) * 60_000;
    const over = isPhaseOver(timer, now);
    const paused = timer.pausedAt !== null;
    const linkedHabit = habits.data?.find((h) => h.id === timer.habitId);
    const linkedTask = tasks.data?.find((t) => t.id === timer.taskId);
    return (
      <View style={[styles.active, { paddingTop: insets.top + spacing[6], paddingBottom: insets.bottom + spacing[6] }]}>
        {Platform.OS !== 'web' && !paused ? <KeepAwake /> : null}
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Volver (la sesión sigue activa)" style={styles.back} hitSlop={8}>
          <ArrowLeft size={20} color={colors.textSecondary} />
          <Text variant="callout" tone="secondary">La sesión sigue en segundo plano</Text>
        </Pressable>
        <View style={styles.center}>
          <Text variant="overline" tone={timer.phase === 'focus' ? 'accent' : 'info'}>
            {timer.phase === 'focus' ? `ENFOQUE · BLOQUE ${timer.cycle}` : timer.phase === 'break' ? 'DESCANSO' : 'DESCANSO LARGO'}
            {paused ? ' · EN PAUSA' : ''}
          </Text>
          <ProgressRing progress={phaseElapsed(timer, now) / total} size={Math.min(280, width - 80)} stroke={8} color={timer.phase === 'focus' ? colors.accentBright : colors.info} label="Progreso del bloque">
            <Text variant="display" tabular style={styles.clock} accessibilityRole="timer" accessibilityLabel={`Quedan ${formatClock(remainingMs(timer, now))}`}>
              {formatClock(remainingMs(timer, now))}
            </Text>
          </ProgressRing>
          {linkedHabit || linkedTask ? <Text tone="secondary">{linkedHabit?.name ?? linkedTask?.title}</Text> : null}
          {over ? <Text variant="bodyStrong" tone="success">{timer.phase === 'focus' ? 'Bloque completado.' : 'Descanso terminado.'}</Text> : null}
        </View>
        <View style={styles.controls}>
          {over ? (
            <Button
              label={timer.phase === 'focus' ? (timer.config.breakMinutes ? 'Empezar descanso' : 'Terminar sesión') : 'Siguiente bloque'}
              icon={<SkipForward size={18} color={colors.textOnAccent} />}
              onPress={() => close(focus.next())}
            />
          ) : paused ? (
            <Button label="Continuar" icon={<Play size={18} color={colors.textOnAccent} />} onPress={focus.resume} />
          ) : (
            <Button label="Pausar" variant="secondary" icon={<Pause size={18} color={colors.text} />} onPress={focus.pause} />
          )}
          <Button label="Terminar" variant="secondary" icon={<Square size={16} color={colors.text} />} onPress={() => close(focus.stop())} loading={save.isPending} />
        </View>
        <View style={styles.controls}>
          <Button label="Registrar una distracción" variant="ghost" onPress={() => setRadar(true)} />
          {desktop ? <Button label="Mini-ventana" variant="ghost" icon={<PictureInPicture2 size={16} color={colors.accentSoft} />} onPress={() => void desktop.focus.openMini()} /> : null}
        </View>
        <DistractionSheet visible={radar} onClose={() => setRadar(false)} sessionId={null} abandoned={false} />
      </View>
    );
  }

  // --- Configuración -----------------------------------------------------------------------
  const config: FocusConfig = mode === 'custom' ? { ...PRESETS.custom, focusMinutes: Math.min(480, Math.max(1, Number(customMin) || 0)) } : mode === 'pomodoro' ? pomodoroConfig(pomodoro) : PRESETS[mode];
  const customInvalid = mode === 'custom' && !(Number(customMin) >= 1 && Number(customMin) <= 480);
  return (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[4], paddingBottom: insets.bottom + spacing[10] }, width >= 900 && styles.wide]} keyboardShouldPersistTaps="handled">
      <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Volver" style={styles.back} hitSlop={8}>
        <ArrowLeft size={20} color={colors.textSecondary} />
        <Text variant="callout" tone="secondary">Volver</Text>
      </Pressable>
      <Text variant="title1" accessibilityRole="header">Sesión de enfoque</Text>
      <MotivationLine moment="enfoque" />
      <View style={styles.section}>
        <Text variant="overline" tone="accent">MODO</Text>
        <View style={styles.wrap}>
          {MODES.map((m) => (
            <Chip key={m.v} role="radio" label={m.l} selected={mode === m.v} onToggle={() => setMode(m.v)} />
          ))}
        </View>
        <Text variant="callout" tone="secondary">{mode === 'pomodoro' ? describePomodoro(pomodoro) : MODES.find((m) => m.v === mode)!.h}</Text>
        {mode === 'pomodoro' ? (
          <View style={styles.pomodoro}>
            <View style={styles.wrap}>
              {POMODORO_PRESETS.map((p) => (
                <Chip key={p.label} role="radio" label={p.label} selected={samePomodoro(pomodoro, p.value)} onToggle={() => setPomodoro(p.value)} />
              ))}
            </View>
            <Stepper label="Enfoque" unit="min" value={pomodoro.focus} min={POMODORO_LIMITS.focus[0]} max={POMODORO_LIMITS.focus[1]} step={POMODORO_LIMITS.focus[2]} onChange={(v) => setPomodoro({ focus: v })} />
            <Stepper label="Descanso corto" unit="min" value={pomodoro.short} min={POMODORO_LIMITS.short[0]} max={POMODORO_LIMITS.short[1]} step={POMODORO_LIMITS.short[2]} onChange={(v) => setPomodoro({ short: v })} />
            <Stepper label="Descanso largo" unit="min" value={pomodoro.long} min={POMODORO_LIMITS.long[0]} max={POMODORO_LIMITS.long[1]} step={POMODORO_LIMITS.long[2]} onChange={(v) => setPomodoro({ long: v })} />
            <Stepper label="Bloques hasta el descanso largo" value={pomodoro.cycles} min={POMODORO_LIMITS.cycles[0]} max={POMODORO_LIMITS.cycles[1]} step={1} onChange={(v) => setPomodoro({ cycles: v })} />
            <Text variant="caption" tone="tertiary">Se guarda para tus próximas sesiones.</Text>
          </View>
        ) : null}
        {mode === 'custom' ? <TextField label="Minutos" value={customMin} onChangeText={setCustomMin} inputMode="numeric" error={customInvalid ? 'Entre 1 y 480 minutos.' : null} /> : null}
      </View>
      {activeHabits.length ? (
        <View style={styles.section}>
          <Text variant="overline" tone="accent">CUENTA PARA EL HÁBITO</Text>
          <View style={styles.wrap}>
            <Chip role="radio" label="Ninguno" selected={habitId === null} onToggle={() => setHabitId(null)} />
            {activeHabits.map((h) => (
              <Chip key={h.id} role="radio" label={h.name} selected={habitId === h.id} onToggle={() => setHabitId(h.id)} />
            ))}
          </View>
        </View>
      ) : null}
      {openTasks.length ? (
        <View style={styles.section}>
          <Text variant="overline" tone="accent">TRABAJAR EN LA TAREA</Text>
          <View style={styles.wrap}>
            <Chip role="radio" label="Ninguna" selected={taskId === null} onToggle={() => setTaskId(null)} />
            {openTasks.map((t) => (
              <Chip key={t.id} role="radio" label={t.title} selected={taskId === t.id} onToggle={() => setTaskId(t.id)} />
            ))}
          </View>
        </View>
      ) : null}
      <Button label={`Empezar ${config.focusMinutes} min`} icon={<Play size={18} color={colors.textOnAccent} />} disabled={customInvalid} onPress={() => { void ensureNotificationPermission().catch(() => {}).finally(() => focus.start(config, { habitId, taskId })); }} fullWidth />
    </ScrollView>
  );
}

/** Radar de distracciones (registro voluntario, F07-012). */
function DistractionSheet({ visible, onClose, sessionId, abandoned }: { visible: boolean; onClose(): void; sessionId: string | null; abandoned: boolean }) {
  const [kind, setKind] = useState<agendaApi.DistractionKind | null>(null);
  const [minutes, setMinutes] = useState('');
  const [note, setNote] = useState('');
  const toast = useToast((t) => t.show);
  const save = useAgendaMutation(agendaApi.logDistraction);
  return (
    <Sheet visible={visible} onClose={onClose} title="¿Qué te interrumpió?">
      <Text variant="callout" tone="secondary">Registrarlo es voluntario. Con varias entradas, Nebula te mostrará patrones.</Text>
      <View style={styles.wrap}>
        {agendaApi.DISTRACTION_KINDS.map((k) => (
          <Chip key={k.v} role="radio" label={k.l} selected={kind === k.v} onToggle={() => setKind(k.v)} />
        ))}
      </View>
      <TextField label="Minutos perdidos (opcional)" value={minutes} onChangeText={setMinutes} inputMode="numeric" />
      <TextField label="Nota (opcional)" value={note} onChangeText={setNote} maxLength={300} />
      <View style={styles.sheetActions}>
        <Button label="Cancelar" variant="ghost" onPress={onClose} />
        <Button
          label="Guardar"
          disabled={!kind}
          loading={save.isPending}
          onPress={() =>
            kind &&
            save.mutate(
              { sessionId, kind, durationMinutes: minutes.trim() ? Math.min(600, Math.max(0, Math.round(Number(minutes) || 0))) : null, abandoned, note: note.trim() || null },
              {
                onSuccess: () => {
                  toast('Distracción registrada');
                  setKind(null);
                  setMinutes('');
                  setNote('');
                  onClose();
                },
                onError: () => toast('No se pudo guardar.'),
              },
            )
          }
        />
      </View>
    </Sheet>
  );
}


const styles = StyleSheet.create({
  pomodoro: { gap: spacing[3], padding: spacing[4], borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  scroll: { paddingHorizontal: spacing[5], gap: spacing[5] },
  wide: { maxWidth: 640, width: '100%', alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], alignSelf: 'flex-start' },
  section: { gap: spacing[3] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  active: { flex: 1, paddingHorizontal: spacing[5], justifyContent: 'space-between', alignItems: 'center' },
  center: { alignItems: 'center', gap: spacing[5] },
  clock: { fontSize: 56, lineHeight: 64 },
  mini: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], padding: spacing[4] },
  controls: { flexDirection: 'row', gap: spacing[3] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2] },
  card: { padding: spacing[4], borderRadius: radius.lg, backgroundColor: colors.surface },
});
