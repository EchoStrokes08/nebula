import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import { Text } from '@/components/primitives/Text';
import { fontFamily, motion, radius, spacing } from '@/design/tokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { platformHaptics } from '@/platform/haptics';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Anillo de progreso con brillo neón: capas anchas y translúcidas bajo el trazo principal. */
function GlowRing({ progress, marker, size = 128, stroke = 10 }: { progress: number; marker?: number; size?: number; stroke?: number }) {
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const pad = 12; // margen para que el brillo no se corte
  const r = (size - stroke) / 2 - pad;
  const c = 2 * Math.PI * r;
  const reduced = useReducedMotion();
  const shown = useSharedValue(reduced ? p : 0);
  useEffect(() => {
    shown.value = reduced ? p : withTiming(p, { duration: motion.slow * 2 });
  }, [p, reduced, shown]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - shown.value) }));
  const mid = size / 2;
  const common = { cx: mid, cy: mid, r, fill: 'none', strokeLinecap: 'round' as const, strokeDasharray: `${c} ${c}`, transform: `rotate(-90 ${mid} ${mid})` };
  return (
    <Svg width={size} height={size}>
      <Defs>
        <SvgGradient id="orbitArc" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#7DF3FF" />
          <Stop offset="0.55" stopColor="#B99BFF" />
          <Stop offset="1" stopColor="#FF8AD8" />
        </SvgGradient>
      </Defs>
      <Circle cx={mid} cy={mid} r={r} stroke="rgba(255, 255, 255, 0.14)" strokeWidth={stroke} fill="none" />
      {p > 0 ? (
        <>
          <AnimatedCircle {...common} stroke="#C9B6FF" strokeOpacity={0.12} strokeWidth={stroke + 16} animatedProps={arc} />
          <AnimatedCircle {...common} stroke="#C9B6FF" strokeOpacity={0.22} strokeWidth={stroke + 8} animatedProps={arc} />
          <AnimatedCircle {...common} stroke="url(#orbitArc)" strokeWidth={stroke} animatedProps={arc} />
        </>
      ) : null}
      {marker !== undefined && marker > 0 && marker < 1 ? (
        // Marca de ritmo: dónde deberías ir si avanzaras igual cada día del periodo.
        <>
          <Circle cx={mid + r * Math.sin(2 * Math.PI * marker)} cy={mid - r * Math.cos(2 * Math.PI * marker)} r={stroke / 2 + 3} fill="#FFFFFF" fillOpacity={0.25} />
          <Circle cx={mid + r * Math.sin(2 * Math.PI * marker)} cy={mid - r * Math.cos(2 * Math.PI * marker)} r={stroke / 2 - 1} fill="#FFFFFF" stroke="#2B1460" strokeWidth={1.5} />
        </>
      ) : null}
    </Svg>
  );
}

export interface OrbitStat {
  label: string;
  value: string;
  href?: Href;
}

export interface OrbitView {
  key: 'day' | 'week' | 'month';
  /** Texto de la pestaña («Hoy», «Semana», «Mes»). */
  tab: string;
  eyebrow: string;
  /** Lo que va bajo el porcentaje: «del día», «de la semana»… */
  unit: string;
  progress: number;
  /** Parte del periodo transcurrida (0..1): se marca en el anillo como referencia de ritmo. */
  marker?: number;
  headline: string;
  caption?: string;
  stats: OrbitStat[];
}

const pctOf = (p: number) => Math.round(Math.max(0, Math.min(1, Number.isFinite(p) ? p : 0)) * 100);

/**
 * Hoy · «Tu órbita»: el centro visual de la pantalla. Degradado cósmico, anillo luminoso con el
 * porcentaje y cifras grandes (cada una abre su sección). Pestañas para ver la órbita del día,
 * de la semana y del mes; en las dos últimas, una marca en el anillo enseña el ritmo esperado.
 */
