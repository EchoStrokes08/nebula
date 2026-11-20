import { router } from 'expo-router';
import { Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { KeyboardScroll } from '@/components/layout/KeyboardScroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/forms/Chip';
import { DateField } from '@/components/forms/DateField';
import { TextField } from '@/components/forms/TextField';
import { TimePicker } from '@/components/forms/TimePicker';
import { DAY_MINUTES } from '@/components/forms/TimeSlider';
import { Sheet } from '@/components/overlays/Sheet';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, spacing } from '@/design/tokens';
import { atLocal, localMinutes } from '@/domain/calendar/expand';
import { negotiate, type NegotiationOption } from '@/domain/planning/negotiate';
import { formatRecurrence, parseRecurrence } from '@/domain/tasks/recurrence';
import { FormMessage } from '@/features/auth/FormMessage';
import { useTimeZone, useToday } from '@/features/habits/useToday';
import { WEEKDAYS } from '@/features/onboarding/options';
import { createTask, updateTask } from '@/features/tasks/api';
import { useTasks } from '@/features/tasks/hooks';
import { confirmAction } from '@/lib/confirm';
import { dayKeyOf, startOfDayInstant, type DayKey } from '@/lib/dates';
import { formatDuration, hhmm, minutesOf, normalizeTime } from '@/lib/time';

import { createEvent, deleteEvent, updateEvent, type EventRecord } from './api';
import { useAgendaMutation, useAvailability } from './hooks';

