import { FlexWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import { palette } from '@/design/tokens';
import { MAP_WEEKS, type HeatDay } from '@/domain/widget/today';

import { DISPLAY, type Hex, Message, Pill, Shell, SOFT, TEXT_MEDIUM, TEXT_STRONG, WARM_TEXT } from './common';
import { barSvg, heatmapSvg, iconSvg, legendSvg, ringSvg, type IconName } from './svg';

export const ORBIT_WIDGET = 'Orbita';
export const STREAK_MAP_WIDGET = 'Constancia';
export const FOCUS_WIDGET = 'Enfoque';
export const QUICK_WIDGET = 'Accesos';

const pct = (p: number) => `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
const signedOut = <Message title="Nebula" body="Abre la app e inicia sesión." />;

/* ─────────────── Órbita (2 × 2): anillo del día + semana y mes ─────────────── */

export interface OrbitWidgetData {
  day: { done: number; total: number; progress: number };
  week: { progress: number; remaining: number; elapsed: number };
  month: { progress: number; remaining: number; elapsed: number };
  streak: number;
}

function MiniBar({ label, progress, width }: { label: string; progress: number; width: number }) {
  return (
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'column', flexGap: 4 }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row' }}>
        <TextWidget text={label} style={{ fontSize: 12, fontFamily: TEXT_MEDIUM, color: SOFT }} />
        <FlexWidget style={{ flex: 1 }} />
        <TextWidget text={pct(progress)} style={{ fontSize: 12, fontFamily: TEXT_STRONG, color: palette.white as Hex }} />
      </FlexWidget>
      <SvgWidget svg={barSvg(width, 6, progress)} style={{ width, height: 6 }} />
    </FlexWidget>
  );
}

function Ring({ size, progress, caption }: { size: number; progress: number; caption: string }) {
  return (
    <OverlapWidget style={{ width: size, height: size }}>
      <SvgWidget svg={ringSvg(size, Math.max(7, Math.round(size / 11)), progress)} style={{ width: size, height: size }} />
      <FlexWidget style={{ width: size, height: size, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <TextWidget text={pct(progress)} style={{ fontSize: Math.round(size / 4.2), fontFamily: DISPLAY, color: palette.white as Hex }} />
        <TextWidget text={caption} style={{ fontSize: 11, fontFamily: TEXT_MEDIUM, color: SOFT }} />
      </FlexWidget>
    </OverlapWidget>
  );
}

export function OrbitWidget({ data, width, height }: { data: OrbitWidgetData | null; width: number; height: number }) {
  if (!data) return signedOut;
  const pad = 14;
  const inner = { w: width - pad * 2, h: height - pad * 2 };
  // Ancho (≥ 3 celdas): anillo a la izquierda y barras de semana y mes a la derecha.
  if (inner.w >= 220) {
    const ring = Math.min(inner.h, Math.round(inner.w * 0.42));
    const barW = inner.w - ring - 16;
    return (
      <Shell pad={pad} uri="nebula://hoy">
        <FlexWidget style={{ width: 'match_parent', height: 'match_parent', flexDirection: 'row', alignItems: 'center', flexGap: 16 }}>
          <Ring size={ring} progress={data.day.progress} caption="hoy" />
          <FlexWidget style={{ flex: 1, flexDirection: 'column', flexGap: 10 }}>
            <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 6 }}>
              <TextWidget text={`${data.day.done}/${data.day.total} hábitos`} style={{ fontSize: 14, fontFamily: TEXT_STRONG, color: palette.white as Hex }} />
              {data.streak >= 2 ? <TextWidget text={`🔥 ${data.streak}`} style={{ fontSize: 13, fontFamily: TEXT_STRONG, color: WARM_TEXT }} /> : null}
            </FlexWidget>
            <MiniBar label="Semana" progress={data.week.progress} width={barW} />
            <MiniBar label="Mes" progress={data.month.progress} width={barW} />
          </FlexWidget>
        </FlexWidget>
      </Shell>
    );
  }
  // Compacto (2 × 2): anillo grande y una línea con semana y mes.
  const footer = inner.h >= 150 ? 34 : 18;
  const ring = Math.max(56, Math.min(inner.w, inner.h - footer - 6));
  return (
    <Shell pad={pad} uri="nebula://hoy">
      <FlexWidget style={{ width: 'match_parent', height: 'match_parent', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGap: 6 }}>
        <Ring size={ring} progress={data.day.progress} caption={data.streak >= 2 ? `🔥 ${data.streak}` : `${data.day.done}/${data.day.total}`} />
        {inner.h >= 150 ? (
          <FlexWidget style={{ flexDirection: 'column', alignItems: 'center' }}>
            <TextWidget text={`Semana ${pct(data.week.progress)}`} style={{ fontSize: 12, fontFamily: TEXT_STRONG, color: palette.white as Hex }} />
            <TextWidget text={`Mes ${pct(data.month.progress)}`} style={{ fontSize: 12, fontFamily: TEXT_MEDIUM, color: SOFT }} />
          </FlexWidget>
        ) : (
          <TextWidget text={`S ${pct(data.week.progress)} · M ${pct(data.month.progress)}`} style={{ fontSize: 12, fontFamily: TEXT_STRONG, color: SOFT }} />
        )}
      </FlexWidget>
    </Shell>
  );
}

/* ─────────────── Constancia (4 × 2): mapa de calor de las últimas semanas ─────────────── */

const LABELS_W = 14;
const SIDE_W = 92;

/**
 * Tamaño de celda y semanas que caben (máx. MAP_WEEKS: lo que guarda la instantánea). Con
 * anchura suficiente, el resumen va en una columna a la derecha para no dejar huecos.
 */
export function heatmapLayout(width: number, height: number): { cell: number; gap: number; weeks: number; side: boolean } {
  const gap = 3;
  const side = width >= 280;
  const gridH = height - 18 * 2 - 26 - 10 - (side ? 0 : 18);
  const cell = Math.max(8, Math.min(20, Math.floor((gridH - 6 * gap) / 7)));
  const gridArea = width - 36 - LABELS_W - 4 - (side ? SIDE_W + 12 : 0);
  const weeks = Math.max(4, Math.min(MAP_WEEKS, Math.floor((gridArea + gap) / (cell + gap))));
  return { cell, gap, weeks, side };
}

/** Iniciales de los días, en el orden de la semana del usuario. */
const INITIALS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

function Legend() {
  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 5 }}>
      <TextWidget text="menos" style={{ fontSize: 10, fontFamily: TEXT_MEDIUM, color: palette.dusk as Hex }} />
      <SvgWidget svg={legendSvg(9, 2)} style={{ width: 53, height: 9 }} />
      <TextWidget text="más" style={{ fontSize: 10, fontFamily: TEXT_MEDIUM, color: palette.dusk as Hex }} />
    </FlexWidget>
  );
}

export function StreakMapWidget({ data, width, height }: { data: { today: string; days: HeatDay[]; perfect: number; weekStartsOn: number } | null; width: number; height: number }) {
  if (!data) return signedOut;
  const { cell, gap, side } = heatmapLayout(width, height);
  const weeks = Math.ceil(data.days.length / 7);
  const gridW = weeks * cell + (weeks - 1) * gap;
  const gridH = 7 * cell + 6 * gap;
  const tracked = data.days.filter((d) => !d.future && d.ratio !== null);
  const full = tracked.filter((d) => (d.ratio ?? 0) >= 1).length;
  const share = tracked.length ? Math.round((full / tracked.length) * 100) : 0;
  const labels = (
    <FlexWidget style={{ width: LABELS_W, height: gridH, flexDirection: 'column' }}>
      {Array.from({ length: 7 }, (_, i) => (
        <FlexWidget key={i} style={{ width: LABELS_W, height: cell + (i < 6 ? gap : 0), justifyContent: 'center' }}>
          {/* Solo lunes, miércoles y viernes (o equivalentes): así no se amontonan. */}
          {i % 2 === 0 ? <TextWidget text={INITIALS[(data.weekStartsOn + i) % 7]!} style={{ fontSize: Math.min(10, cell), fontFamily: TEXT_MEDIUM, color: palette.dusk as Hex }} /> : null}
        </FlexWidget>
      ))}
    </FlexWidget>
  );
  return (
    <Shell uri="nebula://estadisticas">
      <FlexWidget style={{ width: 'match_parent', height: 26, flexDirection: 'row', alignItems: 'center' }}>
        <TextWidget text="Constancia" style={{ fontSize: 17, fontFamily: DISPLAY, color: palette.white as Hex }} />
        <FlexWidget style={{ flex: 1 }} />
        {data.perfect >= 1 ? <Pill text={`🔥 ${data.perfect} ${data.perfect === 1 ? 'día perfecto' : 'días perfectos'}`} color={WARM_TEXT} bg="rgba(255, 150, 90, 0.16)" /> : null}
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', height: 10 }} />
      <FlexWidget style={{ width: 'match_parent', flex: 1, flexDirection: 'row', alignItems: 'center', flexGap: 4 }}>
        {labels}
        <SvgWidget svg={heatmapSvg(data.days, data.today, cell, gap)} style={{ width: gridW, height: gridH }} />
        {side ? (
          <FlexWidget style={{ flex: 1, height: gridH, marginLeft: 8, flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', flexGap: 2 }}>
            <TextWidget text={`${share}%`} style={{ fontSize: 26, fontFamily: DISPLAY, color: palette.white as Hex }} />
            <TextWidget text={`${full} de ${tracked.length} días`} style={{ fontSize: 11, fontFamily: TEXT_MEDIUM, color: SOFT }} />
            <TextWidget text="completos" style={{ fontSize: 11, fontFamily: TEXT_MEDIUM, color: SOFT }} />
            <FlexWidget style={{ height: 8 }} />
            <Legend />
          </FlexWidget>
        ) : null}
      </FlexWidget>
      {side ? null : (
        <FlexWidget style={{ width: 'match_parent', height: 18, flexDirection: 'row', alignItems: 'flex-end' }}>
          <TextWidget text={`${full} de ${tracked.length} días completos`} style={{ fontSize: 11, fontFamily: TEXT_MEDIUM, color: SOFT }} />
          <FlexWidget style={{ flex: 1 }} />
          <Legend />
        </FlexWidget>
      )}
    </Shell>
  );
}

/* ─────────────── Enfoque (2 × 2): empezar un bloque con un toque ─────────────── */

function FocusChip({ label, uri, strong }: { label: string; uri: string; strong?: boolean }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      style={{ flex: 1, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: strong ? 'rgba(255, 179, 122, 0.95)' : 'rgba(255, 255, 255, 0.10)' }}
    >
      <TextWidget text={label} style={{ fontSize: 14, fontFamily: TEXT_STRONG, color: (strong ? '#2A1606' : palette.white) as Hex }} />
    </FlexWidget>
  );
}

export function FocusWidget({ data, height }: { data: { suggestion: { habitId: string; name: string; leftMinutes: number } | null } | null; height: number }) {
  if (!data) return signedOut;
  const s = data.suggestion;
  const roomy = height >= 160;
  return (
    <Shell pad={14}>
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: s ? `nebula://enfoque?habito=${s.habitId}` : 'nebula://enfoque' }} style={{ width: 'match_parent', flex: 1, flexDirection: 'row', alignItems: 'center', flexGap: 12 }}>
        <FlexWidget style={{ width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255, 179, 122, 0.18)' }}>
          <SvgWidget svg={iconSvg(s ? 'play' : 'timer', '#FFB37A', 20)} style={{ width: 20, height: 20 }} />
        </FlexWidget>
        <FlexWidget style={{ flex: 1, flexDirection: 'column', flexGap: 2 }}>
          <TextWidget text={s ? s.name : 'Enfoque'} maxLines={2} truncate="END" style={{ fontSize: 15, fontFamily: TEXT_STRONG, color: palette.white as Hex }} />
          <TextWidget text={s ? `faltan ${s.leftMinutes} min hoy` : 'un bloque sin distracciones'} maxLines={1} style={{ fontSize: 12, fontFamily: TEXT_MEDIUM, color: SOFT }} />
        </FlexWidget>
      </FlexWidget>
      {roomy ? <FlexWidget style={{ width: 'match_parent', height: 10 }} /> : null}
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', flexGap: 8 }}>
        {s ? <FocusChip label={`${Math.min(120, s.leftMinutes)}′`} uri={`nebula://enfoque?habito=${s.habitId}&min=${Math.min(120, s.leftMinutes)}`} strong /> : <FocusChip label="25′" uri="nebula://enfoque?min=25" strong />}
        <FocusChip label={s ? '25′' : '50′'} uri={`nebula://enfoque?min=${s ? 25 : 50}`} />
      </FlexWidget>
    </Shell>
  );
}

