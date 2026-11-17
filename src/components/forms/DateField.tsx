import { CalendarDays, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Sheet } from '@/components/overlays/Sheet';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { addDays, type DayKey } from '@/lib/dates';

import { Chip } from './Chip';
import { MonthCalendar } from './MonthCalendar';

export function formatDay(day: DayKey, today: DayKey): string {
  if (day === today) return 'Hoy';
  if (day === addDays(today, 1)) return 'Mañana';
  if (day === addDays(today, -1)) return 'Ayer';
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }).format(date);
}

/** Campo de fecha con atajos (hoy, mañana, en una semana) y calendario. */
export function DateField({ label, value, onChange, today, allowEmpty = true }: { label: string; value: DayKey | null; onChange(v: DayKey | null): void; today: DayKey; allowEmpty?: boolean }) {
  const [open, setOpen] = useState(false);
  const presets: [string, DayKey][] = [
    ['Hoy', today],
    ['Mañana', addDays(today, 1)],
    ['En una semana', addDays(today, 7)],
  ];
  return (
    <View style={styles.root}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <View style={styles.wrap}>
        {presets.map(([l, d]) => (
          <Chip key={l} role="radio" label={l} selected={value === d} onToggle={() => onChange(d)} />
        ))}
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`Elegir ${label.toLowerCase()} en el calendario`} style={styles.pick}>
          <CalendarDays size={16} color={colors.accentSoft} />
          <Text variant="callout" tone="accent">
            {value && !presets.some(([, d]) => d === value) ? formatDay(value, today) : 'Elegir…'}
          </Text>
        </Pressable>
        {value && allowEmpty ? (
          <Pressable onPress={() => onChange(null)} accessibilityRole="button" accessibilityLabel={`Quitar ${label.toLowerCase()}`} hitSlop={8} style={styles.clear}>
            <X size={16} color={colors.textTertiary} />
          </Pressable>
        ) : null}
      </View>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <MonthCalendar
          value={value}
          today={today}
          onChange={(d) => {
            onChange(d);
            setOpen(false);
          }}
        />
        <Button label="Cerrar" variant="ghost" onPress={() => setOpen(false)} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[2] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], alignItems: 'center' },
  pick: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], minHeight: 40, paddingHorizontal: spacing[3], borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong },
  clear: { padding: spacing[2] },
});
