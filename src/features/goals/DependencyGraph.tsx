import { router } from 'expo-router';
import { Check, Lock } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import type { DagAnalysis } from '@/domain/tasks/dag';
import type { Task } from '@/features/tasks/api';

const NODE_W = 196;
const NODE_H = 72;
const COL_GAP = 56;
const ROW_GAP = 16;

/**
 * Proyecto como grafo por niveles (izquierda → derecha): prerrequisitos a la izquierda.
 * Bloqueadas en ámbar, listas en violeta, hechas en verde; la ruta crítica con línea más gruesa.
 * Debajo se ofrece la misma información como lista ordenada (alternativa accesible).
 */
export function DependencyGraph({ tasks, dag }: { tasks: Task[]; dag: DagAnalysis }) {
  const byLevel = new Map<number, Task[]>();
  for (const id of dag.order) {
    const t = tasks.find((x) => x.id === id);
    if (!t) continue;
    const lv = dag.level.get(id) ?? 0;
    byLevel.set(lv, [...(byLevel.get(lv) ?? []), t]);
  }
  const levels = [...byLevel.keys()].sort((a, b) => a - b);
  const pos = new Map<string, { x: number; y: number }>();
  levels.forEach((lv, col) => byLevel.get(lv)!.forEach((t, row) => pos.set(t.id, { x: col * (NODE_W + COL_GAP), y: row * (NODE_H + ROW_GAP) })));
  const width = levels.length * (NODE_W + COL_GAP) - COL_GAP;
  const height = Math.max(...[...byLevel.values()].map((l) => l.length)) * (NODE_H + ROW_GAP) - ROW_GAP;
  const critical = new Set(dag.criticalPath.map((id, i) => `${dag.criticalPath[i - 1]}>${id}`));

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.scroll} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ width, height }}>
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          {tasks.flatMap((t) =>
            t.dependsOn
              .filter((d) => pos.has(d) && pos.has(t.id))
              .map((d) => {
                const a = pos.get(d)!;
                const b = pos.get(t.id)!;
                const x1 = a.x + NODE_W;
                const y1 = a.y + NODE_H / 2;
                const x2 = b.x;
                const y2 = b.y + NODE_H / 2;
                const mid = (x1 + x2) / 2;
                const isCritical = critical.has(`${d}>${t.id}`);
                return (
                  <Path
                    key={`${d}-${t.id}`}
                    d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                    stroke={isCritical ? colors.accentBright : colors.borderStrong}
                    strokeWidth={isCritical ? 2.5 : 1.5}
                    fill="none"
                  />
                );
              }),
          )}
        </Svg>
        {tasks.map((t) => {
          const p = pos.get(t.id);
          if (!p) return null;
          const done = t.status === 'done';
          const blocked = dag.blocked.has(t.id);
          const border = done ? colors.success : blocked ? colors.warning : colors.accentBright;
          return (
            <Pressable
              key={t.id}
              onPress={() => router.push({ pathname: '/tarea/[id]', params: { id: t.id } })}
              style={[styles.node, { left: p.x, top: p.y, borderColor: border }]}
            >
              <View style={styles.nodeHead}>
                {done ? <Check size={14} color={colors.success} /> : blocked ? <Lock size={14} color={colors.warning} /> : <View style={styles.readyDot} />}
                <Text variant="caption" tone={done ? 'success' : blocked ? 'warning' : 'accent'}>
                  {done ? 'Hecha' : blocked ? 'Bloqueada' : 'Lista'}
                </Text>
              </View>
              <Text variant="callout" numberOfLines={2} style={done && styles.done}>
                {t.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: spacing[2] },
  node: { position: 'absolute', width: NODE_W, height: NODE_H, padding: spacing[3], gap: 2, borderRadius: radius.md, borderWidth: 1.5, backgroundColor: colors.surfaceRaised },
  nodeHead: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  readyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentBright },
  done: { color: colors.textSecondary },
});
