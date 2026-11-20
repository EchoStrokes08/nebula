import { FlexWidget, ListWidget, TextWidget } from 'react-native-android-widget';

import { palette, userColors, type UserColor } from '@/design/tokens';
import type { WidgetItem } from '@/domain/widget/today';

export const TODAY_WIDGET = 'Hoy';
export const TOGGLE_ACTION = 'TOGGLE_HABIT';

type Hex = `#${string}`;
const hex = (c: string): Hex => (c.startsWith('#') ? (c as Hex) : (userColors[c as UserColor] ?? palette.violet400) as Hex);
const PAD = 16;
// Fuentes de la app copiadas al APK por el plugin del widget (app.json → fonts).
const DISPLAY = 'Sora_700Bold';
const TEXT_MEDIUM = 'PlusJakartaSans_500Medium';
const TEXT_STRONG = 'PlusJakartaSans_600SemiBold';

export type TodayWidgetProps =
  | { state: 'signedOut' }
  | { state: 'ready'; today: string; items: WidgetItem[]; done: number; width: number };

const dayLabel = (day: string) => {
  try {
    return new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
  } catch {
    return day;
  }
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        padding: PAD,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(199, 169, 255, 0.18)',
        backgroundGradient: { from: '#1E1633', to: palette.space950 as Hex, orientation: 'TL_BR' },
      }}
    >
      {children}
    </FlexWidget>
  );
}

function Message({ title, body, uri }: { title: string; body: string; uri?: string }) {
  return (
    <Shell>
      <FlexWidget
        clickAction={uri ? 'OPEN_URI' : 'OPEN_APP'}
        clickActionData={uri ? { uri } : undefined}
        style={{ height: 'match_parent', width: 'match_parent', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flexGap: 4 }}
      >
        <TextWidget text={title} style={{ fontSize: 18, fontFamily: DISPLAY, color: palette.white as Hex, textAlign: 'center' }} />
        <TextWidget text={body} style={{ fontSize: 13, fontFamily: TEXT_MEDIUM, color: palette.mist as Hex, textAlign: 'center' }} />
      </FlexWidget>
    </Shell>
  );
}

function Row({ item }: { item: WidgetItem }) {
  const color = hex(item.color);
  const click = item.toggleable
    ? { clickAction: TOGGLE_ACTION, clickActionData: { habitId: item.id } }
    : { clickAction: 'OPEN_URI', clickActionData: { uri: `nebula://habito/${item.id}` } };
  return (
    <FlexWidget
      {...click}
      style={{ width: 'match_parent', height: 52, flexDirection: 'row', alignItems: 'center', flexGap: 12 }}
    >
      <FlexWidget
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 2,
          borderColor: color,
          backgroundColor: item.done ? color : 'rgba(0, 0, 0, 0)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {item.done ? (
          <TextWidget text="✓" style={{ fontSize: 15, fontFamily: TEXT_STRONG, color: palette.space950 as Hex }} />
        ) : item.toggleable ? null : (
          // Cantidad o duración: «+» indica que se registra en la app.
          <TextWidget text="+" style={{ fontSize: 17, fontFamily: TEXT_STRONG, color }} />
        )}
      </FlexWidget>
      <FlexWidget style={{ flex: 1, flexDirection: 'column', flexGap: 1 }}>
        <TextWidget
          text={item.name}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 15, fontFamily: TEXT_STRONG, color: (item.done ? palette.dusk : palette.white) as Hex }}
        />
        {item.detail ? <TextWidget text={item.detail} maxLines={1} style={{ fontSize: 12, fontFamily: TEXT_MEDIUM, color: palette.mist as Hex }} /> : null}
      </FlexWidget>
      {item.streak >= 2 ? <TextWidget text={`🔥 ${item.streak}`} style={{ fontSize: 13, fontFamily: TEXT_STRONG, color: palette.starlight as Hex }} /> : null}
    </FlexWidget>
  );
}

/** Widget «Hoy»: hábitos del día; un toque marca o desmarca, el resto abre el hábito. */
export function TodayWidget(props: TodayWidgetProps) {
  if (props.state === 'signedOut') {
    return <Message title="Nebula" body="Abre la app e inicia sesión para ver aquí tus hábitos de hoy." />;
  }
  const { items, done, today, width } = props;
  if (items.length === 0) {
    return <Message title="Nada para hoy" body="Toca para crear un hábito." uri="nebula://habito/nuevo" />;
  }
  const total = items.length;
  const barWidth = Math.max(0, width - PAD * 2);
  return (
    <Shell>
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'nebula://hoy' }} style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
          <TextWidget text={done === total ? '¡Todo hecho!' : 'Hoy'} style={{ fontSize: 20, fontFamily: DISPLAY, color: palette.white as Hex }} />
          <TextWidget text={dayLabel(today)} style={{ fontSize: 12, fontFamily: TEXT_MEDIUM, color: palette.starlight as Hex }} />
        </FlexWidget>
        <TextWidget text={`${done}/${total}`} style={{ fontSize: 18, fontFamily: DISPLAY, color: palette.lavender300 as Hex }} />
      </FlexWidget>
      <FlexWidget style={{ width: barWidth, height: 4, marginTop: 10, marginBottom: 6, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.08)', flexDirection: 'row' }}>
        <FlexWidget style={{ width: Math.round((barWidth * done) / total), height: 4, borderRadius: 2, backgroundColor: palette.violet400 as Hex }} />
      </FlexWidget>
      {/* La lista ocupa solo el espacio que queda: a pantalla completa tapaba la cabecera. */}
      <FlexWidget style={{ flex: 1, width: 'match_parent' }}>
        <ListWidget style={{ height: 'match_parent', width: 'match_parent' }}>
          {items.map((item) => (
            <Row key={item.id} item={item} />
          ))}
        </ListWidget>
      </FlexWidget>
    </Shell>
  );
}
