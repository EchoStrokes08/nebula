import { ChevronDown, Clock, Minus, Moon, Plus, Sun, Sunrise, Sunset, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Sheet } from '@/components/overlays/Sheet';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, fontFamily, hitTarget, radius, spacing } from '@/design/tokens';
import { hhmm, minutesOf, normalizeTime } from '@/lib/time';
import { platformHaptics } from '@/platform/haptics';

const DAY_END = 24 * 60 - 1;

/** Franjas del día para ordenar las 24 horas en el desplegable. */
export const DAY_PARTS: { label: string; icon: LucideIcon; hours: number[] }[] = [
  { label: 'Madrugada', icon: Moon, hours: [0, 1, 2, 3, 4, 5] },
  { label: 'Mañana', icon: Sunrise, hours: [6, 7, 8, 9, 10, 11] },
  { label: 'Tarde', icon: Sun, hours: [12, 13, 14, 15, 16, 17] },
  { label: 'Noche', icon: Sunset, hours: [18, 19, 20, 21, 22, 23] },
];

/** Minutos ofrecidos dentro de la hora según el paso (5 → :00, :05 … :55). */
export const minuteOptions = (step: number) => Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step).filter((m) => m < 60);

/** Al cambiar de hora se conserva el minuto; si queda fuera de rango, se usa el primero válido. */
export function withHour(hour: number, minute: number, step: number, min: number, max: number): number | null {
  const ok = (m: number) => hour * 60 + m >= min && hour * 60 + m <= max;
  if (ok(minute)) return hour * 60 + minute;
  const first = minuteOptions(step).find(ok);
  return first === undefined ? null : hour * 60 + first;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** «de la mañana», «de la noche»… para leer la hora elegida en palabras. */
export function partOfDay(hour: number): string {
  if (hour < 6) return 'de madrugada';
  if (hour < 12) return 'de la mañana';
  if (hour < 14) return 'del mediodía';
  if (hour < 20) return 'de la tarde';
  return 'de la noche';
}

const clampTo = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Lo tecleado en el campo de la hora: «7» cambia solo la hora (conserva los minutos) y «7:37»,
 * «7.37», «7h37» o «737» fijan la hora completa. Devuelve los minutos del día o null si aún no vale.
 */
export function parseHourInput(text: string, minute: number): number | null {
  const t = text.trim();
  if (!t) return null;
  if (/^\d{1,2}$/.test(t)) {
    const h = Number(t);
    return h <= 23 ? h * 60 + minute : null;
  }
  const full = normalizeTime(t);
  return full ? minutesOf(full) : null;
}

/** Lo tecleado en el campo de los minutos (0–59, cualquier minuto, no solo los del paso). */
export function parseMinuteInput(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,2}$/.test(t)) return null;
  const m = Number(t);
  return m <= 59 ? m : null;
}

/** −/+ de minuto en minuto, sin salirse del rango permitido. */
export const nudgeMinutes = (base: number, delta: number, min: number, max: number) => clampTo(base + delta, min, max);

/**
 * Hora del día elegida en un desplegable: las 24 horas agrupadas por franjas (madrugada, mañana,
 * tarde, noche) y debajo los minutos. Sustituye al deslizador horizontal: se ve todo de un vistazo y
 * se elige con dos toques. La hora grande también se puede escribir («7:37», o tocar los minutos y
 * escribir «37») y afinar minuto a minuto con − y +. `value` vacío muestra el texto de ayuda.
 */
