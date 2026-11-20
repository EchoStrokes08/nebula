import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { type GestureResponderEvent, PanResponder, Platform, StyleSheet, View } from 'react-native';

import { Text } from '@/components/primitives/Text';
import { platformHaptics } from '@/platform/haptics';
import { colors, radius, spacing } from '@/design/tokens';
import { formatDuration, hhmm, minutesOf, normalizeTime } from '@/lib/time';

export const DAY_MINUTES = 24 * 60;
const THUMB = 26;
const TICKS = [0, 6, 12, 18, 24];

/** Ajusta unos minutos al paso y a los límites. */
export function snapMinutes(value: number, step: number, min = 0, max = DAY_MINUTES): number {
  return Math.min(max, Math.max(min, Math.round(value / step) * step));
}
/** «HH:MM» de unos minutos del día; el final del día (24:00) se guarda como 23:59. */
export const timeOf = (minutes: number) => hhmm(Math.min(minutes, DAY_MINUTES - 1));
/** Minutos de una hora escrita, o el respaldo si no es válida. */
export function minutesFrom(time: string, fallback: number): number {
  const t = normalizeTime(time);
  return t ? minutesOf(t) : fallback;
}
const label24 = (minutes: number) => (minutes >= DAY_MINUTES ? '24:00' : hhmm(minutes));

type Thumb = { value: number; min: number; max: number; label: string; onChange(v: number): void };

/**
 * Pista horizontal compartida: tocar mueve el tirador más cercano y arrastrar en horizontal lo desliza.
 * Un gesto vertical se cede al ScrollView para no secuestrar el desplazamiento de la pantalla.
 */
function Track({ thumbs, step, min, max, disabled, fill }: { thumbs: Thumb[]; step: number; min: number; max: number; disabled?: boolean; fill: [number, number] }) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const geo = useRef({ x: 0, width: 1 });
  const drag = useRef({ active: 0, dragging: false, ambiguous: false });
  const live = useRef({ thumbs, disabled, step, min, max });
  useEffect(() => { live.current = { thumbs, disabled, step, min, max }; });
  const [width, setWidth] = useState(0);

  const measure = () => ref.current?.measureInWindow?.((x: number, _y: number, w: number) => { geo.current = { x, width: Math.max(1, w) }; });
  const at = (pageX: number) => {
    const { min: lo, max: hi } = live.current;
    const usable = Math.max(1, geo.current.width - THUMB);
    const ratio = Math.min(1, Math.max(0, (pageX - geo.current.x - THUMB / 2) / usable));
    return lo + ratio * (hi - lo);
  };
  const apply = (index: number, raw: number) => {
    const t = live.current.thumbs[index];
    if (!t) return;
    const next = snapMinutes(raw, live.current.step, t.min, t.max);
    if (next !== t.value) t.onChange(next);
  };
  const nearest = (raw: number) => {
    const ts = live.current.thumbs;
    let best = 0;
    ts.forEach((t, i) => { if (Math.abs(t.value - raw) < Math.abs(ts[best]!.value - raw) || (t.value === ts[best]!.value && raw > t.value)) best = i; });
    return best;
  };

  // Los manejadores solo leen las refs durante el gesto, nunca al renderizar.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !live.current.disabled,
    onMoveShouldSetPanResponder: (_e, g) => !live.current.disabled && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderGrant: (e: GestureResponderEvent) => {
      measure();
      const raw = at(e.nativeEvent.pageX);
      const { thumbs: ts, min: lo, max: hi } = live.current;
      // Con los tiradores solapados bajo el dedo, decide la dirección del arrastre: derecha = final, izquierda = inicio.
      const reach = (THUMB / Math.max(1, geo.current.width - THUMB)) * (hi - lo);
      drag.current = { active: nearest(raw), dragging: false, ambiguous: ts.length > 1 && ts.every((t) => Math.abs(t.value - raw) < reach) };
    },
    onPanResponderMove: (e, g) => {
      if (!drag.current.dragging && Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy)) {
        drag.current.dragging = true;
        if (drag.current.ambiguous) drag.current.active = g.dx > 0 ? live.current.thumbs.length - 1 : 0;
      }
      if (drag.current.dragging) apply(drag.current.active, at(e.nativeEvent.pageX));
    },
    onPanResponderRelease: (e) => {
      // Un toque sin arrastre salta a esa hora.
      if (!drag.current.dragging) apply(drag.current.active, at(e.nativeEvent.pageX));
      platformHaptics.tap();
    },
    onPanResponderTerminationRequest: () => !drag.current.dragging,
    onShouldBlockNativeResponder: () => false,
  }));

  const x = (v: number) => ((v - min) / Math.max(1, max - min)) * Math.max(0, width - THUMB);
  return (
    <View>
      <View
        ref={ref}
        onLayout={(e) => { setWidth(e.nativeEvent.layout.width); measure(); }}
        style={[styles.track, disabled && styles.disabled]}
        {...responder.panHandlers}
      >
        <View style={styles.rail} />
        <View style={[styles.fill, { left: x(fill[0]) + THUMB / 2, width: Math.max(0, x(fill[1]) - x(fill[0])) }]} />
        {thumbs.map((t, i) => {
          const nudge = (delta: number) => apply(i, t.value + delta);
          const web = Platform.OS === 'web' && !disabled
            ? { tabIndex: 0 as const, onKeyDown: (e: { key: string; shiftKey?: boolean; preventDefault(): void }) => {
              const big = e.shiftKey ? 60 : step;
              const move = { ArrowRight: big, ArrowUp: big, ArrowLeft: -big, ArrowDown: -big, PageUp: 60, PageDown: -60, Home: t.min - t.value, End: t.max - t.value }[e.key];
              if (move !== undefined) { e.preventDefault(); nudge(move); }
            } }
            : {};
          return (
            <View
              key={t.label}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={t.label}
              accessibilityState={{ disabled: !!disabled }}
              accessibilityValue={{ min: t.min, max: t.max, now: t.value, text: label24(t.value) }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(e) => { if (!disabled) nudge(e.nativeEvent.actionName === 'increment' ? step : -step); }}
              style={[styles.thumb, { left: x(t.value) }]}
              {...(web as object)}
            />
          );
        })}
      </View>
      {min === 0 && max === DAY_MINUTES ? (
        <View style={styles.ticks} pointerEvents="none">
          {TICKS.map((h) => <Text key={h} variant="caption" tone="tertiary" tabular>{String(h).padStart(2, '0')}</Text>)}
        </View>
      ) : null}
    </View>
  );
}

