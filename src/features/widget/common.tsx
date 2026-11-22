import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { palette, userColors, type UserColor } from '@/design/tokens';

export type Hex = `#${string}`;
export type Rgba = `rgba(${number}, ${number}, ${number}, ${number})`;
export const hex = (c: string): Hex => (c.startsWith('#') ? (c as Hex) : (userColors[c as UserColor] ?? palette.violet400) as Hex);

// Fuentes de la app copiadas al APK por el plugin del widget (app.json → fonts).
export const DISPLAY = 'Sora_700Bold';
export const TEXT_MEDIUM = 'PlusJakartaSans_500Medium';
export const TEXT_STRONG = 'PlusJakartaSans_600SemiBold';

/** Texto secundario con más contraste que `mist` sobre el cristal oscuro. */
export const SOFT: Hex = '#D3CAE8';
export const WARM_TEXT: Hex = '#FFC98F';

export const dayLabel = (day: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric' }) => {
  try {
    return new Intl.DateTimeFormat('es', { ...opts, timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
  } catch {
    return day;
  }
};

/**
 * Contenedor común: «cristal» oscuro translúcido (deja ver el fondo de pantalla sin perder
 * contraste) con un filo claro fino. Android no permite desenfoque real en widgets, así que la
 * profundidad viene del degradado y del borde.
 */
export function Shell({ children, pad = 18, uri }: { children: React.ReactNode; pad?: number; uri?: string }) {
  return (
    <FlexWidget
      clickAction={uri ? 'OPEN_URI' : undefined}
      clickActionData={uri ? { uri } : undefined}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        padding: pad,
        borderRadius: 26,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.16)',
        backgroundGradient: { from: 'rgba(52, 34, 92, 0.86)', to: 'rgba(12, 9, 24, 0.92)', orientation: 'TL_BR' },
      }}
    >
      {children}
    </FlexWidget>
  );
}

export function Message({ title, body, uri }: { title: string; body: string; uri?: string }) {
  return (
    <Shell>
      <FlexWidget
        clickAction={uri ? 'OPEN_URI' : 'OPEN_APP'}
        clickActionData={uri ? { uri } : undefined}
        style={{ height: 'match_parent', width: 'match_parent', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flexGap: 6 }}
      >
        <TextWidget text={title} style={{ fontSize: 18, fontFamily: DISPLAY, color: palette.white as Hex, textAlign: 'center' }} />
        <TextWidget text={body} maxLines={3} style={{ fontSize: 13, fontFamily: TEXT_MEDIUM, color: SOFT, textAlign: 'center' }} />
      </FlexWidget>
    </Shell>
  );
}

/** Pastilla pequeña (contador, racha). */
export function Pill({ text, color = palette.white as Hex, bg = 'rgba(255, 255, 255, 0.10)' as Rgba }: { text: string; color?: Hex; bg?: Rgba }) {
  return (
    <FlexWidget style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: bg }}>
      <TextWidget text={text} style={{ fontSize: 13, fontFamily: TEXT_STRONG, color }} />
    </FlexWidget>
  );
}

/** `#RRGGBB` → `rgba(r, g, b, a)` (para halos y fondos teñidos del color del hábito). */
export function tint(color: Hex, alpha: number): Rgba {
  const c = color.replace('#', '');
  const v = (i: number) => parseInt(c.slice(i, i + 2), 16) || 0;
  return `rgba(${v(0)}, ${v(2)}, ${v(4)}, ${alpha})` as Rgba;
}

/**
 * Contenedor «cósmico» del widget Hoy: el degradado violeta → índigo de la tarjeta de la órbita
 * con un filo claro. Es un FlexWidget normal: dentro de un OverlapWidget, la lista se medía mal
 * en el lanzador de Xiaomi (se montaba sobre la cabecera).
 */
export function CosmicShell({ children, pad }: { children: React.ReactNode; pad: number }) {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        padding: pad,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: 'rgba(230, 215, 255, 0.30)',
        backgroundGradient: { from: 'rgba(98, 46, 204, 0.95)', to: 'rgba(32, 46, 138, 0.96)', orientation: 'TL_BR' },
      }}
    >
      {children}
    </FlexWidget>
  );
}
