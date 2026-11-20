import { router } from 'expo-router';
import { Bell, Check, Plus, StickyNote } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { formatDay } from '@/components/forms/DateField';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { useToast } from '@/components/overlays/UndoToast';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { boardNotes, whenLabel, type Note, type NoteColor } from '@/domain/notes/board';
import type { DayKey } from '@/lib/dates';
import { platformHaptics } from '@/platform/haptics';

import { useNotes, useSaveNote } from './api';

/** Colores de papel de los pósits (texto oscuro encima, contraste AA). */
export const PAPER: Record<NoteColor, string> = {
  amarillo: '#FFE58A',
  rosa: '#FFB8CB',
  verde: '#B9F0CB',
  azul: '#B3DCFF',
  violeta: '#D7C6FF',
  naranja: '#FFCB91',
};
export const INK = '#2A2140';
const TILT = [-2, 1.5, -1, 2, -1.5, 1];

/** Un pósit. `onDone` muestra el botón de marcar como hecha. */
export function PostIt({ note, today, index = 0, onPress, onDone, width = 168 }: { note: Pick<Note, 'text' | 'color' | 'day' | 'atTime' | 'remind'>; today: DayKey; index?: number; onPress?: () => void; onDone?: () => void; width?: number | '100%' }) {
  const when = whenLabel(note, today, formatDay);
  const overdue = !!note.day && note.day < today;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`Nota: ${note.text}${when ? `. ${when}` : ''}`}
      accessibilityHint={onPress ? 'Editar la nota' : undefined}
      style={({ pressed }) => [styles.paper, { width, backgroundColor: PAPER[note.color], transform: [{ rotate: `${TILT[index % TILT.length]}deg` }, { scale: pressed ? 0.97 : 1 }] }]}
    >
      <View style={styles.tape} />
      <Text variant="body" numberOfLines={6} style={styles.ink}>{note.text || 'Escribe algo…'}</Text>
      <View style={styles.foot}>
        {when ? (
          <View style={styles.when}>
            {note.remind ? <Bell size={12} color={overdue ? '#B3261E' : INK} /> : null}
            <Text variant="caption" style={[styles.ink, overdue && styles.overdue]} numberOfLines={1}>{when}</Text>
          </View>
        ) : <View style={styles.flex} />}
        {onDone ? (
          <Pressable onPress={onDone} hitSlop={10} accessibilityRole="button" accessibilityLabel="Marcar como hecha" style={styles.done}>
            <Check size={16} color={INK} strokeWidth={2.6} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Hoy: tablero de pósits pendientes (sin fecha, de hoy, vencidos y próximos días). */
export function NotesBoard({ today }: { today: DayKey }) {
  const notes = useNotes();
  const save = useSaveNote();
  const toast = useToast((t) => t.show);
  const list = boardNotes(notes.data ?? [], today);
  if (!notes.data) return null;
  const done = (n: Note) => {
    platformHaptics.success();
    save.mutate({ id: n.id, done: true });
    toast('Nota hecha.', () => save.mutate({ id: n.id, done: false }));
  };
  return (
    <View style={styles.section}>
      <SectionHeader icon={StickyNote} title="Notas" meta={list.length ? `${list.length} pendiente${list.length === 1 ? '' : 's'}` : undefined} color={colors.success} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row}>
        {list.map((n, i) => (
          <Animated.View key={n.id} entering={FadeIn.duration(200)} layout={LinearTransition}>
            <PostIt note={n} today={today} index={i} onPress={() => router.push({ pathname: '/captura', params: { nota: n.id } })} onDone={() => done(n)} />
          </Animated.View>
        ))}
        <Pressable onPress={() => router.push('/captura')} accessibilityRole="button" accessibilityLabel="Nueva nota rápida" style={styles.add}>
          <Plus size={22} color={colors.textSecondary} />
          <Text variant="caption" tone="secondary">Nueva nota</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing[3] },
  scroll: { marginHorizontal: -spacing[5], flexGrow: 0 },
  row: { gap: spacing[4], paddingHorizontal: spacing[5], paddingVertical: spacing[3], alignItems: 'flex-start' },
  paper: { minHeight: 150, padding: spacing[4], paddingTop: spacing[5], gap: spacing[3], borderRadius: 4, borderBottomRightRadius: 18, justifyContent: 'space-between', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  tape: { position: 'absolute', top: -8, alignSelf: 'center', width: 56, height: 18, borderRadius: 3, backgroundColor: 'rgba(255, 255, 255, 0.45)' },
  ink: { color: INK },
  overdue: { color: '#B3261E', fontWeight: '600' },
  foot: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  when: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  flex: { flex: 1 },
  done: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(42, 33, 64, 0.12)' },
  add: { width: 120, minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: spacing[2], borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong },
});
