import { router } from 'expo-router';
import { AlertTriangle, Flame, Timer } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { layoutColumns } from '@/domain/calendar/layout';
import { hhmm } from '@/lib/time';

import type { AgendaItem } from './useAgendaItems';

export const CATEGORY_COLOR: Record<string, string> = {
  trabajo: colors.info,
  estudio: colors.accentBright,
  personal: colors.accentSoft,
  salud: colors.success,
  social: '#E58FD0',
  otro: colors.textSecondary,
};

const KIND_LABEL = { event: 'Evento', task: 'Tarea', focus: 'Enfoque', habit: 'Hábito' } as const;
const HABIT_COLOR = colors.warning;

export function openItem(i: AgendaItem) {
  if (i.kind === 'event') router.push({ pathname: '/evento/[id]', params: { id: i.refId } });
  else if (i.kind === 'task') router.push({ pathname: '/tarea/[id]', params: { id: i.refId } });
  else if (i.kind === 'habit') router.push({ pathname: '/habito/[id]', params: { id: i.refId } });
}

/**
 * Línea temporal de un día. `hourHeight` ajusta la densidad (vista semanal usa menos).
 * Si `nowMinutes` está definido, dibuja la línea de «ahora».
 */
export function DayTimeline({
  items,
  hourHeight = 56,
  startHour = 6,
  endHour = 24,
  nowMinutes,
  compact = false,
  bands = [],
}: {
  items: AgendaItem[];
  /** Franjas de disponibilidad: se pintan de fondo. */
  bands?: { start: number; end: number }[];
  hourHeight?: number;
  startHour?: number;
  endHour?: number;
  nowMinutes?: number | null;
  compact?: boolean;
}) {
  const timed = items.filter((i) => !i.allDay);
  const allDay = items.filter((i) => i.allDay);
  const first = Math.min(startHour * 60, ...timed.map((i) => Math.floor(i.start / 60) * 60));
  const last = Math.max(endHour * 60, ...timed.map((i) => Math.ceil(i.end / 60) * 60));
  const hours = Array.from({ length: (last - first) / 60 }, (_, i) => first / 60 + i);
  const px = (m: number) => ((m - first) / 60) * hourHeight;
  const laid = layoutColumns(timed.map((i) => ({ ...i, id: i.key })));
  const gutter = compact ? 0 : 48;

  return (
    <View style={styles.root}>
      {allDay.map((i) => (
        <Pressable key={i.key} onPress={() => openItem(i)} style={[styles.allDay, { borderLeftColor: i.overdue ? colors.danger : i.kind === 'habit' ? HABIT_COLOR : i.kind === 'task' ? colors.warning : CATEGORY_COLOR[i.category ?? 'otro'] }]} accessibilityRole="button" accessibilityLabel={i.overdue ? `Tarea vencida: ${i.title}` : i.due ? `Tarea: ${i.title}, vence este día` : `${i.title}, todo el día`}>
          <Text variant="caption" numberOfLines={1}>{i.overdue ? `Vencida · ${i.title}` : i.due ? `Vence · ${i.title}` : i.kind === 'habit' ? `Hábito · ${i.title}` : i.title}</Text>
        </Pressable>
      ))}
      <View style={{ height: hours.length * hourHeight }}>
        {hours.map((h) => (
          <View key={h} style={[styles.hourRow, { top: (h * 60 - first) / 60 * hourHeight, height: hourHeight }]}>
            {!compact ? <Text variant="caption" tone="tertiary" style={[styles.hourLabel, { width: gutter }]} tabular>{`${String(h % 24).padStart(2, '0')}:00`}</Text> : null}
            <View style={styles.hourLine} />
          </View>
        ))}
        <View style={[StyleSheet.absoluteFill, { left: gutter }]}>
          {bands.map((b) => (
            <View key={`b-${b.start}`} pointerEvents="none" style={[styles.band, { top: px(Math.max(b.start, first)), height: Math.max(0, px(Math.min(b.end, last)) - px(Math.max(b.start, first))) }]} accessibilityLabel={`Disponible de ${hhmm(b.start)} a ${hhmm(b.end % 1440)}`}>
              {!compact ? <Text variant="caption" style={styles.bandLabel}>Disponible</Text> : null}
            </View>
          ))}
          {laid.map((i) => {
            const color = i.kind === 'habit' ? HABIT_COLOR : i.due ? colors.warning : i.kind === 'task' ? colors.accent : i.kind === 'focus' ? colors.success : (CATEGORY_COLOR[i.category ?? 'otro'] ?? colors.info);
            const top = px(i.start);
            const height = Math.max(compact ? 16 : 24, px(i.end) - top - 2);
            const label = i.due ? `Tarea: ${i.title}, vence a las ${hhmm(i.start)}` : `${KIND_LABEL[i.kind]}: ${i.title}, de ${hhmm(i.start)} a ${hhmm(i.end % 1440)}${i.conflict ? '. Se solapa con otro elemento' : ''}${i.imported ? '. Importado' : ''}`;
            return (
              <Pressable
                key={i.key}
                onPress={() => openItem(i)}
                disabled={i.kind === 'focus'}
                accessibilityRole="button"
                accessibilityLabel={label}
                style={[
                  styles.block,
                  {
                    top,
                    height,
                    left: `${(i.column / i.columns) * 100}%`,
                    width: `${(1 / i.columns) * 100}%`,
                    borderLeftColor: color,
                    backgroundColor: i.kind === 'task' ? colors.accentMuted : i.kind === 'habit' ? 'rgba(242, 184, 102, 0.14)' : colors.surfaceRaised,
                  },
                  i.conflict && styles.conflict,
                ]}
              >
                <View style={styles.blockHead}>
                  {i.conflict ? <AlertTriangle size={12} color={colors.warning} /> : i.kind === 'focus' ? <Timer size={12} color={colors.success} /> : i.kind === 'habit' ? <Flame size={12} color={HABIT_COLOR} /> : null}
                  <Text variant="caption" numberOfLines={compact ? 1 : 2} style={styles.blockTitle}>{i.title}</Text>
                </View>
                {!compact && height > 36 ? <Text variant="caption" tone="tertiary" tabular>{i.due ? `Vence ${hhmm(i.start)}` : `${hhmm(i.start)}–${hhmm(i.end % 1440)}`}</Text> : null}
              </Pressable>
            );
          })}
          {nowMinutes !== null && nowMinutes !== undefined && nowMinutes >= first && nowMinutes <= last ? (
            <View pointerEvents="none" style={[styles.now, { top: px(nowMinutes) }]} accessibilityElementsHidden>
              <View style={styles.nowDot} />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[2] },
  allDay: { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.sm, backgroundColor: colors.surfaceRaised, borderLeftWidth: 3 },
  hourRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row' },
  hourLabel: { marginTop: -7 },
  hourLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  block: { position: 'absolute', paddingHorizontal: spacing[2], paddingVertical: 4, borderRadius: radius.sm, borderLeftWidth: 3, overflow: 'hidden', marginRight: 2 },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  blockTitle: { flex: 1, color: colors.text },
  conflict: { borderWidth: 1, borderColor: colors.warning },
  band: { position: 'absolute', left: 0, right: 0, backgroundColor: 'rgba(111, 214, 160, 0.07)', borderLeftWidth: 2, borderLeftColor: 'rgba(111, 214, 160, 0.45)' },
  bandLabel: { position: 'absolute', right: spacing[2], top: 2, color: 'rgba(111, 214, 160, 0.75)' },
  now: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: colors.danger },
  nowDot: { position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
});
