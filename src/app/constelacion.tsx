import { useState } from 'react';
import { router } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { Screen } from '@/components/layout/Screen';
import { Text } from '@/components/primitives/Text';
import { Button } from '@/components/primitives/Button';
import { ProgressBar } from '@/components/progress/ProgressBar';
import { useGoalSummaries } from '@/features/goals/hooks';
import { colors, spacing } from '@/design/tokens';
import { SkeletonList } from '@/components/feedback/Skeleton';

export default function Constelacion() {
  const goals = useGoalSummaries(); const { width } = useWindowDimensions(); const [list, setList] = useState(false);
  const size = Math.max(260, Math.min(width - 60, 640));
  return <Screen title="Mapa de progreso" back={{ fallback: '/perfil' }}>
    <Text tone="secondary">Cada meta conecta las tareas y los hábitos que contribuyen a ella. El progreso viene de tus registros.</Text>
    <Button label={list ? 'Mostrar constelación' : 'Mostrar lista accesible'} variant="secondary" onPress={() => setList(!list)} />
    {goals.isLoading ? <SkeletonList rows={3} /> : null}
    {goals.error ? <Button label="Reintentar" onPress={() => void goals.refetch()} /> : null}
    {!goals.isLoading && !goals.error && !goals.summaries?.length ? <><Text tone="secondary">Tu mapa comenzará con tu primera meta.</Text><Button label="Crear meta" onPress={() => router.push('/meta/nueva')} /></> : null}
    {(goals.summaries ?? []).map(({ goal, progress, linkedTasks, linkedHabits }) => {
      const nodes = [...linkedTasks.map((t) => ({ id: t.id, name: t.title, kind: 'task', done: t.status === 'done' })), ...linkedHabits.map((h) => ({ id: h.id, name: h.name, kind: 'habit', done: false }))];
      return <View key={goal.id} style={{ gap: spacing[3] }}>
        <Button label={goal.title} variant="ghost" onPress={() => router.push({ pathname: '/meta/[id]', params: { id: goal.id } })} />
        <ProgressBar progress={progress.ratio ?? 0} />
        <Text>{progress.ratio === null ? 'Sin registros suficientes' : `${Math.round(progress.ratio * 100)} % de la meta`}</Text>
        {!list && nodes.length ? <Svg width={size} height={size} viewBox="0 0 400 400" accessibilityRole="image" accessibilityLabel={`${goal.title}: ${linkedTasks.length} tareas y ${linkedHabits.length} hábitos. Consulta la lista para ver los detalles.`}>
          {nodes.slice(0, 16).map((n, i, arr) => {
            const angle = 2 * Math.PI * i / arr.length; const x = 200 + Math.cos(angle) * 145; const y = 200 + Math.sin(angle) * 145;
            return <Line key={n.id} x1={200} y1={200} x2={x} y2={y} stroke={colors.borderStrong} strokeWidth={1.5} />;
          })}
          <Circle cx={200} cy={200} r={24} fill={colors.accent} /><SvgText x={200} y={245} fill={colors.text} fontSize={13} textAnchor="middle">{goal.title.slice(0, 24)}</SvgText>
          {nodes.slice(0, 16).map((n, i, arr) => {
            const angle = 2 * Math.PI * i / arr.length; const x = 200 + Math.cos(angle) * 145; const y = 200 + Math.sin(angle) * 145;
            return <Circle key={n.id} cx={x} cy={y} r={n.kind === 'habit' ? 9 : 6} fill={n.done ? colors.success : colors.accentSoft} onPress={() => router.push({ pathname: n.kind === 'habit' ? '/habito/[id]' : '/tarea/[id]', params: { id: n.id } })} />;
          })}
        </Svg> : null}
        {nodes.map((n) => <Button key={n.id} label={`${n.kind === 'habit' ? 'Hábito' : n.done ? 'Tarea completada' : 'Tarea'} · ${n.name}`} variant="secondary" onPress={() => router.push({ pathname: n.kind === 'habit' ? '/habito/[id]' : '/tarea/[id]', params: { id: n.id } })} />)}
      </View>;
    })}
  </Screen>;
}
