import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { ArrowLeft, Share2 } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { Chip } from '@/components/forms/Chip';
import { SkeletonList } from '@/components/feedback/Skeleton';
import { useToast } from '@/components/overlays/UndoToast';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, fontFamily, palette, spacing } from '@/design/tokens';
import { localMinutes } from '@/domain/calendar/expand';
import { wrapped, wrappedRange, type Wrapped } from '@/domain/stats/wrapped';
import { fetchFocusSessions } from '@/features/agenda/api';
import { useAuth } from '@/features/auth/session';
import { fetchLogsSince } from '@/features/habits/api';
import { useHabitsData } from '@/features/habits/hooks';
import { useTimeZone, useToday } from '@/features/habits/useToday';
import { useMyProfile } from '@/features/profile/useMyProfile';
import { useTasks } from '@/features/tasks/hooks';
import { dayKeyOf } from '@/lib/dates';
import { formatDuration } from '@/lib/time';

const WEEKDAYS = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
// Estrellas fijas (posiciones en %): la tarjeta debe verse igual en la imagen exportada.
const STARS = [[8, 6, 2], [22, 14, 1], [80, 9, 2], [91, 22, 1], [64, 4, 1], [12, 41, 1], [94, 47, 2], [6, 72, 2], [86, 76, 1], [48, 93, 2], [28, 88, 1], [72, 62, 1]] as const;

export default function Resumen() {
  const insets = useSafeAreaInsets();
  const today = useToday();
  const tz = useTimeZone();
  const uid = useAuth((s) => s.session?.user.id);
  const name = useMyProfile().data?.display_name?.split(' ')[0] ?? null;
  const weekStartsOn = useMyProfile().data?.week_starts_on ?? 1;
  const toast = useToast((t) => t.show);
  const [kind, setKind] = useState<'mes' | 'año'>('mes');
  const range = wrappedRange(kind, today);
  const { habits } = useHabitsData();
  const tasks = useTasks();
  const logs = useQuery({ queryKey: ['habit_logs_range', uid, range.from], queryFn: () => fetchLogsSince(range.from), enabled: !!uid });
  const focus = useQuery({ queryKey: ['focus_range', uid, range.from], queryFn: () => fetchFocusSessions(new Date(`${range.from}T00:00:00Z`).toISOString()), enabled: !!uid });
  const card = useRef<React.ComponentRef<typeof View>>(null);
  const [sharing, setSharing] = useState(false);

  const data = useMemo<Wrapped | null>(() => {
    if (!habits.data || !logs.data || !focus.data || !tasks.data) return null;
    return wrapped({
      habits: habits.data.map((h) => ({ ...h, logs: logs.data.filter((l) => l.habitId === h.id) })),
      focus: focus.data.filter((f) => f.endedAt).map((f) => ({ day: dayKeyOf(new Date(f.startedAt), tz), minutes: Math.round(f.focusedSeconds / 60), startHour: Math.floor(localMinutes(new Date(f.startedAt), tz) / 60), endedEarly: f.endedEarly })),
      tasksDone: tasks.data.filter((t) => t.completedAt).map((t) => ({ day: dayKeyOf(new Date(t.completedAt!), tz) })),
      from: range.from,
      to: range.to,
      today,
      weekStartsOn,
    });
  }, [habits.data, logs.data, focus.data, tasks.data, range.from, range.to, today, tz, weekStartsOn]);

  const share = async () => {
    if (!card.current) return;
    setSharing(true);
    try {
      if (Platform.OS === 'web') {
        // Escritorio: se descarga la imagen (el menú de compartir no existe allí).
        const uri = await captureRef(card.current as never, { format: 'png', quality: 1, result: 'data-uri' });
        const a = document.createElement('a');
        a.href = uri;
        a.download = `nebula-resumen-${range.label.replace(/\s+/g, '-')}.png`;
        a.click();
        toast('Imagen descargada.');
      } else {
        const uri = await captureRef(card.current as never, { format: 'png', quality: 1, result: 'tmpfile' });
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Compartir tu resumen' });
      }
    } catch {
      toast('No se pudo crear la imagen.');
    } finally {
      setSharing(false);
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/estadisticas'));
  return (
    <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[4], paddingBottom: insets.bottom + spacing[10] }]}>
      <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Volver" style={styles.back} hitSlop={8}>
        <ArrowLeft size={20} color={colors.textSecondary} />
        <Text variant="callout" tone="secondary">Volver</Text>
      </Pressable>
      <Text variant="title1" accessibilityRole="header">Tu resumen</Text>
      <View style={styles.row}>
        <Chip role="radio" label="Este mes" selected={kind === 'mes'} onToggle={() => setKind('mes')} />
        <Chip role="radio" label="Este año" selected={kind === 'año'} onToggle={() => setKind('año')} />
      </View>

      {!data ? (
        <SkeletonList rows={4} />
      ) : (
        <>
          <View ref={card} collapsable={false} style={styles.cardOuter}>
            <LinearGradient colors={['#2A1A55', '#14102A', palette.space950]} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={styles.card}>
              <LinearGradient colors={['rgba(229, 143, 208, 0.35)', 'rgba(229, 143, 208, 0)']} style={styles.glow} />
              {STARS.map(([x, y, s], i) => (
                <View key={i} style={[styles.star, { left: `${x}%`, top: `${y}%`, width: s * 2, height: s * 2, borderRadius: s }]} />
              ))}
              <Text style={styles.overline}>NEBULA · {range.label.toUpperCase()}</Text>
              <Text style={styles.headline}>
                {name ? `${name}, ` : ''}
                {data.activeDays === 0 ? 'este periodo aún está por escribir.' : (
                  <>
                    estuviste presente <Text style={styles.headlineAccent}>{data.activeDays} de {data.days}</Text> días.
                  </>
                )}
              </Text>
              <View style={styles.grid}>
                <Big value={data.completionRate === null ? '—' : `${Math.round(data.completionRate * 100)} %`} label="constancia" />
                <Big value={String(data.habitChecks)} label="hábitos marcados" />
                <Big value={String(data.tasksCompleted)} label="tareas terminadas" />
                <Big value={data.focusMinutes >= 60 ? `${Math.round(data.focusMinutes / 6) / 10} h` : `${data.focusMinutes} min`} label="de enfoque" />
              </View>
              <View style={styles.facts}>
                {data.star ? <Fact label="Tu estrella" value={`${data.star.name} · ${data.star.met} ${data.star.met === 1 ? 'vez' : 'veces'}`} /> : null}
                {data.bestStreak ? <Fact label="Racha más larga" value={`${data.bestStreak.days} días de ${data.bestStreak.name.toLowerCase()}`} /> : null}
                {data.perfectDays ? <Fact label="Días redondos" value={`${data.perfectDays} con todos tus hábitos`} /> : null}
                {data.bestWeekday !== null ? <Fact label="Tu mejor día" value={`los ${WEEKDAYS[data.bestWeekday]}`} /> : null}
                {data.focusWindow ? <Fact label="Tu franja" value={`de ${data.focusWindow.from}:00 a ${data.focusWindow.to}:00`} /> : null}
              </View>
              <Text style={styles.footer}>Tu día, claro. Tu progreso, real.</Text>
            </LinearGradient>
          </View>
          <Text variant="caption" tone="tertiary">Solo datos reales de tu {kind === 'mes' ? 'mes' : 'año'}. Lo que no tiene datos suficientes no aparece.</Text>
          <Button
            label={Platform.OS === 'web' ? 'Descargar imagen' : 'Compartir imagen'}
            icon={<Share2 size={18} color={colors.textOnAccent} />}
            loading={sharing}
            onPress={() => void share()}
            fullWidth
          />
          {focus.data && data.focusSessions ? <Text variant="caption" tone="tertiary">{data.focusSessions} sesiones de enfoque · {formatDuration(data.focusMinutes)} en total.</Text> : null}
        </>
      )}
    </ScrollView>
  );
}