const CATEGORIES = [
  { v: 'trabajo', l: 'Trabajo' },
  { v: 'estudio', l: 'Estudio' },
  { v: 'personal', l: 'Personal' },
  { v: 'salud', l: 'Salud' },
  { v: 'social', l: 'Social' },
  { v: 'otro', l: 'Otro' },
];
const REMINDERS = [
  { v: null, l: 'Sin aviso' },
  { v: 0, l: 'A la hora' },
  { v: 10, l: '10 min antes' },
  { v: 30, l: '30 min antes' },
  { v: 60, l: '1 h antes' },
  { v: 1440, l: '1 día antes' },
];
type Freq = 'none' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export function EventEditor({ event, presetDay }: { event?: EventRecord; presetDay?: DayKey }) {
  const editing = !!event;
  const readOnly = event?.source && event.source !== 'manual';
  const tz = useTimeZone();
  const today = useToday();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tasks = useTasks();
  const availability = useAvailability();
  const rec = event?.recurrence ? parseRecurrence(event.recurrence) : null;

  const [title, setTitle] = useState(event?.title ?? '');
  const [day, setDay] = useState<DayKey | null>(event ? dayKeyOf(new Date(event.startsAt), event.tz) : (presetDay ?? today));
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [start, setStart] = useState(event ? hhmm(localMinutes(new Date(event.startsAt), event.tz)) : '09:00');
  const [end, setEnd] = useState(event ? hhmm(localMinutes(new Date(event.endsAt), event.tz)) : '10:00');
  const [category, setCategory] = useState(event?.category ?? 'personal');
  const [freq, setFreq] = useState<Freq>(rec?.freq ?? 'none');
  const [byDay, setByDay] = useState<number[]>(rec?.byDay ?? []);
  const [until, setUntil] = useState<DayKey | null>(event?.recurrenceUntil ?? null);
  const [reminder, setReminder] = useState<number | null>(event?.reminderMinutes ?? null);
  const [location, setLocation] = useState(event?.location ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [negotiation, setNegotiation] = useState<{ blockId: string; title: string; options: NegotiationOption[] }[] | null>(null);
  const save = useAgendaMutation(async (input: Parameters<typeof createEvent>[0]) => (editing ? (await updateEvent(event!.id, input), event!.id) : createEvent(input)));
  const remove = useAgendaMutation(() => deleteEvent(event!.id));
  const applyTask = useAgendaMutation(async (v: { id: string; option: NegotiationOption }) => {
    const o = v.option;
    if (o.kind === 'mover') {
      await updateTask(v.id, { scheduledStart: atLocal(day!, o.to.start, tz).toISOString(), scheduledEnd: atLocal(day!, o.to.end, tz).toISOString() });
    } else if (o.kind === 'dividir') {
      // La tarea conserva la primera parte; la segunda pasa a una tarea de continuación que depende de ella.
      const original = tasks.data?.find((t) => t.id === v.id);
      if (!original) return;
      const [a, b] = o.parts as [{ start: number; end: number }, { start: number; end: number }];
      await updateTask(v.id, { scheduledStart: atLocal(day!, a.start, tz).toISOString(), scheduledEnd: atLocal(day!, a.end, tz).toISOString(), estimateMinutes: a.end - a.start });
      await createTask({
        title: `${original.title} (continuación)`.slice(0, 200),
        priority: original.priority,
        dueDate: original.dueDate,
        goalId: original.goalId,
        estimateMinutes: b.end - b.start,
        scheduledStart: atLocal(day!, b.start, tz).toISOString(),
        scheduledEnd: atLocal(day!, b.end, tz).toISOString(),
        dependsOn: [original.id],
      });
    }
  });
  // Mover el inicio arrastra el final y conserva la duración, como en un calendario.
  const moveStart = (next: string) => {
    const s0 = normalizeTime(start); const e0 = normalizeTime(end);
    const span = s0 && e0 && minutesOf(e0) > minutesOf(s0) ? minutesOf(e0) - minutesOf(s0) : 60;
    setStart(next);
    setEnd(hhmm(Math.min(minutesOf(next) + span, DAY_MINUTES - 1)));
  };
  const endHint = (() => {
    const s0 = normalizeTime(start); const e0 = normalizeTime(end);
    return s0 && e0 && minutesOf(e0) > minutesOf(s0) ? `Dura ${formatDuration(minutesOf(e0) - minutesOf(s0))}` : undefined;
  })();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/agenda'));

  const submit = () => {
    setFailure(null);
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Ponle un título.';
    if (!day) e.day = 'Elige el día.';
    const s = normalizeTime(start);
    let en = normalizeTime(end);
    if (!allDay) {
      if (!s) e.start = 'Hora no válida (HH:MM).';
      if (!en) e.end = 'Hora no válida (HH:MM).';
      if (s && en && minutesOf(en) <= minutesOf(s)) e.end = 'Debe terminar después de empezar.';
    }
    if (Object.keys(e).length) return setErrors(e);
    setErrors({});
    const startsAt = allDay ? startOfDayInstant(day!, tz) : atLocal(day!, minutesOf(s!), tz);
    const endsAt = allDay ? new Date(startOfDayInstant(day!, tz).getTime() + 86_400_000) : atLocal(day!, minutesOf((en ??= s!)), tz);
    // Semanal sin días elegidos = el mismo día de la semana del evento.
    const weekDays = byDay.length ? byDay : [new Date(`${day}T12:00:00Z`).getUTCDay()];
    const recurrence = freq === 'none' ? null : formatRecurrence({ freq, interval: 1, byDay: freq === 'WEEKLY' ? weekDays : [] });
    save.mutate(
      { title: title.trim(), notes, location, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), allDay, tz, category, recurrence, recurrenceUntil: recurrence ? until : null, reminderMinutes: reminder },
      {
        onSuccess: () => {
          // ¿Choca con bloques de tareas planificados ese día? Se negocia, nunca se mueve solo.
          if (allDay) return close();
          const flexible = (tasks.data ?? [])
            .filter((t) => t.scheduledStart && t.scheduledEnd && t.status !== 'done' && dayKeyOf(new Date(t.scheduledStart), tz) === day)
            .map((t) => ({ id: t.id, title: t.title, start: localMinutes(new Date(t.scheduledStart!), tz), end: localMinutes(new Date(t.scheduledEnd!), tz) }));
          const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
          const windows = (availability.data ?? []).filter((w) => w.weekday === weekday);
          const avail = windows.length ? windows.map((w) => ({ start: minutesOf(w.start), end: minutesOf(w.end) })) : [{ start: 8 * 60, end: 22 * 60 }];
          const res = negotiate({ start: minutesOf(s!), end: minutesOf(en!) }, flexible, [], avail);
          if (res.length) setNegotiation(res.map((r) => ({ ...r, title: flexible.find((f) => f.id === r.blockId)!.title })));
          else close();
        },
        onError: () => setFailure('No se pudo guardar el evento. Comprueba la conexión.'),
      },
    );
  };

  const describe = (o: NegotiationOption) =>
    o.kind === 'mover' ? `Mover a ${hhmm(o.to.start)}–${hhmm(o.to.end)}` : o.kind === 'dividir' ? `Dividir: ${o.parts.map((p) => `${hhmm(p.start)}–${hhmm(p.end)}`).join(' y ')}` : 'Mantener ambos (se solaparán)';

  return (
    <KeyboardScroll contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[4], paddingBottom: insets.bottom + spacing[10] }, width >= 900 && styles.wide]} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text variant="title1" accessibilityRole="header">{readOnly ? 'Evento importado' : editing ? 'Editar evento' : 'Nuevo evento'}</Text>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Cerrar" hitSlop={10}>
          <X size={22} color={colors.textSecondary} />
        </Pressable>
      </View>
      {readOnly ? <FormMessage tone="info">Este evento viene de tu calendario externo. Edítalo allí; Nebula solo lo usa para planificar.</FormMessage> : null}

      <TextField label="Título" value={title} onChangeText={setTitle} error={errors.title} editable={!readOnly} placeholder="Clase de cálculo" maxLength={160} />
      <DateField label="Día" value={day} onChange={setDay} today={today} allowEmpty={false} />
      <View style={styles.wrap}>
        <Chip role="radio" label="Con hora" selected={!allDay} onToggle={() => setAllDay(false)} />
        <Chip role="radio" label="Todo el día" selected={allDay} onToggle={() => setAllDay(true)} />
      </View>
      {!allDay ? (
        <>
          <TimePicker label="Empieza" value={start} step={5} disabled={readOnly} error={errors.start} onChange={moveStart} />
          <TimePicker label="Termina" value={end} step={5} min={5} max={DAY_MINUTES - 1} disabled={readOnly} error={errors.end} hint={endHint} onChange={setEnd} />
        </>
      ) : null}

      <Section title="Categoría">
        <View style={styles.wrap}>
          {CATEGORIES.map((c) => <Chip key={c.v} role="radio" label={c.l} selected={category === c.v} onToggle={() => setCategory(c.v)} />)}
        </View>
      </Section>

      {!readOnly ? (
        <Section title="Repetir">
          <View style={styles.wrap}>
            {(['none', 'DAILY', 'WEEKLY', 'MONTHLY'] as Freq[]).map((f) => (
              <Chip key={f} role="radio" label={{ none: 'No', DAILY: 'Cada día', WEEKLY: 'Cada semana', MONTHLY: 'Cada mes' }[f]} selected={freq === f} onToggle={() => setFreq(f)} />
            ))}
          </View>
          {freq === 'WEEKLY' ? (
            <View style={styles.wrap}>
              {WEEKDAYS.map((d) => <Chip key={d.value} label={d.label} selected={byDay.includes(d.value)} onToggle={() => setByDay((x) => (x.includes(d.value) ? x.filter((y) => y !== d.value) : [...x, d.value]))} />)}
            </View>
          ) : null}
          {freq !== 'none' ? <DateField label="Hasta (opcional)" value={until} onChange={setUntil} today={today} /> : null}
        </Section>
      ) : null}

      <Section title="Aviso">
        <View style={styles.wrap}>
          {REMINDERS.map((r) => <Chip key={String(r.v)} role="radio" label={r.l} selected={reminder === r.v} onToggle={() => setReminder(r.v)} />)}
        </View>
      </Section>

      <TextField label="Lugar (opcional)" value={location} onChangeText={setLocation} maxLength={200} editable={!readOnly} />
      <TextField label="Notas (opcional)" value={notes} onChangeText={setNotes} multiline maxLength={2000} editable={!readOnly} />

      {failure ? <FormMessage tone="danger">{failure}</FormMessage> : null}
      {!readOnly ? <Button label={editing ? 'Guardar cambios' : 'Crear evento'} onPress={submit} loading={save.isPending} fullWidth /> : null}
      {editing && !readOnly ? (
        <Button
          label="Eliminar evento"
          variant="danger"
          icon={<Trash2 size={18} color={colors.danger} />}
          onPress={() => confirmAction('Eliminar evento', event!.recurrence ? 'Se eliminarán todas las repeticiones.' : `Se eliminará «${event!.title}».`, 'Eliminar', () => remove.mutate(undefined, { onSuccess: close }))}
        />
      ) : null}

      <Sheet visible={!!negotiation} onClose={close} title="Este evento choca con tu plan">
        {negotiation?.map((n) => (
          <View key={n.blockId} style={styles.col}>
            <Text variant="bodyStrong">«{n.title}» estaba planificada a esa hora.</Text>
            {n.options.map((o, i) => (
              <Button
                key={i}
                label={describe(o)}
                variant={o.kind === 'mantener' ? 'ghost' : 'secondary'}
                onPress={() => {
                  if (o.kind === 'mantener') return setNegotiation((x) => (x && x.length > 1 ? x.filter((y) => y.blockId !== n.blockId) : (close(), null)));
                  applyTask.mutate(
                    { id: n.blockId, option: o },
                    { onSuccess: () => setNegotiation((x) => (x && x.length > 1 ? x.filter((y) => y.blockId !== n.blockId) : (close(), null))) },
                  );
                }}
              />
            ))}
          </View>
        ))}
        <Text variant="caption" tone="tertiary">Nebula nunca reprograma sin tu autorización.</Text>
      </Sheet>
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
  flex: { flex: 1 },
});
