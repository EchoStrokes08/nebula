/**
 * Cielos de Nebula: el fondo cambia con la hora del día (amanecer, día, atardecer, noche) y cada
 * día compone una galaxia distinta (brazos, giro, posición), de forma determinista.
 */
import { palette } from '@/design/tokens';

export type SkyId = 'aurora' | 'azur' | 'ocaso' | 'nebulosa' | 'boreal';
export type SkyChoice = 'auto' | SkyId;

export interface Nebula { color: string; cx: number; cy: number; rx: number; ry: number; opacity: number }
export interface SkyTheme {
  id: SkyId;
  name: string;
  description: string;
  sky: readonly [string, string, string];
  nebulae: Nebula[];
  dust: readonly [string, string, string];
  core: readonly [string, string];
}

export const skies: Record<SkyId, SkyTheme> = {
  aurora: {
    id: 'aurora', name: 'Amanecer', description: 'Rosas y dorados suaves',
    sky: ['#1E1030', '#120B22', '#08060F'],
    nebulae: [
      { color: '#E58FD0', cx: 0.85, cy: 0.08, rx: 0.8, ry: 0.5, opacity: 0.36 },
      { color: '#F2B866', cx: 0.1, cy: 0.18, rx: 0.6, ry: 0.35, opacity: 0.2 },
      { color: palette.violet500, cx: 0.3, cy: 0.95, rx: 0.8, ry: 0.4, opacity: 0.22 },
    ],
    dust: ['#E58FD0', '#F2B866', palette.lavender300],
    core: ['#FFF1E0', '#FFC9A8'],
  },
  azur: {
    id: 'azur', name: 'Día', description: 'Azules claros y cian',
    sky: ['#0E1A38', '#0B1026', '#070912'],
    nebulae: [
      { color: '#8FB4FF', cx: 0.8, cy: 0.06, rx: 0.85, ry: 0.5, opacity: 0.36 },
      { color: palette.cyan400, cx: 0.05, cy: 0.5, rx: 0.55, ry: 0.4, opacity: 0.2 },
      { color: palette.violet500, cx: 0.5, cy: 1, rx: 0.8, ry: 0.4, opacity: 0.2 },
    ],
    dust: [palette.cyan400, '#8FB4FF', palette.violet400],
    core: ['#F2FBFF', '#BDE6FF'],
  },
  ocaso: {
    id: 'ocaso', name: 'Atardecer', description: 'Magentas y corales',
    sky: ['#24102A', '#160B1E', '#09060E'],
    nebulae: [
      { color: '#C04FA8', cx: 0.82, cy: 0.1, rx: 0.8, ry: 0.5, opacity: 0.42 },
      { color: palette.red400, cx: 0.08, cy: 0.42, rx: 0.55, ry: 0.38, opacity: 0.22 },
      { color: '#F2B866', cx: 0.6, cy: 1, rx: 0.7, ry: 0.35, opacity: 0.14 },
    ],
    dust: ['#E58FD0', palette.red400, '#F2B866'],
    core: ['#FFF0E6', '#FFB89C'],
  },
  nebulosa: {
    id: 'nebulosa', name: 'Noche', description: 'Violeta profundo, el clásico',
    sky: ['#120C24', palette.space950, '#07060F'],
    nebulae: [
      { color: palette.violet500, cx: 0.8, cy: 0.1, rx: 0.75, ry: 0.5, opacity: 0.42 },
      { color: '#C04FA8', cx: 0.08, cy: 0.55, rx: 0.55, ry: 0.38, opacity: 0.22 },
      { color: palette.cyan400, cx: 0.35, cy: 1, rx: 0.7, ry: 0.4, opacity: 0.16 },
    ],
    dust: [palette.violet400, '#E58FD0', palette.cyan400],
    core: ['#FFF6E8', '#FFE1B8'],
  },
  boreal: {
    id: 'boreal', name: 'Boreal', description: 'Verdes de aurora polar',
    sky: ['#081A1F', '#08111A', '#05070D'],
    nebulae: [
      { color: palette.green400, cx: 0.75, cy: 0.05, rx: 0.85, ry: 0.4, opacity: 0.3 },
      { color: palette.cyan400, cx: 0.15, cy: 0.3, rx: 0.6, ry: 0.4, opacity: 0.22 },
      { color: palette.violet500, cx: 0.5, cy: 1, rx: 0.8, ry: 0.4, opacity: 0.24 },
    ],
    dust: [palette.green400, palette.cyan400, palette.violet400],
    core: ['#F0FFF8', '#B8F5DA'],
  },
};
export const skyList = Object.values(skies);

/** Cielo automático según la hora local. */
export function skyForHour(hour: number): SkyId {
  if (hour >= 6 && hour < 10) return 'aurora';
  if (hour >= 10 && hour < 18) return 'azur';
  if (hour >= 18 && hour < 21) return 'ocaso';
  return 'nebulosa';
}

export function resolveSky(choice: SkyChoice, now: Date): SkyTheme {
  return skies[choice === 'auto' ? skyForHour(now.getHours()) : choice];
}

/** Composición del día: misma fecha → misma galaxia. */
export function dailyLayout(now: Date) {
  const seed = now.getFullYear() * 400 + now.getMonth() * 32 + now.getDate();
  const r = (n: number) => {
    const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const anchors = [
    { x: 0.7, y: 0.2 },
    { x: 0.3, y: 0.18 },
    { x: 0.72, y: 0.62 },
    { x: 0.5, y: 0.28 },
  ] as const;
  return {
    seed,
    arms: 2 + Math.floor(r(1) * 3),
    twist: 2.6 + r(2) * 1.8,
    anchor: anchors[Math.floor(r(3) * anchors.length)]!,
    angle: -40 + r(4) * 60,
    scale: 0.85 + r(5) * 0.3,
  };
}
