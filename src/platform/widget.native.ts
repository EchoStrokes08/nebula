import { Platform } from 'react-native';
import { registerWidgetTaskHandler, requestWidgetUpdate } from 'react-native-android-widget';

import { renderTodayWidget, widgetTaskHandler } from '@/features/widget/taskHandler';
import { TODAY_WIDGET } from '@/features/widget/TodayWidget';

/** Se llama una vez al cargar el bundle (también en segundo plano, sin interfaz). */
export function registerWidgets(): void {
  if (Platform.OS === 'android') registerWidgetTaskHandler(widgetTaskHandler);
}

/** Redibuja los widgets «Hoy» colocados en la pantalla de inicio (si no hay ninguno, no hace nada). */
export async function refreshTodayWidget(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await requestWidgetUpdate({ widgetName: TODAY_WIDGET, renderWidget: (info) => renderTodayWidget(info.width) }).catch(() => undefined);
}
