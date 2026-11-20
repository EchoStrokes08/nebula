import { router, useLocalSearchParams } from 'expo-router';
import { Check, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Chip } from '@/components/forms/Chip';
import { DateField } from '@/components/forms/DateField';
import { Switch } from '@/components/forms/Switch';
import { TimePicker } from '@/components/forms/TimePicker';
import { Screen } from '@/components/layout/Screen';
import { useToast } from '@/components/overlays/UndoToast';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, fontFamily, radius, spacing } from '@/design/tokens';
import { parseCapture } from '@/domain/capture/parser';
import { NOTE_COLORS, type Note, type NoteColor } from '@/domain/notes/board';
import { useTimeZone, useToday } from '@/features/habits/useToday';
import { applyAction, describeAction } from '@/features/intelligence/apply';
import { useDeleteNote, useNotes, useSaveNote } from '@/features/notes/api';
import { INK, PAPER } from '@/features/notes/PostIt';
import { ensureNotificationPermission } from '@/features/notifications/NotificationPrompt';
import { confirmAction } from '@/lib/confirm';
import type { DayKey } from '@/lib/dates';
import { VoiceCapture } from '@/platform/VoiceCapture';

const COLOR_LABEL: Record<NoteColor, string> = { amarillo: 'Amarillo', rosa: 'Rosa', verde: 'Verde', azul: 'Azul', violeta: 'Violeta', naranja: 'Naranja' };

/** Nota rápida: un pósit con color, día, hora y recordatorio opcionales. */
export default function Captura() {
  const { nota, texto } = useLocalSearchParams<{ nota?: string; texto?: string }>();
  const notes = useNotes();
  const existing = nota ? notes.data?.find((n) => n.id === nota) : undefined;
  // Al editar, el formulario se monta cuando la nota está cargada para partir de sus valores.
  if (nota && !existing) {
    return (
      <Screen title="Editar nota" back={{ fallback: '/hoy' }}>
        <Text tone="secondary">{notes.isLoading ? 'Cargando la nota…' : 'Esta nota ya no existe.'}</Text>
      </Screen>
    );
  }
  // `texto`: lo que se compartió desde otra app (menú Compartir de Android).
  return <NoteForm key={existing?.id ?? `nueva-${texto ?? ''}`} note={existing} initialText={texto?.slice(0, 1000)} />;
}

