import AsyncStorage from '@react-native-async-storage/async-storage';

import type { WidgetSnapshot } from '@/domain/widget/today';

/** Instantánea para el widget de Android. No contiene tokens: solo hábitos y registros propios. */
const KEY = 'nebula-widget-v1';

export async function readWidgetSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const s = raw ? (JSON.parse(raw) as WidgetSnapshot) : null;
    return s && s.v === 1 && typeof s.uid === 'string' && Array.isArray(s.habits) && Array.isArray(s.logs) ? s : null;
  } catch {
    return null;
  }
}

export async function writeWidgetSnapshot(s: WidgetSnapshot): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => undefined);
}

export async function clearWidgetSnapshot(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
}
