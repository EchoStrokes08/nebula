import { router } from 'expo-router';
import { CalendarPlus, ChevronLeft, ChevronRight, Sparkles, Timer } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Chip } from '@/components/forms/Chip';
import { formatDay } from '@/components/forms/DateField';
import { MonthCalendar } from '@/components/forms/MonthCalendar';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { DayTimeline, openItem } from '@/features/agenda/DayTimeline';
import { useAgendaItems } from '@/features/agenda/useAgendaItems';
import { GoalsShortcut } from '@/features/goals/GoalsShortcut';
import { useTimeZone, useToday } from '@/features/habits/useToday';
import { useMyProfile } from '@/features/profile/useMyProfile';
import { useTasks } from '@/features/tasks/hooks';
import { TaskListView } from '@/features/tasks/TaskListView';
import { TaskDetail } from '@/features/tasks/TaskDetail';
import { setSplitActive, SPLIT_MIN_WIDTH, useSplit } from '@/features/system/split';
import { EmptyState } from '@/components/feedback/EmptyState';
import { localMinutes } from '@/domain/calendar/expand';
import { addDays, dayRange, startOfMonth, startOfWeek, type DayKey } from '@/lib/dates';
import { hhmm } from '@/lib/time';
import { SkeletonList } from '@/components/feedback/Skeleton';

type View_ = 'dia' | 'semana' | 'mes' | 'tareas';
const VIEWS: { v: View_; l: string }[] = [
  { v: 'dia', l: 'Día' },
  { v: 'semana', l: 'Semana' },
  { v: 'mes', l: 'Mes' },
  { v: 'tareas', l: 'Tareas' },
];
const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const FILTER_LABEL: Record<string, string> = { trabajo: 'Trabajo', estudio: 'Estudio', personal: 'Personal', salud: 'Salud', social: 'Social', otro: 'Otros', task: 'Tareas planificadas', focus: 'Enfoque' };

