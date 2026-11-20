import { memo, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { generateGalaxy } from '@/design/galaxy';
import { dailyLayout, resolveSky, type SkyTheme } from '@/design/sky';
import { generateStars } from '@/design/starfield';
import { colors, palette } from '@/design/tokens';
import { useAppearance } from '@/features/appearance/store';

const FIELD = generateStars(150, 11);
const SPARKLES = generateStars(16, 5);
const SOURCE_DUST = [palette.violet400, '#E58FD0', palette.cyan400];
// Difuminado sutil del cielo (solo web: en Android el desenfoque de capas animadas cuesta batería).
const softFocus = Platform.OS === 'web' ? ({ filter: 'blur(1.5px)' } as unknown as ViewStyle) : null;
const webLayer = Platform.OS === 'web' ? ({ willChange: 'transform, opacity' } as unknown as ViewStyle) : null;

/** Destello de cuatro puntas centrado en (x, y). */
const sparkle = (x: number, y: number, s: number) =>
  `M${x} ${y - s} Q${x + s * 0.12} ${y - s * 0.12} ${x + s} ${y} Q${x + s * 0.12} ${y + s * 0.12} ${x} ${y + s} Q${x - s * 0.12} ${y + s * 0.12} ${x - s} ${y} Q${x - s * 0.12} ${y - s * 0.12} ${x} ${y - s}Z`;

/** Hora actual que se refresca cada minuto (para cambiar de cielo al pasar de franja). */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function Twinkle({ width, height, phase, animate }: { width: number; height: number; phase: 0 | 1; animate: boolean }) {
  const o = useSharedValue(phase ? 1 : 0.35);
  useEffect(() => {
    if (!animate) return;
    o.value = withRepeat(withTiming(phase ? 0.25 : 1, { duration: 2600 + phase * 900 }), -1, true);
  }, [o, phase, animate]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  const stars = SPARKLES.filter((_, i) => i % 2 === phase);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id={`twinkleHalo${phase}`} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={palette.lavender300} stopOpacity={0.6} />
            <Stop offset="1" stopColor={palette.lavender300} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {stars.map((s, i) => {
          const x = s.x * width;
          const y = s.y * height;
          const size = 4 + s.r * 4;
          return (
            <G key={i}>
              <Circle cx={x} cy={y} r={size * 1.6} fill={`url(#twinkleHalo${phase})`} />
              <Path d={sparkle(x, y, size)} fill={palette.white} opacity={0.9} />
            </G>
          );
        })}
      </Svg>
    </Animated.View>
  );
}

/** Nube de color que deriva y «respira» muy despacio. */
function NebulaCloud({ width, height, n, i, animate }: { width: number; height: number; n: SkyTheme['nebulae'][number]; i: number; animate: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!animate) return;
    t.value = withRepeat(withTiming(1, { duration: 18_000 + i * 7_000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [t, i, animate]);
  const dx = (i % 2 ? -1 : 1) * width * 0.06;
  const dy = (i % 2 ? 1 : -1) * height * 0.03;
  const style = useAnimatedStyle(() => ({
    opacity: 0.75 + t.value * 0.25,
    transform: [{ translateX: dx * t.value }, { translateY: dy * t.value }, { scale: 1 + t.value * 0.08 }],
  }));
  const id = `neb${i}`;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, webLayer, style]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id={id} cx={`${n.cx * 100}%`} cy={`${n.cy * 100}%`} rx={`${n.rx * 100}%`} ry={`${n.ry * 100}%`}>
            <Stop offset="0" stopColor={n.color} stopOpacity={n.opacity} />
            <Stop offset="0.5" stopColor={n.color} stopOpacity={n.opacity * 0.3} />
            <Stop offset="1" stopColor={n.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/** Estrella fugaz ocasional. */
function ShootingStar({ width, height, delay, y }: { width: number; height: number; delay: number; y: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withSequence(withDelay(delay, withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) })), withTiming(0, { duration: 0 })), -1, false);
  }, [p, delay]);
  const len = Math.max(120, width * 0.18);
  const style = useAnimatedStyle(() => ({
    opacity: p.value === 0 ? 0 : Math.sin(p.value * Math.PI),
    transform: [{ translateX: width * 0.15 + p.value * width * 0.55 }, { translateY: height * y + p.value * height * 0.18 }, { rotate: '18deg' }],
  }));
  return (
    <Animated.View style={[styles.streak, { width: len }, webLayer, style]}>
      <Svg width={len} height={3}>
        <Defs>
          <LinearGradient id={`streak${delay}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#fff" stopOpacity={0} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0.95} />
          </LinearGradient>
        </Defs>
        <Rect width={len} height={2} rx={1} fill={`url(#streak${delay})`} />
      </Svg>
    </Animated.View>
  );
}

/** Galaxia del día: el disco gira muy despacio en su propio plano (inclinación + rotación). */
function Galaxy({ width, height, theme, layout, animate, wide }: { width: number; height: number; theme: SkyTheme; layout: ReturnType<typeof dailyLayout>; animate: boolean; wide: boolean }) {
  const galaxy = useMemo(() => generateGalaxy(wide ? 900 : 650, { arms: layout.arms, twist: layout.twist, seed: layout.seed }), [layout.arms, layout.twist, layout.seed, wide]);
  const R = (wide ? Math.min(width * 0.36, height * 0.75) : width * 0.78) * layout.scale;
  const size = R * 2.6;
  const half = size / 2;
  const cx = width * (wide ? Math.min(0.72, Math.max(0.42, layout.anchor.x)) : layout.anchor.x);
  const cy = height * layout.anchor.y;
  const spin = useSharedValue(0);
  useEffect(() => {
    if (!animate) return;
    spin.value = withRepeat(withTiming(360, { duration: 900_000, easing: Easing.linear }), -1, false);
  }, [spin, animate]);
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const dustId = (c: string) => `gd${Math.max(0, SOURCE_DUST.indexOf(c))}`;

  return (
    <View style={[styles.galaxy, { left: cx - half, top: cy - half, width: size, height: size, transform: [{ rotate: `${layout.angle}deg` }, { scaleY: 0.46 }] }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="gdisk" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={theme.dust[0]} stopOpacity={0.28} />
            <Stop offset="0.6" stopColor={theme.dust[0]} stopOpacity={0.07} />
            <Stop offset="1" stopColor={theme.dust[0]} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={half} cy={half} r={R * 1.15} fill="url(#gdisk)" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, webLayer, spinStyle]} renderToHardwareTextureAndroid shouldRasterizeIOS>
        <Svg width={size} height={size}>
          <Defs>
            {theme.dust.map((c, i) => (
              <RadialGradient key={i} id={`gd${i}`} cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0" stopColor={c} stopOpacity={1} />
                <Stop offset="1" stopColor={c} stopOpacity={0} />
              </RadialGradient>
            ))}
          </Defs>
          {galaxy.dust.map((d, i) => (
            <Circle key={`d${i}`} cx={half + d.x * R} cy={half + d.y * R} r={d.r * R} fill={`url(#${dustId(d.c)})`} opacity={d.o * 2.2} />
          ))}
          {galaxy.stars.map((s, i) => (
            <Circle key={`s${i}`} cx={half + s.x * R} cy={half + s.y * R} r={s.r * 1.4} fill={s.c} opacity={s.o} />
          ))}
        </Svg>
      </Animated.View>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="gcore" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={theme.core[0]} stopOpacity={0.95} />
            <Stop offset="0.14" stopColor={theme.core[1]} stopOpacity={0.55} />
            <Stop offset="0.45" stopColor={theme.dust[0]} stopOpacity={0.18} />
            <Stop offset="1" stopColor={theme.dust[0]} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={half} cy={half} rx={R * 0.42} ry={R * 0.46} fill="url(#gcore)" />
      </Svg>
    </View>
  );
}

/**
 * Fondo espacial vivo: el cielo cambia con la hora (amanecer, día, atardecer, noche) o con el
 * cielo elegido en Configuración; cada día compone una galaxia distinta que gira despacio, con
 * nebulosas que derivan, estrellas que titilan y alguna estrella fugaz. Todo queda quieto con
 * «reducir movimiento» o con el fondo animado desactivado.
 */
export const SpaceBackground = memo(function SpaceBackground() {
  const { width, height } = useWindowDimensions();
  const wide = width > 900;
  const now = useClock();
  const choice = useAppearance((s) => s.sky);
  const lively = useAppearance((s) => s.livelyBackground);
  const reduced = useReducedMotion();
  const animate = lively && !reduced;
  const theme = resolveSky(choice, now);
  const dayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => dailyLayout(now), [dayKey]);
  const field = wide ? FIELD : FIELD.slice(0, 100);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.sky[2], overflow: 'hidden' }]} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <Animated.View key={theme.id} entering={reduced ? undefined : FadeIn.duration(1600)} style={[StyleSheet.absoluteFill, softFocus]}>
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="sky" x1="0" y1="0" x2="0.3" y2="1">
              <Stop offset="0" stopColor={theme.sky[0]} />
              <Stop offset="0.55" stopColor={theme.sky[1]} />
              <Stop offset="1" stopColor={theme.sky[2]} />
            </LinearGradient>
            <RadialGradient id="halo" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={palette.lavender300} stopOpacity={0.55} />
              <Stop offset="1" stopColor={palette.lavender300} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={width} height={height} fill="url(#sky)" />
          {field.map((s, i) => (
            <G key={i}>
              {s.r > 1 ? <Circle cx={s.x * width} cy={s.y * height} r={s.r * 5} fill="url(#halo)" opacity={0.5} /> : null}
              <Circle cx={s.x * width} cy={s.y * height} r={s.r} fill={palette.white} opacity={s.o} />
            </G>
          ))}
        </Svg>
        {theme.nebulae.map((n, i) => <NebulaCloud key={i} width={width} height={height} n={n} i={i} animate={animate} />)}
        <Galaxy width={width} height={height} theme={theme} layout={layout} animate={animate} wide={wide} />
      </Animated.View>
      <Twinkle width={width} height={height} phase={0} animate={animate} />
      <Twinkle width={width} height={height} phase={1} animate={animate} />
      {animate ? (
        <>
          <ShootingStar width={width} height={height} delay={9_000} y={0.12} />
          <ShootingStar width={width} height={height} delay={23_000} y={0.4} />
        </>
      ) : null}
      {/* Velo y viñeta: oscurecen los bordes para que el contenido resalte sobre la galaxia. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, opacity: wide ? 0.3 : 0.26 }]} />
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="vignette" cx="50%" cy="42%" rx="75%" ry="68%">
            <Stop offset="0.45" stopColor="#05030C" stopOpacity={0} />
            <Stop offset="1" stopColor="#05030C" stopOpacity={0.78} />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#vignette)" />
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  galaxy: { position: 'absolute' },
  streak: { position: 'absolute', left: 0, top: 0, height: 3 },
});
