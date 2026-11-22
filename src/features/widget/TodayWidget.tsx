import { FlexWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import { palette } from '@/design/tokens';
import type { WidgetItem } from '@/domain/widget/today';

import { CosmicShell, DISPLAY, dayLabel, hex, type Hex, Message, SOFT, TEXT_MEDIUM, TEXT_STRONG, tint, WARM_TEXT } from './common';
import { ringSvg, rowIconSvg } from './svg';

export const TODAY_WIDGET = 'Hoy';
export const TOGGLE_ACTION = 'TOGGLE_HABIT';

const PAD = 16;
const HEADER = 52;
const GAP_TOP = 10;
const RING = 50;
const ICON = 26;
const HALO = 36;
const ICON_GAP = 12;
/** Separación entre tarjetas y relleno lateral de cada tarjeta. */
const CARD_GAP = 6;
const CARD_PAD = 10;
/** Alto del botón «Ver N más» (con su separación). */
const MORE = 30;

export type TodayWidgetProps =
  | { state: 'signedOut' }
  | { state: 'ready'; today: string; items: WidgetItem[]; done: number; width: number; height: number };

/** Caracteres de título que caben por línea (aprox. para Plus Jakarta 15 sp). */
const charsPerLine = (width: number, streak: boolean) => Math.max(10, Math.floor((width - PAD * 2 - CARD_PAD * 2 - HALO - ICON_GAP - (streak ? 46 : 0)) / 7.8));

/** Alto de una fila (tarjeta + separación): el título puede ocupar dos líneas y el detalle una más. */
export function rowHeight(item: WidgetItem, width: number): number {
  const lines = item.name.length > charsPerLine(width, item.streak >= 2) ? 2 : 1;
  // Mínimo 46 dp de tarjeta: área de toque cómoda aunque el título sea corto.
  return Math.max(46, 12 + lines * 20 + (item.detail ? 17 : 0)) + CARD_GAP;
}

/** Cuántas filas se ven sin desplazar con el alto disponible para la lista. */
export function visibleRows(items: WidgetItem[], width: number, listHeight: number): number {
  let used = 0;
  let n = 0;
  for (const it of items) {
    used += rowHeight(it, width);
    if (used > listHeight + CARD_GAP + 2) break;
    n += 1;
  }
  return n;
}

function Row({ item, width }: { item: WidgetItem; width: number }) {
  const color = hex(item.color);
  const click = item.toggleable
    ? { clickAction: TOGGLE_ACTION, clickActionData: { habitId: item.id } }
    : { clickAction: 'OPEN_URI', clickActionData: { uri: `nebula://habito/${item.id}` } };
  const h = rowHeight(item, width);
  return (
    <FlexWidget style={{ width: 'match_parent', height: h, flexDirection: 'column' }}>
      <FlexWidget
        {...click}
        style={{
          width: 'match_parent',
          height: h - CARD_GAP,
          flexDirection: 'row',
          alignItems: 'center',
          flexGap: ICON_GAP,
          paddingHorizontal: CARD_PAD,
          borderRadius: 16,
          backgroundColor: item.done ? 'rgba(10, 6, 24, 0.14)' : 'rgba(10, 6, 24, 0.30)',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.08)',
        }}
      >
        {/* Halo del color del hábito: se reconoce de un vistazo. */}
        <FlexWidget style={{ width: HALO, height: HALO, borderRadius: HALO / 2, backgroundColor: tint(color, item.done ? 0.3 : 0.18), justifyContent: 'center', alignItems: 'center' }}>
          <SvgWidget svg={rowIconSvg(item.toggleable ? 'check' : 'ring', color, item.done, item.progress)} style={{ width: ICON, height: ICON }} />
        </FlexWidget>
        <FlexWidget style={{ flex: 1, flexDirection: 'column', flexGap: 1 }}>
          <TextWidget
            text={item.name}
            maxLines={2}
            truncate="END"
            style={{ fontSize: 15, fontFamily: TEXT_STRONG, color: item.done ? 'rgba(245, 238, 255, 0.55)' : (palette.white as Hex) }}
          />
          {item.detail ? <TextWidget text={item.detail} maxLines={1} style={{ fontSize: 13, fontFamily: TEXT_MEDIUM, color: item.done ? 'rgba(245, 238, 255, 0.5)' : SOFT }} /> : null}
        </FlexWidget>
        {item.streak >= 2 ? <TextWidget text={`🔥 ${item.streak}`} style={{ fontSize: 13, fontFamily: TEXT_STRONG, color: WARM_TEXT }} /> : null}
      </FlexWidget>
    </FlexWidget>
  );
}