/** Una franja (desde–hasta) dentro del día con dos tiradores que no se cruzan. */
export function TimeRangeSlider({ label, start, end, onChange, step = 15, disabled, error }: {
  label?: string; start: string; end: string; onChange(next: { start: string; end: string }): void; step?: number; disabled?: boolean; error?: string;
}) {
  const s = minutesFrom(start, 9 * 60);
  const e = Math.max(minutesFrom(end, s + 60), s);
  const endValue = end === timeOf(DAY_MINUTES) ? DAY_MINUTES : e;
  return (
    <View style={styles.box}>
      <View style={styles.head}>
        {label ? <Text variant="caption" tone="secondary" style={styles.flex}>{label}</Text> : <View style={styles.flex} />}
        <Text variant="title3" tabular>{label24(s)} – {label24(endValue)}</Text>
        <Text variant="caption" tone="tertiary" tabular>{formatDuration(endValue - s)}</Text>
      </View>
      <Track
        thumbs={[
          { value: s, min: 0, max: endValue - step, label: `${label ? `${label}: ` : ''}desde`, onChange: (m) => onChange({ start: timeOf(m), end }) },
          { value: endValue, min: s + step, max: DAY_MINUTES, label: `${label ? `${label}: ` : ''}hasta`, onChange: (m) => onChange({ start, end: timeOf(m) }) },
        ]}
        step={step}
        min={0}
        max={DAY_MINUTES}
        fill={[s, endValue]}
        disabled={disabled}
      />
      {error ? <Text variant="caption" tone="danger">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing[2] },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  nudge: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderStrong },
  value: { minWidth: 56, textAlign: 'center' },
  flex: { flex: 1 },
  track: { height: 44, justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  rail: { position: 'absolute', left: THUMB / 2, right: THUMB / 2, height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised },
  fill: { position: 'absolute', height: 6, borderRadius: radius.pill, backgroundColor: colors.accent },
  thumb: { position: 'absolute', top: (44 - THUMB) / 2, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: colors.text, borderWidth: 3, borderColor: colors.accentBright },
  ticks: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: THUMB / 2 - 6 },
});
