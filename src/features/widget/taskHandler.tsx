import type { WidgetTaskHandler } from 'react-native-android-widget';

import { queryClient } from '@/data/queryClient';
import { enqueueLog, flushPendingFor, removePendingLog } from '@/data/offline/runtime';
import { supabase } from '@/data/supabase';
import { applyToggle, toggleFor, widgetItems, type WidgetSnapshot } from '@/domain/widget/today';
import { uuid } from '@/lib/ids';

import { readWidgetSnapshot, writeWidgetSnapshot } from './snapshot';
import { TodayWidget, TOGGLE_ACTION } from './TodayWidget';

function view(s: WidgetSnapshot | null, width: number) {
  if (!s) return <TodayWidget state="signedOut" />;
  const r = widgetItems(s, new Date());
  return <TodayWidget state="ready" today={r.today} items={r.items} done={r.done} width={width} />;
}

/** Dibujo actual del widget a partir de la instantánea guardada. */
export async function renderTodayWidget(width: number) {
  return view(await readWidgetSnapshot(), width);
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
    renderWidget(view(snapshot, widgetInfo.width));
    return;
  }

  const habitId = typeof clickActionData?.habitId === 'string' ? clickActionData.habitId : null;
  const op = snapshot && habitId ? toggleFor(snapshot, habitId, new Date()) : null;
  const owner = !!snapshot && (await sameAccount(snapshot.uid));
  if (!snapshot || !owner || !op) {
    renderWidget(view(owner ? snapshot : null, widgetInfo.width));
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
  renderWidget(view(next, widgetInfo.width));

  // Sin red se queda en la cola; la app lo enviará al abrirse.
  await flushPendingFor(snapshot.uid).catch(() => undefined);
  void queryClient.invalidateQueries({ queryKey: ['habit_logs', snapshot.uid] });
};