export function TimePicker({ label, value, onChange, step = 5, min = 0, max = DAY_END, disabled, hint, error, placeholder = 'Elegir hora' }: {
  label: string; value: string; onChange(v: string): void; step?: number; min?: number; max?: number; disabled?: boolean; hint?: string; error?: string; placeholder?: string;
}) {
  const current = normalizeTime(value);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? (current ? minutesOf(current) : null);
  const hour = shown === null ? null : Math.floor(shown / 60);
  const minute = shown === null ? 0 : shown % 60;

  // Edición a mano de la hora grande: el texto vive aparte mientras se escribe, para no pisar
  // lo que el usuario teclea con el formato «07».
  const [hText, setHText] = useState<string | null>(null);
  const [mText, setMText] = useState<string | null>(null);
  const resetTyping = () => { setHText(null); setMText(null); };

  const show = () => { if (disabled) return; platformHaptics.tap(); resetTyping(); setDraft(current ? minutesOf(current) : null); setOpen(true); };
  const close = () => { setOpen(false); setDraft(null); resetTyping(); };
  const confirm = () => { if (shown !== null) onChange(hhmm(shown)); close(); };
  const pickHour = (h: number) => { platformHaptics.tap(); resetTyping(); const next = withHour(h, minute, step, min, max); if (next !== null) setDraft(next); };
  const pickMinute = (m: number) => { if (hour === null) return; platformHaptics.tap(); resetTyping(); setDraft(hour * 60 + m); };
  const nowMinutes = () => { const d = new Date(); return clampTo(d.getHours() * 60 + d.getMinutes(), min, max); };
  const typeHour = (t: string) => {
    setHText(t);
    const next = parseHourInput(t, minute);
    if (next !== null) setDraft(clampTo(next, min, max));
  };
  const typeMinute = (t: string) => {
    setMText(t);
    const m = parseMinuteInput(t);
    if (m !== null) setDraft(clampTo((hour ?? Math.floor(nowMinutes() / 60)) * 60 + m, min, max));
  };
  const nudge = (delta: number) => {
    platformHaptics.tap();
    resetTyping();
    setDraft(nudgeMinutes(shown ?? nowMinutes(), delta, min, max));
  };
  // Escribiendo la hora completa («7:37») el campo se ensancha y los minutos se ocultan para no duplicarlos.
  const typingFull = hText !== null && hText.length > 2;
  const canDown = shown === null || shown > min;
  const canUp = shown === null || shown < max;

  return (
    <View style={styles.root}>
      <Text variant="caption" tone="secondary">{label}</Text>
      <Pressable
        onPress={show}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current ?? placeholder}`}
        accessibilityHint="Abre la lista de horas del día"
        accessibilityState={{ disabled: !!disabled, expanded: open }}
        style={(s: { hovered?: boolean; focused?: boolean; pressed: boolean }) => [styles.field, (s.hovered || s.pressed) && styles.fieldHover, s.focused && Platform.OS === 'web' && styles.focus, !!error && styles.fieldError, disabled && styles.disabled]}
      >
        <View style={styles.clock}><Clock size={18} color={colors.star} /></View>
        <Text style={[styles.fieldValue, !current && styles.placeholder]} tabular>{current ?? placeholder}</Text>
        <ChevronDown size={18} color={colors.textSecondary} />
      </Pressable>
      {error ? <Text variant="caption" tone="danger">{error}</Text> : hint ? <Text variant="caption" tone="secondary">{hint}</Text> : null}

      <Sheet visible={open} onClose={close} title={label}>
        <View style={styles.previewBox} accessibilityLiveRegion="polite">
          <View style={styles.previewRow}>
            <Pressable onPress={() => nudge(-1)} disabled={!canDown} accessibilityRole="button" accessibilityLabel="Un minuto antes" hitSlop={6} style={(s: { hovered?: boolean; pressed: boolean }) => [styles.nudge, (s.hovered || s.pressed) && styles.nudgeHover, !canDown && styles.disabled]}>
              <Minus size={20} color={colors.star} strokeWidth={2.2} />
            </Pressable>
            <View style={styles.digits}>
              <TextInput
                value={hText ?? (hour === null ? '' : pad(hour))}
                onChangeText={typeHour}
                onFocus={() => setHText(hour === null ? '' : pad(hour))}
                onBlur={() => setHText(null)}
                placeholder="--"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numbers-and-punctuation"
                inputMode="text"
                maxLength={5}
                selectTextOnFocus
                accessibilityLabel="Hora, escríbela (por ejemplo 7 o 7:37)"
                style={[styles.digit, typingFull && styles.digitWide, hText !== null && styles.digitEditing, shown === null && styles.previewEmpty]}
              />
              {typingFull ? null : <Text style={[styles.preview, styles.colon, shown === null && styles.previewEmpty]}>:</Text>}
              {typingFull ? null : <TextInput
                value={mText ?? (shown === null ? '' : pad(minute))}
                onChangeText={typeMinute}
                onFocus={() => setMText(shown === null ? '' : pad(minute))}
                onBlur={() => setMText(null)}
                placeholder="--"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                inputMode="numeric"
                maxLength={2}
                selectTextOnFocus
                accessibilityLabel="Minutos, escríbelos (por ejemplo 37)"
                style={[styles.digit, mText !== null && styles.digitEditing, shown === null && styles.previewEmpty]}
              />}
            </View>
            <Pressable onPress={() => nudge(1)} disabled={!canUp} accessibilityRole="button" accessibilityLabel="Un minuto después" hitSlop={6} style={(s: { hovered?: boolean; pressed: boolean }) => [styles.nudge, (s.hovered || s.pressed) && styles.nudgeHover, !canUp && styles.disabled]}>
              <Plus size={20} color={colors.star} strokeWidth={2.2} />
            </Pressable>
          </View>
          <Text variant="caption" style={styles.previewPart}>{hour === null ? 'Elige abajo o escribe la hora' : `${partOfDay(hour)} · toca los números para escribir`}</Text>
        </View>
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {DAY_PARTS.map((part) => (
            <View key={part.label} style={styles.part}>
              <View style={styles.partHead}>
                <part.icon size={14} color={colors.textTertiary} />
                <Text variant="overline" tone="tertiary">{part.label.toUpperCase()}</Text>
                <View style={styles.line} />
              </View>
              <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={`Horas de ${part.label.toLowerCase()}`}>
                {part.hours.map((h) => {
                  const on = hour === h;
                  const off = withHour(h, minute, step, min, max) === null;
                  return (
                    <Pressable
                      key={h}
                      onPress={() => pickHour(h)}
                      disabled={off}
                      accessibilityRole="radio"
                      accessibilityLabel={`${pad(h)} horas`}
                      accessibilityState={{ checked: on, disabled: off }}
                      aria-checked={on}
                      style={(s: { hovered?: boolean }) => [styles.cell, s.hovered && !on && styles.cellHover, on && styles.cellOn, off && styles.disabled]}
                    >
                      <Text variant="bodyStrong" tabular style={{ color: on ? colors.bg : colors.text }}>{pad(h)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
          <View style={styles.part}>
            <View style={styles.partHead}>
              <Clock size={14} color={colors.textTertiary} />
              <Text variant="overline" tone="tertiary">MINUTOS</Text>
              <View style={styles.line} />
            </View>
            <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Minutos">
              {minuteOptions(step).map((m) => {
                const on = hour !== null && minute === m;
                const off = hour === null || hour * 60 + m < min || hour * 60 + m > max;
                return (
                  <Pressable
                    key={m}
                    onPress={() => pickMinute(m)}
                    disabled={off}
                    accessibilityRole="radio"
                    accessibilityLabel={`Minuto ${pad(m)}`}
                    accessibilityState={{ checked: on, disabled: off }}
                    aria-checked={on}
                    style={(s: { hovered?: boolean }) => [styles.cell, s.hovered && !on && styles.cellHover, on && styles.minuteOn, off && styles.disabled]}
                  >
                    <Text variant="callout" tabular style={{ color: on ? colors.star : colors.textSecondary }}>:{pad(m)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
        <Button label={shown === null ? 'Elige una hora' : `Usar las ${hhmm(shown)}`} onPress={confirm} disabled={shown === null} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[2] },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: hitTarget + 8, paddingHorizontal: spacing[3], borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  fieldHover: { borderColor: 'rgba(244, 221, 176, 0.5)' },
  fieldError: { borderColor: colors.danger },
  focus: { outlineColor: colors.borderFocus, outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 2 } as object,
  clock: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.starMuted },
  fieldValue: { flex: 1, fontFamily: fontFamily.display, fontSize: 20, lineHeight: 26, color: colors.text },
  placeholder: { fontFamily: fontFamily.medium, fontSize: 15, color: colors.textTertiary },
  previewBox: { alignItems: 'center', gap: 2, paddingBottom: spacing[1] },
  preview: { fontFamily: fontFamily.serif, fontSize: 60, lineHeight: 64, color: colors.star, textShadowColor: 'rgba(244, 221, 176, 0.35)', textShadowRadius: 18 },
  previewEmpty: { color: colors.textTertiary, textShadowRadius: 0 },
  previewPart: { color: colors.textSecondary, letterSpacing: 0.4 },
  previewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[4] },
  digits: { flexDirection: 'row', alignItems: 'center' },
  digit: { width: 76, paddingVertical: 0, textAlign: 'center', fontFamily: fontFamily.serif, fontSize: 60, lineHeight: 68, color: colors.star, borderBottomWidth: 1, borderBottomColor: 'transparent', borderRadius: 0, outlineStyle: 'none' } as object,
  digitWide: { width: 168 },
  digitEditing: { borderBottomColor: colors.star, backgroundColor: colors.starMuted, borderRadius: radius.sm },
  colon: { marginHorizontal: 2, marginTop: -6 },
  nudge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.starMuted, borderWidth: 1, borderColor: 'rgba(244, 221, 176, 0.35)' },
  nudgeHover: { backgroundColor: 'rgba(244, 221, 176, 0.24)', borderColor: colors.star },
  list: { maxHeight: 440 },
  listContent: { gap: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[2] },
  part: { gap: spacing[2] },
  partHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  cell: { flexBasis: '14%', flexGrow: 1, minHeight: hitTarget, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  cellHover: { borderColor: colors.borderStrong, backgroundColor: colors.surfaceRaised },
  cellOn: { backgroundColor: colors.star, borderColor: colors.star },
  minuteOn: { backgroundColor: colors.starMuted, borderColor: 'rgba(244, 221, 176, 0.6)' },
  disabled: { opacity: 0.35 },
});