export default function AgendaScreen() {
  const today = useToday();
  const tz = useTimeZone();
  const { width } = useWindowDimensions();
  const weekStartsOn = useMyProfile().data?.week_starts_on ?? 1;
  const [view, setView] = useState<View_>('dia');
  const wideScreen = useWindowDimensions().width >= SPLIT_MIN_WIDTH;
  const split = wideScreen && view === 'tareas';
  const selectedTask = useSplit((st) => st.selected.task);
  useEffect(() => { setSplitActive('task', split); return () => setSplitActive('task', false); }, [split]);
  const [day, setDay] = useState<DayKey>(today);
  const [hidden, setHidden] = useState<string[]>([]);

  const weekStart = startOfWeek(day, weekStartsOn);
  const monthStart = startOfMonth(day);
  const from = view === 'semana' ? weekStart : view === 'mes' ? addDays(startOfWeek(monthStart, weekStartsOn), 0) : day;
  const to = view === 'semana' ? addDays(weekStart, 6) : view === 'mes' ? addDays(startOfWeek(monthStart, weekStartsOn), 41) : day;
  const { items: allItems, isLoading } = useAgendaItems(from, to);
  // Filtro por categoría (eventos) y por tipo (tareas planificadas, sesiones de enfoque).
  const filterKey = (i: { kind: string; category?: string }) => (i.kind === 'event' ? (i.category ?? 'otro') : i.kind);
  const items = allItems.filter((i) => !hidden.includes(filterKey(i)));
  const present = [...new Set(allItems.map(filterKey))];
  const tasks = useTasks();
  const nowMinutes = localMinutes(new Date(), tz);

  const shift = (n: number) => setDay(view === 'semana' ? addDays(day, 7 * n) : view === 'mes' ? addDays(startOfMonth(addDays(monthStart, n > 0 ? 32 : -1)), 0) : addDays(day, n));
  const title =
    view === 'semana'
      ? `${formatDay(weekStart, today)} – ${formatDay(addDays(weekStart, 6), today)}`
      : view === 'mes'
        ? new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(new Date(`${monthStart}T12:00:00Z`))
        : formatDay(day, today);

  // Marcadores del mes: eventos + tareas con fecha.
  const markers: Record<string, number> = {};
  for (const i of items) markers[i.day] = (markers[i.day] ?? 0) + 1;
  for (const t of tasks.data ?? []) if (t.dueDate && t.status !== 'done' && t.status !== 'cancelled') markers[t.dueDate] = (markers[t.dueDate] ?? 0) + 1;

  const screen = (
    <Screen
      wide={split}
      title="Agenda"
      trailing={
        <View style={styles.headActions}>
          <Button label="Enfoque" variant="secondary" icon={<Timer size={18} color={colors.text} />} onPress={() => router.push('/enfoque')} />
          <Button label="Evento" icon={<CalendarPlus size={18} color={colors.textOnAccent} />} onPress={() => router.push({ pathname: '/evento/nuevo', params: { dia: day } })} />
        </View>
      }
    >
      <View style={styles.wrap} accessibilityRole="radiogroup">
        {VIEWS.map((v) => (
          <Chip key={v.v} role="radio" label={v.l} selected={view === v.v} onToggle={() => setView(v.v)} />
        ))}
      </View>

      {view === 'tareas' ? (
        <>
          <GoalsShortcut />
          <TaskListView />
        </>
      ) : (
        <>
          <View style={styles.nav}>
            <Pressable onPress={() => shift(-1)} accessibilityRole="button" accessibilityLabel="Anterior" hitSlop={8} style={styles.navBtn}>
              <ChevronLeft size={20} color={colors.textSecondary} />
            </Pressable>
            <Text variant="title3" style={styles.navTitle}>{title}</Text>
            <Pressable onPress={() => shift(1)} accessibilityRole="button" accessibilityLabel="Siguiente" hitSlop={8} style={styles.navBtn}>
              <ChevronRight size={20} color={colors.textSecondary} />
            </Pressable>
            {day !== today ? <Button label="Hoy" variant="ghost" onPress={() => setDay(today)} /> : null}
          </View>

          {present.length > 1 ? (
            <View style={styles.wrap} accessibilityLabel="Filtrar por categoría">
              {present.map((k) => (
                <Chip
                  key={k}
                  label={FILTER_LABEL[k] ?? k}
                  selected={!hidden.includes(k)}
                  onToggle={() => setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]))}
                />
              ))}
            </View>
          ) : null}

          {view === 'dia' ? (
            <>
              <Button label="Planificar este día" variant="secondary" icon={<Sparkles size={18} color={colors.accentSoft} />} onPress={() => router.push({ pathname: '/planificar', params: { dia: day } })} />
              {isLoading ? <SkeletonList rows={3} /> : null}
              {!isLoading && items.length === 0 ? <Text tone="secondary">Nada programado. Añade un evento o planifica tus tareas en los huecos libres.</Text> : null}
              <DayTimeline
                items={items.filter((i) => i.day === day)}
                nowMinutes={day === today ? nowMinutes : null}
                startHour={day === today ? Math.max(6, Math.floor(nowMinutes / 60) - 1) : 6}
              />
            </>
          ) : null}

          {view === 'semana' ? (
            <ScrollView horizontal={width < 900} contentContainerStyle={width < 900 ? styles.weekScroll : undefined}>
              <View style={[styles.week, { width: width < 900 ? 7 * 132 : '100%' }]}>
                {dayRange(weekStart, addDays(weekStart, 6)).map((d) => (
                  <Pressable key={d} style={styles.weekCol} onPress={() => { setDay(d); setView('dia'); }} accessibilityRole="button" accessibilityLabel={`Ver ${formatDay(d, today)}`}>
                    <View style={[styles.weekHead, d === today && styles.weekHeadToday]}>
                      <Text variant="caption" tone={d === today ? 'accent' : 'secondary'}>{DOW[new Date(`${d}T12:00:00Z`).getUTCDay()]}</Text>
                      <Text variant="title3" tabular>{Number(d.slice(8))}</Text>
                    </View>
                    <DayTimeline items={items.filter((i) => i.day === d)} hourHeight={28} compact nowMinutes={d === today ? nowMinutes : null} />
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          ) : null}

          {view === 'mes' ? (
            <View style={styles.month}>
              <View style={styles.monthCal}>
                <MonthCalendar key={monthStart} value={day} today={today} weekStartsOn={weekStartsOn} onChange={setDay} markers={markers} />
              </View>
              <View style={styles.monthList}>
                <Text variant="title3">{formatDay(day, today)}</Text>
                {items.filter((i) => i.day === day).length === 0 && !(tasks.data ?? []).some((t) => t.dueDate === day && t.status !== 'done') ? <Text tone="secondary">Sin nada ese día.</Text> : null}
                {items.filter((i) => i.day === day).map((i) => (
                  <Pressable key={i.key} onPress={() => openItem(i)} style={styles.monthItem} accessibilityRole="button">
                    <Text variant="caption" tone="tertiary" tabular>{i.allDay ? 'Todo el día' : `${hhmm(i.start)}–${hhmm(i.end % 1440)}`}</Text>
                    <Text variant="bodyStrong" numberOfLines={1}>{i.title}</Text>
                  </Pressable>
                ))}
                {(tasks.data ?? []).filter((t) => t.dueDate === day && t.status !== 'done' && t.status !== 'cancelled').map((t) => (
                  <Pressable key={t.id} onPress={() => router.push({ pathname: '/tarea/[id]', params: { id: t.id } })} style={styles.monthItem} accessibilityRole="button">
                    <Text variant="caption" tone="warning">Vence</Text>
                    <Text variant="bodyStrong" numberOfLines={1}>{t.title}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
  if (!split) return screen;
  return (
    <View style={styles.columns}>
      <View style={styles.listCol}>{screen}</View>
      <View style={styles.detailCol}>
        {selectedTask ? <TaskDetail key={selectedTask} id={selectedTask} embedded /> : (
          <View style={styles.placeholder}><EmptyState title="Elige una tarea" description="Sus subtareas, dependencias y notas aparecerán aquí." /></View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  columns: { flex: 1, flexDirection: 'row' },
  listCol: { flex: 5, minWidth: 420 },
  detailCol: { flex: 6, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border },
  placeholder: { flex: 1, justifyContent: 'center' },
  headActions: { flexDirection: 'row', gap: spacing[2] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  nav: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  navBtn: { padding: spacing[2] },
  navTitle: { flex: 1, textAlign: 'center' },
  weekScroll: { paddingBottom: spacing[2] },
  week: { flexDirection: 'row', gap: spacing[1] },
  weekCol: { flex: 1, gap: spacing[2] },
  weekHead: { alignItems: 'center', paddingVertical: spacing[1], borderRadius: radius.md },
  weekHeadToday: { backgroundColor: colors.accentMuted },
  month: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[6] },
  monthCal: { flexGrow: 1, flexBasis: 320, maxWidth: 520 },
  monthList: { flexGrow: 1, flexBasis: 260, gap: spacing[2] },
  monthItem: { gap: 2, padding: spacing[3], borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
