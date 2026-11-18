/**
 * Tokens de diseño de Nebula — «Cosmic Minimalism».
 * Toda la UI debe consumir estos valores; no se escriben colores ni medidas sueltas en pantallas.
 */

export const palette = {
  space950: '#0B0815', // fondo espacial principal
  space900: '#100D1C', // fondo alternativo (PDF)
  space800: '#171126', // superficie primaria
  space700: '#251B39', // superficie elevada
  space600: '#33274D', // bordes fuertes / pistas
  violet500: '#8055E8', // violeta principal
  violet400: '#A987FF', // violeta brillante
  lavender300: '#C7A9FF', // lavanda
  white: '#F7F4FF', // texto principal
  mist: '#B5AAC8', // texto secundario
  dusk: '#8A7FA0', // texto terciario
  cyan400: '#7CD4E8', // información secundaria
  green400: '#6FD6A0', // estados positivos
  amber400: '#F2B866', // advertencias
  red400: '#F07A8A', // errores
} as const;

export const colors = {
  bg: palette.space950,
  bgAlt: palette.space900,
  surface: palette.space800,
  surfaceRaised: palette.space700,
  surfacePressed: '#2E2245',
  surfaceDisabled: '#1A1428',
  overlay: 'rgba(6, 4, 12, 0.72)',
  glass: 'rgba(37, 27, 57, 0.62)',
  // Tarjetas translúcidas: dejan intuir la galaxia sin comprometer el contraste del texto.
  card: 'rgba(24, 18, 42, 0.80)',
  cardRaised: 'rgba(40, 30, 64, 0.86)',
  cardHighlight: 'rgba(199, 169, 255, 0.28)',

  border: 'rgba(199, 169, 255, 0.10)',
  borderStrong: 'rgba(199, 169, 255, 0.22)',
  borderFocus: palette.violet400,

  text: palette.white,
  textSecondary: palette.mist,
  textTertiary: palette.dusk,
  textDisabled: '#6B6280',
  textOnAccent: '#FFFFFF',

  accent: palette.violet500,
  accentBright: palette.violet400,
  accentSoft: palette.lavender300,
  accentMuted: 'rgba(128, 85, 232, 0.16)',
  accentPressed: '#6D45D6',

  info: palette.cyan400,
  infoMuted: 'rgba(124, 212, 232, 0.14)',
  success: palette.green400,
  successMuted: 'rgba(111, 214, 160, 0.14)',
  warning: palette.amber400,
  warningMuted: 'rgba(242, 184, 102, 0.14)',
  danger: palette.red400,
  dangerMuted: 'rgba(240, 122, 138, 0.14)',

  track: 'rgba(199, 169, 255, 0.10)',
} as const;

/** Serie categórica para gráficos: violetas primero, acentos controlados después. */
export const chartColors = [
  palette.violet400,
  palette.cyan400,
  palette.lavender300,
  palette.green400,
  palette.amber400,
  '#E58FD0',
] as const;

/** Colores que el usuario puede asignar a hábitos/metas (todos legibles sobre superficie). */
export const userColors = {
  violet: palette.violet400,
  lavender: palette.lavender300,
  cyan: palette.cyan400,
  green: palette.green400,
  amber: palette.amber400,
  rose: '#E58FD0',
  coral: palette.red400,
  sky: '#8FB4FF',
} as const;
export type UserColor = keyof typeof userColors;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

/**
 * Plus Jakarta Sans para lectura (geométrica, cálida y muy legible en tamaños pequeños) y Sora para
 * titulares y cifras: le da a Nebula una voz propia, redondeada y algo «espacial».
 */
export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  display: 'Sora_600SemiBold',
  displayBold: 'Sora_700Bold',
  displayLight: 'Sora_300Light',
} as const;

export const typography = {
  hero: { fontFamily: fontFamily.displayLight, fontSize: 40, lineHeight: 46, letterSpacing: -1.2 },
  display: { fontFamily: fontFamily.displayBold, fontSize: 34, lineHeight: 40, letterSpacing: -1 },
  title1: { fontFamily: fontFamily.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.6 },
  title2: { fontFamily: fontFamily.display, fontSize: 20, lineHeight: 26, letterSpacing: -0.4 },
  title3: { fontFamily: fontFamily.display, fontSize: 16, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  bodyStrong: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  callout: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  caption: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
  overline: { fontFamily: fontFamily.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.4 },
  metric: { fontFamily: fontFamily.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.8 },
} as const;
export type TypographyVariant = keyof typeof typography;

export const elevation = {
  none: {},
  low: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  high: {
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  glow: {
    shadowColor: palette.violet500,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
} as const;

export const gradients = {
  accent: [palette.violet500, palette.violet400] as const,
  button: ['#7A4DE6', '#9B6BFF', '#B86BE0'] as const,
  ambient: ['rgba(128, 85, 232, 0.22)', 'rgba(128, 85, 232, 0)'] as const,
  space: [palette.space950, palette.space900, palette.space950] as const,
  card: ['rgba(46, 34, 76, 0.82)', 'rgba(20, 15, 36, 0.86)'] as const,
  cardRaised: ['rgba(64, 46, 104, 0.88)', 'rgba(30, 22, 52, 0.9)'] as const,
  hero: ['rgba(128, 85, 232, 0.55)', 'rgba(192, 79, 168, 0.32)', 'rgba(24, 18, 42, 0.85)'] as const,
  aurora: [palette.violet400, '#E58FD0', palette.cyan400] as const,
};

export const motion = {
  fast: 150,
  base: 220,
  slow: 350,
} as const;

/** Tamaño mínimo de área táctil (pt). */
export const hitTarget = 44;
