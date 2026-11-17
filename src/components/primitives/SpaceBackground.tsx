import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { generateGalaxy } from '@/design/galaxy';
import { generateStars } from '@/design/starfield';
import { colors, palette } from '@/design/tokens';

const FIELD = generateStars(140, 11);
const GALAXY = generateGalaxy(900);
const SPARKLES = generateStars(16, 5);
const DUST_ID: Record<string, string> = { [palette.violet400]: 'dustViolet', '#E58FD0': 'dustRose', [palette.cyan400]: 'dustCyan' };

/** Destello de cuatro puntas centrado en (x, y). */
const sparkle = (x: number, y: number, s: number) =>
  `M${x} ${y - s} Q${x + s * 0.12} ${y - s * 0.12} ${x + s} ${y} Q${x + s * 0.12} ${y + s * 0.12} ${x} ${y + s} Q${x - s * 0.12} ${y + s * 0.12} ${x - s} ${y} Q${x - s * 0.12} ${y - s * 0.12} ${x} ${y - s}Z`;

function Twinkle({ width, height, phase }: { width: number; height: number; phase: 0 | 1 }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(phase ? 1 : 0.35);
  useEffect(() => {
    if (reduced) return;
    o.value = withRepeat(withTiming(phase ? 0.3 : 1, { duration: 2600 + phase * 900 }), -1, true);
  }, [o, phase, reduced]);
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

/**
 * Fondo espacial: nebulosas de color, una galaxia espiral con brazos de polvo y estrellas, campo
 * de estrellas con halos y destellos que titilan despacio (estáticos con «reducir movimiento»).
 */
export const SpaceBackground = memo(function SpaceBackground() {
  const { width, height } = useWindowDimensions();
  const wide = width > 900;
  const g = useMemo(() => {
    // Móvil: galaxia grande arriba a la derecha. Escritorio: más centrada, detrás del contenido.
    const cx = width * (wide ? 0.66 : 0.7);
    const cy = height * (wide ? 0.38 : 0.2);
    const R = wide ? Math.min(width * 0.36, height * 0.75) : width * 0.78;
    const tilt = 0.46;
    const rot = (-28 * Math.PI) / 180;
    const map = (x: number, y: number) => {
      const py = y * tilt;
      return { X: cx + R * (x * Math.cos(rot) - py * Math.sin(rot)), Y: cy + R * (x * Math.sin(rot) + py * Math.cos(rot)) };
    };
    return {
      cx, cy, R, tilt, deg: -28,
      stars: GALAXY.stars.map((s) => ({ ...map(s.x, s.y), r: s.r, o: s.o, c: s.c })),
      dust: GALAXY.dust.map((s) => ({ ...map(s.x, s.y), r: s.r * R, o: s.o, id: DUST_ID[s.c] ?? 'dustViolet' })),
    };
  }, [width, height, wide]);
  const field = wide ? FIELD : FIELD.slice(0, 90);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#120C24" />
            <Stop offset="0.55" stopColor={colors.bg} />
            <Stop offset="1" stopColor="#07060F" />
          </LinearGradient>
          <RadialGradient id="nebViolet" cx="80%" cy="10%" rx="75%" ry="50%">
            <Stop offset="0" stopColor={palette.violet500} stopOpacity={0.42} />
            <Stop offset="0.5" stopColor={palette.violet500} stopOpacity={0.12} />
            <Stop offset="1" stopColor={palette.violet500} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="nebRose" cx="8%" cy="55%" rx="55%" ry="38%">
            <Stop offset="0" stopColor="#C04FA8" stopOpacity={0.22} />
            <Stop offset="1" stopColor="#C04FA8" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="nebCyan" cx="35%" cy="100%" rx="70%" ry="40%">
            <Stop offset="0" stopColor={palette.cyan400} stopOpacity={0.16} />
            <Stop offset="1" stopColor={palette.cyan400} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="core" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor="#FFF6E8" stopOpacity={0.95} />
            <Stop offset="0.12" stopColor="#FFE1B8" stopOpacity={0.6} />
            <Stop offset="0.4" stopColor={palette.lavender300} stopOpacity={0.22} />
            <Stop offset="1" stopColor={palette.violet500} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="disk" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={palette.violet400} stopOpacity={0.26} />
            <Stop offset="0.6" stopColor={palette.violet500} stopOpacity={0.08} />
            <Stop offset="1" stopColor={palette.violet500} stopOpacity={0} />
          </RadialGradient>
          {([['dustViolet', palette.violet400], ['dustRose', '#E58FD0'], ['dustCyan', palette.cyan400]] as const).map(([id, c]) => (
            <RadialGradient key={id} id={id} cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={c} stopOpacity={1} />
              <Stop offset="1" stopColor={c} stopOpacity={0} />
            </RadialGradient>
          ))}
          <RadialGradient id="halo" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={palette.lavender300} stopOpacity={0.55} />
            <Stop offset="1" stopColor={palette.lavender300} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#sky)" />
        <Rect width={width} height={height} fill="url(#nebViolet)" />
        <Rect width={width} height={height} fill="url(#nebRose)" />
        <Rect width={width} height={height} fill="url(#nebCyan)" />

        {field.map((s, i) => (
          <G key={i}>
            {s.r > 1 ? <Circle cx={s.x * width} cy={s.y * height} r={s.r * 5} fill="url(#halo)" opacity={0.5} /> : null}
            <Circle cx={s.x * width} cy={s.y * height} r={s.r} fill={palette.white} opacity={s.o} />
          </G>
        ))}

        {/* Galaxia lejana pequeña. */}
        <G rotation={22} origin={`${width * 0.14}, ${height * 0.8}`}>
          <Ellipse cx={width * 0.14} cy={height * 0.8} rx={wide ? 70 : 44} ry={wide ? 18 : 12} fill="url(#disk)" />
          <Ellipse cx={width * 0.14} cy={height * 0.8} rx={wide ? 14 : 9} ry={wide ? 5 : 3.5} fill="url(#core)" opacity={0.7} />
        </G>

        {/* Galaxia principal: disco, polvo de los brazos, estrellas y núcleo. */}
        <G rotation={g.deg} origin={`${g.cx}, ${g.cy}`}>
          <Ellipse cx={g.cx} cy={g.cy} rx={g.R * 1.15} ry={g.R * 1.15 * g.tilt} fill="url(#disk)" />
        </G>
        {g.dust.map((d, i) => (
          <Circle key={`d${i}`} cx={d.X} cy={d.Y} r={d.r} fill={`url(#${d.id})`} opacity={d.o * 2.2} />
        ))}
        {g.stars.map((s, i) => (
          <Circle key={`s${i}`} cx={s.X} cy={s.Y} r={s.r} fill={s.c} opacity={s.o} />
        ))}
        <G rotation={g.deg} origin={`${g.cx}, ${g.cy}`}>
          <Ellipse cx={g.cx} cy={g.cy} rx={g.R * 0.42} ry={g.R * 0.42 * g.tilt * 1.1} fill="url(#core)" />
        </G>
        {/* Velo inferior: mantiene el contenido legible sobre la galaxia. */}
        <Rect width={width} height={height} fill={colors.bg} opacity={wide ? 0.18 : 0.12} />
      </Svg>
      <Twinkle width={width} height={height} phase={0} />
      <Twinkle width={width} height={height} phase={1} />
    </View>
  );
});