function NoteForm({ note, initialText }: { note?: Note; initialText?: string }) {
  const today = useToday();
  const tz = useTimeZone();
  const toast = useToast((t) => t.show);
  const save = useSaveNote();
  const remove = useDeleteNote();
  const [text, setText] = useState(note?.text ?? initialText ?? '');
  const [color, setColor] = useState<NoteColor>(note?.color ?? 'amarillo');
  const [day, setDay] = useState<DayKey | null>(note?.day ?? null);
  const [time, setTime] = useState(note?.atTime ?? '');
  const [remind, setRemind] = useState(note?.remind ?? false);
  const [busy, setBusy] = useState(false);
  const preview = useMemo(() => parseCapture(text, new Date(), tz), [text, tz]);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/hoy'));

  const pickDay = (d: DayKey | null) => {
    setDay(d);
    if (!d) { setTime(''); setRemind(false); }
  };
  const pickTime = (on: boolean) => {
    setTime(on ? (time || '09:00') : '');
    if (!on) setRemind(false);
  };
  const toggleRemind = async (on: boolean) => {
    setRemind(on);
    if (on && (await ensureNotificationPermission()) !== 'granted') toast('Activa las notificaciones para recibir el aviso.');
  };

  const submit = () => {
    if (!text.trim()) return toast('Escribe algo en la nota.');
    const input = { text, color, day, atTime: day && time ? time : null, remind: !!(day && time && remind) };
    save.mutate(note ? { id: note.id, ...input } : input, {
      onSuccess: () => { toast(note ? 'Nota guardada.' : 'Nota pegada en Hoy.'); close(); },
      onError: () => toast('No se pudo guardar la nota. Comprueba la conexión.'),
    });
  };

  return (
    <Screen title={note ? 'Editar nota' : 'Nota rápida'} back={{ fallback: '/hoy' }}>
      <View style={[styles.paper, { backgroundColor: PAPER[color] }]}>
        <View style={styles.tape} />
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          autoFocus={!note}
          placeholder="¿Qué no quieres olvidar?"
          placeholderTextColor="rgba(42, 33, 64, 0.45)"
          accessibilityLabel="Texto de la nota"
          style={styles.input}
          textAlignVertical="top"
        />
      </View>
      <VoiceCapture onText={(v) => setText((t) => (t ? `${t} ${v}` : v))} />

      <View style={styles.swatches} accessibilityRole="radiogroup" accessibilityLabel="Color del pósit">
        {NOTE_COLORS.map((c) => (
          <Pressable key={c} onPress={() => setColor(c)} accessibilityRole="radio" accessibilityLabel={COLOR_LABEL[c]} accessibilityState={{ checked: color === c }} style={[styles.swatch, { backgroundColor: PAPER[c] }, color === c && styles.swatchOn]}>
            {color === c ? <Check size={16} color={INK} strokeWidth={3} /> : null}
          </Pressable>
        ))}
      </View>

      <DateField label="Día (opcional)" value={day} onChange={pickDay} today={today} />
      {day ? (
        <>
          <View style={styles.wrap}>
            <Chip role="radio" label="Sin hora" selected={!time} onToggle={() => pickTime(false)} />
            <Chip role="radio" label="A una hora" selected={!!time} onToggle={() => pickTime(true)} />
          </View>
          {time ? <TimePicker label="Hora" value={time} onChange={setTime} step={5} /> : null}
          {time ? <Switch label="Recordarme a esa hora" description="Te llega un aviso en este dispositivo." value={remind} onChange={(v) => void toggleRemind(v)} /> : null}
        </>
      ) : <Text variant="caption" tone="tertiary">Sin día, la nota se queda pegada en Hoy hasta que la marques como hecha.</Text>}

      <Button label={note ? 'Guardar nota' : 'Pegar nota'} onPress={submit} loading={save.isPending} disabled={!text.trim()} />
      {note ? (
        <View style={styles.wrap}>
          <Button label="Marcar como hecha" variant="secondary" onPress={() => save.mutate({ id: note.id, done: true }, { onSuccess: () => { toast('Nota hecha.'); close(); } })} />
          <Button label="Borrar" variant="danger" onPress={() => confirmAction('Borrar nota', 'La nota desaparecerá de Hoy.', 'Borrar', () => remove.mutate(note.id, { onSuccess: close }))} />
        </View>
      ) : null}

      {!note && preview.action ? (
        <View style={styles.suggest}>
          <View style={styles.suggestHead}>
            <Sparkles size={16} color={colors.accentSoft} />
            <Text variant="overline" tone="accent">¿ES OTRA COSA?</Text>
          </View>
          <Text>Nebula lo entiende como: {describeAction(preview.action)}</Text>
          {preview.warnings.map((w) => <Text key={w} variant="caption" tone="warning">{w}</Text>)}
          <Button label="Crear eso en lugar de una nota" variant="secondary" loading={busy} onPress={async () => {
            if (!preview.action) return;
            setBusy(true);
            try { await applyAction(preview.action, tz); toast('Guardado.'); close(); }
            catch (e) { toast(e instanceof Error ? e.message : 'No se pudo guardar. Reintenta.'); }
            finally { setBusy(false); }
          }} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  paper: { minHeight: 200, padding: spacing[5], paddingTop: spacing[6], borderRadius: 6, borderBottomRightRadius: 28, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8, transform: [{ rotate: '-0.8deg' }] },
  tape: { position: 'absolute', top: -10, alignSelf: 'center', width: 80, height: 22, borderRadius: 3, backgroundColor: 'rgba(255, 255, 255, 0.45)' },
  input: { flex: 1, minHeight: 150, color: INK, fontFamily: fontFamily.medium, fontSize: 18, lineHeight: 26, outlineStyle: 'none' } as object,
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  suggest: { gap: spacing[2], padding: spacing[4], borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  suggestHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
});
