import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { dehydrate, focusManager, hydrate, onlineManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';

import { queryClient } from '@/data/queryClient';
import { supabase } from '@/data/supabase';
import { isolateFocusForUser } from '@/features/focus/store';
import { notifications } from '@/platform/notifications';
import { insertLog, deleteLogByAnyId } from '@/features/habits/api';
import type { DayKey } from '@/lib/dates';

import { LogQueue, type PendingLog } from './queue';

export const useConnection = create<{ online: boolean; pending: number; error: string | null }>(() => ({ online: true, pending: 0, error: null }));
let currentUser: string | null = null;
const queues = new Map<string, LogQueue>();
const key = (uid: string) => `nebula-cache-v1-${uid}`;
function queue(uid: string) {
  if (!queues.has(uid)) queues.set(uid, new LogQueue(AsyncStorage, `nebula-logs-v1-${uid}`));
  return queues.get(uid)!;
}
export async function pendingLogs(uid: string) { return queue(uid).list(); }
export async function purgeOfflineAccount(uid: string) {
  if (currentUser === uid) currentUser = null;
  await queue(uid).clear();
  await AsyncStorage.removeItem(key(uid));
  useConnection.setState({ pending: 0, error: null });
}
export async function discardPendingLog(uid: string, id: string) {
  await queue(uid).remove(id);
  useConnection.setState({ pending: (await queue(uid).list()).length, error: null });
  await queryClient.invalidateQueries({ queryKey: ['habit_logs', uid] });
}
export async function enqueueLog(uid: string, log: PendingLog) {
  await queue(uid).add(log);
  useConnection.setState({ pending: (await queue(uid).list()).length });
  if (onlineManager.isOnline()) void syncPendingLogs();
}
export async function removePendingLog(uid: string, id: string) {
  await queue(uid).remove(id);
  await queue(uid).add({ op: 'delete', clientId: id, habitId: '', dayKey: '', value: 0, tz: 'UTC' });
  useConnection.setState({ pending: (await queue(uid).list()).length });
  if (onlineManager.isOnline()) void syncPendingLogs();
}
let syncing: Promise<void> | null = null;
export function syncPendingLogs(): Promise<void> {
  if (syncing) return syncing;
  const uid = currentUser;
  if (!uid || !onlineManager.isOnline()) return Promise.resolve();
  syncing = (async () => {
    try {
      await queue(uid).flush(async (log) => {
        // Verifica también la sesión, por si cambió durante una llamada anterior.
        const { data } = await supabase!.auth.getSession();
        if (data.session?.user.id !== uid) throw new Error('La sesión ha cambiado.');
        if (log.op === 'delete') await deleteLogByAnyId(log.clientId);
        else await insertLog({ ...log, dayKey: log.dayKey as DayKey });
      }, () => currentUser === uid && onlineManager.isOnline());
      if (currentUser === uid) {
        useConnection.setState({ pending: (await queue(uid).list()).length, error: null });
        await queryClient.invalidateQueries({ queryKey: ['habit_logs', uid] });
      }
    } catch (e) {
      if (currentUser === uid) useConnection.setState({ error: e instanceof Error ? e.message : 'No se pudo sincronizar. Tus registros siguen guardados.' });
    } finally { syncing = null; }
  })();
  return syncing;
}
const CACHED = new Set(['profile', 'preferences', 'habits', 'habit_logs', 'tasks', 'goals', 'events', 'availability', 'journal']);
/** No se persisten tokens ni datos sociales. Cada cuenta tiene su propio espacio. */
export function startOfflineRuntime() {
  let disposed = false;
  let generation = 0;
  let unsubscribeCache = () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const switchUser = async (uid: string | null) => {
    if (uid === currentUser) return;
    const previous = currentUser;
    currentUser = uid;
    isolateFocusForUser(uid);
    if (previous) void notifications.cancelPrefix('nebula-').catch(() => {});
    const ownGeneration = ++generation;
    clearTimeout(timer);
    unsubscribeCache();
    if (previous) queryClient.clear();
    useConnection.setState({ pending: 0, error: null });
    // Al cerrar sesión se borra la caché; la cola duradera permanece aislada para no perder registros.
    if (previous) await AsyncStorage.removeItem(key(previous)).catch(() => {});
    if (!uid) return;
    try {
      const raw = await AsyncStorage.getItem(key(uid));
      if (disposed || generation !== ownGeneration) return;
      if (raw) {
        const saved = JSON.parse(raw);
        if (Date.now() - saved.at < 7 * 86400000) hydrate(queryClient, saved.state);
      }
      useConnection.setState({ pending: (await queue(uid).list()).length });
    } catch { /* Caché corrupta: las consultas recuperan desde servidor. */ }
    if (disposed || generation !== ownGeneration) return;
    unsubscribeCache = queryClient.getQueryCache().subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (currentUser !== uid) return;
        const state = dehydrate(queryClient, { shouldDehydrateMutation: () => false, shouldDehydrateQuery: (q) => q.state.status === 'success' && CACHED.has(String(q.queryKey[0])) && q.queryKey[1] === uid });
        void AsyncStorage.setItem(key(uid), JSON.stringify({ at: Date.now(), state })).catch(() => {});
      }, 400);
    });
    void syncPendingLogs();
  };
  // En web NetInfo comprueba internet con `HEAD /`, que en GitHub Pages (servida en /nebula/) da 404
  // y marcaba «Sin conexión» con internet. Allí basta `navigator.onLine` (isConnected); si Supabase
  // no responde, ya lo dicen los errores de cada consulta.
  if (Platform.OS === 'web') NetInfo.configure({ reachabilityShouldRun: () => false });
  const net = NetInfo.addEventListener((state) => {
    const online = state.isConnected !== false && (Platform.OS === 'web' || state.isInternetReachable !== false);
    onlineManager.setOnline(online);
    useConnection.setState({ online });
    if (online) void syncPendingLogs();
  });
  const focus = AppState.addEventListener('change', (state) => {
    if (Platform.OS !== 'web') focusManager.setFocused(state === 'active');
    if (state === 'active') void syncPendingLogs();
  });
  const auth = supabase?.auth.onAuthStateChange((_event, session) => { void switchUser(session?.user.id ?? null); });
  return () => {
    disposed = true;
    generation++;
    clearTimeout(timer);
    unsubscribeCache(); net(); focus.remove(); auth?.data.subscription.unsubscribe();
    currentUser = null;
  };
}