function Big({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.big}>
      <Text style={styles.bigValue}>{value}</Text>
      <Text style={styles.bigLabel}>{label}</Text>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.factValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing[5], gap: spacing[4], maxWidth: 520, width: '100%', alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], alignSelf: 'flex-start' },
  row: { flexDirection: 'row', gap: spacing[2] },
  cardOuter: { borderRadius: 28, overflow: 'hidden', aspectRatio: 9 / 16, width: '100%' },
  card: { flex: 1, padding: 28, gap: 18, justifyContent: 'space-between' },
  glow: { position: 'absolute', right: -80, top: -60, width: 280, height: 280, borderRadius: 140 },
  star: { position: 'absolute', backgroundColor: palette.starlight, opacity: 0.85 },
  overline: { fontFamily: fontFamily.bold, fontSize: 11, letterSpacing: 2.2, color: palette.starlight },
  headline: { fontFamily: fontFamily.serif, fontSize: 34, lineHeight: 38, color: palette.white, letterSpacing: 0.2 },
  headlineAccent: { fontFamily: fontFamily.serifItalic, color: palette.lavender300 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  big: { width: '50%', gap: 2 },
  bigValue: { fontFamily: fontFamily.displayBold, fontSize: 30, color: palette.white, letterSpacing: -0.5 },
  bigLabel: { fontFamily: fontFamily.medium, fontSize: 12, color: palette.mist },
  facts: { gap: 10 },
  fact: { gap: 1 },
  factLabel: { fontFamily: fontFamily.bold, fontSize: 10, letterSpacing: 1.6, color: palette.dusk },
  factValue: { fontFamily: fontFamily.semibold, fontSize: 15, color: palette.white },
  footer: { fontFamily: fontFamily.serifItalic, fontSize: 16, color: palette.starlight, opacity: 0.9 },
});
