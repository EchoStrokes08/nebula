import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { db, unwrap } from '@/data/db';

const TABLES = [
  'profiles',
  'user_preferences',
  'habits',
  'habit_targets',
  'habit_logs',
  'habit_pauses',
  'tasks',
  'subtasks',
  'tags',
  'task_tags',
  'task_dependencies',
  'task_history',
  'goals',
  'milestones',
  'goal_progress_events',
  'calendar_events',
  'availability_windows',
  'focus_sessions',
  'distraction_logs',
  'notifications',
  'journal_entries',
  'integrations',
  'notes',
  'motivation_phrases',
] as const;

/** Exporta todos tus datos (lo que RLS te permite leer, que es solo lo tuyo) a un JSON. */
export async function exportMyData(): Promise<void> {
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), app: 'Nebula' };
  for (const t of TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += 500) {
      const order = t === 'user_preferences' ? 'user_id' : t === 'task_tags' || t === 'task_dependencies' ? 'task_id' : 'id';
      let query = db().from(t).select('*').order(order);
      if (t === 'task_tags') query = query.order('tag_id');
      if (t === 'task_dependencies') query = query.order('depends_on');
      const page = unwrap(await query.range(from, from + 499));
      rows.push(...(page ?? []));
      if (!page || page.length < 500) break;
    }
    out[t] = rows;
  }
  const json = JSON.stringify(out, null, 2);
  const name = `nebula-datos-${new Date().toISOString().slice(0, 10)}.json`;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const path = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.writeAsStringAsync(path, json);
  await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Exportar mis datos de Nebula' });
}
