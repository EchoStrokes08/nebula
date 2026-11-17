import { router } from 'expo-router';
import { ChevronDown, ChevronUp, ListChecks, Search } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Chip } from '@/components/forms/Chip';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, spacing } from '@/design/tokens';
import { analyzeDag } from '@/domain/tasks/dag';
import { filterTasks, groupTasks, moveOrder, type GroupBy } from '@/domain/tasks/listing';
import { useGoals } from '@/features/goals/hooks';
import { useToday } from '@/features/habits/useToday';

import { updateTask } from './api';
import { useTaskMutation, useTasks } from './hooks';
import { TaskRow } from './TaskRow';
import { SkeletonList } from '@/components/feedback/Skeleton';

const GROUPS: { v: GroupBy; l: string }[] = [
  { v: 'fecha', l: 'Fecha' },
  { v: 'prioridad', l: 'Prioridad' },
  { v: 'meta', l: 'Meta' },
  { v: 'etiqueta', l: 'Etiqueta' },
  { v: 'manual', l: 'Mi orden' },
];

export function TaskListView() {
  const today = useToday();
  const tasks = useTasks();
  const goals = useGoals();
  const [view, setView] = useState<'pendientes' | 'completadas'>('pendientes');
  const [group, setGroup] = useState<GroupBy>('fecha');
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const reorder = useTaskMutation((v: { id: string; sortOrder: number }) => updateTask(v.id, { sortOrder: v.sortOrder }));

  if (tasks.isLoading) return <SkeletonList rows={3} />;
  if (tasks.error) {
    return <EmptyState title="No se pudieron cargar tus tareas" description="Comprueba la conexión." action={<Button label="Reintentar" variant="secondary" onPress={() => tasks.refetch()} />} />;
  }
  const all = tasks.data ?? [];
  if (all.length === 0) {
    return (
      <EmptyState
        icon={<ListChecks size={28} color={colors.accentSoft} strokeWidth={1.6} />}
        title="Sin tareas todavía"
        description="Apunta lo que tienes pendiente. Nebula te ayudará a ordenarlo."
        action={<Button label="Crear una tarea" onPress={() => router.push('/tarea/nueva')} />}
      />
    );
  }

  const dag = analyzeDag(all.map((t) => ({ id: t.id, done: t.status === 'done' || t.status === 'cancelled' })), all.flatMap((t) => t.dependsOn.map((d) => ({ taskId: t.id, dependsOn: d }))));
  const tagNames = [...new Set(all.flatMap((t) => t.tags.map((x) => x.name)))].sort();
  const goalTitles = Object.fromEntries((goals.data ?? []).map((g) => [g.id, g.title]));
  const filtered = filterTasks(all, { view, search, tag });
  const sections = view === 'completadas' ? [{ key: 'done', title: 'Completadas', tone: 'default' as const, items: [...filtered].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')) }] : groupTasks(filtered, group, today, goalTitles);

  return (
    <View style={styles.root}>
      <View style={styles.searchRow}>
        <Search size={18} color={colors.textTertiary} />
        <View style={styles.flex}>
          <TextField label="Buscar tareas" value={search} onChangeText={setSearch} placeholder="Título, nota o etiqueta" autoCapitalize="none" />
        </View>
      </View>
      <View style={styles.wrap}>
        <Chip role="radio" label="Pendientes" selected={view === 'pendientes'} onToggle={() => setView('pendientes')} />
        <Chip role="radio" label="Completadas" selected={view === 'completadas'} onToggle={() => setView('completadas')} />
      </View>
      {view === 'pendientes' ? (
        <View style={styles.wrap} accessibilityLabel="Agrupar por">
          {GROUPS.map((g) => (
            <Chip key={g.v} role="radio" label={g.l} selected={group === g.v} onToggle={() => setGroup(g.v)} />
          ))}
        </View>
      ) : null}
      {tagNames.length ? (
        <View style={styles.wrap} accessibilityLabel="Filtrar por etiqueta">
          {tagNames.map((n) => (
            <Chip key={n} label={`#${n}`} selected={tag === n} onToggle={() => setTag(tag === n ? null : n)} />
          ))}
        </View>
      ) : null}
      {filtered.length === 0 ? (
        <Text tone="secondary">{search || tag ? 'Nada coincide con la búsqueda.' : view === 'pendientes' ? 'No tienes tareas pendientes.' : 'Aún no has completado tareas.'}</Text>
      ) : (
        sections.map((s) => (
          <View key={s.key} style={styles.section}>
            <Text variant="overline" tone={s.tone === 'danger' ? 'danger' : s.tone === 'warning' ? 'warning' : 'secondary'}>
              {s.title.toUpperCase()} · {s.items.length}
            </Text>
            {s.items.map((t) =>
              group === 'manual' && view === 'pendientes' ? (
                <View key={t.id} style={styles.manualRow}>
                  <View style={styles.flex}>
                    <TaskRow task={t} today={today} blocked={dag.blocked.has(t.id)} />
                  </View>
                  <View style={styles.moveCol}>
                    {([-1, 1] as const).map((dir) => {
                      const next = moveOrder(s.items, t.id, dir);
                      const Icon = dir === -1 ? ChevronUp : ChevronDown;
                      return (
                        <Pressable
                          key={dir}
                          disabled={next === null}
                          onPress={() => next !== null && reorder.mutate({ id: t.id, sortOrder: next })}
                          accessibilityRole="button"
                          accessibilityLabel={`${dir === -1 ? 'Subir' : 'Bajar'} ${t.title}`}
                          accessibilityState={{ disabled: next === null }}
                          style={[styles.moveBtn, next === null && styles.moveDisabled]}
                        >
                          <Icon size={18} color={colors.textSecondary} />
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : (
                <TaskRow key={`${s.key}-${t.id}`} task={t} today={today} blocked={dag.blocked.has(t.id)} />
              ),
            )}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing[4] },
  searchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] },
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  section: { gap: spacing[2] },
  manualRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  moveCol: { gap: 2 },
  moveBtn: { width: 36, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  moveDisabled: { opacity: 0.3 },
});
