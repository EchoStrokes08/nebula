import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { addDays, startOfMonth, startOfWeek, type DayKey } from '@/lib/dates';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

function shiftMonth(month: DayKey, n: number): DayKey {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01` as DayKey;
}

export interface MonthCalendarProps {
  value: DayKey | null;
  today: DayKey;
  weekStartsOn?: number;
  onChange(day: DayKey): void;
  /** Marca de carga por día (p. ej. nº de pendientes) para la vista mensual de la agenda. */
  markers?: Record<string, number>;
}

/** Calendario mensual accesible (cada día es un botón con su fecha completa como etiqueta). */
export function MonthCalendar({ value, today, weekStartsOn = 1, onChange, markers }: MonthCalendarProps) {
  const [month, setMonth] = useState<DayKey>(startOfMonth(value ?? today));
  const first = startOfWeek(month, weekStartsOn);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  const [y, m] = month.split('-').map(Number) as [number, number];
  const fmt = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={() => setMonth(shiftMonth(month, -1))} accessibilityRole="button" accessibilityLabel="Mes anterior" hitSlop={10} style={styles.nav}>
          <ChevronLeft size={20} color={colors.textSecondary} />
        </Pressable>
        <Text variant="title3" accessibilityRole="header">
          {MONTHS[m - 1]} {y}
        </Text>
        <Pressable onPress={() => setMonth(shiftMonth(month, 1))} accessibilityRole="button" accessibilityLabel="Mes siguiente" hitSlop={10} style={styles.nav}>
          <ChevronRight size={20} color={colors.textSecondary} />
        </Pressable>
      </View>
      <View style={styles.row}>
        {Array.from({ length: 7 }, (_, i) => (
          <Text key={i} variant="caption" tone="tertiary" style={styles.dow}>
            {DAYS[(weekStartsOn + i) % 7]}
          </Text>
        ))}
      </View>
      {Array.from({ length: 6 }, (_, w) => (
        <View key={w} style={styles.row}>
          {cells.slice(w * 7, w * 7 + 7).map((d) => {
            const inMonth = d.slice(0, 7) === month.slice(0, 7);
            const selected = d === value;
            const isToday = d === today;
            const [yy, mm, dd] = d.split('-').map(Number) as [number, number, number];
            const mark = markers?.[d] ?? 0;
            return (
              <Pressable
                key={d}
                onPress={() => onChange(d)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${fmt.format(new Date(yy, mm - 1, dd))}${mark ? `, ${mark} pendientes` : ''}`}
                style={({ pressed }) => [styles.cell, selected && styles.selected, isToday && !selected && styles.today, pressed && styles.pressed]}
              >
                <Text variant="callout" tabular style={{ color: selected ? colors.textOnAccent : inMonth ? colors.text : colors.textDisabled }}>
                  {dd}
                </Text>
                {mark > 0 ? <View style={[styles.dot, selected && { backgroundColor: colors.textOnAccent }]} /> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[1] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[2] },
  nav: { padding: spacing[2] },
  row: { flexDirection: 'row' },
  dow: { flex: 1, textAlign: 'center', paddingVertical: spacing[1] },
  cell: { flex: 1, aspectRatio: 1, maxHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  selected: { backgroundColor: colors.accent },
  today: { borderWidth: 1, borderColor: colors.accentBright },
  pressed: { backgroundColor: colors.surfacePressed },
  dot: { position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accentBright },
});