export function TodayOrbit({ views }: { views: OrbitView[] }) {
  const [selected, setSelected] = useState<OrbitView['key']>(views[0]?.key ?? 'day');
  const view = views.find((v) => v.key === selected) ?? views[0];
  if (!view) return null;
  const pct = pctOf(view.progress);
  return (
    <View style={styles.shadow}>
      <LinearGradient colors={['#4A22B8', '#8B37C9', '#2C5BD6']} locations={[0, 0.55, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.root} accessibilityRole="summary">
        <View style={[styles.orb, styles.orbPink]} pointerEvents="none" />
        <View style={[styles.orb, styles.orbCyan]} pointerEvents="none" />
        <LinearGradient colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.6 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
        {STARS.map((s, i) => <View key={i} pointerEvents="none" style={[styles.star, { left: `${s[0]}%`, top: `${s[1]}%`, width: s[2], height: s[2], borderRadius: s[2] }]} />)}

        {views.length > 1 ? (
          <View style={styles.tabs} accessibilityRole="tablist">
            {views.map((v) => {
              const on = v.key === view.key;
              return (
                <Pressable
                  key={v.key}
                  onPress={() => { if (!on) { platformHaptics.tap(); setSelected(v.key); } }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  aria-selected={on}
                  accessibilityLabel={`${v.tab}: ${pctOf(v.progress)} %`}
                  style={({ pressed }) => [styles.tab, on && styles.tabOn, pressed && styles.pressed]}
                >
                  <Text variant="caption" style={on ? styles.tabTextOn : styles.tabText}>{v.tab}</Text>
                  <Text variant="caption" tabular style={on ? styles.tabPctOn : styles.tabPct}>{pctOf(v.progress)}%</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.top}>
          <View style={styles.ring} accessible accessibilityRole="progressbar" accessibilityLabel={`Progreso ${view.unit}: ${pct} %`} accessibilityValue={{ min: 0, max: 100, now: pct }}>
            <GlowRing progress={view.progress} marker={view.marker} />
            <View style={styles.ringCenter} pointerEvents="none">
              <Text style={styles.pct} tabular>{pct}<Text style={styles.pctSign}>%</Text></Text>
              <Text variant="caption" style={styles.dim}>{view.unit}</Text>
            </View>
          </View>
          <View style={styles.copy}>
            <Text variant="overline" style={styles.eyebrow}>{view.eyebrow}</Text>
            <Text variant="title2" style={styles.headline}>{view.headline}</Text>
            {view.caption ? <Text variant="callout" style={styles.dim}>{view.caption}</Text> : null}
          </View>
        </View>

        <View style={styles.stats}>
          {view.stats.map((s, i) => (
            <View key={s.label} style={styles.statWrap}>
              {i > 0 ? <View style={styles.divider} /> : null}
              <Pressable
                disabled={!s.href}
                onPress={() => { if (s.href) { platformHaptics.tap(); router.push(s.href); } }}
                accessibilityRole={s.href ? 'button' : undefined}
                accessibilityLabel={`${s.label}: ${s.value}`}
                style={({ pressed }) => [styles.stat, pressed && styles.pressed]}
              >
                <Text style={styles.statValue} tabular numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
                <Text variant="caption" style={styles.dim} numberOfLines={1}>{s.label}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </LinearGradient>
    </View>
  );
}

/** Estrellitas fijas sobre el degradado: [x %, y %, tamaño]. */
const STARS: [number, number, number][] = [[8, 12, 2], [22, 78, 1.5], [46, 8, 1.5], [63, 30, 2], [88, 18, 2.5], [93, 64, 1.5], [55, 88, 2], [74, 52, 1.5]];

const styles = StyleSheet.create({
  shadow: { borderRadius: radius.xl + 6, boxShadow: '0 0 34px rgba(139, 92, 246, 0.45), 0 18px 40px rgba(0, 0, 0, 0.5)' } as ViewStyle,
  root: { gap: spacing[5], padding: spacing[5], borderRadius: radius.xl + 6, borderWidth: 1, borderColor: 'rgba(230, 215, 255, 0.35)', overflow: 'hidden' },
  orb: { position: 'absolute', borderRadius: 999 },
  orbPink: { top: -70, right: -50, width: 200, height: 200, backgroundColor: 'rgba(255, 138, 216, 0.32)' },
  orbCyan: { bottom: -90, left: -60, width: 220, height: 220, backgroundColor: 'rgba(125, 243, 255, 0.18)' },
  star: { position: 'absolute', backgroundColor: 'rgba(255, 255, 255, 0.85)' },
  tabs: { flexDirection: 'row', alignSelf: 'stretch', padding: 3, gap: 3, borderRadius: radius.pill, backgroundColor: 'rgba(10, 6, 24, 0.32)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)' },
  tab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline', gap: 6, paddingVertical: 7, borderRadius: radius.pill },
  tabOn: { backgroundColor: 'rgba(255, 255, 255, 0.92)' },
  tabText: { color: 'rgba(245, 238, 255, 0.85)', fontFamily: fontFamily.semibold },
  tabTextOn: { color: '#2B1460', fontFamily: fontFamily.semibold },
  tabPct: { color: 'rgba(245, 238, 255, 0.6)' },
  tabPctOn: { color: '#6B3FD4', fontFamily: fontFamily.semibold },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  ring: { width: 128, height: 128, marginVertical: -spacing[2], marginLeft: -spacing[2] },
  ringCenter: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  pct: { fontFamily: fontFamily.displayBold, fontSize: 30, lineHeight: 36, letterSpacing: -1, color: '#FFFFFF', textShadowColor: 'rgba(201, 182, 255, 0.9)', textShadowRadius: 14 },
  pctSign: { fontFamily: fontFamily.displayBold, fontSize: 16, color: 'rgba(255, 255, 255, 0.8)' },
  copy: { flex: 1, gap: spacing[1] },
  eyebrow: { color: '#E9DDFF', letterSpacing: 1.2 },
  headline: { color: '#FFFFFF' },
  dim: { color: 'rgba(245, 238, 255, 0.78)' },
  stats: { flexDirection: 'row', alignItems: 'stretch', paddingVertical: spacing[3], borderRadius: radius.lg, backgroundColor: 'rgba(10, 6, 24, 0.35)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)' },
  statWrap: { flex: 1, flexDirection: 'row' },
  divider: { width: 1, marginVertical: spacing[1], backgroundColor: 'rgba(255, 255, 255, 0.16)' },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: spacing[2] },
  statValue: { fontFamily: fontFamily.displayBold, fontSize: 30, lineHeight: 38, letterSpacing: -1, color: '#FFFFFF', textShadowColor: 'rgba(0, 0, 0, 0.25)', textShadowRadius: 6 },
  pressed: { opacity: 0.7 },
});