/* ─────────────── Accesos (4 × 1): capturar, enfocar, planificar, diario ─────────────── */

const QUICK: { label: string; icon: IconName; uri: string; color: string }[] = [
  { label: 'Capturar', icon: 'plus', uri: 'nebula://captura', color: '#C7A9FF' },
  { label: 'Enfoque', icon: 'timer', uri: 'nebula://enfoque', color: '#FFB37A' },
  { label: 'Planificar', icon: 'calendar', uri: 'nebula://planificar', color: '#7CD4E8' },
  { label: 'Diario', icon: 'book', uri: 'nebula://diario', color: '#6FD6A0' },
];

export function QuickWidget({ height }: { height: number }) {
  const withLabels = height >= 64;
  return (
    <Shell pad={8}>
      <FlexWidget style={{ width: 'match_parent', height: 'match_parent', flexDirection: 'row', flexGap: 6 }}>
        {QUICK.map((q) => (
          <FlexWidget
            key={q.uri}
            clickAction="OPEN_URI"
            clickActionData={{ uri: q.uri }}
            style={{ flex: 1, height: 'match_parent', borderRadius: 18, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flexGap: 3, backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
          >
            <SvgWidget svg={iconSvg(q.icon, q.color, 22)} style={{ width: 22, height: 22 }} />
            {withLabels ? <TextWidget text={q.label} style={{ fontSize: 11, fontFamily: TEXT_STRONG, color: SOFT }} /> : null}
          </FlexWidget>
        ))}
      </FlexWidget>
    </Shell>
  );
}
