import { Platform } from 'react-native';
import { registerWidgetTaskHandler, requestWidgetUpdate } from 'react-native-android-widget';

import { FOCUS_WIDGET, ORBIT_WIDGET, QUICK_WIDGET, STREAK_MAP_WIDGET } from '@/features/widget/ExtraWidgets';
import { renderWidget, widgetTaskHandler } from '@/features/widget/taskHandler';
import { TODAY_WIDGET } from '@/features/widget/TodayWidget';

/** Los que dependen de los datos (la barra de accesos no cambia nunca). */
const DATA_WIDGETS = [TODAY_WIDGET, ORBIT_WIDGET, STREAK_MAP_WIDGET, FOCUS_WIDGET];
export const ALL_WIDGETS = [...DATA_WIDGETS, QUICK_WIDGET];

/** Se llama una vez al cargar el bundle (también en segundo plano, sin interfaz). */
export function registerWidgets(): void {
  if (Platform.OS === 'android') registerWidgetTaskHandler(widgetTaskHandler);
}

/** Redibuja los widgets de Nebula colocados en la pantalla de inicio (si no hay ninguno, no hace nada). */
export async function refreshTodayWidget(): Promise<void> {
  if (Platform.OS !== 'android') return;
  for (const widgetName of DATA_WIDGETS) {
    await requestWidgetUpdate({ widgetName, renderWidget: (info) => renderWidget(info) }).catch(() => undefined);
  }
}
