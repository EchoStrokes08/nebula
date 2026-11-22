import type { WidgetTaskHandler } from 'react-native-android-widget';

import { queryClient } from '@/data/queryClient';
import { enqueueLog, flushPendingFor, removePendingLog } from '@/data/offline/runtime';
import { supabase } from '@/data/supabase';
import { applyToggle, focusSuggestion, perfectDays, toggleFor, widgetHeatmap, widgetItems, widgetOrbits, type WidgetSnapshot } from '@/domain/widget/today';
import { uuid } from '@/lib/ids';

import { readWidgetSnapshot, writeWidgetSnapshot } from './snapshot';
import { FOCUS_WIDGET, FocusWidget, heatmapLayout, ORBIT_WIDGET, OrbitWidget, QUICK_WIDGET, QuickWidget, STREAK_MAP_WIDGET, StreakMapWidget } from './ExtraWidgets';
import { TodayWidget, TOGGLE_ACTION } from './TodayWidget';

export interface WidgetSize {
  widgetName: string;
  width: number;
  height: number;
}

/** Dibuja el widget pedido (por nombre) a partir de la instantánea. */
export function view(s: WidgetSnapshot | null, info: WidgetSize, now = new Date()) {
  const { width, height } = info;
  switch (info.widgetName) {
    case ORBIT_WIDGET: {
      const o = s ? widgetOrbits(s, now) : null;
      return <OrbitWidget data={o} width={width} height={height} />;
    }
    case STREAK_MAP_WIDGET: {
      if (!s) return <StreakMapWidget data={null} width={width} height={height} />;
      const h = widgetHeatmap(s, now, heatmapLayout(width, height).weeks);
      return <StreakMapWidget data={{ ...h, perfect: perfectDays(h.days, h.today), weekStartsOn: s.weekStartsOn }} width={width} height={height} />;
    }
    case FOCUS_WIDGET:
      return <FocusWidget data={s ? { suggestion: focusSuggestion(s, now) } : null} height={height} />;
    case QUICK_WIDGET:
      return <QuickWidget height={height} />;
    default: {
      if (!s) return <TodayWidget state="signedOut" />;
      const r = widgetItems(s, now);
      return <TodayWidget state="ready" today={r.today} items={r.items} done={r.done} width={width} height={height} />;
    }
  }
}

/** Dibujo actual de un widget a partir de la instantánea guardada. */
export async function renderWidget(info: WidgetSize) {
  return view(await readWidgetSnapshot(), info);
}

/** La sesión guardada sigue siendo de la cuenta de la instantánea (si no, no se escribe nada). */
async function sameAccount(uid: string): Promise<boolean> {
  try {
    if (!supabase) return false;
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id === uid;
  } catch {
    return false;
  }
}

/** Corre en segundo plano (headless JS) aunque la app esté cerrada. */
export const widgetTaskHandler: WidgetTaskHandler = async ({ widgetAction, widgetInfo, clickAction, clickActionData, renderWidget }) => {
  if (widgetAction === 'WIDGET_DELETED') return;
  const snapshot = await readWidgetSnapshot();

  if (widgetAction !== 'WIDGET_CLICK' || clickAction !== TOGGLE_ACTION) {
    renderWidget(view(snapshot, widgetInfo));
    return;
  }

  const habitId = typeof clickActionData?.habitId === 'string' ? clickActionData.habitId : null;
  const op = snapshot && habitId ? toggleFor(snapshot, habitId, new Date()) : null;
  const owner = !!snapshot && (await sameAccount(snapshot.uid));
  if (!snapshot || !owner || !op) {
    renderWidget(view(owner ? snapshot : null, widgetInfo));
    return;
  }

  // Igual que en la app: se guarda primero en la cola duradera y luego se envía.
  const clientId = uuid();
  if (op.op === 'insert') {
    await enqueueLog(snapshot.uid, { clientId, habitId: op.habitId, dayKey: op.dayKey, value: op.value, tz: snapshot.tz });
  } else {
    for (const id of op.ids) await removePendingLog(snapshot.uid, id);
  }
  const next = applyToggle(snapshot, op, clientId);
  await writeWidgetSnapshot(next);
  renderWidget(view(next, widgetInfo));

  // Sin red se queda en la cola; la app lo enviará al abrirse.
  await flushPendingFor(snapshot.uid).catch(() => undefined);
  void queryClient.invalidateQueries({ queryKey: ['habit_logs', snapshot.uid] });
};
