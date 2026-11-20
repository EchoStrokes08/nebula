import { router } from 'expo-router';
import { CalendarClock, Check, MoveRight } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/primitives/Button';
import { Text } from '@/components/primitives/Text';
import { colors, radius, spacing } from '@/design/tokens';
import { localMinutes } from '@/domain/calendar/expand';
import { carryOverTasks, reorganizeFrom, type AssistantCommand } from '@/domain/assistant/commands';
import { useTimeZone, useToday } from '@/features/habits/useToday';
import { updateTask } from '@/features/tasks/api';
import { useTasks } from '@/features/tasks/hooks';
import { queryClient } from '@/data/queryClient';
import { addDays, dayKeyOf } from '@/lib/dates';
import { hhmm } from '@/lib/time';

/** Respuesta local a una orden del asistente: muestra qué hará y lo aplica solo con un toque. */
export function CommandCard({ command }: { command: AssistantCommand }) {
  return command.kind === 'carry_over' ? <CarryOver /> : <Reorganize command={command} />;
}

function CarryOver() {
  const today = useToday();
  const tz = useTimeZone();
  const tasks = useTasks();
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [moved, setMoved] = useState(0);
  const list = carryOverTasks(
    (tasks.data ?? []).map((t) => ({ ...t, scheduledDay: t.scheduledStart ? dayKeyOf(new Date(t.scheduledStart), tz) : null })),
    today,
  );
  const tomorrow = addDays(today, 1);

  const apply = async () => {
    setState('working');
    try {
      // Se quita el bloque horario de hoy: mañana se planifica de nuevo con los huecos reales.
      for (const t of list) await updateTask(t.id, { dueDate: tomorrow, scheduledStart: null, scheduledEnd: null });
      setMoved(list.length);
      setState('done');
      await queryClient.invalidateQueries();
    } catch {
      setState('error');
    }
  };

  if (tasks.isLoading) return null;
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <MoveRight size={16} color={colors.accentSoft} />
        <Text variant="bodyStrong">{state === 'done' ? `Listo: ${moved} ${moved === 1 ? 'tarea pasa' : 'tareas pasan'} a mañana` : list.length ? `Pasar ${list.length} ${list.length === 1 ? 'tarea' : 'tareas'} a mañana` : 'No te quedó nada pendiente hoy'}</Text>
      </View>
      {state !== 'done' ? list.slice(0, 8).map((t) => <Text key={t.id} variant="callout" tone="secondary">· {t.title}</Text>) : null}
      {list.length > 8 && state !== 'done' ? <Text variant="caption" tone="tertiary">y {list.length - 8} más</Text> : null}
      {state === 'error' ? <Text variant="caption" tone="danger">No se pudieron mover todas. Revisa la conexión y reintenta.</Text> : null}
      {state === 'done' ? (
        <Button label="Planificar mañana" variant="secondary" icon={<CalendarClock size={16} color={colors.text} />} onPress={() => router.push({ pathname: '/planificar', params: { dia: tomorrow } })} />
      ) : list.length ? (
        <Button label={state === 'error' ? 'Reintentar' : 'Pasar a mañana'} icon={<Check size={16} color={colors.textOnAccent} />} loading={state === 'working'} onPress={() => void apply()} />
      ) : null}
    </View>
  );
}

function Reorganize({ command }: { command: Extract<AssistantCommand, { kind: 'reorganize' }> }) {
  const tz = useTimeZone();
  const from = reorganizeFrom(command, localMinutes(new Date(), tz));
  const late = from >= 22 * 60;
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <CalendarClock size={16} color={colors.accentSoft} />
        <Text variant="bodyStrong">{late ? 'Ya es tarde para reorganizar hoy' : `Tu ${command.from === 'tarde' ? 'tarde' : 'día'} desde las ${hhmm(from)}`}</Text>
      </View>
      <Text variant="callout" tone="secondary">
        {late ? 'Mejor pasa lo pendiente a mañana y descansa.' : 'Coloco tus tareas abiertas en los huecos libres, con descansos y respetando tus eventos. Lo revisas y lo aceptas en un toque.'}
      </Text>
      {late ? null : <Button label="Ver la propuesta" onPress={() => router.push({ pathname: '/planificar', params: { desde: hhmm(from) } })} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing[3], padding: spacing[5], borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
});