/**
 * Widget «Hoy»: con la estética de la órbita de la app (degradado cósmico, anillo luminoso).
 * Cada hábito es una tarjetita: casilla si se marca con un toque, anillo si es acumulativo
 * (se abre en la app). Lo que no cabe se abre en la app con «Ver N más».
 */
export function TodayWidget(props: TodayWidgetProps) {
  if (props.state === 'signedOut') {
    return <Message title="Nebula" body="Abre la app e inicia sesión para ver aquí tus hábitos de hoy." />;
  }
  const { items, done, today, width, height } = props;
  if (items.length === 0) {
    return <Message title="Nada para hoy" body="Toca para crear un hábito." uri="nebula://habito/nuevo" />;
  }
  const total = items.length;
  const best = Math.max(0, ...items.map((i) => i.streak));
  // Las filas se dibujan como elementos normales (no ListWidget): en algunos lanzadores, como el
  // de Xiaomi, la lista nativa se colocaba con otra escala y pisaba la cabecera. Caben las que
  // caben; el resto se abre con «Ver N más».
  const room = height - PAD * 2 - HEADER - GAP_TOP;
  const fitsAll = visibleRows(items, width, room) >= total;
  const shown = fitsAll ? total : Math.max(1, visibleRows(items, width, room - MORE));
  const hidden = total - shown;
  const sub = [dayLabel(today), best >= 2 ? `🔥 ${best}` : null].filter(Boolean).join(' · ');
  return (
    <CosmicShell pad={PAD}>
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'nebula://hoy' }} style={{ width: 'match_parent', height: HEADER, flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget style={{ flex: 1, flexDirection: 'column', flexGap: 2 }}>
          <TextWidget text={done === total ? '¡Todo hecho!' : 'Hoy'} style={{ fontSize: 24, fontFamily: DISPLAY, color: palette.white as Hex }} />
          <TextWidget text={sub} maxLines={1} style={{ fontSize: 13, fontFamily: TEXT_MEDIUM, color: '#E9DDFF' }} />
        </FlexWidget>
        <OverlapWidget style={{ width: RING, height: RING }}>
          <SvgWidget svg={ringSvg(RING, 5, done / total, { track: 'rgba(255,255,255,0.18)' })} style={{ width: RING, height: RING }} />
          <FlexWidget style={{ width: RING, height: RING, justifyContent: 'center', alignItems: 'center' }}>
            <TextWidget text={`${done}/${total}`} style={{ fontSize: 13, fontFamily: DISPLAY, color: palette.white as Hex }} />
          </FlexWidget>
        </OverlapWidget>
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', height: GAP_TOP }} />
      {items.slice(0, shown).map((item) => (
        <Row key={item.id} item={item} width={width} />
      ))}
      {hidden > 0 ? (
        <FlexWidget style={{ width: 'match_parent', flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
          <FlexWidget
            clickAction="OPEN_URI"
            clickActionData={{ uri: 'nebula://hoy' }}
            style={{ paddingHorizontal: 16, height: 26, borderRadius: 13, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.14)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.18)' }}
          >
            <TextWidget text={`Ver ${hidden} ${hidden === 1 ? 'hábito más' : 'hábitos más'}  →`} style={{ fontSize: 13, fontFamily: TEXT_STRONG, color: palette.white as Hex }} />
          </FlexWidget>
        </FlexWidget>
      ) : null}
    </CosmicShell>
  );
}
