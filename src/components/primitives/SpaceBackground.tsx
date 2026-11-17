import { memo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { generateStars } from '@/design/starfield';
import { colors, palette } from '@/design/tokens';

const STARS = generateStars(90, 11);

/**
 * Fondo espacial: gradiente oscuro, dos nebulosas abstractas de baja opacidad y estrellas
 * dispersas. Es estático (no consume batería) y se dibuja detrás de todo el contenido.
 */
export const SpaceBackground = memo(function SpaceBackground() {
  const { width, height } = useWindowDimensions();
  // En pantallas grandes se reduce la densidad para que no parezca ruido.
  const visible = width > 900 ? STARS : STARS.slice(0, 60);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="nebulaA" cx="85%" cy="-5%" rx="70%" ry="45%">
            <Stop offset="0" stopColor={palette.violet500} stopOpacity={0.28} />
            <Stop offset="0.55" stopColor={palette.violet500} stopOpacity={0.07} />
            <Stop offset="1" stopColor={palette.violet500} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="nebulaB" cx="0%" cy="100%" rx="60%" ry="40%">
            <Stop offset="0" stopColor={palette.cyan400} stopOpacity={0.07} />
            <Stop offset="1" stopColor={palette.cyan400} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill={colors.bg} />
        <Rect width={width} height={height} fill="url(#nebulaA)" />
        <Rect width={width} height={height} fill="url(#nebulaB)" />
        {visible.map((s, i) => (
          <Circle key={i} cx={s.x * width} cy={s.y * height} r={s.r} fill={palette.white} opacity={s.o} />
        ))}
      </Svg>
    </View>
  );
});
